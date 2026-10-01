import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { spawnSync } from "node:child_process"
import { planPredecessorTransition } from "../src/lifecycle-transition.mjs"
import { prepareCurationCheckpoint, finishCurationCheckpoint, inspectCurationCheckpoint } from "../src/curation-checkpoint.mjs"
import { renderPatchRecord } from "../src/patch-record.mjs"
import { recallVault } from "../src/memory-recall.mjs"

test("transition preserves body, unrelated frontmatter, CRLF and is idempotent", () => {
  const original = '---\r\nstatus: active\r\nowner: Taylor\r\n---\r\n# Old\r\nKeep [[Evidence]] verbatim.\r\n'
  const updated = planPredecessorTransition(original, "Project/New.md")
  assert.equal(updated, '---\r\nstatus: superseded\r\nowner: Taylor\r\nsuperseded_by: "Project/New.md"\r\n---\r\n# Old\r\nKeep [[Evidence]] verbatim.\r\n')
  assert.equal(planPredecessorTransition(updated, "Project/New.md"), updated)
  assert.throws(() => planPredecessorTransition(updated, "Other.md"), /CONFLICT/)
  assert.throws(() => planPredecessorTransition('---\nstatus: active\nlifecycle: active\n---\n', "New.md"), /AMBIGUOUS/)
})

test("transition canonicalizes shorthand only when the resolver uniquely identifies the successor", () => {
  const original = '---\nstatus: active\nsuperseded_by: [[Recovery Window Policy|approved policy]]\n---\n# Old\nKeep this body.\n'
  const resolveReplacement = link => link === "Recovery Window Policy"
    ? { resolved: true, path: "01 Projects/Recovery Window Policy.md", method: "title" }
    : { resolved: false, path: null, reason: "unresolved" }
  const updated = planPredecessorTransition(original, "01 Projects/Recovery Window Policy.md", { resolveReplacement })
  assert.match(updated, /superseded_by: "01 Projects\/Recovery Window Policy\.md"\n/u)
  assert.ok(updated.endsWith("# Old\nKeep this body.\n"))
  assert.throws(() => planPredecessorTransition(original, "01 Projects/Recovery Window Policy.md", {
    resolveReplacement: () => ({ resolved: false, path: null, reason: "ambiguous" }),
  }), /CONFLICT/)
  assert.throws(() => planPredecessorTransition(original, "01 Projects/Recovery Window Policy.md", {
    resolveReplacement: () => ({ resolved: true, path: "Other/Recovery Window Policy.md" }),
  }), /CONFLICT/)
  assert.throws(() => planPredecessorTransition(original, "01 Projects/Recovery Window Policy.md", {
    resolveReplacement: () => ({ resolved: true, path: "01 Projects/recovery window policy.md" }),
  }), /CONFLICT/)
})

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-transition-"))
  const vault = path.join(root, "vault"), stateRoot = path.join(root, "state")
  fs.mkdirSync(vault)
  const old = '---\nstatus: active\ntype: decision\nprovenance: Evidence.md\nrevalidate_when: Policy changes\n---\n# Old recovery\nOld recovery limit was two hours.\n[[Evidence]]\n'
  fs.writeFileSync(path.join(vault, "Old.md"), old)
  fs.writeFileSync(path.join(vault, "Evidence.md"), "# Evidence\nNew recovery limit approved: four hours.\n")
  const patch = { claim: "Recovery limit is four hours.", why_it_matters: "Allow approved recovery time.",
    scope: { applies: ["recovery"], excludes: [] }, provenance: [{ kind: "file", value: "Evidence.md" }],
    confidence: "high", suggested_type: "decision", lifecycle: { status: "active", revalidate_when: ["Policy changes"], supersedes: ["Old.md"] } }
  return { root, vault, stateRoot, patch, old }
}

test("checkpoint generates predecessor metadata, issues receipt and fresh recall filters history", () => {
  const f = fixture()
  try {
    const prepared = prepareCurationCheckpoint({ ...f, targets: ["Old.md", "New.md"], sources: ["Evidence.md"] })
    fs.writeFileSync(path.join(f.vault, "New.md"), renderPatchRecord(f.patch) + "\n[[Evidence]]\n")
    const complete = finishCurationCheckpoint({ ...f, operation: prepared.operation, notePath: "New.md" })
    assert.equal(complete.status, "complete")
    assert.ok(complete.receipt.targetHashes["Old.md"])
    assert.equal(inspectCurationCheckpoint(f).blocked, false)
    assert.match(fs.readFileSync(path.join(f.vault, "Old.md"), "utf8"), /status: superseded\n/)
    assert.ok(!recallVault(f.vault, "recovery", { k: 10 }).results.some(item => item.path === "Old.md"))
    const fresh = spawnSync(process.execPath, ["scripts/brain-sync.mjs", "read-notes", "--vault", f.vault, "--paths", '["New.md","Old.md"]', "--state-root", f.stateRoot], { encoding: "utf8" })
    assert.equal(fresh.status, 0, fresh.stderr)
    const sources = JSON.parse(fresh.stdout).sources
    assert.match(sources.find(source => source.path === "New.md").markdown, /Recovery limit is four hours/)
    assert.match(sources.find(source => source.path === "Old.md").markdown, /status: superseded/)
    assert.equal(finishCurationCheckpoint({ ...f, operation: prepared.operation, notePath: "New.md" }).replayed, true)
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})

test("checkpoint resolves a predecessor shorthand and records the canonical transition in its receipt", () => {
  const f = fixture()
  try {
    const prepared = prepareCurationCheckpoint({ ...f, targets: ["Old.md", "New.md"], sources: ["Evidence.md"] })
    const shorthand = f.old.replace("status: active\n", "status: active\nsuperseded_by: [[New]]\n")
    fs.writeFileSync(path.join(f.vault, "Old.md"), shorthand)
    fs.writeFileSync(path.join(f.vault, "New.md"), renderPatchRecord(f.patch) + "\n[[Evidence]]\n")
    const complete = finishCurationCheckpoint({ ...f, operation: prepared.operation, notePath: "New.md" })
    const transitioned = fs.readFileSync(path.join(f.vault, "Old.md"), "utf8")
    assert.match(transitioned, /status: superseded\nsuperseded_by: "New\.md"\n/u)
    assert.ok(transitioned.endsWith("# Old recovery\nOld recovery limit was two hours.\n[[Evidence]]\n"))
    assert.ok(complete.receipt.targetHashes["Old.md"])
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})

test("checkpoint blocks ambiguous shorthand without writing predecessor metadata", () => {
  const f = fixture()
  try {
    fs.mkdirSync(path.join(f.vault, "Project"))
    fs.mkdirSync(path.join(f.vault, "Other"))
    fs.writeFileSync(path.join(f.vault, "Project", "New.md"), "# Project policy\n")
    fs.writeFileSync(path.join(f.vault, "Other", "New.md"), "# Other policy\n")
    const prepared = prepareCurationCheckpoint({ ...f, targets: ["Old.md", "Project/New.md"], sources: ["Evidence.md"] })
    const shorthand = f.old.replace("status: active\n", "status: active\nsuperseded_by: [[New]]\n")
    fs.writeFileSync(path.join(f.vault, "Old.md"), shorthand)
    fs.writeFileSync(path.join(f.vault, "Project", "New.md"), renderPatchRecord(f.patch) + "\n[[Evidence]]\n")
    assert.throws(() => finishCurationCheckpoint({ ...f, operation: prepared.operation, notePath: "Project/New.md" }), /LIFECYCLE_CONFLICT/)
    assert.equal(fs.readFileSync(path.join(f.vault, "Old.md"), "utf8"), shorthand)
    assert.equal(inspectCurationCheckpoint(f).blocked, true)
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})

test("invalid successor and undeclared predecessor never trigger metadata writes", () => {
  const f = fixture()
  try {
    assert.throws(() => prepareCurationCheckpoint({ ...f, targets: ["New.md"], sources: ["Evidence.md"] }), /PREDECESSOR_NOT_DECLARED/)
    const prepared = prepareCurationCheckpoint({ ...f, targets: ["Old.md", "New.md"], sources: ["Evidence.md"] })
    fs.writeFileSync(path.join(f.vault, "New.md"), "# Invalid successor\n")
    assert.throws(() => finishCurationCheckpoint({ ...f, operation: prepared.operation, notePath: "New.md" }), /PERSISTENCE_FAILED/)
    assert.equal(fs.readFileSync(path.join(f.vault, "Old.md"), "utf8"), f.old)
    assert.equal(inspectCurationCheckpoint(f).blocked, true)
  } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
})
