import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import test from "node:test"
import { prepareCurationCheckpoint, inspectCurationCheckpoint, restoreCurationCheckpoint } from "../src/curation-checkpoint.mjs"

const cli = path.resolve("scripts/brain-sync.mjs")
const sentinel = "SYNTHETIC-PRIVATE-MEMORY-SENTINEL-7319"
const patch = {
  claim: "Production releases require an independent reviewer.",
  why_it_matters: "Independent review prevents an owner from approving their own release.",
  scope: { applies: ["production releases"], excludes: ["development releases"] },
  provenance: [{ kind: "file", value: "Evidence.md" }],
  confidence: "high",
  suggested_type: "decision",
  lifecycle: { status: "active", revalidate_when: [], supersedes: [] },
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-read-authority-cli-"))
  const vault = path.join(root, "vault")
  const stateRoot = path.join(root, "state")
  fs.mkdirSync(vault)
  fs.writeFileSync(path.join(vault, "Policy.md"), `# Policy\n\n${sentinel} requires review.\n`)
  fs.writeFileSync(path.join(vault, "Evidence.md"), "# Evidence\nThe user approved independent reviewers.\n")
  const patchPath = path.join(root, "patch.json")
  fs.writeFileSync(patchPath, JSON.stringify(patch))
  const env = { ...process.env, GRAPHMORY_STATE_DIR: stateRoot }
  const run = (args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", env })
  return { root, vault, stateRoot, patchPath, run }
}

function assertSingleBlockedJson(result, operation, code = "CURATION_PENDING") {
  assert.equal(result.status, 1, result.stderr || result.stdout)
  assert.equal(result.stderr, "")
  const lines = result.stdout.trim().split(/\r?\n/u)
  assert.equal(lines.length, 1, result.stdout)
  const output = JSON.parse(lines[0])
  assert.equal(output.status, "BLOCKED")
  assert.equal(output.code, code)
  if (operation) assert.equal(output.operation, operation)
  assert.deepEqual(output.results, [])
  assert.equal(result.stdout.includes(sentinel), false)
  return output
}

test("agent-facing content routes block pending memory with one body-free JSON envelope", () => {
  const f = fixture()
  try {
    const prepared = prepareCurationCheckpoint({ vault: f.vault, patch, targets: ["Policy.md"], sources: ["Evidence.md"], stateRoot: f.stateRoot })
    const op = prepared.operation
    const routes = [
      ["recall", "--vault", f.vault, "--query", sentinel, "--agent"],
      ["recall-loop", "--vault", f.vault, "--query", sentinel, "--agent"],
      ["recall-managed", "--retrieval-mode", "lexical", "--vault", f.vault, "--query", sentinel, "--agent"],
      ["recall-explore", "--vault", f.vault, "--query", sentinel, "--agent"],
      ["recall-rerank", "--vault", f.vault, "--query", sentinel, "--json"],
      ["recall-semantic", "--vault", f.vault, "--query", sentinel, "--json"],
      ["curate-plan", "--vault", f.vault, "--input", path.join(f.root, "missing.json"), "--agent"],
      ["read-notes", "--vault", f.vault, "--paths", '["Policy.md"]'],
      ["read-notes", "--vault", f.vault, "--manifest", path.join(f.root, "missing-handoff.json")],
      ["source-handoff", "--vault", f.vault, "--paths", '["Policy.md"]'],
      ["summary", "sources", "--vault", f.vault, "--paths", '["Evidence.md"]'],
      ["summary", "check", "--vault", f.vault, "--note", "Policy.md"],
    ]
    for (const args of routes) assertSingleBlockedJson(f.run(args), op)

    const scalar = f.run(["recall", "--vault", f.vault, "--query", sentinel])
    assert.equal(scalar.status, 1)
    assert.equal(scalar.stdout, "")
    assert.match(scalar.stderr, new RegExp(`CURATION_PENDING operation ${op}`, "u"))
    assert.equal(scalar.stderr.includes(sentinel), false)

    const diagnostic = f.run(["graph-audit", "--vault", f.vault, "--agent"])
    assert.equal(diagnostic.status, 0, diagnostic.stderr)
    const graph = JSON.parse(diagnostic.stdout)
    assert.equal(graph.authority, "diagnostic-only")
    assert.equal(graph.authoritative, false)
    assert.equal(graph.curation.operation, op)
    assert.equal(diagnostic.stdout.includes(sentinel), false)

    const outPath = path.join(f.root, "handoff.json")
    assertSingleBlockedJson(f.run(["source-handoff", "--vault", f.vault, "--paths", '["Evidence.md"]', "--out", outPath]), op)
    assert.equal(fs.existsSync(outPath), false)
    const collectionPath = path.join(f.root, "collection.json")
    assertSingleBlockedJson(f.run(["read-notes", "--vault", f.vault, "--paths", '["Evidence.md"]', "--collect-state", collectionPath]), op)
    assert.equal(fs.existsSync(collectionPath), false)
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})

test("the pre-publication authority recheck blocks a pending registration after the prior snapshot", () => {
  const f = fixture()
  try {
    const hook = path.join(f.root, "register-pending-after-snapshot.cjs")
    const marker = path.join(f.root, "hook-fired")
    fs.mkdirSync(f.stateRoot, { recursive: true })
    const vaultHash = createHash("sha256").update(fs.realpathSync(f.vault)).digest("hex")
    const operationsDir = path.join(fs.realpathSync(f.stateRoot), "vaults", vaultHash, "operations")
    fs.mkdirSync(operationsDir, { recursive: true })
    fs.writeFileSync(hook, `
const fs = require("node:fs")
const path = require("node:path")
const operationsDir = path.resolve(process.env.GRAPHMORY_TEST_OPERATIONS)
const marker = process.env.GRAPHMORY_TEST_MARKER
const originalReaddirSync = fs.readdirSync.bind(fs)
let inspections = 0
fs.readdirSync = function(directory, ...args) {
  const result = originalReaddirSync(directory, ...args)
  if (path.resolve(directory) === operationsDir) {
    inspections++
    if (inspections === 2) {
      const operation = path.join(operationsDir, "interrupted-test-registration")
      fs.mkdirSync(operation, { recursive: true })
      fs.writeFileSync(path.join(operation, "manifest.json"), JSON.stringify({}))
      fs.writeFileSync(marker, "fired")
    }
  }
  return result
}
`)
    const outputPath = path.join(f.root, "handoff.json")
    const result = spawnSync(process.execPath, ["--require", hook, cli, "source-handoff", "--vault", f.vault,
      "--paths", '["Evidence.md"]', "--out", outputPath], {
      encoding: "utf8",
      env: { ...process.env, GRAPHMORY_STATE_DIR: f.stateRoot,
        GRAPHMORY_TEST_OPERATIONS: operationsDir,
        GRAPHMORY_TEST_MARKER: marker },
    })
    assert.equal(fs.existsSync(marker), true, result.stderr || result.stdout)
    assertSingleBlockedJson(result, "interrupted-test-registration", "STATE_CHANGED_DURING_READ")
    assert.equal(fs.existsSync(outputPath), false)
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})

test("legacy reads remain available when clear without a receipt; recovery is exact and non-authoritative", () => {
  const f = fixture()
  try {
    const normal = f.run(["read-notes", "--vault", f.vault, "--paths", '["Policy.md"]'])
    assert.equal(normal.status, 0, normal.stderr)
    assert.match(JSON.parse(normal.stdout).sources[0].markdown, new RegExp(sentinel, "u"))
    assert.equal(fs.existsSync(f.stateRoot), false)
    const handoffPath = path.join(f.root, "handoff.json")
    const handoff = f.run(["source-handoff", "--vault", f.vault, "--paths", '["Evidence.md"]', "--out", handoffPath])
    assert.equal(handoff.status, 0, handoff.stderr)
    assert.deepEqual(JSON.parse(fs.readFileSync(handoffPath, "utf8")), JSON.parse(handoff.stdout))

    const prepared = prepareCurationCheckpoint({ vault: f.vault, patch, targets: ["Policy.md"], sources: ["Evidence.md"], stateRoot: f.stateRoot })
    fs.writeFileSync(path.join(f.vault, "Policy.md"), `# Partial\n\n${sentinel} partial update.\n`)
    const recovery = f.run(["read-notes", "--vault", f.vault, "--paths", '["Policy.md","Evidence.md"]',
      "--purpose", "recovery", "--operation", prepared.operation])
    assert.equal(recovery.status, 0, recovery.stderr)
    const result = JSON.parse(recovery.stdout)
    assert.equal(result.authority, "recovery-only")
    assert.equal(result.authoritative, false)
    assert.equal(result.reads[0].markdown.includes(sentinel), true)
    assert.match(result.reads[0].currentSha256, /^[a-f0-9]{64}$/u)
    assert.equal(result.reads[1].status, "verified-original")

    const wrongPath = f.run(["read-notes", "--vault", f.vault, "--paths", '["Other.md"]',
      "--purpose", "recovery", "--operation", prepared.operation])
    assertSingleBlockedJson(wrongPath, prepared.operation, "RECOVERY_PATH_NOT_BOUND")

    fs.writeFileSync(path.join(f.vault, "Evidence.md"), "# Changed source\n")
    const drift = f.run(["read-notes", "--vault", f.vault, "--paths", '["Evidence.md"]',
      "--purpose", "recovery", "--operation", prepared.operation])
    assert.equal(drift.status, 0, drift.stderr)
    const driftedSource = JSON.parse(drift.stdout).reads[0]
    assert.equal(driftedSource.status, "changed")
    assert.equal(Object.hasOwn(driftedSource, "markdown"), false)

    const state = inspectCurationCheckpoint({ vault: f.vault, stateRoot: f.stateRoot })
    restoreCurationCheckpoint({ vault: f.vault, operation: prepared.operation, expectedHashes: state.expectedHashes,
      approve: true, stateRoot: f.stateRoot })
    const afterRestore = f.run(["read-notes", "--vault", f.vault, "--paths", '["Policy.md"]'])
    assert.equal(afterRestore.status, 0, afterRestore.stderr)
    assert.match(JSON.parse(afterRestore.stdout).sources[0].markdown, new RegExp(sentinel, "u"))
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})

test("inconsistent state with a missing operation directory returns a JSON block", () => {
  const f = fixture()
  try {
    prepareCurationCheckpoint({ vault: f.vault, patch, targets: ["Policy.md"], sources: ["Evidence.md"], stateRoot: f.stateRoot })
    const vaultHash = createHash("sha256").update(fs.realpathSync(f.vault)).digest("hex")
    fs.rmSync(path.join(f.stateRoot, "vaults", vaultHash, "operations"), { recursive: true, force: true })
    const result = f.run(["read-notes", "--vault", f.vault, "--paths", '["Policy.md"]'])
    assertSingleBlockedJson(result, undefined, "CHECKPOINT_STATE_UNREADABLE")
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})
