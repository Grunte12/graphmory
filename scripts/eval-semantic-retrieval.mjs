#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { recallVaultSemantic } from "../src/semantic-recall.mjs"
import { scoreRun, scoreRunGroups } from "../src/retrieval.mjs"

const args = process.argv.slice(2)

function option(name, fallback = "") {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

function flag(name) {
  return args.includes(name)
}

function usage(exitCode = 0) {
  const out = exitCode === 0 ? process.stdout : process.stderr
  out.write(`Semantic retrieval eval\n\n`)
  out.write(`Usage:\n`)
  out.write(`  node scripts/eval-semantic-retrieval.mjs --vault <path> --queries <json> [--k 3] [--scope <path>] [--model Xenova/bge-small-en-v1.5] [--json <file>]\n\n`)
  out.write(`Requires optional dependency: npm install @huggingface/transformers\n`)
  process.exit(exitCode)
}

function required(name) {
  const value = option(name)
  if (!value) {
    console.error(`Missing ${name}`)
    usage(2)
  }
  return value
}

if (flag("--help") || flag("-h")) usage(0)

const vault = path.resolve(required("--vault"))
const queriesFile = path.resolve(required("--queries"))
const k = Number.parseInt(option("--k", "3"), 10)
const model = option("--model", "Xenova/bge-small-en-v1.5")
const scopeOverride = option("--scope", "")
const reportFile = option("--json", "")

const cases = JSON.parse(fs.readFileSync(queriesFile, "utf8"))
const runs = []

try {
  for (const item of cases) {
    const report = await recallVaultSemantic(vault, item.query, {
      k,
      scope: scopeOverride || item.scope || "",
      model,
      modelCache: option("--model-cache", ""),
    })
    const results = report.results.map((result) => ({ id: result.path, characters: 0 }))
    const metrics = item.relevant_groups
      ? scoreRunGroups(results, item.relevant_groups, k)
      : scoreRun(results, item.relevant, k)
    runs.push({
      id: item.id,
      query: item.query,
      metrics,
      retrieved: report.results.map((result) => result.path),
    })
  }
} catch (error) {
  if (/OPTIONAL_DEPENDENCY_MISSING/u.test(error.message)) {
    console.error(error.message)
    console.error("Install hint: npm install @huggingface/transformers")
    process.exit(2)
  }
  throw error
}

const average = (field) => runs.reduce((sum, run) => sum + run.metrics[field], 0) / Math.max(runs.length, 1)
const summary = {
  method: "semantic-hybrid",
  model,
  queries: runs.length,
  k,
  recallAtK: average("recall"),
  hitAtK: average("hit"),
  mrr: average("reciprocalRank"),
  misses: runs.filter((run) => !run.metrics.hit).map((run) => run.id),
}
const report = { summary, runs }

if (reportFile) {
  fs.mkdirSync(path.dirname(path.resolve(reportFile)), { recursive: true })
  fs.writeFileSync(path.resolve(reportFile), `${JSON.stringify(report, null, 2)}\n`)
}

console.log(`Semantic retrieval eval: ${runs.length} queries`)
console.log(`- Recall@${k}: ${(summary.recallAtK * 100).toFixed(1)}%`)
console.log(`- MRR: ${summary.mrr.toFixed(3)}`)
console.log(`- Misses: ${summary.misses.length ? summary.misses.join(", ") : "none"}`)
