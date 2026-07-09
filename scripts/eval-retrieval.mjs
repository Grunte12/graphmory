#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { parseMarkdown, rank, scoreRun, summarizeRuns } from "../src/retrieval.mjs"

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

const report = {
  dataset: datasetRoot,
  k,
  documents: documents.length,
  queries: queries.length,
  methods: {},
}

for (const method of ["lexical", "bm25", "bm25-sections", "bm25f-sections"]) {
  const runs = queries.map((item) => {
    const results = rank(documents, item.query, method)
    return {
      id: item.id,
      category: item.category,
      query: item.query,
      relevant: item.relevant,
      retrieved: results.slice(0, k).map((result) => ({
        id: result.id,
        chunkId: result.chunkId,
        score: Number(result.score.toFixed(4)),
      })),
      metrics: scoreRun(results, item.relevant, k),
    }
  })
  report.methods[method] = {
    summary: summarizeRuns(runs),
    categories: Object.fromEntries(
      [...new Set(runs.map((run) => run.category))].map((category) => [
        category,
        summarizeRuns(runs.filter((run) => run.category === category)),
      ]),
    ),
    runs,
  }
}

const percent = (value) => `${(value * 100).toFixed(1)}%`
console.log(`Dataset: ${report.documents} notes, ${report.queries} queries, k=${k}`)
console.log("")
console.log("| Method | Hit@k | Recall@k | MRR | nDCG@k | Avg context chars |")
console.log("|---|---:|---:|---:|---:|---:|")
for (const [method, result] of Object.entries(report.methods)) {
  const summary = result.summary
  console.log(
    `| ${method} | ${percent(summary.hitAtK)} | ${percent(summary.recallAtK)} | ${summary.mrr.toFixed(3)} | ${summary.ndcgAtK.toFixed(3)} | ${summary.averageContextCharacters.toFixed(0)} |`,
  )
}

if (jsonOutput) {
  const outputPath = path.resolve(jsonOutput)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`\nJSON report: ${outputPath}`)
}
