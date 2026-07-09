#!/usr/bin/env node
/**
 * Rerank evaluation script.
 *
 * Runs sectionFocusRerank on top of baseline BM25F section retrieval
 * using the synthetic fixture dataset.  Reports whether rerank changes
 * result order and whether it preserves or improves retrieval metrics.
 *
 * Usage:
 *   node scripts/eval-rerank.mjs
 *   node scripts/eval-rerank.mjs --json tmp/rerank-report.json
 *   node scripts/eval-rerank.mjs --k 3
 */
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { parseMarkdown, rank, scoreRun, sectionFocusRerank, summarizeRuns } from "../src/retrieval.mjs"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const datasetRoot = path.resolve(option("--dataset", "eval/fixtures"))
const k = Number.parseInt(option("--k", "3"), 10)
const jsonOutput = option("--json", "")
if (!Number.isInteger(k) || k < 1) {
  console.error("--k must be a positive integer")
  process.exit(2)
}

const notesRoot = path.join(datasetRoot, "notes")
const queriesPath = path.join(datasetRoot, "queries.json")
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

const method = "bm25f-sections"

const baselineRuns = queries.map((item) => {
  const results = rank(documents, item.query, method)
  return {
    id: item.id,
    category: item.category,
    query: item.query,
    relevant: item.relevant,
    retrieved: results.slice(0, k).map((r) => ({ id: r.id, score: Number(r.score.toFixed(4)) })),
    metrics: scoreRun(results, item.relevant, k),
  }
})

const rerankedRuns = queries.map((item) => {
  const results = rank(documents, item.query, method)
  const reranked = sectionFocusRerank(results, item.query, documents)
  return {
    id: item.id,
    category: item.category,
    query: item.query,
    relevant: item.relevant,
    reranked: reranked.slice(0, k).map((r) => ({
      id: r.id,
      score: Number(r.score.toFixed(4)),
      rerankApplied: r.rerankApplied,
      rerankSignals: r.rerankSignals,
    })),
    metrics: scoreRun(reranked, item.relevant, k),
    orderChanged: results.slice(0, k).some((r, i) => reranked[i]?.id !== r.id),
    bestRerankSignal: reranked[0]?.rerankSignals ?? null,
  }
})

const baselineSummary = summarizeRuns(baselineRuns)
const rerankSummary = summarizeRuns(rerankedRuns)

const rerankStats = {
  reranked: rerankedRuns.filter((r) => r.reranked.some((rr) => rr.rerankApplied)).length,
  orderChanged: rerankedRuns.filter((r) => r.orderChanged).length,
}

const report = {
  dataset: datasetRoot,
  method,
  k,
  documents: documents.length,
  queries: queries.length,
  rerankStats,
  baseline: {
    summary: baselineSummary,
    byCategory: Object.fromEntries(
      [...new Set(baselineRuns.map((r) => r.category))].map((cat) => [
        cat,
        summarizeRuns(baselineRuns.filter((r) => r.category === cat)),
      ]),
    ),
  },
  reranked: {
    summary: rerankSummary,
    byCategory: Object.fromEntries(
      [...new Set(rerankedRuns.map((r) => r.category))].map((cat) => [
        cat,
        summarizeRuns(rerankedRuns.filter((r) => r.category === cat)),
      ]),
    ),
  },
  runs: rerankedRuns.map((r) => ({
    id: r.id,
    category: r.category,
    query: r.query,
    orderChanged: r.orderChanged,
    baselineMetrics: baselineRuns.find((br) => br.id === r.id).metrics,
    rerankMetrics: r.metrics,
    bestRerankSignal: r.bestRerankSignal,
  })),
}

const percent = (v) => `${(v * 100).toFixed(1)}%`
console.log(`Dataset: ${report.documents} notes, ${report.queries} queries, k=${k}`)
console.log(`Rerank stats: ${rerankStats.reranked}/${rerankStats.orderChanged} order changed`)
console.log("")
console.log("| Variant | Hit@k | Recall@k | MRR | nDCG@k | Avg context chars |")
console.log("|---|---:|---:|---:|---:|---:|")
const fmt = (s) =>
  `${percent(s.hitAtK)} | ${percent(s.recallAtK)} | ${s.mrr.toFixed(3)} | ${s.ndcgAtK.toFixed(3)} | ${s.averageContextCharacters.toFixed(0)}`
console.log(`| ${method} (baseline) | ${fmt(baselineSummary)} |`)
console.log(`| ${method} + rerank   | ${fmt(rerankSummary)} |`)

if (jsonOutput) {
  const p = path.resolve(jsonOutput)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`\nJSON report: ${p}`)
}
