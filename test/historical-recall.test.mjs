import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { spawnSync } from "node:child_process"
import { governedRank, parseMarkdown } from "../src/retrieval.mjs"
import { managedRecall } from "../src/decision-recall.mjs"
import { DEFAULT_RUNTIME_CONFIG as HYBRID_RUNTIME_CONFIG, saveRuntimeConfig } from "../src/runtime-config.mjs"
const DEFAULT_RUNTIME_CONFIG = { ...HYBRID_RUNTIME_CONFIG, retrievalMode: "lexical" }

test("historical lookup does not contaminate cached current eligibility or admit unsafe lifecycle states", () => {
  const docs = ["active", "superseded", "raw", "stale", "archived", "deprecated"].map(status =>
    parseMarkdown(`${status}.md`, `---\nstatus: ${status}\n---\n# Cedar storage\nCedar storage policy.`))
  const lookup = options => governedRank(docs, "Cedar storage", "bm25", options).results.map(row => row.id).sort()
  assert.deepEqual(lookup({}), ["active.md"])
  assert.deepEqual(lookup({ includeSuperseded: true }), ["active.md", "superseded.md"])
  assert.deepEqual(lookup({}), ["active.md"])
})

test("actual CLI historical pages preserve scope, source status, continuation and navigation exclusion", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-history-test-"))
  try {
    fs.mkdirSync(path.join(vault, "Cedar"))
    for (let i = 0; i < 13; i++) fs.writeFileSync(path.join(vault, "Cedar", `${i}.md`), `---\nstatus: ${i ? "superseded" : "active"}\n---\n# Cedar policy ${i}\nCedar storage policy changed over time.`)
    fs.writeFileSync(path.join(vault, "Cedar", "index.md"), "---\ncanonical_memory: false\n---\n# Cedar storage\n[[1]]")
    fs.writeFileSync(path.join(vault, "outside.md"), "---\nstatus: superseded\n---\n# Cedar storage\nOutside scope.")
    const config = path.join(vault, "runtime.json")
    saveRuntimeConfig(config, DEFAULT_RUNTIME_CONFIG)
    const call = (historical, offset = 0) => {
      const r = spawnSync(process.execPath, ["scripts/brain-sync.mjs", "recall-managed", "--retrieval-mode", "lexical", "--vault", vault, "--query", "Cedar storage policy", "--scope", "Cedar", "--config", config, "--offset", String(offset), "--agent", ...(historical ? ["--include-superseded"] : [])], { encoding: "utf8" })
      assert.equal(r.status, 0, r.stderr)
      return JSON.parse(r.stdout)
    }
    assert.deepEqual(call(false).results.map(row => row.path), ["Cedar/0.md"])
    const first = call(true), second = call(true, first.nextOffset)
    assert.equal(first.historicalCandidatesIncluded, true)
    assert.equal(first.hasMore, true)
    assert.equal(second.hasMore, false)
    const all = [...first.results, ...second.results]
    assert.equal(all.length, 13)
    assert.equal(new Set(all.map(row => row.path)).size, 13)
    assert.equal(all.filter(row => row.status === "superseded").length, 12)
    assert.deepEqual(call(false).results.map(row => row.path), ["Cedar/0.md"])
    for (const workflow of ["hosted-jev", "local-decision", "local-rerank"]) {
      await assert.rejects(managedRecall(vault, "Cedar", { ...DEFAULT_RUNTIME_CONFIG, workflow }, { includeSuperseded: true, fetchImpl: () => { throw new Error("Must not call provider") } }), /Historical retrieval is supported only in curator mode/)
    }
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})
