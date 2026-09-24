#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"
import { recallVaultAdaptive } from "../src/adaptive-recall.mjs"
import { filterByScope, fuseRankedLanes, loadVaultDocuments } from "../src/memory-recall.mjs"
import { governedRank, scoreRun, scoreRunGroups, summarizeRuns } from "../src/retrieval.mjs"

const args = process.argv.slice(2)
const option = (flag) => args[args.indexOf(flag) + 1]
if (!args.includes("--vault") || !args.includes("--queries")) {
  console.error("Usage: node scripts/eval-adaptive-graph.mjs --vault <path> --queries <json> [--json <report.json>]")
  process.exit(2)
}
const vault = path.resolve(option("--vault"))
const queries = JSON.parse(fs.readFileSync(option("--queries"), "utf8"))
const documents = loadVaultDocuments(vault)
const paths = new Set(documents.map((document) => document.id))
const goldPath = (id) => paths.has(id) ? id : paths.has(`${id}.md`) ? `${id}.md` : id
const runs = { baseline: [], graph: [] }
for (const item of queries) {
  const startBaseline = performance.now()
  const scoped = filterByScope(loadVaultDocuments(vault), item.scope ?? "")
  const baseline = fuseRankedLanes(["bm25", "bm25f-focused-sections"].map((method) => ({
    method, results: governedRank(scoped, item.query, method).results.slice(0, 12),
  }))).slice(0, 12)
  const baselineMs = performance.now() - startBaseline
  const startGraph = performance.now()
  const graph = await recallVaultAdaptive(vault, item.query, { scope: item.scope ?? "", graphPolicy: "auto", maxCandidates: 12, maxRounds: 2 })
  const graphMs = performance.now() - startGraph
  const groups = Array.isArray(item.relevant_groups) ? item.relevant_groups.map((group) => group.map(goldPath)) : null
  const gold = Array.isArray(groups) ? groups.flat() : item.relevant.map(goldPath)
  for (const [arm, results, elapsedMs] of [["baseline", baseline.map((entry) => ({ id: entry.id })), baselineMs],
    ["graph", graph.candidatePool.map((id) => ({ id })), graphMs]]) {
    const answerable = gold.length > 0
    const top3 = !answerable ? null : Array.isArray(groups) ? scoreRunGroups(results, groups, 3) : scoreRun(results, gold, 3)
    const at12 = !answerable ? null : Array.isArray(groups) ? scoreRunGroups(results, groups, 12) : scoreRun(results, gold, 12)
    const complete = (n) => Array.isArray(groups)
      ? groups.every((group) => results.slice(0, n).some((entry) => group.includes(entry.id)))
      : results.slice(0, n).some((entry) => gold.includes(entry.id))
    runs[arm].push({ id: item.id, category: item.category, top3, at12, elapsedMs,
      completeAt3: answerable && complete(3), completeAt12: answerable && complete(12),
      retrieved: results.slice(0, 12).map((entry) => entry.id) })
  }
}
const summarize = (arm) => {
  const answerable = runs[arm].filter((run) => run.top3)
  const noAnswer = runs[arm].filter((run) => !run.top3)
  const top3 = summarizeRuns(answerable.map((run) => ({ metrics: run.top3 })))
  const at12 = summarizeRuns(answerable.map((run) => ({ metrics: run.at12 })))
  const timings = runs[arm].map((run) => run.elapsedMs).sort((a, b) => a - b)
  return { hitAt3: top3.hitAtK, recallAt3: top3.recallAtK, hitAt12: at12.hitAtK, recallAt12: at12.recallAtK,
    completeAt3: answerable.filter((run) => run.completeAt3).length / answerable.length,
    completeAt12: answerable.filter((run) => run.completeAt12).length / answerable.length,
    noAnswerWithCandidates: noAnswer.filter((run) => run.retrieved.length > 0).length,
    noAnswerCases: noAnswer.length,
    meanMs: timings.reduce((a, b) => a + b, 0) / timings.length, p95Ms: timings[Math.ceil(timings.length * .95) - 1],
    missesAt12: answerable.filter((run) => run.at12.hit === 0).map((run) => run.id) }
}
const report = { suite: "adaptive-graph", notes: documents.length, questions: queries.length, candidateCap: 12,
  baseline: summarize("baseline"), graph: summarize("graph"), runs }
for (const arm of ["baseline", "graph"]) {
  const value = report[arm]
  console.log(`${arm}: Hit@3 ${(value.hitAt3 * 100).toFixed(1)}%, complete@3 ${(value.completeAt3 * 100).toFixed(1)}%, Recall@3 ${(value.recallAt3 * 100).toFixed(1)}%, Hit@12 ${(value.hitAt12 * 100).toFixed(1)}%, no-answer candidates ${value.noAnswerWithCandidates}/${value.noAnswerCases}, mean ${value.meanMs.toFixed(1)} ms, p95 ${value.p95Ms.toFixed(1)} ms`)
}
if (args.includes("--json")) fs.writeFileSync(path.resolve(option("--json")), `${JSON.stringify(report, null, 2)}\n`)
