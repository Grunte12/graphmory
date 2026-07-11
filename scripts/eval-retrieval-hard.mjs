#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { filterByScope } from "../src/memory-recall.mjs"
import { governedRank, parseMarkdown, scoreRun, scoreRunGroups, summarizeRuns } from "../src/retrieval.mjs"
import { summarizeSelectiveRetrieval } from "../src/retrieval-evaluation.mjs"
import { analyzeQuery, buildAliasMap } from "../src/query-understanding.mjs"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}
function flag(name) {
  return args.includes(name)
}

const METHOD_LABEL = "governed-bm25f-sections"
const METHOD = "bm25f-sections"

const datasetRoot = path.resolve(option("--dataset", "eval/fixtures-hard"))
const k = Number.parseInt(option("--k", "3"), 10)
const jsonOutput = option("--json", "")
const gateEnabled = flag("--gate")
if (!Number.isInteger(k) || k < 1) {
  console.error("--k must be a positive integer")
  process.exit(2)
}

const notesRoot = path.join(datasetRoot, "notes")
const queriesPath = path.join(datasetRoot, "queries.json")
const thresholdsPath = path.join(datasetRoot, "thresholds.json")

const documents = fs
  .readdirSync(notesRoot)
  .filter((file) => file.endsWith(".md"))
  .sort()
  .map((file) =>
    parseMarkdown(
      path.basename(file, ".md"),
      fs.readFileSync(path.join(notesRoot, file), "utf8"),
    ),
  )
const queries = JSON.parse(fs.readFileSync(queriesPath, "utf8"))
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

// Vault-mined alias map, built once over the full fixture corpus (mirrors
// memory-recall.mjs: reuses already-parsed frontmatter, no re-parsing).
const aliasMap = buildAliasMap(documents)

const scoredRuns = []
const abstentionRuns = []

for (const item of queries) {
  if (!item.id || !item.query || !item.category) {
    throw new Error(`invalid query case: ${item.id ?? "missing-id"}`)
  }
  const isAbstention = item.category === "abstention"
  const hasRelevant = Array.isArray(item.relevant) && item.relevant.length > 0
  const hasGroups = Array.isArray(item.relevant_groups)
    && item.relevant_groups.length > 0
    && item.relevant_groups.every((group) => Array.isArray(group) && group.length > 0)
  if (!isAbstention && !hasRelevant && !hasGroups) {
    throw new Error(`invalid query case (no gold answer, but category is not abstention): ${item.id}`)
  }

  const documentsForQuery = scopedDocuments(item.scope ?? "")
  let retrieval = governedRank(documentsForQuery, item.query, METHOD)
  let retrievalRung = 1

  // Rung 2: one cheap alias-expanded retry before any semantic escalation
  // (semantic rung is opt-in elsewhere and out of scope for this lexical eval).
  const analysis = analyzeQuery(item.query, { aliasMap })
  if ((retrieval.confidence === "low" || retrieval.confidence === "none") && analysis.variants.length) {
    const retry = governedRank(documentsForQuery, analysis.variants[0], METHOD)
    if (retry.confidence === "bounded") {
      retrieval = retry
      retrievalRung = 2
    }
  }
  const results = retrieval.results
  const abstained = retrieval.confidence === "none" || results.length === 0

  if (isAbstention) {
    abstentionRuns.push({
      id: item.id,
      category: item.category,
      query: item.query,
      confidence: retrieval.confidence,
      confidenceSignals: retrieval.confidenceSignals,
      retrievalRung,
      retrieved: results.slice(0, k).map((result) => result.id),
      abstained,
    })
    continue
  }

  const metrics = hasGroups
    ? scoreRunGroups(results, item.relevant_groups, k)
    : scoreRun(results, item.relevant, k)
  scoredRuns.push({
    id: item.id,
    category: item.category,
    scope: item.scope ?? "",
    query: item.query,
    relevant: item.relevant ?? item.relevant_groups,
    goldMode: hasGroups ? "groups" : "flat",
    confidence: retrieval.confidence,
    confidenceSignals: retrieval.confidenceSignals,
    abstained,
    retrievalRung,
    queryAnalysis: { lang: analysis.lang, classes: analysis.classes },
    retrieved: results.slice(0, k).map((result) => ({ id: result.id, score: Number(result.score.toFixed(4)) })),
    metrics,
  })
}

const answerability = summarizeSelectiveRetrieval(scoredRuns, abstentionRuns)
const abstentionAccuracy = answerability.abstentionAccuracy

const categories = [...new Set(queries.map((item) => item.category))]
const categorySummaries = {}
for (const category of categories) {
  if (category === "abstention") {
    const runs = abstentionRuns.filter((run) => run.category === category)
    categorySummaries[category] = {
      queries: runs.length,
      abstentionAccuracy: runs.length ? runs.filter((run) => run.abstained).length / runs.length : 1,
    }
    continue
  }
  categorySummaries[category] = summarizeRuns(scoredRuns.filter((run) => run.category === category))
}

const overallSummary = summarizeRuns(scoredRuns)
const misses = scoredRuns.filter((run) => run.metrics.hit === 0).map((run) => run.id)
const abstentionFailures = abstentionRuns.filter((run) => !run.abstained).map((run) => run.id)

const report = {
  dataset: datasetRoot,
  method: METHOD_LABEL,
  k,
  documents: documents.length,
  queries: queries.length,
  scoredQueries: scoredRuns.length,
  abstentionQueries: abstentionRuns.length,
  overall: overallSummary,
  abstentionAccuracy,
  answerability,
  categories: categorySummaries,
  misses,
  abstentionFailures,
  runs: scoredRuns,
  abstentionRuns,
}

const percent = (value) => `${(value * 100).toFixed(1)}%`
console.log(`Hard eval: ${report.documents} notes, ${report.queries} queries (${report.scoredQueries} scored, ${report.abstentionQueries} abstention), method=${METHOD_LABEL}, k=${k}`)
console.log("")
console.log(`Overall: Hit@${k} ${percent(overallSummary.hitAtK)} | Recall@${k} ${percent(overallSummary.recallAtK)} | MRR ${overallSummary.mrr.toFixed(3)} | nDCG@${k} ${overallSummary.ndcgAtK.toFixed(3)} | Abstention accuracy ${percent(abstentionAccuracy)}`)
console.log(`Selective: answerable acceptance ${percent(answerability.answerableAcceptanceAccuracy)} | answerability decisions ${percent(answerability.answerabilityDecisionAccuracy)} | joint retrieval/abstention ${percent(answerability.selectiveAccuracy)}`)
console.log("")
console.log("| Category | Queries | Hit@k | Recall@k | MRR | nDCG@k |")
console.log("|---|---:|---:|---:|---:|---:|")
for (const category of categories) {
  const summary = categorySummaries[category]
  if (category === "abstention") {
    console.log(`| ${category} | ${summary.queries} | abstention acc. ${percent(summary.abstentionAccuracy)} | - | - | - |`)
    continue
  }
  console.log(`| ${category} | ${summary.queries} | ${percent(summary.hitAtK)} | ${percent(summary.recallAtK)} | ${summary.mrr.toFixed(3)} | ${summary.ndcgAtK.toFixed(3)} |`)
}

if (misses.length) {
  console.log("")
  console.log(`Misses (${misses.length}): ${misses.join(", ")}`)
}
if (abstentionFailures.length) {
  console.log("")
  console.log(`Abstention failures (${abstentionFailures.length}): ${abstentionFailures.join(", ")}`)
}

if (jsonOutput) {
  const outputPath = path.resolve(jsonOutput)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`\nJSON report: ${outputPath}`)
}

if (gateEnabled) {
  if (!fs.existsSync(thresholdsPath)) {
    console.error(`THRESHOLDS_NOT_FOUND: ${thresholdsPath}`)
    process.exit(2)
  }
  const thresholds = JSON.parse(fs.readFileSync(thresholdsPath, "utf8"))
  const checks = []
  for (const [metric, threshold] of Object.entries(thresholds.overall ?? {})) {
    if (threshold === null || threshold === undefined) continue
    checks.push([`overall ${metric} >= ${threshold}`, overallSummary[metric] >= threshold])
  }
  for (const [category, threshold] of Object.entries(thresholds.categories ?? {})) {
    if (threshold === null || threshold === undefined) continue
    const summary = categorySummaries[category]
    const value = category === "abstention" ? summary?.abstentionAccuracy : summary?.hitAtK
    checks.push([`category ${category} hit/abstention >= ${threshold}`, value !== undefined && value >= threshold])
  }
  if (thresholds.abstentionAccuracy !== null && thresholds.abstentionAccuracy !== undefined) {
    checks.push([`abstentionAccuracy >= ${thresholds.abstentionAccuracy}`, abstentionAccuracy >= thresholds.abstentionAccuracy])
  }
  for (const [metric, threshold] of Object.entries(thresholds.answerability ?? {})) {
    if (threshold === null || threshold === undefined) continue
    checks.push([`answerability ${metric} >= ${threshold}`, answerability[metric] >= threshold])
  }

  console.log("")
  if (!checks.length) {
    console.log("Gate disabled: no thresholds set in eval/fixtures-hard/thresholds.json.")
  } else {
    console.log("Hard eval gate")
    for (const [name, passed] of checks) console.log(`- [${passed ? "PASS" : "FAIL"}] ${name}`)
    const failed = checks.filter(([, passed]) => !passed)
    if (failed.length) {
      console.error(`\nHard eval gate failed: ${failed.length} criterion/criteria`)
      process.exit(1)
    }
    console.log("\nHard eval gate passed.")
  }
}
