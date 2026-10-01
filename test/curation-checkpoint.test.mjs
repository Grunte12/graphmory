import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { spawn, spawnSync } from "node:child_process"
import {
  finishCurationCheckpoint,
  inspectCurationCheckpoint,
  prepareCurationCheckpoint,
  restoreCurationCheckpoint,
} from "../src/curation-checkpoint.mjs"
import { renderPatchRecord } from "../src/patch-record.mjs"

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-curation-checkpoint-"))
}

function patch({ provenance = [{ kind: "file", value: "Evidence.md#approval" }] } = {}) {
  return {
    claim: "Production releases require an independent approver.",
    why_it_matters: "Independent review prevents release owners from approving their own changes.",
    scope: { applies: ["production releases"], excludes: ["development deployments"] },
    provenance,
    confidence: "high",
    suggested_type: "decision",
    lifecycle: {
      status: "active",
      revalidate_when: ["approval owner changes", "release process changes"],
      supersedes: [],
    },
  }
}

function fixture({ includeSource = true } = {}) {
  const root = tempRoot()
  const vault = path.join(root, "vault")
  const stateRoot = path.join(root, "state")
  fs.mkdirSync(vault)
  const preimage = Buffer.from("# Existing policy\r\n\r\nPreserve these exact bytes.\r\n")
  fs.writeFileSync(path.join(vault, "Policy.md"), preimage)
  if (includeSource) fs.writeFileSync(path.join(vault, "Evidence.md"), "# Evidence\nApproved releases use a separate reviewer.\n")
  fs.mkdirSync(path.join(vault, ".obsidian"))
  fs.writeFileSync(path.join(vault, ".obsidian", "app.json"), '{"theme":"test"}\n')
  return { root, vault, stateRoot, preimage }
}

function prepare({ vault, stateRoot, patchValue = patch(), targets = ["Policy.md"], sources = ["Evidence.md"], now } = {}) {
  return prepareCurationCheckpoint({ vault, stateRoot, patch: patchValue, targets, sources, ...(now ? { now } : {}) })
}

function writeCanonical(vault, patchValue, targets) {
  const record = `${renderPatchRecord(patchValue)}\n[[Evidence]]\n`
  for (const target of targets) {
    const absolute = path.join(vault, target)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, record)
  }
}

function digest(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function seedStateLock(context, { pid = 2_147_483_647, hostname = os.hostname() } = {}) {
  const before = inspectCurationCheckpoint(context)
  fs.mkdirSync(before.lockPath)
  const ownerBytes = Buffer.from(JSON.stringify({ pid, hostname, startedAt: "2026-10-01T00:00:00.000Z" }))
  fs.writeFileSync(path.join(before.lockPath, "owner.json"), ownerBytes, { mode: 0o600 })
  return { ownerBytes, status: inspectCurationCheckpoint(context) }
}

test("pending operation survives a fresh process, reports reviewed hashes, and blocks duplicate prepare", () => {
  const context = fixture()
  try {
    assert.equal(inspectCurationCheckpoint(context).blocked, false)
    assert.equal(fs.existsSync(context.stateRoot), false, "read-only status must not create user state")
    const prepared = prepare(context)
    assert.equal(prepared.status, "pending")
    assert.equal(prepared.expectedHashes["Policy.md"], digest(context.preimage))

    const moduleUrl = new URL("../src/curation-checkpoint.mjs", import.meta.url).href
    const script = `import { inspectCurationCheckpoint } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(inspectCurationCheckpoint({vault:process.argv[1],stateRoot:process.argv[2]})))`
    const fresh = spawnSync(process.execPath, ["--input-type=module", "-e", script, context.vault, context.stateRoot], { encoding: "utf8" })
    assert.equal(fresh.status, 0, fresh.stderr)
    const state = JSON.parse(fresh.stdout)
    assert.equal(state.blocked, true)
    assert.equal(state.operation, prepared.operation)
    assert.equal(state.status, "pending")
    assert.equal(state.expectedHashes["Policy.md"], digest(context.preimage))

    assert.throws(() => prepare(context), /CURATION_PENDING/)
    assert.equal(inspectCurationCheckpoint(context).operation, prepared.operation)
  } finally {
    fs.rmSync(context.root, { recursive: true, force: true })
  }
})

test("state root cannot be placed inside the vault", () => {
  const context = fixture()
  try {
    const nestedState = path.join(context.vault, ".curation-state")
    assert.throws(() => prepareCurationCheckpoint({ vault: context.vault, stateRoot: nestedState,
      patch: patch(), targets: ["Policy.md"], sources: ["Evidence.md"] }), /UNSAFE_STATE_ROOT/)
    assert.equal(fs.existsSync(nestedState), false)
  } finally {
    fs.rmSync(context.root, { recursive: true, force: true })
  }
})

test("source and target hard links are rejected as the same physical file", () => {
  const context = fixture()
  try {
    fs.unlinkSync(path.join(context.vault, "Policy.md"))
    fs.linkSync(path.join(context.vault, "Evidence.md"), path.join(context.vault, "Policy.md"))
    assert.throws(() => prepare(context), /SOURCE_TARGET_OVERLAP/)
  } finally {
    fs.rmSync(context.root, { recursive: true, force: true })
  }
})

test("failed close leaves ownership pending; exact patch can finish and replay without writes", () => {
  const context = fixture()
  try {
    const patchValue = patch()
    const prepared = prepare({ ...context, patchValue })
    writeCanonical(context.vault, patchValue, ["Policy.md"])
    const wrongPatch = { ...patchValue, claim: "Production releases can approve themselves." }
    assert.throws(() => finishCurationCheckpoint({ ...context, operation: prepared.operation, patch: wrongPatch, notePath: "Policy.md" }), /PATCH_BINDING_MISMATCH/)
    const afterFailure = inspectCurationCheckpoint(context)
    assert.equal(afterFailure.blocked, true)
    assert.equal(afterFailure.status, "pending")
    assert.match(JSON.stringify(afterFailure.operations), /PATCH_BINDING_MISMATCH|FINISH_FAILED/)

    const closed = finishCurationCheckpoint({ ...context, operation: prepared.operation, patch: patchValue, notePath: "Policy.md" })
    assert.equal(closed.status, "complete")
    const beforeReplay = fs.readFileSync(path.join(context.vault, "Policy.md"))
    const replay = prepare({ ...context, patchValue })
    assert.equal(replay.replayed, true)
    assert.equal(replay.operation, prepared.operation)
    assert.deepEqual(fs.readFileSync(path.join(context.vault, "Policy.md")), beforeReplay)
    fs.appendFileSync(path.join(context.vault, "Policy.md"), "\n# Runbook note added after completion\n")
    assert.throws(() => prepare({ ...context, patchValue }), /REPLAY_REVERIFY_FAILED/)
  } finally {
    fs.rmSync(context.root, { recursive: true, force: true })
  }
})

test("restore preflights all targets, resumes a partial restore, and preserves changed sources", () => {
  const context = fixture()
  const patchValue = patch()
  const targets = ["Policy.md", "New Policy.md"]
  try {
    const prepared = prepare({ ...context, patchValue, targets })
    writeCanonical(context.vault, patchValue, targets)
    const sourceChanged = "# Evidence\nA reviewer process changed after preparation.\n"
    fs.writeFileSync(path.join(context.vault, "Evidence.md"), sourceChanged)

    assert.throws(() => finishCurationCheckpoint({ ...context, operation: prepared.operation, patch: patchValue, notePath: "Policy.md" }), /SOURCE_CHANGED/)
    const pending = inspectCurationCheckpoint(context)
    assert.equal(pending.blocked, true)
    const reviewed = pending.expectedHashes

    const originalUnlink = fs.unlinkSync
    let injected = false
    fs.unlinkSync = function (target, ...args) {
      if (!injected && path.resolve(String(target)) === path.join(fs.realpathSync(context.vault), "New Policy.md")) {
        injected = true
        const error = new Error("simulated interruption after the first target")
        error.code = "EIO"
        throw error
      }
      return originalUnlink.call(this, target, ...args)
    }
    try {
      let interruptedError
      try { restoreCurationCheckpoint({ ...context, operation: prepared.operation, expectedHashes: reviewed, approve: true }) }
      catch (error) { interruptedError = error }
      assert.match(interruptedError?.message ?? "", /simulated interruption/)
      assert.equal(interruptedError.code, "EIO")
    } finally {
      fs.unlinkSync = originalUnlink
    }
    assert.equal(fs.readFileSync(path.join(context.vault, "Policy.md"), "utf8"), context.preimage.toString("utf8"))
    assert.equal(fs.existsSync(path.join(context.vault, "New Policy.md")), true)
    const interrupted = inspectCurationCheckpoint(context)
    assert.equal(interrupted.status, "recovery-in-progress")

    const restored = restoreCurationCheckpoint({ ...context, operation: prepared.operation, expectedHashes: interrupted.expectedHashes, approve: true })
    assert.equal(restored.status, "recovered")
    assert.equal(restored.resumed, true)
    assert.deepEqual(restored.restored, targets)
    assert.deepEqual(restored.sourceDrift.map((item) => item.path), ["Evidence.md"])
    assert.equal(fs.readFileSync(path.join(context.vault, "Evidence.md"), "utf8"), sourceChanged)
    assert.equal(fs.readFileSync(path.join(context.vault, "Policy.md"), "utf8"), context.preimage.toString("utf8"))
    assert.equal(fs.existsSync(path.join(context.vault, "New Policy.md")), false)
  } finally {
    fs.rmSync(context.root, { recursive: true, force: true })
  }
})

test("user-statement intake accepts no file sources and inventory binds Obsidian JSON", () => {
  const context = fixture({ includeSource: false })
  const patchValue = patch({ provenance: [{ kind: "user-statement", value: "User stated that production changes need a separate reviewer." }] })
  try {
    fs.mkdirSync(path.join(context.vault, "00 Inbox"))
    fs.writeFileSync(path.join(context.vault, "00 Inbox", "Raw.md"), "# Raw capture\nOriginal capture.\n")
    fs.mkdirSync(path.join(context.vault, ".hidden"))
    fs.writeFileSync(path.join(context.vault, ".hidden", "Hidden.md"), "# Hidden note\nOriginal hidden memory.\n")
    const prepared = prepare({ ...context, patchValue, sources: [] })
    assert.deepEqual(prepared.sources, [])
    assert.equal(prepared.status, "pending")
    writeCanonical(context.vault, patchValue, ["Policy.md"])
    fs.writeFileSync(path.join(context.vault, ".obsidian", "app.json"), '{"theme":"changed"}\n')
    fs.writeFileSync(path.join(context.vault, "00 Inbox", "Raw.md"), "# Raw capture\nChanged raw capture.\n")
    fs.writeFileSync(path.join(context.vault, ".hidden", "Hidden.md"), "# Hidden note\nChanged hidden memory.\n")
    assert.throws(() => finishCurationCheckpoint({ ...context, operation: prepared.operation, patch: patchValue, notePath: "Policy.md" }), /UNDECLARED_DRIFT/)
    const state = inspectCurationCheckpoint(context)
    assert.equal(state.blocked, true)
  } finally {
    fs.rmSync(context.root, { recursive: true, force: true })
  }
})

test("finish reports unrelated baseline graph and lifecycle findings while rejecting new target links", () => {
  const context = fixture()
  try {
    fs.writeFileSync(path.join(context.vault, "Old Policy.md"), '---\nstatus: active\nvalid_until: "2000-01-01"\n---\n# Old Policy\nExpired old policy.\n')
    fs.writeFileSync(path.join(context.vault, "Old Link.md"), "# Old link\n[[Missing Old Note]]\n")
    const patchValue = patch()
    const prepared = prepare({ ...context, patchValue })
    writeCanonical(context.vault, patchValue, ["Policy.md"])
    const closed = finishCurationCheckpoint({ ...context, operation: prepared.operation, patch: patchValue, notePath: "Policy.md" })
    assert.equal(closed.status, "complete")
    assert.ok(closed.receipt.audit.unrelatedBaselineGraphIssues.some((item) => item.source === "Old Link.md"))
    assert.ok(closed.receipt.audit.unrelatedBaselineLifecycleFindings.some((item) => item.file === "Old Policy.md" && item.kind === "expired-valid-until"))
  } finally {
    fs.rmSync(context.root, { recursive: true, force: true })
  }

  const affected = fixture()
  try {
    const patchValue = patch()
    const prepared = prepare({ ...affected, patchValue })
    writeCanonical(affected.vault, patchValue, ["Policy.md"])
    fs.appendFileSync(path.join(affected.vault, "Policy.md"), "\n[[New Missing Relationship]]\n")
    let failure
    try { finishCurationCheckpoint({ ...affected, operation: prepared.operation, patch: patchValue, notePath: "Policy.md" }) }
    catch (error) { failure = error }
    assert.match(failure?.message ?? "", /AFFECTED_AUDIT_FAILED/u)
    assert.ok(failure.affectedAudit.totalCount >= 1)
    assert.ok(failure.affectedAudit.findings.some((item) => item.file === "Policy.md" && item.kind))
    assert.match(failure.message, /repair named paths/u)
    assert.equal(inspectCurationCheckpoint(affected).blocked, true)
    assert.equal(inspectCurationCheckpoint(affected).operations[0].lastFailure.affectedAudit.totalCount, failure.affectedAudit.totalCount)
  } finally {
    fs.rmSync(affected.root, { recursive: true, force: true })
  }
})

test("inventory fails closed on symlink coverage and detects a 5,001st Markdown file", () => {
  const linked = fixture()
  try {
    const outside = path.join(linked.root, "outside.md")
    fs.writeFileSync(outside, "# Outside\nMust not be read as vault coverage.\n")
    fs.symlinkSync(outside, path.join(linked.vault, "Linked.md"))
    assert.throws(() => prepare({ ...linked, sources: [] }), /INCOMPLETE_INVENTORY.*symbolic link/)
    assert.equal(fs.readFileSync(outside, "utf8"), "# Outside\nMust not be read as vault coverage.\n")
  } finally {
    fs.rmSync(linked.root, { recursive: true, force: true })
  }

  const capped = fixture({ includeSource: false })
  try {
    for (let index = 0; index < 5001; index += 1) {
      fs.writeFileSync(path.join(capped.vault, `Note ${index}.md`), "# Note\n")
    }
    assert.throws(() => prepare({ ...capped, sources: [] }), /exceeds the 5,000 Markdown file cap/)
  } finally {
    fs.rmSync(capped.root, { recursive: true, force: true })
  }
})

test("restore requires a reviewed hash and preserves a same-host lock after its owner process is killed", async () => {
  const context = fixture()
  let child
  try {
    const patchValue = patch()
    const prepared = prepare({ ...context, patchValue })
    writeCanonical(context.vault, patchValue, ["Policy.md"])
    const beforeLock = inspectCurationCheckpoint(context)
    const moduleUrl = new URL("../src/curation-checkpoint.mjs", import.meta.url).href
    const childCode = `import fs from "node:fs"; const rename=fs.renameSync; fs.renameSync=function(from,to,...rest){const result=rename.call(this,from,to,...rest); if(String(to).endsWith("/manifest.json")){const m=JSON.parse(fs.readFileSync(to,"utf8")); if(m.status==="recovery-in-progress" && Object.keys(m.recovery?.progress??{}).length===0){process.stdout.write("recovery-ready\\n"); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60000)}} return result}; const {restoreCurationCheckpoint}=await import(process.argv[1]); restoreCurationCheckpoint({vault:process.argv[2],stateRoot:process.argv[3],operation:process.argv[4],expectedHashes:JSON.parse(process.argv[5]),approve:true})`
    child = spawn(process.execPath, ["--input-type=module", "-e", childCode, moduleUrl, context.vault, context.stateRoot,
      prepared.operation, JSON.stringify(beforeLock.expectedHashes)], { stdio: ["ignore", "pipe", "pipe"] })
    await new Promise((resolve, reject) => {
      child.once("error", reject)
      child.once("exit", (code, signal) => reject(new Error(`restore child exited before interruption point (${code ?? signal})`)))
      child.stdout.once("data", (chunk) => resolve(chunk.toString()))
    }).then((ready) => assert.match(ready, /recovery-ready/))
    assert.equal(child.kill("SIGKILL"), true)
    await new Promise((resolve, reject) => {
      child.once("error", reject)
      child.once("exit", (code, signal) => signal === "SIGKILL" ? resolve() : reject(new Error(`unexpected restore child exit (${code ?? signal})`)))
    })
    const seeded = { status: inspectCurationCheckpoint(context) }
    assert.equal(seeded.status.blocked, true)
    assert.equal(seeded.status.status, "recovery-in-progress")
    assert.equal(seeded.status.lockOwner.pid, child.pid)
    assert.equal(seeded.status.lockOwner.hostname, os.hostname())
    assert.match(seeded.status.lockOwnerSha256, /^[a-f0-9]{64}$/u)
    assert.equal(seeded.status.lockPath, beforeLock.lockPath)

    assert.throws(() => restoreCurationCheckpoint({ ...context, operation: prepared.operation,
      expectedHashes: seeded.status.expectedHashes, approve: true }), /CHECKPOINT_STATE_BUSY/)
    assert.equal(fs.existsSync(seeded.status.lockPath), true)

    const restored = restoreCurationCheckpoint({ ...context, operation: prepared.operation,
      expectedHashes: seeded.status.expectedHashes, approve: true, reviewLockHash: seeded.status.lockOwnerSha256 })
    assert.equal(restored.status, "recovered")
    const archivedOwner = fs.readFileSync(path.join(restored.reviewedLockArchive, "owner.json"))
    assert.equal(digest(archivedOwner), seeded.status.lockOwnerSha256)
    assert.equal(JSON.parse(archivedOwner.toString("utf8")).pid, child.pid)
    assert.equal(fs.existsSync(seeded.status.lockPath), false)
    assert.equal(inspectCurationCheckpoint(context).locked, false)
  } finally {
    if (child && child.exitCode === null) child.kill("SIGKILL")
    fs.rmSync(context.root, { recursive: true, force: true })
  }
})

test("restore refuses a reviewed lock whose same-host owner is still alive", () => {
  const context = fixture()
  try {
    const patchValue = patch()
    const prepared = prepare({ ...context, patchValue })
    writeCanonical(context.vault, patchValue, ["Policy.md"])
    const seeded = seedStateLock(context, { pid: process.pid })
    assert.throws(() => restoreCurationCheckpoint({ ...context, operation: prepared.operation,
      expectedHashes: seeded.status.expectedHashes, approve: true, reviewLockHash: seeded.status.lockOwnerSha256 }), /STATE_LOCK_OWNER_ALIVE/)
    assert.equal(fs.existsSync(seeded.status.lockPath), true)
    assert.equal(inspectCurationCheckpoint(context).locked, true)
  } finally {
    fs.rmSync(context.root, { recursive: true, force: true })
  }
})

test("reviewed absence restores the preimage of an originally existing target", () => {
  const context = fixture()
  try {
    const patchValue = patch()
    const prepared = prepare({ ...context, patchValue })
    fs.unlinkSync(path.join(context.vault, "Policy.md"))
    const state = inspectCurationCheckpoint(context)
    assert.equal(state.expectedHashes["Policy.md"], null)
    const restored = restoreCurationCheckpoint({ ...context, operation: prepared.operation,
      expectedHashes: state.expectedHashes, approve: true })
    assert.equal(restored.status, "recovered")
    assert.deepEqual(fs.readFileSync(path.join(context.vault, "Policy.md")), context.preimage)
  } finally {
    fs.rmSync(context.root, { recursive: true, force: true })
  }
})

test("finish refuses covered-file drift between its audit snapshot and final receipt", () => {
  const context = fixture()
  const patchValue = patch()
  try {
    const prepared = prepare({ ...context, patchValue })
    writeCanonical(context.vault, patchValue, ["Policy.md"])
    const originalReaddir = fs.readdirSync
    const vaultRoot = fs.realpathSync(context.vault)
    let rootReads = 0
    let injected = false
    fs.readdirSync = function (directory, ...args) {
      const entries = originalReaddir.call(this, directory, ...args)
      if (path.resolve(String(directory)) === vaultRoot && ++rootReads === 2) {
        fs.appendFileSync(path.join(vaultRoot, "Policy.md"), "\nA concurrent edit landed during finish.\n")
        injected = true
      }
      return entries
    }
    try {
      assert.throws(() => finishCurationCheckpoint({ ...context, operation: prepared.operation, patch: patchValue, notePath: "Policy.md" }), /COVERED_DRIFT_DURING_FINISH/)
      assert.equal(injected, true)
    } finally {
      fs.readdirSync = originalReaddir
    }
    assert.equal(inspectCurationCheckpoint(context).blocked, true)
  } finally {
    fs.rmSync(context.root, { recursive: true, force: true })
  }
})

test("unknown patch fields are rejected before checkpoint state is created", () => {
  const context = fixture()
  try {
    const unsupported = { ...patch(), unsupported_mvp_field: "not renderable" }
    assert.throws(() => prepare({ ...context, patchValue: unsupported }), /Memory Patch contract/)
    assert.equal(fs.existsSync(context.stateRoot), false)
    assert.equal(inspectCurationCheckpoint(context).blocked, false)
  } finally {
    fs.rmSync(context.root, { recursive: true, force: true })
  }
})
