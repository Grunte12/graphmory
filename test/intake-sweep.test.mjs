import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { buildIntakeSweep } from "../src/intake-sweep.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(repoRoot, "scripts", "brain-sync.mjs")

function tempVault() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mph-intake-sweep-"))
}

test("intake sweep returns bounded eligible raw candidates and excludes automation", () => {
  const vault = tempVault()
  try {
    fs.mkdirSync(path.join(vault, "02 Projects", "Demo", "inbox"), { recursive: true })
    fs.mkdirSync(path.join(vault, "Clippings"), { recursive: true })
    fs.mkdirSync(path.join(vault, "02 Projects", "Demo", "inbox", "auto-triggers"), { recursive: true })
    fs.writeFileSync(path.join(vault, "02 Projects", "Demo", "inbox", "candidate.md"), "# Candidate\n")
    fs.writeFileSync(path.join(vault, "Clippings", "clip.md"), "# Clip\n")
    fs.writeFileSync(path.join(vault, "02 Projects", "Demo", "inbox", "auto-triggers", "event.md"), "# Event\n")

    const report = buildIntakeSweep(vault, { scope: "02 Projects/Demo", limit: 1 })
    assert.equal(report.summary.pending, 2)
    assert.equal(report.summary.inbox, 1)
    assert.equal(report.summary.clippings, 1)
    assert.equal(report.summary.excludedArchiveOrAutomation, 1)
    assert.equal(report.candidates.length, 1)
    assert.equal(report.omittedCandidates, 1)
    assert.equal(report.recommendedAction, "review-provisional-evidence")
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("intake sweep blocks promotion when a candidate contains a secret-like value", () => {
  const vault = tempVault()
  try {
    fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true })
    fs.writeFileSync(path.join(vault, "00 Inbox", "secret.md"), "# Raw\n\napi_key=sk-abcdefghijklmnopqrstuvwxyz1234567890\n")

    const report = buildIntakeSweep(vault)
    assert.equal(report.summary.secretLikeFiles, 1)
    assert.equal(report.candidates[0].secretLike, true)
    assert.equal(report.recommendedAction, "blocked-secret-scan")
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("intake-sweep CLI returns a bounded JSON queue without writing the vault", () => {
  const vault = tempVault()
  try {
    fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true })
    fs.writeFileSync(path.join(vault, "00 Inbox", "candidate.md"), "# Candidate\n")
    const result = spawnSync(process.execPath, [cli, "intake-sweep", "--vault", vault, "--limit", "1", "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
      shell: false,
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    const report = JSON.parse(result.stdout)
    assert.equal(report.summary.pending, 1)
    assert.equal(report.candidates[0].path, "00 Inbox/candidate.md")
    assert.equal(fs.existsSync(path.join(vault, ".memory-patch-harness")), false)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})
