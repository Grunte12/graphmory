#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const outPath = path.resolve(option("--out", "tmp/eval-report.md"))
const jsonDir = path.resolve(option("--json-dir", "tmp/eval-report"))

function run(label, commandArgs) {
  const result = spawnSync(process.execPath, commandArgs, {
    encoding: "utf8",
    shell: false,
  })
  if (result.status !== 0) {
    process.stdout.write(result.stdout || "")
    process.stderr.write(result.stderr || "")
    throw new Error(`${label} failed with exit ${result.status}`)
  }
  return result.stdout
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`
}

fs.mkdirSync(jsonDir, { recursive: true })

const files = {
  retrieval: path.join(jsonDir, "retrieval.json"),
  curator: path.join(jsonDir, "curator.json"),
  lifecycle: path.join(jsonDir, "lifecycle.json"),
  conflict: path.join(jsonDir, "conflict.json"),
  patchQuality: path.join(jsonDir, "patch-quality.json"),
  learningLoop: path.join(jsonDir, "learning-loop.json"),
  futureTask: path.join(jsonDir, "future-task.json"),
}

run("retrieval eval", ["scripts/eval-retrieval.mjs", "--json", files.retrieval])
run("lifecycle audit eval", ["scripts/eval-lifecycle-audit.mjs", "--json", files.lifecycle])
run("conflict assist eval", ["scripts/eval-conflict-assist.mjs", "--json", files.conflict])
run("curator eval", ["scripts/eval-curator.mjs", "--json", files.curator])
run("patch quality eval", ["scripts/eval-patch-quality.mjs", "--json", files.patchQuality])
run("learning loop eval", ["scripts/eval-learning-loop.mjs", "--json", files.learningLoop])
run("future task eval", ["scripts/eval-future-task.mjs", "--json", files.futureTask])

const retrieval = readJson(files.retrieval)
const lifecycle = readJson(files.lifecycle)
const conflict = readJson(files.conflict)
const curator = readJson(files.curator)
const patchQuality = readJson(files.patchQuality)
const learningLoop = readJson(files.learningLoop)
const futureTask = readJson(files.futureTask)

const curatorReport = Object.values(curator.candidates)[0]
const patchRuns = patchQuality.runs
const learningRuns = learningLoop.runs
const futureReports = futureTask.reports

const lines = []
lines.push("# Memory Patch Harness Eval Report")
lines.push("")
lines.push(`Generated: ${new Date().toISOString()}`)
lines.push("")
lines.push("## Summary")
lines.push("")
lines.push("| Gate | Result | Notes |")
lines.push("|---|---:|---|")
lines.push(`| Retrieval baseline | ${retrieval.documents} notes / ${retrieval.queries} queries | BM25F sections avg context ${retrieval.methods["bm25f-sections"].summary.averageContextCharacters.toFixed(0)} chars |`)
lines.push(`| Lifecycle audit | ${lifecycle.checks.filter((check) => check.pass).length}/${lifecycle.checks.length} | Stale, expired, raw, and tension gates |`)
lines.push(`| Conflict assist | ${conflict.checks.filter((check) => check.pass).length}/${conflict.checks.length} | Diverged/dirty shared-brain decisions |`)
lines.push(`| Curator behavior | ${curatorReport.summary.passed}/${curatorReport.summary.scenarios} | ${percent(curatorReport.summary.passRate)} pass rate |`)
lines.push(`| Patch quality | ${patchRuns.filter((run) => run.pass).length}/${patchRuns.length} | Expected score ranges met |`)
lines.push(`| Learning loop | ${learningRuns.filter((run) => run.pass).length}/${learningRuns.length} | Score and token ceilings met |`)
lines.push(`| Future-task utility | ${futureReports.filter((run) => run.pass).length}/${futureReports.length} | Downstream decision proxy passed |`)
lines.push("")
lines.push("## Retrieval")
lines.push("")
lines.push("| Method | Hit@k | Recall@k | MRR | nDCG@k | Avg context chars |")
lines.push("|---|---:|---:|---:|---:|---:|")
for (const [method, result] of Object.entries(retrieval.methods)) {
  const summary = result.summary
  lines.push(`| ${method} | ${percent(summary.hitAtK)} | ${percent(summary.recallAtK)} | ${summary.mrr.toFixed(3)} | ${summary.ndcgAtK.toFixed(3)} | ${summary.averageContextCharacters.toFixed(0)} |`)
}
lines.push("")
lines.push("## Lifecycle And Conflict Gates")
lines.push("")
lines.push("| Eval | Passed | Total | Result |")
lines.push("|---|---:|---:|---|")
lines.push(`| Lifecycle audit | ${lifecycle.checks.filter((check) => check.pass).length} | ${lifecycle.checks.length} | ${lifecycle.checks.every((check) => check.pass) ? "PASS" : "FAIL"} |`)
lines.push(`| Conflict assist | ${conflict.checks.filter((check) => check.pass).length} | ${conflict.checks.length} | ${conflict.checks.every((check) => check.pass) ? "PASS" : "FAIL"} |`)
lines.push("")
lines.push("## Learning Loop Cost Proxy")
lines.push("")
lines.push("| Candidate | Score | Max tokens | Est. tokens | Token gate | Selectors |")
lines.push("|---|---:|---:|---:|---|---:|")
for (const run of learningRuns) {
  lines.push(`| ${run.name} | ${run.score} | ${run.expected_max_estimated_tokens ?? "n/a"} | ${run.metrics.estimated_tokens} | ${run.token_pass ? "PASS" : "FAIL"} | ${run.metrics.selector_items} |`)
}
lines.push("")
lines.push("## Future-Task Utility")
lines.push("")
lines.push("| Candidate | Passed | Score | Result |")
lines.push("|---|---:|---:|---|")
for (const report of futureReports) {
  lines.push(`| ${report.name} | ${report.passed}/${report.total} | ${report.score} | ${report.pass ? "PASS" : "FAIL"} |`)
}
lines.push("")
lines.push("## Caveat")
lines.push("")
lines.push("This report is deterministic and proxy-based. It verifies harness behavior, cost ceilings, and scenario gates. It does not replace live-model benchmarking.")
lines.push("")

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${lines.join("\n")}\n`)
console.log(`Eval report: ${outPath}`)
