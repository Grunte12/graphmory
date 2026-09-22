#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"
import { managedRecall } from "../src/decision-recall.mjs"
import { loadVaultDocuments } from "../src/memory-recall.mjs"
import { scoreRun, scoreRunGroups, summarizeRuns } from "../src/retrieval.mjs"
import { loadRuntimeConfig } from "../src/runtime-config.mjs"

const args = process.argv.slice(2)
const option = (name, fallback = "") => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] ?? fallback : fallback
}
const vault = option("--vault")
const queryFile = option("--queries")
const configFile = option("--config")
const outputFile = option("--json")
const k = Number(option("--k", "3"))
if (!vault || !queryFile || !Number.isInteger(k) || k < 1 || k > 10) {
  console.error("Usage: node scripts/eval-managed-recall.mjs --vault <path> --queries <json> [--config runtime.json] [--k 3] [--json report.json]")
  process.exit(2)
}

const allQueries = JSON.parse(fs.readFileSync(queryFile, "utf8"))
if (!Array.isArray(allQueries) || !allQueries.length) throw new Error("query set must be a non-empty array")
const perCategory = Number(option("--per-category", "0"))
if (!Number.isInteger(perCategory) || perCategory < 0) throw new Error("--per-category must be a nonnegative integer")
const categoryCounts = new Map()
const queries = perCategory === 0 ? allQueries : allQueries.filter((item) => {
  const category = item.category ?? "unclassified"
  const count = categoryCounts.get(category) ?? 0
  categoryCounts.set(category, count + 1)
  return count < perCategory
})
const documents = loadVaultDocuments(vault)
const paths = new Set(documents.map((document) => document.id))
const config = loadRuntimeConfig(configFile || undefined)
const runs = []
for (const item of queries) {
  const groups = item.relevant_groups
  const gold = Array.isArray(groups) ? groups.flat() : item.relevant
  if (!item.id || !item.query || !Array.isArray(gold) || !gold.length) throw new Error(`Invalid query: ${item.id ?? "missing-id"}`)
  const missing = gold.filter((candidate) => !paths.has(candidate))
  if (missing.length) throw new Error(`Gold paths are missing from vault for ${item.id}: ${missing.length}`)
  const start = performance.now()
  const response = await managedRecall(vault, item.query, config, { k, scope: item.scope ?? "" })
  const elapsedMs = performance.now() - start
  const results = response.results.map((result) => ({ id: result.path, ...result }))
  const metrics = Array.isArray(groups) ? scoreRunGroups(results, groups, k) : scoreRun(results, gold, k)
  runs.push({ id: item.id, category: item.category ?? "unclassified", metrics, elapsedMs,
    retrieved: results.map((result) => result.id), decisionGate: response.decisionGate ?? null,
    candidateCount: response.candidateCount ?? null })
}
const summary = summarizeRuns(runs)
const latencies = runs.map((run) => run.elapsedMs).sort((a, b) => a - b)
const report = {
  vault: "[private]", querySet: path.basename(queryFile), sampling: perCategory ? `first-${perCategory}-per-category` : "all",
  documents: documents.length, queries: runs.length,
  workflow: config.workflow, model: config.workflow === "curator" ? null : config.decision.model, k,
  summary: { ...summary, averageMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    p95Ms: latencies[Math.ceil(latencies.length * .95) - 1],
    abstentions: runs.filter((run) => run.decisionGate === "abstain").length },
  misses: runs.filter((run) => run.metrics.hit === 0).map((run) => run.id), runs,
}
console.log(`${config.workflow}: ${documents.length} notes, ${runs.length} questions, k=${k}`)
console.log(`Hit@k ${(summary.hitAtK * 100).toFixed(1)}%; Recall@k ${(summary.recallAtK * 100).toFixed(1)}%; MRR ${summary.mrr.toFixed(3)}; nDCG ${summary.ndcgAtK.toFixed(3)}`)
console.log(`Mean ${report.summary.averageMs.toFixed(1)} ms; p95 ${report.summary.p95Ms.toFixed(1)} ms; misses ${report.misses.length}; abstentions ${report.summary.abstentions}`)
if (outputFile) {
  const target = path.resolve(outputFile)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`Report: ${target}`)
}
