import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"

test("native summary retains failed/unattempted slots and unknown cache counters", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-summary-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const manifest = { configuration: { curator: "small", lead: "lead", maxRounds: 3, maxInputBytes: 300000 },
    order: [{ id: "case", arm: "graph" }, { id: "case", arm: "basic" }] }
  const manifestFile = path.join(root, "manifest.json")
  fs.writeFileSync(manifestFile, JSON.stringify(manifest))
  const hash = createHash("sha256").update(fs.readFileSync(manifestFile)).digest("hex")
  const ledger = { manifestSha256: hash, stopped: "input-byte-budget", attempts: [
    { id: "case", arm: "graph", status: "failed", report: "report.json" },
    { id: "case", arm: "basic", status: "unattempted" },
  ] }
  fs.writeFileSync(path.join(root, "ledger.json"), JSON.stringify(ledger))
  const report = { id: "case", model: "small", leadModel: "lead", maxRounds: 3, maxInputBytes: 300000,
    sourceIndex: true, rankedOriginals: false, retrieval: "graphmory-managed", runComplete: false,
    modelCalls: [{ failed: false, usage: { input_tokens: 20, output_tokens: 2 } }],
    sourceReads: [], pages: [], sourceToolCalls: [], stopReason: "input-byte-budget" }
  fs.writeFileSync(path.join(root, "report.json"), JSON.stringify(report))
  const run = output => spawnSync("python3", [new URL("../scripts/summarize-ranked-native-screen.py", import.meta.url).pathname,
    "--manifest", manifestFile, "--runs", root, "--out", output], { encoding: "utf8" })
  const output = path.join(root, "summary.json")
  assert.equal(run(output).status, 0)
  const summary = JSON.parse(fs.readFileSync(output))
  assert.deepEqual([summary.planned, summary.attempted, summary.completed, summary.failed, summary.unattempted], [2, 1, 0, 1, 1])
  assert.equal(summary.rows[0].usageObserved.input_tokens, 20)
  assert.equal(summary.rows[0].usageObserved.cached_input_tokens, null)
  assert.equal(summary.rows[0].noncachedInputObserved, null)
  report.model = "different-model"
  fs.writeFileSync(path.join(root, "report.json"), JSON.stringify(report))
  assert.notEqual(run(path.join(root, "invalid.json")).status, 0)
})
