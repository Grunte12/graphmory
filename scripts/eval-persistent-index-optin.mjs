#!/usr/bin/env node
// Matched fresh-process CLI screen. The report contains aggregates, not note text.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { performance } from "node:perf_hooks"
import { createHash } from "node:crypto"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"
import { persistentIndexLocation } from "../src/index-capability.mjs"
import { loadVaultDocuments } from "../src/memory-recall.mjs"

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const prepared = option("--prepared")
const suppliedVault = option("--vault")
const output = option("--out")
if ((!prepared && !suppliedVault) || (prepared && suppliedVault) || !output || fs.existsSync(output)) throw new Error("Supply --prepared or --vault and a new --out path")
const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-index-bench-"))
const cache = path.join(root, "cache")
const configFile = path.join(root, "config.json")
fs.writeFileSync(configFile, JSON.stringify(DEFAULT_RUNTIME_CONFIG))
const vault = suppliedVault ?? path.join(prepared, "vault")
const queries = prepared ? JSON.parse(fs.readFileSync(path.join(prepared, "queries.json"), "utf8")).slice(0, 30)
  : ["memory", "project", "decision", "workflow", "graph", "design", "setup", "evaluation", "latency", "retrieval"].map(query => ({ query }))
const cli = new URL("./brain-sync.mjs", import.meta.url).pathname
const digest = value => createHash("sha256").update(value).digest("hex")
const sourceSnapshot = () => digest(JSON.stringify(loadVaultDocuments(vault).map(document => [document.id, digest(document.markdown)])))
const sourceBefore = sourceSnapshot()
const codeNames = ["src/persistent-postings.mjs", "src/index-capability.mjs", "src/decision-recall.mjs", "src/retrieval.mjs", "src/memory-recall.mjs", "scripts/brain-sync.mjs", "scripts/eval-persistent-index-optin.mjs"]
const codeHashes = Object.fromEntries(codeNames.map(name => [name, digest(fs.readFileSync(new URL("../" + name, import.meta.url)))]))
function run(query, indexed) {
  const argv = [cli, "recall-managed", "--vault", vault, "--query", query, "--config", configFile, "--agent"]
  if (indexed) argv.push("--index-cache", cache)
  const start = performance.now()
  const child = spawnSync(process.execPath, argv, { encoding: "utf8", timeout: 120000, maxBuffer: 16 * 1024 * 1024 })
  const ms = performance.now() - start
  if (child.error || child.status !== 0) throw new Error(`CLI failed: ${child.error?.message ?? child.stderr.slice(0, 300)}`)
  if (child.stderr.includes("INDEX_FALLBACK")) throw new Error(`Index fallback during benchmark: ${child.stderr.trim()}`)
  return { ms, bytes: Buffer.byteLength(child.stdout), hash: digest(child.stdout), parsed: JSON.parse(child.stdout) }
}
const median = values => {
  const ordered = [...values].sort((a, b) => a - b)
  return (ordered[Math.floor((ordered.length - 1) / 2)] + ordered[Math.floor(ordered.length / 2)]) / 2
}
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1]
const report = { protocol: "persistent-index-optin-product-screen-v1", complete: false,
  corpus: prepared ? "SciFact Markdown first 5,000 loaded notes; first 30 frozen queries" : "Read-only local vault; ten generic unlabeled queries", node: process.version,
  exact: 0, count: queries.length, baselineMs: [], indexedMs: [], baselineBytes: [], indexedBytes: [],
  firstCallMs: null, dbBytes: null, codeHashes, sourceSetSha256: sourceBefore }
try {
  const cold = run(queries[0].query, true)
  report.firstCallMs = cold.ms
  report.dbBytes = fs.statSync(persistentIndexLocation(vault, "", cache)).size
  for (const [index, { query }] of queries.entries()) {
    const firstIndexed = index % 2 === 1
    const first = run(query, firstIndexed)
    const second = run(query, !firstIndexed)
    const baseline = firstIndexed ? second : first
    const cached = firstIndexed ? first : second
    assert.deepEqual(cached.parsed, baseline.parsed, `Mismatch on frozen query ${index + 1}`)
    report.exact += 1
    report.baselineMs.push(baseline.ms)
    report.indexedMs.push(cached.ms)
    report.baselineBytes.push(baseline.bytes)
    report.indexedBytes.push(cached.bytes)
  }
  report.p50 = { baseline: median(report.baselineMs), index: median(report.indexedMs) }
  report.p95 = { baseline: percentile(report.baselineMs, 0.95), index: percentile(report.indexedMs, 0.95) }
  report.bytesExact = report.baselineBytes.every((bytes, i) => bytes === report.indexedBytes[i])
  report.gates = { exact: report.exact === queries.length, p50Improvement: report.p50.index <= 0.8 * report.p50.baseline,
    p95NoWorse: report.p95.index <= report.p95.baseline, bytesNoWorse: report.bytesExact }
  if (sourceSnapshot() !== sourceBefore) throw new Error("Vault changed during evaluation")
  for (const [name, hash] of Object.entries(codeHashes)) {
    if (digest(fs.readFileSync(new URL("../" + name, import.meta.url))) !== hash) throw new Error("Code drift during evaluation: " + name)
  }
  report.complete = true
} catch (error) { report.failure = error.message }
finally {
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n")
  fs.rmSync(root, { recursive: true, force: true })
}
console.log(JSON.stringify({ complete: report.complete, exact: report.exact, count: report.count, p50: report.p50, p95: report.p95, gates: report.gates, failure: report.failure }))
if (!report.complete || !report.gates.exact || (prepared && !Object.values(report.gates).every(Boolean))) process.exitCode = 1
