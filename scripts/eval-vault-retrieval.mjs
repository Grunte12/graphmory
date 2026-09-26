#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { filterByScope, fuseRankedLanes, loadVaultDocuments } from "../src/memory-recall.mjs"
import { governedRank, rank, scoreRun, scoreRunGroups, summarizeRuns } from "../src/retrieval.mjs"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const vault = path.resolve(option("--vault", ""))
const queriesPath = path.resolve(option("--queries", ""))
const output = option("--json", "")
const k = Number.parseInt(option("--k", "3"), 10)
if (!option("--vault") || !option("--queries") || !Number.isInteger(k) || k < 1) {
  console.error("Usage: node scripts/eval-vault-retrieval.mjs --vault <path> --queries <json> [--k 3] [--json report]")
  console.error("Query cases require id, query, and either relevant or relevant_groups. Optional scope narrows search by path/domain.")
  process.exit(2)
}
if (!fs.existsSync(queriesPath)) {
  console.error(`QUERY_SET_NOT_FOUND: ${queriesPath}`)
  process.exit(2)
}

const documents = loadVaultDocuments(vault, { includeRawPaths: true })
const queries = JSON.parse(fs.readFileSync(queriesPath, "utf8"))
if (!Array.isArray(queries) || queries.length < 1) throw new Error("query set must be a non-empty array")

const methods = ["lexical", "bm25", "bm25-sections", "governed-bm25-sections", "governed-bm25f-sections", "recall-loop-with-navigation", "recall-loop"]
const report = { vault: "[private]", querySet: path.basename(queriesPath), documents: documents.length, queries: queries.length, k, methods: {} }
const scopedDocumentsByScope = new Map()
function scopedDocuments(scope) {
  const key = scope ?? ""
  const cached = scopedDocumentsByScope.get(key)
  if (cached) return cached
  const scoped = filterByScope(documents, key)
  scopedDocumentsByScope.set(key, scoped)
  return scoped
}
for (const label of methods) {
  const governed = label.startsWith("governed-")
  const method = label.replace(/^governed-/u, "")
  const runs = queries.map((item) => {
    const hasRelevant = Array.isArray(item.relevant) && item.relevant.length > 0
    const hasGroups = Array.isArray(item.relevant_groups)
      && item.relevant_groups.length > 0
      && item.relevant_groups.every((group) => Array.isArray(group) && group.length > 0)
    if (!item.id || !item.query || (!hasRelevant && !hasGroups)) {
      throw new Error(`invalid query case: ${item.id ?? "missing-id"}`)
    }
    const scopedDocumentsForQuery = scopedDocuments(item.scope ?? "")
    const results = label.startsWith("recall-loop")
      ? fuseRankedLanes(["bm25", "bm25f-focused-sections"].map((laneMethod) => ({
          method: laneMethod,
          results: governedRank(scopedDocumentsForQuery, item.query, laneMethod, {
            answerCandidatesOnly: label === "recall-loop",
          }).results.slice(0, 8),
        })))
      : governed
        ? governedRank(scopedDocumentsForQuery, item.query, method).results
        : rank(scopedDocumentsForQuery, item.query, method)
    const metrics = hasGroups
      ? scoreRunGroups(results, item.relevant_groups, k)
      : scoreRun(results, item.relevant, k)
    return {
      id: item.id,
      category: item.category ?? "unclassified",
      scope: item.scope ?? "",
      goldMode: hasGroups ? "groups" : "flat",
      metrics,
      retrieved: results.slice(0, k).map((result) => result.id),
    }
  })
  report.methods[label] = {
    summary: summarizeRuns(runs),
    misses: runs.filter((run) => run.metrics.hit === 0).map((run) => run.id),
    runs,
  }
}

const percent = (value) => `${(value * 100).toFixed(1)}%`
console.log(`Private vault eval: ${report.documents} notes, ${report.queries} frozen questions, k=${k}`)
console.log("")
console.log("| Method | Hit@k | Recall@k | MRR | nDCG@k | Avg context chars | Misses |")
console.log("|---|---:|---:|---:|---:|---:|---:|")
for (const [method, result] of Object.entries(report.methods)) {
  const summary = result.summary
  console.log(`| ${method} | ${percent(summary.hitAtK)} | ${percent(summary.recallAtK)} | ${summary.mrr.toFixed(3)} | ${summary.ndcgAtK.toFixed(3)} | ${summary.averageContextCharacters.toFixed(0)} | ${result.misses.length} |`)
}
console.log("\nAverage context characters describe retrieved candidate text, not the compact --agent CLI output.")

if (output) {
  const target = path.resolve(output)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`\nPrivate JSON report: ${target}`)
}
