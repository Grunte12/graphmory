#!/usr/bin/env node
// Ablation: does a single blind LLM query-reformulation rewrite (no dense/semantic lane
// involved) help retrieval on the real-vault fixture, and does it ever regress a query that
// plain BM25F already got right? Extends the original N=2 spot-check (the two queries that
// miss under plain BM25F) to the full N=34 query set, so the reformulation intervention is
// measured for both its fix rate on failures and its regression rate on passes.
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { governedRank, scoreRun, scoreRunGroups, summarizeRuns } from "../src/retrieval.mjs"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const vault = path.resolve(option("--vault", ""))
const queriesPath = path.resolve(option("--queries", ""))
const reformulationsPath = path.resolve(option("--reformulations", ""))
const output = option("--json", "")
const k = Number.parseInt(option("--k", "3"), 10)
if (!option("--vault") || !option("--queries") || !option("--reformulations") || !Number.isInteger(k) || k < 1) {
  console.error(
    "Usage: node scripts/eval-query-reformulation.mjs --vault <path> --queries <json> --reformulations <json> [--k 3] [--json report]",
  )
  process.exit(2)
}
for (const p of [queriesPath, reformulationsPath]) {
  if (!fs.existsSync(p)) {
    console.error(`NOT_FOUND: ${p}`)
    process.exit(2)
  }
}

const { loadVaultDocuments, filterByScope } = await import("../src/memory-recall.mjs")
const documents = loadVaultDocuments(vault, { includeRawPaths: true })
const queries = JSON.parse(fs.readFileSync(queriesPath, "utf8"))
const reformulations = JSON.parse(fs.readFileSync(reformulationsPath, "utf8")).reformulations
if (!Array.isArray(queries) || queries.length < 1) throw new Error("query set must be a non-empty array")

const scopedDocumentsByScope = new Map()
function scopedDocuments(scope) {
  const key = scope ?? ""
  const cached = scopedDocumentsByScope.get(key)
  if (cached) return cached
  const scoped = filterByScope(documents, key)
  scopedDocumentsByScope.set(key, scoped)
  return scoped
}

function runOne(item, queryText) {
  const scoped = scopedDocuments(item.scope ?? "")
  const results = governedRank(scoped, queryText, "bm25f-sections").results.map((entry) => ({
    id: entry.id,
    characters: entry.characters,
  }))
  const hasGroups = Array.isArray(item.relevant_groups) && item.relevant_groups.length > 0
  const metrics = hasGroups ? scoreRunGroups(results, item.relevant_groups, k) : scoreRun(results, item.relevant, k)
  return { metrics, top: results.slice(0, k).map((r) => r.id) }
}

const rows = []
for (const item of queries) {
  const hasRelevant = Array.isArray(item.relevant) && item.relevant.length > 0
  const hasGroups = Array.isArray(item.relevant_groups) && item.relevant_groups.length > 0
  if (!item.id || !item.query || (!hasRelevant && !hasGroups)) {
    throw new Error(`invalid query case: ${item.id ?? "missing-id"}`)
  }
  const reformulated = reformulations[item.id]
  if (!reformulated) throw new Error(`missing reformulation for query: ${item.id}`)

  const original = runOne(item, item.query)
  const rewritten = runOne(item, reformulated)

  const wasHit = original.metrics.hit === 1
  const isHit = rewritten.metrics.hit === 1
  let outcome
  if (wasHit && isHit) outcome = "still-pass"
  else if (wasHit && !isHit) outcome = "REGRESSION"
  else if (!wasHit && isHit) outcome = "FIXED"
  else outcome = "still-fail"

  rows.push({
    id: item.id,
    category: item.category,
    outcome,
    original: { hit: original.metrics.hit, top: original.top },
    reformulated: { hit: rewritten.metrics.hit, top: rewritten.top },
  })
}

const summary = {
  total: rows.length,
  stillPass: rows.filter((r) => r.outcome === "still-pass").length,
  fixed: rows.filter((r) => r.outcome === "FIXED").length,
  regression: rows.filter((r) => r.outcome === "REGRESSION").length,
  stillFail: rows.filter((r) => r.outcome === "still-fail").length,
}

const report = { vault: "[private]", querySet: path.basename(queriesPath), documents: documents.length, k, summary, rows }

console.log(`Query reformulation ablation -- N=${summary.total}`)
console.log(`  still-pass:  ${summary.stillPass}`)
console.log(`  FIXED:       ${summary.fixed}  (${rows.filter((r) => r.outcome === "FIXED").map((r) => r.id).join(", ") || "none"})`)
console.log(`  REGRESSION:  ${summary.regression}  (${rows.filter((r) => r.outcome === "REGRESSION").map((r) => r.id).join(", ") || "none"})`)
console.log(`  still-fail:  ${summary.stillFail}  (${rows.filter((r) => r.outcome === "still-fail").map((r) => r.id).join(", ") || "none"})`)

if (output) {
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
  fs.writeFileSync(path.resolve(output), JSON.stringify(report, null, 2))
  console.log(`\nWrote ${output}`)
}
