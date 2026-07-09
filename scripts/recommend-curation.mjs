#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { buildCurationRecommendations, renderCurationRecommendations } from "../src/curation-recommendations.mjs"

const args = process.argv.slice(2)
function option(name, fallback = "") {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const reportPath = path.resolve(option("--report"))
const queriesPath = path.resolve(option("--queries"))
const method = option("--method", "governed-bm25f-sections")
const output = option("--json")

if (!option("--report") || !option("--queries")) {
  console.error("Usage: node scripts/recommend-curation.mjs --report <eval-report.json> --queries <queries.json> [--method governed-bm25f-sections] [--json out.json]")
  process.exit(2)
}
if (!fs.existsSync(reportPath)) throw new Error(`REPORT_NOT_FOUND: ${reportPath}`)
if (!fs.existsSync(queriesPath)) throw new Error(`QUERIES_NOT_FOUND: ${queriesPath}`)

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"))
const queries = JSON.parse(fs.readFileSync(queriesPath, "utf8"))
const result = {
  report: path.basename(reportPath),
  querySet: path.basename(queriesPath),
  ...buildCurationRecommendations(report, queries, { method }),
}

if (output) {
  const target = path.resolve(output)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`)
}

process.stdout.write(renderCurationRecommendations(result))
