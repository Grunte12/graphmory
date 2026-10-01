import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import test from "node:test"
import { beginAgentRead, finishAgentRead, withAgentReadAuthority } from "../src/read-authority.mjs"
import { inspectCurationCheckpoint, prepareCurationCheckpoint, readCurationRecoveryContext, restoreCurationCheckpoint } from "../src/curation-checkpoint.mjs"
import { managedRecall } from "../src/decision-recall.mjs"
import { DEFAULT_RUNTIME_CONFIG as HYBRID_RUNTIME_CONFIG } from "../src/runtime-config.mjs"
const DEFAULT_RUNTIME_CONFIG = { ...HYBRID_RUNTIME_CONFIG, retrievalMode: "lexical" }
import { planDecisionCuration } from "../src/decision-curation.mjs"
import { requireCurrentAgentRead } from "../src/read-authority.mjs"

function temporaryVault() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-read-authority-"))
  const vault = path.join(root, "vault")
  const stateRoot = path.join(root, "state")
  fs.mkdirSync(vault)
  fs.writeFileSync(path.join(vault, "Policy.md"), "# Existing policy\n\nSynthetic old policy.\n")
  fs.writeFileSync(path.join(vault, "Evidence.md"), "# Evidence\nThe user approved independent reviewers.\n")
  return { root, vault, stateRoot }
}

const patch = {
  claim: "Production releases require an independent reviewer.",
  why_it_matters: "Independent review prevents an owner from approving their own release.",
  scope: { applies: ["production releases"], excludes: ["development releases"] },
  provenance: [{ kind: "file", value: "Evidence.md" }],
  confidence: "high",
  suggested_type: "decision",
  lifecycle: { status: "active", revalidate_when: [], supersedes: [] },
}

test("guard accepts stable clear state, blocks pending, and fails closed on inspector errors", async () => {
  const clear = { blocked: false, status: "none", authorityToken: "clear-1" }
  assert.equal(beginAgentRead({ vault: "/synthetic", inspect: () => clear }).ok, true)
  assert.equal(finishAgentRead({ vault: "/synthetic", authorityToken: "clear-1", inspect: () => clear }).ok, true)

  const pending = beginAgentRead({ vault: "/synthetic", inspect: () => ({ blocked: true, status: "pending", operation: "op-1", authorityToken: "pending-1" }) })
  assert.equal(pending.ok, false)
  assert.equal(pending.code, "CURATION_PENDING")
  assert.equal(pending.operation, "op-1")

  const unreadable = beginAgentRead({ vault: "/synthetic", inspect: () => { throw new Error("CHECKPOINT_STATE_UNREADABLE: corrupt state") } })
  assert.equal(unreadable.ok, false)
  assert.equal(unreadable.code, "CHECKPOINT_STATE_UNREADABLE")
  assert.equal(Object.hasOwn(unreadable, "value"), false)
})

test("authority token comparison catches clear-to-pending-to-clear transitions", async () => {
  const states = [
    { blocked: false, status: "none", authorityToken: "state-before" },
    { blocked: false, status: "complete", authorityToken: "state-after-operation" },
  ]
  let reads = 0
  const guarded = await withAgentReadAuthority({ vault: "/synthetic", inspect: () => states.shift(),
    read: async () => { reads++; return { secret: "assembled but must be discarded" } } })
  assert.equal(reads, 1)
  assert.equal(guarded.ok, false)
  assert.equal(guarded.code, "STATE_CHANGED_DURING_READ")
  assert.equal(Object.hasOwn(guarded, "value"), false)
})

test("pending recovery exposes only exact operation-bound paths with hashes and recovery-only labels", () => {
  const f = temporaryVault()
  try {
    const before = inspectCurationCheckpoint({ vault: f.vault, stateRoot: f.stateRoot })
    const prepared = prepareCurationCheckpoint({ vault: f.vault, patch, targets: ["Policy.md"], sources: ["Evidence.md"], stateRoot: f.stateRoot })
    const pending = inspectCurationCheckpoint({ vault: f.vault, stateRoot: f.stateRoot })
    assert.notEqual(before.authorityToken, pending.authorityToken)
    fs.writeFileSync(path.join(f.vault, "Policy.md"), "# Partially edited target\n\nCurrent partial bytes.\n")

    const recovery = readCurationRecoveryContext({ vault: f.vault, stateRoot: f.stateRoot,
      operation: prepared.operation, paths: ["Policy.md", "Evidence.md"] })
    assert.equal(recovery.status, "RECOVERY_READ")
    assert.equal(recovery.authority, "recovery-only")
    assert.equal(recovery.authoritative, false)
    assert.equal(recovery.reads[0].markdown, "# Partially edited target\n\nCurrent partial bytes.\n")
    assert.match(recovery.reads[0].currentSha256, /^[a-f0-9]{64}$/u)
    assert.equal(recovery.reads[1].status, "verified-original")
    assert.equal(recovery.reads[1].markdown, fs.readFileSync(path.join(f.vault, "Evidence.md"), "utf8"))
    assert.throws(() => readCurationRecoveryContext({ vault: f.vault, stateRoot: f.stateRoot,
      operation: prepared.operation, paths: ["Other.md"] }), /RECOVERY_PATH_NOT_BOUND/u)
    assert.throws(() => readCurationRecoveryContext({ vault: f.vault, stateRoot: f.stateRoot,
      operation: "00000000-0000-0000-0000-000000000000", paths: ["Policy.md"] }), /RECOVERY_OPERATION_MISMATCH/u)

    fs.writeFileSync(path.join(f.vault, "Evidence.md"), "# Changed source\n")
    const drifted = readCurationRecoveryContext({ vault: f.vault, stateRoot: f.stateRoot,
      operation: prepared.operation, paths: ["Evidence.md"] })
    assert.equal(drifted.reads[0].status, "changed")
    assert.equal(Object.hasOwn(drifted.reads[0], "markdown"), false)
    const current = inspectCurationCheckpoint({ vault: f.vault, stateRoot: f.stateRoot })
    restoreCurationCheckpoint({ vault: f.vault, operation: prepared.operation, expectedHashes: current.expectedHashes,
      approve: true, stateRoot: f.stateRoot })
    const afterRestore = inspectCurationCheckpoint({ vault: f.vault, stateRoot: f.stateRoot })
    assert.equal(afterRestore.blocked, false)
    assert.notEqual(before.authorityToken, afterRestore.authorityToken)
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})

test("missing operation directory under an existing per-vault state fails closed", () => {
  const f = temporaryVault()
  try {
    prepareCurationCheckpoint({ vault: f.vault, patch, targets: ["Policy.md"], sources: ["Evidence.md"], stateRoot: f.stateRoot })
    const vaultHash = createHash("sha256").update(fs.realpathSync(f.vault)).digest("hex")
    const operationsDirectory = path.join(f.stateRoot, "vaults", vaultHash, "operations")
    fs.rmSync(operationsDirectory, { recursive: true, force: true })
    const blocked = beginAgentRead({ vault: f.vault, stateRoot: f.stateRoot })
    assert.equal(blocked.ok, false)
    assert.equal(blocked.code, "CHECKPOINT_STATE_UNREADABLE")
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})

test("a terminal manifest bound to another vault is treated as unresolved corruption", () => {
  const f = temporaryVault()
  try {
    const prepared = prepareCurationCheckpoint({ vault: f.vault, patch, targets: ["Policy.md"], sources: ["Evidence.md"], stateRoot: f.stateRoot })
    const vaultHash = createHash("sha256").update(fs.realpathSync(f.vault)).digest("hex")
    const manifestPath = path.join(f.stateRoot, "vaults", vaultHash, "operations", prepared.operation, "manifest.json")
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    manifest.status = "complete"
    manifest.vaultRoot = path.join(f.root, "different-vault")
    fs.writeFileSync(manifestPath, JSON.stringify(manifest))
    const blocked = beginAgentRead({ vault: f.vault, stateRoot: f.stateRoot })
    assert.equal(blocked.ok, false)
    assert.equal(blocked.code, "CURATION_PENDING")
    assert.equal(blocked.operation, prepared.operation)
    assert.equal(blocked.operationStatus, "interrupted-registration")
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})

test("managed recall discards a read when authority changes during retrieval", async () => {
  const f = temporaryVault()
  try {
    const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
    let operation
    const report = await managedRecall(f.vault, "independent reviewer", config, {
      stateRoot: f.stateRoot,
      semanticExpansion: true,
      semanticLaneImpl: async () => {
        operation = prepareCurationCheckpoint({ vault: f.vault, patch, targets: ["Policy.md"], sources: ["Evidence.md"], stateRoot: f.stateRoot }).operation
        return { method: "semantic-vector", model: "test", results: [] }
      },
    })
    assert.equal(report.status, "BLOCKED")
    assert.equal(report.code, "STATE_CHANGED_DURING_READ")
    assert.equal(report.operation, operation)
    assert.deepEqual(report.results, [])
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})

test("decision curation rechecks authority immediately before calling its provider", async () => {
  const f = temporaryVault()
  try {
    const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
    config.workflow = "local-decision"
    config.decision.endpoint = "http://127.0.0.1:8000/v1/systemone"
    const decisionPatch = { ...patch, provenance: [{ kind: "file", value: "source-1" }] }
    const input = { patch: decisionPatch, sources: [{ id: "source-1", text: "The user approved independent reviewers." }], candidate_paths: ["Policy.md"] }
    const start = beginAgentRead({ vault: f.vault, stateRoot: f.stateRoot })
    let providerCalls = 0
    await assert.rejects(() => planDecisionCuration(f.vault, input, config, {
      beforeProvider() {
        prepareCurationCheckpoint({ vault: f.vault, patch: decisionPatch, targets: ["Policy.md"], sources: ["Evidence.md"], stateRoot: f.stateRoot })
        requireCurrentAgentRead({ vault: f.vault, stateRoot: f.stateRoot, authorityToken: start.authorityToken })
      },
      fetchImpl: async () => { providerCalls++; throw new Error("provider should remain unused") },
    }), (error) => error.authorityDecision?.code === "STATE_CHANGED_DURING_READ")
    assert.equal(providerCalls, 0)
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})
