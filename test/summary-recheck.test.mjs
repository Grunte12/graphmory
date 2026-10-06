import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { createMemoryEngine } from "../src/mcp-engine.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"
import { auditMemoryLifecycle } from "../src/memory-lifecycle-audit.mjs"

const config = { ...DEFAULT_RUNTIME_CONFIG, retrievalMode: "lexical" }
const sha = (value) => createHash("sha256").update(value).digest("hex")

function vaultWithSummary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-recheck-"))
  const vault = path.join(root, "vault")
  fs.mkdirSync(path.join(vault, "Project"), { recursive: true })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const source = "# Release owner\n\nTaylor owns the production release approval.\n"
  fs.writeFileSync(path.join(vault, "Project", "Source.md"), source)
  const summary = `---\nmemory_kind: summary\nsummary_sources:\n  - ${JSON.stringify(`${sha(source)} Project/Source.md`)}\n---\n# Release ownership summary\n\nTaylor owns the production release approval.\n`
  fs.writeFileSync(path.join(vault, "Project", "Summary.md"), summary)
  return { vault, stateRoot: path.join(root, "state"), source }
}

test("a fresh summary is recalled and nothing is flagged for recheck", async (t) => {
  const f = vaultWithSummary(t)
  const engine = createMemoryEngine({ vault: f.vault, stateRoot: f.stateRoot, config })
  const result = await engine.recall({ query: "production release approval owner" })
  assert.ok(result.candidates.some((c) => c.path === "Project/Summary.md"))
  assert.equal(result.recheck, undefined)
})

test("a changed source drops the summary from recall and lists it in recheck", async (t) => {
  const f = vaultWithSummary(t)
  const engine = createMemoryEngine({ vault: f.vault, stateRoot: f.stateRoot, config })
  fs.writeFileSync(path.join(f.vault, "Project", "Source.md"), `${f.source}\nAriel now co-owns approval.\n`)
  const result = await engine.recall({ query: "production release approval owner" })
  assert.ok(!result.candidates.some((c) => c.path === "Project/Summary.md"), "stale summary must not be recalled")
  assert.deepEqual(result.recheck, [{ path: "Project/Summary.md", changedSources: ["Project/Source.md"] }])
})

test("recheck only lists summaries that mention the query", async (t) => {
  const f = vaultWithSummary(t)
  const engine = createMemoryEngine({ vault: f.vault, stateRoot: f.stateRoot, config })
  fs.writeFileSync(path.join(f.vault, "Project", "Source.md"), `${f.source}\nChanged.\n`)
  const result = await engine.recall({ query: "kubernetes cluster autoscaling" })
  assert.equal(result.recheck, undefined)
})

test("lifecycle audit flags summary-source-changed read-only and names the source", (t) => {
  const f = vaultWithSummary(t)
  fs.writeFileSync(path.join(f.vault, "Project", "Source.md"), `${f.source}\nChanged.\n`)
  const before = fs.readFileSync(path.join(f.vault, "Project", "Summary.md"), "utf8")
  const audit = auditMemoryLifecycle(f.vault)
  const found = audit.findings.filter((item) => item.kind === "summary-source-changed")
  assert.equal(found.length, 1)
  assert.equal(found[0].file, "Project/Summary.md")
  assert.equal(found[0].severity, "medium")
  assert.match(found[0].detail, /Project\/Source\.md/)
  assert.ok(!audit.findings.some((item) => item.kind === "obsolete-without-replacement" && item.file === "Project/Summary.md"))
  assert.ok(audit.actions.some((item) => item.type === "summary-source-changed" && item.action === "recheck-summary"))
  assert.equal(fs.readFileSync(path.join(f.vault, "Project", "Summary.md"), "utf8"), before)
})

test("lifecycle audit stays quiet for a fresh summary", (t) => {
  const f = vaultWithSummary(t)
  assert.ok(!auditMemoryLifecycle(f.vault).findings.some((item) => item.kind === "summary-source-changed"))
})
