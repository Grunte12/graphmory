#!/usr/bin/env node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mph-v05-gate-"))
const scenarios = [
  ...[11, 29, 47].flatMap((seed) => [250, 1000].map((notes) => ({ notes, seed }))),
  { notes: 5000, seed: 29 },
]
const runs = []

for (const scenario of scenarios) {
  const output = path.join(scratch, `stress-${scenario.notes}-${scenario.seed}.json`)
  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "eval-retrieval-stress.mjs"),
    "--notes", String(scenario.notes),
    "--seed", String(scenario.seed),
    "--json", output,
  ], { cwd: root, encoding: "utf8", shell: false })
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout)
    process.exit(result.status ?? 1)
  }
  runs.push(JSON.parse(fs.readFileSync(output, "utf8")))
}

const selected = runs.map((run) => ({
  notes: run.notes,
  seed: run.seed,
  queries: run.queries,
  baselinePollution: run.methods["bm25-sections"].summary.pollutedQueries,
  baselineQueryMs: run.methods["bm25-sections"].summary.averageQueryMs,
  ...run.methods["governed-bm25f-sections"].summary,
}))

const checks = [
  ["at least 50 query executions per run", selected.every((run) => run.queries >= 50)],
  ["fixture exposes baseline pollution", selected.every((run) => run.baselinePollution > 0)],
  ["governed BM25F Recall@3 >= 0.90", selected.every((run) => run.recallAtK >= 0.9)],
  ["governed BM25F current-memory accuracy >= 0.90", selected.every((run) => run.currentMemoryAccuracy >= 0.9)],
  ["governed BM25F MRR >= 0.90", selected.every((run) => run.mrr >= 0.9)],
  ["governed BM25F polluted queries = 0", selected.every((run) => run.pollutedQueries === 0)],
  ["estimated context <= 300 tokens", selected.every((run) => run.estimatedContextTokens <= 300)],
  ["governed latency <= 3x baseline + 10 ms", selected.every((run) => run.averageQueryMs <= run.baselineQueryMs * 3 + 10)],
]

console.log("v0.5 deterministic acceptance gate")
console.log("")
console.log("| Notes | Seed | Recall@3 | Current-memory acc. | MRR | Pollution | Est. tokens | Avg ms |")
console.log("|---:|---:|---:|---:|---:|---:|---:|---:|")
for (const run of selected) {
  console.log(`| ${run.notes} | ${run.seed} | ${(run.recallAtK * 100).toFixed(1)}% | ${(run.currentMemoryAccuracy * 100).toFixed(1)}% | ${run.mrr.toFixed(3)} | ${run.pollutedQueries} | ${run.estimatedContextTokens} | ${run.averageQueryMs.toFixed(2)} |`)
}
console.log("")
for (const [name, passed] of checks) console.log(`- [${passed ? "PASS" : "FAIL"}] ${name}`)

const failed = checks.filter(([, passed]) => !passed)
if (failed.length) {
  console.error(`\nv0.5 gate failed: ${failed.length} criterion/criteria`)
  process.exit(1)
}
console.log("\nv0.5 deterministic gate passed. Live-model and human-labeled evidence remain separate release claims.")
