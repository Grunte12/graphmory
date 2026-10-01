import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { DEFAULT_RUNTIME_CONFIG as HYBRID_RUNTIME_CONFIG } from "../src/runtime-config.mjs"
const DEFAULT_RUNTIME_CONFIG = { ...HYBRID_RUNTIME_CONFIG, retrievalMode: "lexical" }

const cli = path.resolve("scripts/brain-sync.mjs")
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-mvp-cli-"))
  const vault = path.join(root, "vault with spaces"), state = path.join(root, "private state")
  fs.mkdirSync(vault)
  const original = "# Existing policy\r\n\r\nA synthetic policy requiring review.\r\n"
  fs.writeFileSync(path.join(vault, "Policy.md"), original)
  fs.writeFileSync(path.join(vault, "Evidence.md"), "# Evidence\nThe user approved independent reviewers.\n")
  const patch = { claim: "Production releases require an independent reviewer.",
    why_it_matters: "Independent review prevents an owner from approving their own release.",
    scope: { applies: ["production releases"], excludes: ["development releases"] },
    provenance: [{ kind: "file", value: "Evidence.md" }], confidence: "high", suggested_type: "decision",
    lifecycle: { status: "active", revalidate_when: [], supersedes: [] } }
  const input = path.join(root, "patch.json"), config = path.join(root, "curator.json")
  fs.writeFileSync(input, JSON.stringify(patch)); fs.writeFileSync(config, JSON.stringify(DEFAULT_RUNTIME_CONFIG))
  const run = (args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", env: { ...process.env, GRAPHMORY_STATE_DIR: state } })
  const json = (args, status = 0) => {
    const result = run(args); assert.equal(result.status, status, result.stderr || result.stdout)
    return JSON.parse(result.stdout)
  }
  const checkpoint = (action, extra = [], status = 0) => json(["curation-checkpoint", action, "--vault", vault, ...extra, "--agent"], status)
  return { root, vault, state, original, patch, input, config, run, json, checkpoint }
}

test("CLI full projection, pending recall guard, successful close and exact replay integrate", () => {
  const f = fixture()
  try {
    const rendered = f.run(["render-patch", "--input", f.input])
    assert.equal(rendered.status, 0, rendered.stderr)
    assert.deepEqual(fs.readdirSync(f.vault).sort(), ["Evidence.md", "Policy.md"])
    const prepared = f.checkpoint("prepare", ["--input", f.input, "--targets", '["Policy.md"]', "--sources", '["Evidence.md"]'])
    assert.equal(prepared.status, "pending")
    const pending = f.checkpoint("status")
    assert.equal(pending.blocked, true)
    assert.match(pending.expectedHashes["Policy.md"], /^[a-f0-9]{64}$/)
    const recallArgs = ["recall-managed", "--retrieval-mode", "lexical", "--vault", f.vault, "--query", "production reviewer", "--config", f.config, "--agent"]
    const blocked = f.json(recallArgs, 1)
    assert.equal(blocked.status, "BLOCKED"); assert.equal(blocked.code, "CURATION_PENDING")
    assert.deepEqual(blocked.results, [])
    fs.writeFileSync(path.join(f.vault, "Policy.md"), rendered.stdout)
    const verify = f.json(["verify-patch-persistence", "--vault", f.vault, "--input", f.input, "--note", "Policy.md", "--full", "--agent"])
    assert.equal(verify.valid, true); assert.equal(verify.metadataOnly, false)
    const finished = f.checkpoint("finish", ["--operation", prepared.operation, "--input", f.input, "--note", "Policy.md"])
    assert.equal(finished.status, "complete"); assert.ok(finished.receipt)
    assert.equal(f.checkpoint("status").blocked, false)
    assert.ok(f.json(recallArgs).results.some((item) => item.path === "Policy.md"))
    const before = fs.readFileSync(path.join(f.vault, "Policy.md"))
    const replay = f.checkpoint("prepare", ["--input", f.input, "--targets", '["Policy.md"]', "--sources", '["Evidence.md"]'])
    assert.equal(replay.replayed, true); assert.equal(replay.operation, prepared.operation)
    assert.deepEqual(fs.readFileSync(path.join(f.vault, "Policy.md")), before)
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})

test("CLI failure remains discoverable; approved target recovery preserves externally changed source", () => {
  const f = fixture()
  try {
    const prepared = f.checkpoint("prepare", ["--input", f.input, "--targets", '["Policy.md","New policy.md"]', "--sources", '["Evidence.md"]'])
    fs.writeFileSync(path.join(f.vault, "Policy.md"), f.run(["render-patch", "--input", f.input]).stdout)
    fs.writeFileSync(path.join(f.vault, "Evidence.md"), "# Evidence\nAn external policy update needs review.\n")
    const failed = f.checkpoint("finish", ["--operation", prepared.operation, "--input", f.input, "--note", "Policy.md"], 1)
    assert.equal(failed.status, "BLOCKED"); assert.match(failed.error, /SOURCE_CHANGED/)
    const state = f.checkpoint("status")
    assert.equal(state.blocked, true); assert.equal(state.expectedHashes["New policy.md"], null)
    f.checkpoint("restore", ["--operation", prepared.operation, "--expected", JSON.stringify(state.expectedHashes)], 1)
    const restored = f.checkpoint("restore", ["--operation", prepared.operation, "--expected", JSON.stringify(state.expectedHashes), "--approve"])
    assert.equal(restored.status, "recovered"); assert.equal(restored.sourcesUntouched, true)
    assert.deepEqual(fs.readFileSync(path.join(f.vault, "Policy.md"), "utf8"), f.original)
    assert.equal(fs.existsSync(path.join(f.vault, "New policy.md")), false)
    assert.match(fs.readFileSync(path.join(f.vault, "Evidence.md"), "utf8"), /external policy update/)
    assert.equal(f.checkpoint("status").blocked, false)
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})

test("CLI restore accepts the reviewed dead-owner hash and preserves the old lock record", () => {
  const f = fixture()
  try {
    const prepared = f.checkpoint("prepare", ["--input", f.input, "--targets", '["Policy.md"]', "--sources", '["Evidence.md"]'])
    const rendered = f.run(["render-patch", "--input", f.input])
    assert.equal(rendered.status, 0, rendered.stderr)
    fs.writeFileSync(path.join(f.vault, "Policy.md"), rendered.stdout)

    const before = f.checkpoint("status")
    fs.mkdirSync(before.lockPath)
    fs.writeFileSync(path.join(before.lockPath, "owner.json"), JSON.stringify({
      pid: 2_147_483_647, hostname: os.hostname(), startedAt: "2026-10-01T00:00:00.000Z",
    }), { mode: 0o600 })
    const locked = f.checkpoint("status")
    assert.equal(locked.blocked, true)
    assert.match(locked.lockOwnerSha256, /^[a-f0-9]{64}$/u)
    const restored = f.checkpoint("restore", ["--operation", prepared.operation, "--expected", JSON.stringify(locked.expectedHashes),
      "--approve", "--review-lock", locked.lockOwnerSha256])
    assert.equal(restored.status, "recovered")
    assert.ok(fs.existsSync(path.join(restored.reviewedLockArchive, "owner.json")))
    assert.equal(fs.readFileSync(path.join(f.vault, "Policy.md"), "utf8"), f.original)
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})
