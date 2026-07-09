#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(root, "scripts", "brain-sync.mjs")
const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const jsonOutput = option("--json", "")
const runs = [
  runSameNoteConflict(),
  runNonOverlappingConflict(),
  runDirtyDraftConflict(),
]

const checks = runs.flatMap((run) => run.checks.map((check) => ({ scenario: run.name, ...check })))
console.log("Conflict assist eval")
console.log("")
console.log("| Scenario | Check | Result |")
console.log("|---|---|---:|")
for (const check of checks) {
  console.log(`| ${check.scenario} | ${check.name} | ${check.pass ? "PASS" : "FAIL"} |`)
}

if (jsonOutput) {
  const target = path.resolve(jsonOutput)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify({ runs, checks }, null, 2)}\n`)
  console.log(`JSON report: ${target}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length) {
  console.error(`Conflict assist eval failed: ${failed.length} check(s)`)
  process.exit(1)
}

function runSameNoteConflict() {
  return withSharedBrain("same-note-conflict", ({ first, second }) => {
    commitNote(second, "shared.md", "# Shared Memory\n\nLocal agent claim.\n\nAPPLIED: local verified deployment.\n", "memory: local shared update")
    commitNote(first, "shared.md", "# Shared Memory\n\nRemote agent claim.\n\nTENSION: remote needs source check.\n", "memory: remote shared update")
    git(first, ["push", "origin", "main"])
    const before = git(second, ["rev-parse", "HEAD"])
    const report = conflictAssist(second)
    const optionIds = report.decisionOptions.map((item) => item.id)
    return {
      name: "same-note-conflict",
      report,
      checks: [
        { name: "classified as diverged", pass: report.relationship === "diverged" },
        { name: "blocks auto pull", pass: report.safeToAutoPull === false },
        { name: "high semantic risk", pass: report.files[0]?.review?.semanticRisk === "high" },
        { name: "offers tension option", pass: optionIds.includes("create-tension") },
        { name: "offers evidence-blocked option", pass: optionIds.includes("blocked-needs-evidence") },
        { name: "does not mutate local HEAD", pass: git(second, ["rev-parse", "HEAD"]) === before },
      ],
    }
  })
}

function runNonOverlappingConflict() {
  return withSharedBrain("non-overlap-conflict", ({ first, second }) => {
    commitNote(second, "local-learning.md", "# Local Learning\n\nAPPLIED: local note.\n", "memory: local note")
    commitNote(first, "remote-learning.md", "# Remote Learning\n\nAPPLIED: remote note.\n", "memory: remote note")
    git(first, ["push", "origin", "main"])
    const report = conflictAssist(second)
    const optionIds = report.decisionOptions.map((item) => item.id)
    return {
      name: "non-overlap-conflict",
      report,
      checks: [
        { name: "sees local-only file", pass: report.summary.localOnlyFiles === 1 },
        { name: "sees remote-only file", pass: report.summary.remoteOnlyFiles === 1 },
        { name: "sees no overlap", pass: report.summary.overlappingFiles === 0 },
        { name: "offers merge-compatible", pass: optionIds.includes("merge-compatible") },
        { name: "does not force tension", pass: !optionIds.includes("create-tension") },
      ],
    }
  })
}

function runDirtyDraftConflict() {
  return withSharedBrain("dirty-draft", ({ second }) => {
    fs.writeFileSync(path.join(second, "draft.md"), "# Draft\n\nUncommitted memory.\n")
    const report = conflictAssist(second)
    const optionIds = report.decisionOptions.map((item) => item.id)
    return {
      name: "dirty-draft",
      report,
      checks: [
        { name: "detects dirty worktree", pass: report.workingTreeDirty === true },
        { name: "counts dirty file", pass: report.summary.dirtyFiles === 1 },
        { name: "does not offer auto merge as final answer", pass: !optionIds.includes("merge-compatible") },
        { name: "asks for local decision", pass: /uncommitted memory/iu.test(report.nextDecision) },
      ],
    }
  })
}

function withSharedBrain(name, callback) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), `mph-conflict-${name}-`))
  const remote = path.join(temp, "brain.git")
  const first = path.join(temp, "agent-a")
  const second = path.join(temp, "agent-b")
  fs.mkdirSync(first)
  run("git", ["init", "--bare", remote], temp)
  git(first, ["init", "-b", "main"])
  git(first, ["config", "user.name", "Agent A"])
  git(first, ["config", "user.email", "agent-a@example.invalid"])
  fs.mkdirSync(path.join(first, ".memory-patch-harness"), { recursive: true })
  fs.writeFileSync(path.join(first, ".memory-patch-harness", "brain-sync.json"), `${JSON.stringify({ version: 1, repo: "example/shared-brain", branch: "main", visibility: "private", memoryRoot: "." }, null, 2)}\n`)
  fs.writeFileSync(path.join(first, "shared.md"), "# Shared Memory\n\nInitial.\n")
  git(first, ["add", "."])
  git(first, ["commit", "-m", "initialize shared brain"])
  git(first, ["remote", "add", "origin", remote])
  git(first, ["push", "-u", "origin", "main"])
  git(remote, ["symbolic-ref", "HEAD", "refs/heads/main"])
  run("git", ["clone", remote, second], temp)
  git(second, ["config", "user.name", "Agent B"])
  git(second, ["config", "user.email", "agent-b@example.invalid"])
  try {
    return callback({ temp, remote, first, second })
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
}

function conflictAssist(vault) {
  const result = spawnSync(process.execPath, [cli, "conflict-assist", "--vault", vault, "--json"], { cwd: root, encoding: "utf8", shell: false })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `conflict-assist exited ${result.status}`)
  }
  return JSON.parse(result.stdout)
}

function commitNote(vault, relativePath, content, message) {
  const target = path.join(vault, relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
  git(vault, ["add", relativePath])
  git(vault, ["commit", "-m", message])
}

function git(cwd, args) {
  return run("git", args, cwd).stdout.trim()
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", shell: false })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} ${args.join(" ")} failed`)
  return result
}
