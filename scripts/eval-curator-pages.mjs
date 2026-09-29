#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"
import { loadVaultDocuments, fuseRankedLanes } from "../src/memory-recall.mjs"
import { governedRank } from "../src/retrieval.mjs"
import { loadRuntimeConfig, retrievalMethods } from "../src/runtime-config.mjs"

const args = process.argv.slice(2)
const option = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1] }
const vault = option("--vault")
const queryFiles = args.flatMap((arg, index) => arg === "--queries" ? [args[index + 1]] : [])
const output = option("--out")
const k = Number(option("--k") ?? 10)
if (!vault || !queryFiles.length || !Number.isInteger(k) || k < 1 || k > 10) {
  console.error("Usage: node scripts/eval-curator-pages.mjs --vault <path> --queries <json> [--queries <json>] [--config <path>] [--k 10] [--out <path>]")
  process.exit(2)
}
const config = loadRuntimeConfig(option("--config"))
if (config.workflow !== "curator") throw new Error("This evaluator requires curator workflow")
const methods = retrievalMethods(config.retrievalProfile)
const queries = queryFiles.flatMap((file) => JSON.parse(fs.readFileSync(file, "utf8")))
const documents = loadVaultDocuments(vault)
const runs = []
for (const item of queries) {
  if (!item.id || !item.query) throw new Error("Every query needs an id and query")
  const groups = item.relevant_groups ?? item.relevant?.map((p) => [p])
  if (!Array.isArray(groups) || !groups.length) throw new Error(`Gold evidence missing for ${item.id}`)
  const scoped = item.scope ? loadVaultDocuments(vault, { scope: item.scope }) : documents
  const start = performance.now()
  const lanes = methods.map((method) => ({ method, results: governedRank(scoped, item.query, method, { answerCandidatesOnly: true }).results }))
  const first = fuseRankedLanes(lanes.map((lane) => ({ ...lane, results: lane.results.slice(0, config.decision.maxCandidates) }))).slice(0, 10)
  const firstIds = new Set(first.map((item) => item.id))
  const ranked = [...first, ...fuseRankedLanes(lanes).filter((item) => !firstIds.has(item.id))].map((candidate) => candidate.id)
  const rankingMs = performance.now() - start
  const positions = groups.map((group) => {
    const alternatives = group.map((gold) => ranked.indexOf(gold)).filter((index) => index >= 0)
    return alternatives.length ? Math.min(...alternatives) : -1
  })
  const lastRequired = positions.includes(-1) ? -1 : Math.max(...positions)
  const firstCompletePage = lastRequired < 0 ? null : Math.floor(lastRequired / k) + 1
  const pages = Math.ceil(ranked.length / k)
  runs.push({ id: item.id, category: item.category ?? "unclassified", candidateCount: ranked.length,
    pages, firstCompletePage, completeAtOne: firstCompletePage === 1,
    completeAtTwo: firstCompletePage !== null && firstCompletePage <= 2,
    completeAtExhaustion: firstCompletePage !== null, rankingMs: Number(rankingMs.toFixed(1)),
    pathBytesAtExhaustion: ranked.reduce((sum, p) => sum + Buffer.byteLength(p) + 1, 0),
    missingGoldGroups: positions.filter((position) => position < 0).length })
}
const count = (key) => runs.filter((run) => run[key]).length
const sorted = runs.map((run) => run.rankingMs).sort((a, b) => a - b)
const summary = { queries: runs.length, completeAtOne: count("completeAtOne"), completeAtTwo: count("completeAtTwo"),
  completeAtExhaustion: count("completeAtExhaustion"), meanPagesIfExhausted: runs.reduce((sum, run) => sum + run.pages, 0) / runs.length,
  meanPathBytesIfExhausted: runs.reduce((sum, run) => sum + run.pathBytesAtExhaustion, 0) / runs.length,
  meanRankingMs: sorted.reduce((sum, ms) => sum + ms, 0) / runs.length,
  p95RankingMs: sorted[Math.ceil(sorted.length * .95) - 1] }
const report = { scope: "private-vault-eval", metric: "oracle candidate availability, not curator answer quality", k, summary, runs }
console.log(JSON.stringify(summary))
if (output) fs.writeFileSync(path.resolve(output), `${JSON.stringify(report, null, 2)}\n`)
