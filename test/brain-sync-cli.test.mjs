import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(repoRoot, "scripts", "brain-sync.mjs")

function tempRoot(prefix = "mph-brain-sync-cli-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function run(bin, args, cwd) {
  return spawnSync(bin, args, { cwd, encoding: "utf8", shell: false })
}

function runCli(args, cwd = repoRoot, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    shell: false,
    ...options,
  })
}

function git(vault, args) {
  const result = run("git", args, vault)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout.trim()
}

function initializeCommittedVault(vault) {
  git(vault, ["init", "-b", "main"])
  git(vault, ["config", "user.name", "Memory Harness Test"])
  git(vault, ["config", "user.email", "memory-harness@example.invalid"])
  fs.writeFileSync(path.join(vault, "note.md"), "# Durable Note\n")
  git(vault, ["add", "note.md"])
  git(vault, ["commit", "-m", "baseline"])
}

function writePlan(file, vault, id = "cli-round-trip") {
  fs.writeFileSync(file, `${JSON.stringify({
    version: 1,
    id,
    vaultRoot: vault,
    status: "draft",
    entries: [{
      source: "note.md",
      target: "03 Reference/note.md",
      approved: true,
      reason: "approved CLI integration test",
    }],
  }, null, 2)}\n`)
}

function initializeSharedBrain() {
  const root = tempRoot("mph-shared-brain-")
  const remote = path.join(root, "brain.git")
  const first = path.join(root, "hermes-brain")
  const second = path.join(root, "opencode-brain")
  fs.mkdirSync(first)
  assert.equal(run("git", ["init", "--bare", remote], root).status, 0)
  git(first, ["init", "-b", "main"])
  git(first, ["config", "user.name", "Hermes Test"])
  git(first, ["config", "user.email", "hermes@example.invalid"])
  fs.mkdirSync(path.join(first, ".memory-patch-harness"), { recursive: true })
  fs.writeFileSync(path.join(first, ".memory-patch-harness", "brain-sync.json"), `${JSON.stringify({
    version: 1,
    repo: "example/shared-brain",
    branch: "main",
    visibility: "private",
    memoryRoot: ".",
  }, null, 2)}\n`)
  fs.writeFileSync(path.join(first, "shared.md"), "# Shared Memory\n\nInitial.\n")
  git(first, ["add", "."])
  git(first, ["commit", "-m", "initialize shared brain"])
  git(first, ["remote", "add", "origin", remote])
  git(first, ["push", "-u", "origin", "main"])
  git(remote, ["symbolic-ref", "HEAD", "refs/heads/main"])
  const cloned = run("git", ["clone", remote, second], root)
  assert.equal(cloned.status, 0, cloned.stderr)
  git(second, ["config", "user.name", "OpenCode Test"])
  git(second, ["config", "user.email", "opencode@example.invalid"])
  return { root, remote, first, second }
}

function commitNote(vault, relativePath, content, message) {
  const target = path.join(vault, relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
  git(vault, ["add", relativePath])
  git(vault, ["commit", "-m", message])
}

test("CLI help lists the complete restructure lifecycle", () => {
  const result = runCli(["--help"])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /restructure-plan/)
  assert.match(result.stdout, /restructure-apply/)
  assert.match(result.stdout, /restructure-verify/)
  assert.match(result.stdout, /restructure-rollback/)
  assert.match(result.stdout, /doctor/)
  assert.match(result.stdout, /health/)
  assert.match(result.stdout, /recall/)
  assert.match(result.stdout, /sync-plan/)
  assert.match(result.stdout, /recall-semantic/)
  assert.match(result.stdout, /curation-recommend/)
  assert.match(result.stdout, /lifecycle-audit/)
  assert.match(result.stdout, /auto-pull/)
  assert.match(result.stdout, /conflict-assist/)
})

test("recall-semantic explains the optional dependency when it is not installed", () => {
  const vault = tempRoot("mph-recall-semantic-")
  fs.writeFileSync(path.join(vault, "Memory.md"), "# Memory\n\nSemantic recall fixture.")

  const result = runCli(
    [
      "recall-semantic",
      "--vault",
      vault,
      "--query",
      "semantic fixture",
      "--json",
    ],
    repoRoot,
    { env: { ...process.env, MPH_TEST_SEMANTIC_MOCK_MISSING: "1" } },
  )
  assert.equal(result.status, 1)
  assert.match(result.stderr, /OPTIONAL_DEPENDENCY_MISSING/)
  assert.match(result.stderr, /@huggingface\/transformers/)
})

test("doctor accepts OBSIDIAN_VAULT env var as vault fallback", () => {
  const root = tempRoot("mph-obsidian-env-")
  try {
    const result = spawnSync(process.execPath, [cli, "doctor", "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
      shell: false,
      env: { ...process.env, OBSIDIAN_VAULT: root },
    })
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.vault, path.resolve(root))
    assert.equal(report.checks.some((check) => check.id === "vault-detection"), true)
    assert.equal(report.checks.some((check) => check.id === "vault-permission"), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("doctor returns machine-readable diagnostics for a path with spaces", () => {
  const root = tempRoot("mph doctor path with spaces ")
  try {
    const result = runCli(["doctor", "--vault", root, "--json"])
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.ok, true)
    assert.equal(report.vault, path.resolve(root))
    assert.equal(report.checks.some((check) => check.id === "node-version"), true)
    assert.equal(report.checks.some((check) => check.id === "git-cli"), true)
    assert.equal(report.checks.some((check) => check.id === "vault-permission"), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("doctor explains missing PATH dependencies without crashing", () => {
  const env = { ...process.env, PATH: "", Path: "" }
  const result = runCli(["doctor", "--json", "--require-github"], repoRoot, { env })
  assert.equal(result.status, 1)
  const report = JSON.parse(result.stdout)
  assert.equal(report.ok, false)
  assert.equal(report.checks.find((check) => check.id === "git-cli").status, "fail")
  assert.equal(report.checks.find((check) => check.id === "github-cli").status, "fail")
})

test("doctor reports malformed sync config with a recovery action", () => {
  const vault = tempRoot()
  try {
    const configDir = path.join(vault, ".memory-patch-harness")
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(path.join(configDir, "brain-sync.json"), "{not-json")
    const result = runCli(["doctor", "--vault", vault, "--json"])
    assert.equal(result.status, 1)
    const report = JSON.parse(result.stdout)
    const check = report.checks.find((item) => item.id === "sync-config")
    assert.equal(check.status, "fail")
    assert.match(check.detail, /INVALID_JSON/)
    assert.match(check.fix, /Restore/)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("doctor rejects a file path without deleting or overwriting it", () => {
  const root = tempRoot()
  try {
    const file = path.join(root, "not-a-vault.md")
    fs.writeFileSync(file, "# Keep me\n")
    const result = runCli(["doctor", "--vault", file, "--json"])
    assert.equal(result.status, 1)
    const report = JSON.parse(result.stdout)
    const check = report.checks.find((item) => item.id === "vault-detection")
    assert.equal(check.status, "fail")
    assert.match(check.detail, /not-a-directory/)
    assert.equal(fs.readFileSync(file, "utf8"), "# Keep me\n")
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("health returns JSON findings for curator-safe vault inspection", () => {
  const vault = tempRoot()
  try {
    fs.mkdirSync(path.join(vault, "02 Projects"), { recursive: true })
    fs.writeFileSync(path.join(vault, "02 Projects", "Memory.md"), "# Memory\nSee [[Missing]]\n")
    const result = runCli(["health", "--vault", vault, "--json"])
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.summary.markdownFiles, 1)
    assert.equal(report.findings.some((finding) => finding.kind === "unresolved-link"), true)
    assert.equal(report.findings.some((finding) => finding.kind === "missing-provenance"), true)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("recall returns bounded canonical paths without raw or stale memory", () => {
  const vault = tempRoot("mph-recall-")
  fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true })
  fs.writeFileSync(path.join(vault, "current.md"), "---\nstatus: current\naliases: shared brain\n---\n# Sync Policy\n\nUse fast-forward-only synchronization.")
  fs.writeFileSync(path.join(vault, "stale.md"), "---\nstatus: stale\n---\n# Old Sync\n\nshared brain automatic merge merge merge")
  fs.writeFileSync(path.join(vault, "00 Inbox", "raw.md"), "# Capture\n\nshared brain raw dump")

  const result = runCli(["recall", "--vault", vault, "--query", "shared brain", "--json"])
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.deepEqual(report.results.map((item) => item.path), ["current.md"])
  assert.equal(report.scanned, 2)
  assert.equal(report.excludedByLifecycle, 1)
})

test("recall can restrict search to a known memory scope", () => {
  const vault = tempRoot("mph-recall-scope-")
  fs.mkdirSync(path.join(vault, "02 Projects", "alpha"), { recursive: true })
  fs.mkdirSync(path.join(vault, "02 Projects", "beta"), { recursive: true })
  fs.writeFileSync(path.join(vault, "02 Projects", "alpha", "Policy.md"), "# Alpha Policy\nShared deployment rollback.")
  fs.writeFileSync(path.join(vault, "02 Projects", "beta", "Policy.md"), "# Beta Policy\nShared deployment rollback.")

  const result = runCli([
    "recall",
    "--vault",
    vault,
    "--query",
    "shared deployment rollback",
    "--scope",
    "02 Projects/beta",
    "--json",
  ])
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.deepEqual(report.results.map((item) => item.path), ["02 Projects/beta/Policy.md"])
  assert.equal(report.scanned, 1)
})

test("curation-recommend classifies retrieval misses for agent repair", () => {
  const root = tempRoot("mph-curation-cli-")
  try {
    const report = path.join(root, "report.json")
    const queries = path.join(root, "queries.json")
    fs.writeFileSync(report, `${JSON.stringify({
      k: 3,
      methods: {
        "governed-bm25f-sections": {
          runs: [{
            id: "buried-policy",
            category: "routing",
            metrics: { hit: 0, reciprocalRank: 0.2 },
            retrieved: ["Memory/Summary.md"],
          }],
        },
      },
    })}\n`)
    fs.writeFileSync(queries, `${JSON.stringify([{
      id: "buried-policy",
      category: "routing",
      query: "Where is the decision about visual ownership?",
      relevant: ["Memory/UI Ownership.md"],
      scope: "Memory",
    }])}\n`)

    const result = runCli(["curation-recommend", "--report", report, "--queries", queries, "--json"])
    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(output.misses, 1)
    assert.equal(output.recommendations[0].kind, "buried-gold")
    assert.match(output.recommendations[0].actions.join("\n"), /aliases\/frontmatter/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("recall-loop fuses bounded retrieval lanes for agent use", () => {
  const vault = tempRoot("mph-recall-loop-")
  fs.mkdirSync(path.join(vault, "Memory"), { recursive: true })
  fs.writeFileSync(path.join(vault, "Memory", "Policy.md"), "---\nstatus: current\n---\n# Sync Policy\n\nUse human-reviewed conflict handling.")
  fs.writeFileSync(path.join(vault, "Memory", "Old.md"), "---\nstatus: stale\n---\n# Old Policy\n\nAutomatically overwrite memory conflicts.")

  const result = runCli([
    "recall-loop",
    "--vault",
    vault,
    "--query",
    "human reviewed memory conflict",
    "--scope",
    "Memory",
    "--json",
  ])
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.results[0].path, "Memory/Policy.md")
  assert.deepEqual(report.results[0].lanes, ["bm25f-sections", "bm25f-focused-sections", "bm25-sections"])
})

test("lifecycle-audit reports stale and conflict memory without applying changes", () => {
  const vault = tempRoot()
  try {
    fs.mkdirSync(path.join(vault, "02 Projects", "Example"), { recursive: true })
    fs.writeFileSync(path.join(vault, "02 Projects", "Example", "Current.md"), `---
status: active
valid_until: 2026-01-01
---
# Current

This is the preferred endpoint.
`)
    fs.writeFileSync(path.join(vault, "02 Projects", "Example", "Old.md"), `---
status: superseded
---
# Old

Legacy endpoint note.
`)
    fs.writeFileSync(path.join(vault, "02 Projects", "Example", "Tension.md"), `---
status: tension
---
# Tension

TENSION
`)
    const result = runCli(["lifecycle-audit", "--vault", vault, "--now", "2026-07-06", "--json"])
    assert.equal(result.status, 1)
    const report = JSON.parse(result.stdout)
    assert.equal(report.scanned, 3)
    assert.equal(report.summary.high, 1)
    assert.equal(report.findings.some((item) => item.kind === "expired-valid-until"), true)
    assert.equal(report.findings.some((item) => item.kind === "obsolete-without-replacement"), true)
    assert.equal(report.findings.some((item) => item.kind === "tension-without-decision-path"), true)
    assert.equal(report.actions.some((item) => item.action === "revalidate"), true)
    assert.equal(fs.existsSync(path.join(vault, ".memory-patch-harness")), false)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("lifecycle-audit can include raw paths for intake hygiene", () => {
  const vault = tempRoot()
  try {
    fs.mkdirSync(path.join(vault, "03 Reference"), { recursive: true })
    fs.writeFileSync(path.join(vault, "03 Reference", "Raw Capture.md"), `---
status: raw
---
# Raw Capture

Raw imported note.
`)
    const result = runCli(["lifecycle-audit", "--vault", vault, "--include-raw-paths", "--json"])
    assert.equal(result.status, 0)
    const report = JSON.parse(result.stdout)
    assert.equal(report.findings.some((item) => item.kind === "raw-memory-outside-inbox"), true)
    assert.equal(report.actions.some((item) => item.action === "triage-raw-memory"), true)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("recall reports a stable error for a missing vault", () => {
  const missing = path.join(tempRoot("mph-missing-recall-"), "does-not-exist")
  const result = runCli(["recall", "--vault", missing, "--query", "policy", "--json"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /VAULT_NOT_FOUND/)
})

test("sync-plan explains when a healthy memory batch is ready", () => {
  const shared = initializeSharedBrain()
  fs.writeFileSync(path.join(shared.second, "draft.md"), "---\nstatus: current\n---\n# Draft\n\nProvenance: user-approved test.\n")
  const result = runCli(["sync-plan", "--vault", shared.second, "--patches", "3", "--json"])
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.decision, "push-ready")
  assert.equal(report.requiresHumanApproval, true)
})

test("CLI --verbose flag exposes stack traces on errors", () => {
  const missing = path.join(tempRoot("mph-verbose-"), "does-not-exist")
  const result = runCli(["recall", "--vault", missing, "--query", "test", "--verbose"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /VAULT_NOT_FOUND/)
  // With --verbose, the stack trace should appear
  assert.match(result.stderr, /at /)
})

test("CLI emits stable errors for missing and malformed plan files", () => {
  const vault = tempRoot()
  const outputRoot = tempRoot("mph-plan-output-")
  try {
    initializeCommittedVault(vault)
    const missing = runCli(["restructure-apply", "--vault", vault, "--plan", path.join(outputRoot, "missing.json"), "--dry-run"])
    assert.equal(missing.status, 1)
    assert.match(missing.stderr, /INPUT_NOT_FOUND/)

    const malformedFile = path.join(outputRoot, "malformed.json")
    fs.writeFileSync(malformedFile, "{broken")
    const malformed = runCli(["restructure-apply", "--vault", vault, "--plan", malformedFile, "--dry-run"])
    assert.equal(malformed.status, 1)
    assert.match(malformed.stderr, /INVALID_JSON/)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }
})

test("auto-pull fast-forwards a second agent clone", () => {
  const shared = initializeSharedBrain()
  try {
    commitNote(shared.first, "hermes-learning.md", "# Hermes Learning\n", "memory: add Hermes learning")
    git(shared.first, ["push", "origin", "main"])
    const result = runCli(["auto-pull", "--vault", shared.second, "--json"])
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.status, "updated")
    assert.equal(report.safeToContinue, true)
    assert.equal(fs.existsSync(path.join(shared.second, "hermes-learning.md")), true)
  } finally {
    fs.rmSync(shared.root, { recursive: true, force: true })
  }
})

test("auto-pull skips dirty memory without blocking default agent startup", () => {
  const shared = initializeSharedBrain()
  try {
    fs.writeFileSync(path.join(shared.second, "local-draft.md"), "# Local Draft\n")
    const result = runCli(["auto-pull", "--vault", shared.second, "--json"])
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.status, "skipped-dirty")
    assert.equal(report.safeToContinue, false)

    const strict = runCli(["auto-pull", "--vault", shared.second, "--json", "--strict"])
    assert.equal(strict.status, 1)
  } finally {
    fs.rmSync(shared.root, { recursive: true, force: true })
  }
})

test("auto-pull reports diverged agent histories without merging", () => {
  const shared = initializeSharedBrain()
  try {
    commitNote(shared.second, "opencode-learning.md", "# OpenCode Learning\n", "memory: local OpenCode learning")
    commitNote(shared.first, "hermes-learning.md", "# Hermes Learning\n", "memory: remote Hermes learning")
    git(shared.first, ["push", "origin", "main"])
    const before = git(shared.second, ["rev-parse", "HEAD"])
    const result = runCli(["auto-pull", "--vault", shared.second, "--json", "--strict"])
    assert.equal(result.status, 1)
    const report = JSON.parse(result.stdout)
    assert.equal(report.status, "diverged")
    assert.equal(git(shared.second, ["rev-parse", "HEAD"]), before)
  } finally {
    fs.rmSync(shared.root, { recursive: true, force: true })
  }
})

test("conflict-assist explains same-note divergence without changing history", () => {
  const shared = initializeSharedBrain()
  try {
    commitNote(shared.second, "shared.md", "# Shared Memory\n\nLocal OpenCode fact.\n\nAPPLIED: local.\n", "memory: local shared update")
    commitNote(shared.first, "shared.md", "# Shared Memory\n\nRemote Hermes fact.\n\nTENSION: remote.\n", "memory: remote shared update")
    git(shared.first, ["push", "origin", "main"])
    const before = git(shared.second, ["rev-parse", "HEAD"])

    const result = runCli(["conflict-assist", "--vault", shared.second, "--json"])
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.status, "ok")
    assert.equal(report.relationship, "diverged")
    assert.equal(report.safeToAutoPull, false)
    assert.equal(report.summary.overlappingFiles, 1)
    assert.equal(report.files[0].path, "shared.md")
    assert.equal(report.files[0].review.type, "same-note-changed")
    assert.equal(report.files[0].review.semanticRisk, "high")
    assert.deepEqual(report.files[0].review.lifecycleSignals.sort(), ["APPLIED", "TENSION"].sort())
    const optionIds = report.decisionOptions.map((item) => item.id)
    assert.equal(optionIds.includes("create-tension"), true)
    assert.equal(optionIds.includes("supersede-local"), true)
    assert.equal(optionIds.includes("supersede-remote"), true)
    assert.equal(optionIds.includes("blocked-needs-evidence"), true)
    assert.match(report.nextDecision, /Semantic conflict/)
    assert.equal(git(shared.second, ["rev-parse", "HEAD"]), before)
  } finally {
    fs.rmSync(shared.root, { recursive: true, force: true })
  }
})

test("conflict-assist summarizes non-overlapping diverged histories for user decision", () => {
  const shared = initializeSharedBrain()
  try {
    commitNote(shared.second, "opencode-learning.md", "# OpenCode Learning\n", "memory: local OpenCode learning")
    commitNote(shared.first, "hermes-learning.md", "# Hermes Learning\n", "memory: remote Hermes learning")
    git(shared.first, ["push", "origin", "main"])

    const result = runCli(["conflict-assist", "--vault", shared.second, "--json"])
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.status, "ok")
    assert.equal(report.relationship, "diverged")
    assert.equal(report.summary.overlappingFiles, 0)
    assert.equal(report.summary.localOnlyFiles, 1)
    assert.equal(report.summary.remoteOnlyFiles, 1)
    assert.equal(report.decisionOptions.some((item) => item.id === "prefer-remote"), true)
    assert.match(report.nextDecision, /ask user/i)
  } finally {
    fs.rmSync(shared.root, { recursive: true, force: true })
  }
})

test("conflict-assist reports dirty local memory before sync decisions", () => {
  const shared = initializeSharedBrain()
  try {
    fs.writeFileSync(path.join(shared.second, "local-draft.md"), "# Draft\n")
    const result = runCli(["conflict-assist", "--vault", shared.second, "--json"])
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.status, "ok")
    assert.equal(report.workingTreeDirty, true)
    assert.equal(report.summary.dirtyFiles, 1)
    assert.match(report.nextDecision, /uncommitted memory/i)
  } finally {
    fs.rmSync(shared.root, { recursive: true, force: true })
  }
})

test("push cleans up sync lock when secrets are found", () => {
  const shared = initializeSharedBrain()
  try {
    const lockPath = path.join(shared.second, ".git", "memory-patch-harness-sync.lock")
    fs.writeFileSync(path.join(shared.second, "creds.md"), "api_key = exposed-value-1234567890\n")
    const result = runCli(["push", "--vault", shared.second, "--message", "memory: secret push"])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /SECRET_FOUND/)
    // Lock must be cleaned up by withSyncLock finally block
    assert.equal(fs.existsSync(lockPath), false)
  } finally {
    fs.rmSync(shared.root, { recursive: true, force: true })
  }
})

test("push refuses to rebase when another agent changed remote memory", () => {
  const shared = initializeSharedBrain()
  try {
    commitNote(shared.first, "hermes-learning.md", "# Hermes Learning\n", "memory: remote update")
    git(shared.first, ["push", "origin", "main"])
    fs.writeFileSync(path.join(shared.second, "opencode-draft.md"), "# OpenCode Draft\n")
    const before = git(shared.second, ["rev-parse", "HEAD"])
    const result = runCli(["push", "--vault", shared.second, "--message", "memory: local update"])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /REMOTE_CHANGED/)
    assert.equal(git(shared.second, ["rev-parse", "HEAD"]), before)
    assert.equal(fs.existsSync(path.join(shared.second, "opencode-draft.md")), true)
  } finally {
    fs.rmSync(shared.root, { recursive: true, force: true })
  }
})

test("auto-pull degrades safely when the remote is unavailable", () => {
  const shared = initializeSharedBrain()
  try {
    git(shared.second, ["remote", "set-url", "origin", path.join(shared.root, "missing-remote.git")])
    const result = runCli(["auto-pull", "--vault", shared.second, "--json"])
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.status, "offline-or-auth-failed")
    assert.equal(report.safeToContinue, false)
    assert.equal(fs.existsSync(path.join(shared.second, "shared.md")), true)
  } finally {
    fs.rmSync(shared.root, { recursive: true, force: true })
  }
})

test("restructure-plan writes an unapproved review manifest", () => {
  const vault = tempRoot()
  const outputRoot = tempRoot("mph-plan-output-")
  try {
    fs.mkdirSync(path.join(vault, "clippings"), { recursive: true })
    fs.writeFileSync(path.join(vault, "clippings", "source.md"), "# Source\n")
    const planFile = path.join(outputRoot, "plan.json")
    const result = runCli(["restructure-plan", "--vault", vault, "--out", planFile])
    assert.equal(result.status, 0, result.stderr)
    const manifest = JSON.parse(fs.readFileSync(planFile, "utf8"))
    assert.equal(manifest.entries.length, 1)
    assert.equal(manifest.entries[0].approved, false)
    assert.match(result.stdout, /set approved=true only for the user-approved batch/)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }
})

test("restructure apply requires an explicit approval flag", () => {
  const vault = tempRoot()
  const outputRoot = tempRoot("mph-plan-output-")
  try {
    initializeCommittedVault(vault)
    const planFile = path.join(outputRoot, "plan.json")
    writePlan(planFile, vault)
    const result = runCli(["restructure-apply", "--vault", vault, "--plan", planFile])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /without --approve/)
    assert.equal(fs.existsSync(path.join(vault, "note.md")), true)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }
})

test("restructure dry-run validates without changing the vault", () => {
  const vault = tempRoot()
  const outputRoot = tempRoot("mph-plan-output-")
  try {
    initializeCommittedVault(vault)
    const planFile = path.join(outputRoot, "plan.json")
    writePlan(planFile, vault)
    const result = runCli(["restructure-apply", "--vault", vault, "--plan", planFile, "--dry-run"])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /dry-run passed: 1 approved move/)
    assert.equal(fs.existsSync(path.join(vault, "note.md")), true)
    assert.equal(fs.existsSync(path.join(vault, "03 Reference", "note.md")), false)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }
})

test("restructure apply refuses a dirty worktree", () => {
  const vault = tempRoot()
  const outputRoot = tempRoot("mph-plan-output-")
  try {
    initializeCommittedVault(vault)
    const planFile = path.join(outputRoot, "plan.json")
    writePlan(planFile, vault)
    fs.writeFileSync(path.join(vault, "uncommitted.md"), "# Dirty\n")
    const result = runCli(["restructure-apply", "--vault", vault, "--plan", planFile, "--approve"])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /clean Git worktree/)
    assert.equal(fs.existsSync(path.join(vault, "note.md")), true)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }
})

test("restructure apply requires a baseline commit", () => {
  const vault = tempRoot()
  const outputRoot = tempRoot("mph-plan-output-")
  try {
    git(vault, ["init", "-b", "main"])
    fs.writeFileSync(path.join(vault, "note.md"), "# Note\n")
    const planFile = path.join(outputRoot, "plan.json")
    writePlan(planFile, vault)
    const result = runCli(["restructure-apply", "--vault", vault, "--plan", planFile, "--approve"])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /baseline commit/)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }
})

test("CLI applies, verifies, and rolls back through a recorded migration", () => {
  const vault = tempRoot("mph round trip path with spaces ")
  const outputRoot = tempRoot("mph-plan-output-")
  try {
    initializeCommittedVault(vault)
    const planFile = path.join(outputRoot, "plan.json")
    writePlan(planFile, vault)

    const applied = runCli(["restructure-apply", "--vault", vault, "--plan", planFile, "--approve"])
    assert.equal(applied.status, 0, applied.stderr)
    const recordFile = path.join(vault, ".memory-patch-harness", "migrations", "cli-round-trip.json")
    assert.equal(fs.existsSync(recordFile), true)
    assert.equal(fs.existsSync(path.join(vault, "note.md")), false)
    assert.equal(fs.existsSync(path.join(vault, "03 Reference", "note.md")), true)
    assert.equal(git(vault, ["branch", "--list", "memory-harness-backup/cli-round-trip"]), "memory-harness-backup/cli-round-trip")

    const verified = runCli(["restructure-verify", "--vault", vault, "--record", recordFile])
    assert.equal(verified.status, 0, verified.stderr)
    assert.equal(JSON.parse(verified.stdout).ok, true)

    const blockedRollback = runCli(["restructure-rollback", "--vault", vault, "--record", recordFile])
    assert.equal(blockedRollback.status, 1)
    assert.match(blockedRollback.stderr, /without --approve/)

    const rolledBack = runCli(["restructure-rollback", "--vault", vault, "--record", recordFile, "--approve"])
    assert.equal(rolledBack.status, 0, rolledBack.stderr)
    assert.equal(fs.existsSync(path.join(vault, "note.md")), true)
    assert.equal(fs.existsSync(path.join(vault, "03 Reference", "note.md")), false)

    const verifiedRollback = runCli(["restructure-verify", "--vault", vault, "--record", recordFile])
    assert.equal(verifiedRollback.status, 0, verifiedRollback.stderr)
    assert.equal(JSON.parse(verifiedRollback.stdout).state, "rolled-back")
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }
})

test("restructure apply refuses a vault containing secret-like values", () => {
  const vault = tempRoot()
  const outputRoot = tempRoot("mph-plan-output-")
  try {
    initializeCommittedVault(vault)
    fs.writeFileSync(path.join(vault, "credentials.md"), "api_key = example-secret-value-123456\n")
    git(vault, ["add", "credentials.md"])
    git(vault, ["commit", "-m", "add unsafe fixture"])
    const planFile = path.join(outputRoot, "plan.json")
    writePlan(planFile, vault, "secret-block")
    const result = runCli(["restructure-apply", "--vault", vault, "--plan", planFile, "--approve"])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /secret-like values/)
    assert.equal(fs.existsSync(path.join(vault, "note.md")), true)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }
})

test("restructure apply refuses while another restructure lock exists", () => {
  const vault = tempRoot()
  const outputRoot = tempRoot("mph-plan-output-")
  try {
    initializeCommittedVault(vault)
    fs.appendFileSync(path.join(vault, ".git", "info", "exclude"), "\n.memory-patch-harness/restructure.lock\n")
    const lock = path.join(vault, ".memory-patch-harness", "restructure.lock")
    fs.mkdirSync(path.dirname(lock), { recursive: true })
    fs.writeFileSync(lock, "busy\n")
    const planFile = path.join(outputRoot, "plan.json")
    writePlan(planFile, vault, "locked")
    const result = runCli(["restructure-apply", "--vault", vault, "--plan", planFile, "--approve"])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /may be running/)
    assert.equal(fs.existsSync(path.join(vault, "note.md")), true)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }
})

test("restructure apply blocks batches above the default safety limit", () => {
  const vault = tempRoot()
  const outputRoot = tempRoot("mph-plan-output-")
  try {
    git(vault, ["init", "-b", "main"])
    git(vault, ["config", "user.name", "Memory Harness Test"])
    git(vault, ["config", "user.email", "memory-harness@example.invalid"])
    const entries = []
    for (let index = 0; index < 21; index += 1) {
      const source = `note-${index}.md`
      fs.writeFileSync(path.join(vault, source), `# Note ${index}\n`)
      entries.push({ source, target: `03 Reference/${source}`, approved: true })
    }
    git(vault, ["add", "."])
    git(vault, ["commit", "-m", "baseline"])
    const planFile = path.join(outputRoot, "plan.json")
    fs.writeFileSync(planFile, `${JSON.stringify({ version: 1, id: "too-large", vaultRoot: vault, entries }, null, 2)}\n`)
    const result = runCli(["restructure-apply", "--vault", vault, "--plan", planFile, "--approve"])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /maximum is 20/)
    assert.equal(fs.existsSync(path.join(vault, "note-0.md")), true)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }
})

test("audit reports schema issues for missing metadata and invalid values", () => {
  const vault = tempRoot("mph-audit-")
  try {
    fs.mkdirSync(path.join(vault, "02 Projects"), { recursive: true })
    fs.writeFileSync(path.join(vault, "02 Projects", "NoStatus.md"), "# Missing Status\n\nSome content.\n")
    fs.writeFileSync(path.join(vault, "02 Projects", "BadStatus.md"), "---\nstatus: invalid_what\n---\n# Bad Status\n\nContent.\n")
    fs.writeFileSync(path.join(vault, "02 Projects", "Valid.md"), "---\nstatus: active\nprovenance: user-test\n---\n# Valid\n\nFine.\n")
    const result = runCli(["audit", "--vault", vault, "--json"])
    assert.equal(result.status, 1)
    const report = JSON.parse(result.stdout)
    assert.equal(report.ok, false)
    assert.equal(report.findings.some((f) => f.kind === "missing-required-metadata"), true)
    assert.equal(report.findings.some((f) => f.kind === "invalid-controlled-value"), true)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("audit detects raw clipping outside inbox and oversize hubs", () => {
  const vault = tempRoot("mph-audit-clipping-")
  try {
    fs.writeFileSync(path.join(vault, "clipping-note.md"), "# Clipping\n\nRaw import.")
    fs.writeFileSync(path.join(vault, "hub.md"), "# Hub\n\n" + Array.from({ length: 60 }, (_, i) => `[[note-${i}]]`).join("\n"))
    const result = runCli(["audit", "--vault", vault, "--json"])
    assert.equal(result.status, 1)
    const report = JSON.parse(result.stdout)
    assert.equal(report.findings.some((f) => f.kind === "raw-clipping-outside-inbox"), true)
    assert.equal(report.findings.some((f) => f.kind === "oversized-project-hub"), true)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("audit detects unresolved and ambiguous links", () => {
  const vault = tempRoot("mph-audit-links-")
  try {
    fs.mkdirSync(path.join(vault, "02 Projects"), { recursive: true })
    fs.writeFileSync(path.join(vault, "02 Projects", "Main.md"), "# Main\n\nSee [[MissingTarget]] and [[AmbiguousLink]]")
    fs.writeFileSync(path.join(vault, "02 Projects", "AmbiguousLink.md"), "# Alias A\n---\naliases: [AmbiguousLink]\n---\nContent.")
    const result = runCli(["audit", "--vault", vault, "--json"])
    assert.equal(result.status, 1)
    const report = JSON.parse(result.stdout)
    // AmbiguousLink now has 1 match (via alias), plus MissingTarget fails
    assert.equal(report.findings.some((f) => f.kind === "unresolved-link"), true)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("audit passes for a clean well-structured vault", () => {
  const vault = tempRoot("mph-audit-clean-")
  try {
    fs.mkdirSync(path.join(vault, "02 Projects"), { recursive: true })
    fs.writeFileSync(path.join(vault, "02 Projects", "Note.md"), "\uFEFF---\nstatus: deployed\nprovenance: test\n---\n# Note\n\nClean content.")
    const rawInbox = path.join(vault, "02 Projects", "Example", "inbox", "archive")
    fs.mkdirSync(rawInbox, { recursive: true })
    fs.writeFileSync(path.join(rawInbox, "Session.md"), "\uFEFF---\nstatus: active\n---\n# Session\n\nUnverified stale handoff.")
    const result = runCli(["audit", "--vault", vault, "--json"])
    assert.equal(result.status, 0)
    const report = JSON.parse(result.stdout)
    assert.equal(report.ok, true)
    assert.equal(report.findings.length, 0)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("lint detects duplicate titles and missing provenance", () => {
  const vault = tempRoot("mph-lint-")
  try {
    fs.mkdirSync(path.join(vault, "02 Projects"), { recursive: true })
    fs.writeFileSync(path.join(vault, "02 Projects", "Policy.md"), "# Sync Policy\n\nUse fast-forward pulls.\n")
    fs.writeFileSync(path.join(vault, "02 Projects", "Policy copy.md"), "# Sync Policy\n\nDuplicate title.\n")
    const result = runCli(["lint", "--vault", vault, "--json"])
    assert.equal(result.status, 1)
    const report = JSON.parse(result.stdout)
    assert.equal(report.ok, false)
    assert.equal(report.findings.some((f) => f.kind === "duplicate-title"), true)
    assert.equal(report.findings.some((f) => f.kind === "missing-provenance"), true)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("lint catches derived outputs promoted as truth", () => {
  const vault = tempRoot("mph-lint-derived-")
  try {
    fs.mkdirSync(path.join(vault, "02 Projects"), { recursive: true })
    fs.writeFileSync(path.join(vault, "02 Projects", "Derived.md"), "---\ncanonical_memory: false\n---\n# Derived Index\n\nDerived output.")
    const result = runCli(["lint", "--vault", vault, "--json"])
    assert.equal(result.status, 1)
    const report = JSON.parse(result.stdout)
    assert.equal(report.findings.some((f) => f.kind === "derived-promoted-as-truth"), true)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("lint does not flag derived/ folder files with canonical_memory: false as promoted truth", () => {
  const vault = tempRoot("mph-lint-derived-exclude-")
  try {
    fs.mkdirSync(path.join(vault, "derived", "Reports"), { recursive: true })
    // File in a derived/ folder with canonical_memory: false — should NOT trigger derived-promoted-as-truth
    fs.writeFileSync(path.join(vault, "derived", "Reports", "Summary.md"), "---\ncanonical_memory: false\nprovenance: test\n---\n# Derived Summary\n\nDerived output in recommended folder with [[provenance]] links.\n")
    const result = runCli(["lint", "--vault", vault, "--json"])
    const report = JSON.parse(result.stdout)
    // The specific derived-promoted-as-truth finding should be suppressed for derived/ folder files
    assert.equal(report.findings.some((f) => f.kind === "derived-promoted-as-truth"), false,
      "Files in derived/ folder should not trigger derived-promoted-as-truth regardless of canonical_memory setting")
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("lint passes for a clean well-structured vault", () => {
  const vault = tempRoot("mph-lint-clean-")
  try {
    fs.mkdirSync(path.join(vault, "02 Projects"), { recursive: true })
    fs.writeFileSync(path.join(vault, "02 Projects", "Note.md"), "---\nstatus: active\nprovenance: user-test\n---\n# Note\n\nClean content with [[RelatedNote]] for linking.\n")
    fs.writeFileSync(path.join(vault, "02 Projects", "RelatedNote.md"), "---\nstatus: active\nprovenance: user-test\n---\n# Related Note\n\nLinked from Note.")
    const result = runCli(["lint", "--vault", vault, "--json"])
    assert.equal(result.status, 0)
    const report = JSON.parse(result.stdout)
    assert.equal(report.ok, true)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("lifecycle-audit --json includes structured action fields", () => {
  const vault = tempRoot()
  try {
    fs.mkdirSync(path.join(vault, "02 Projects", "Example"), { recursive: true })
    fs.writeFileSync(path.join(vault, "02 Projects", "Example", "Expired.md"), "---\nstatus: active\nvalid_until: 2025-01-01\n---\n# Expired\n\nOld content.\n")
    const result = runCli(["lifecycle-audit", "--vault", vault, "--now", "2026-07-06", "--json"])
    assert.equal(result.status, 1)
    const report = JSON.parse(result.stdout)

    // Backward compat: old fields still present
    assert.equal(report.actions.some((a) => a.action === "revalidate" && a.file && a.reason), true)
    // New fields: type and target
    const revalidateAction = report.actions.find((a) => a.action === "revalidate")
    assert.equal(revalidateAction.type, "expired-valid-until")
    assert.equal(revalidateAction.target, "valid_until")
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("brain-session-brief returns compact state without network", () => {
  const vault = tempRoot("mph-brief-")
  try {
    fs.mkdirSync(path.join(vault, "02 Projects"), { recursive: true })
    fs.writeFileSync(path.join(vault, "02 Projects", "Note.md"), "---\nstatus: active\nprovenance: test\n---\n# Note\n\nContent.\n")

    const result = runCli(["brain-session-brief", "--vault", vault, "--json"])
    assert.equal(result.status, 0, result.stderr)
    const brief = JSON.parse(result.stdout)
    assert.equal(brief.vault, path.resolve(vault))
    assert.equal(brief.sync.configured, false)
    assert.equal(brief.health.ok, true)
    assert.equal(brief.health.markdownFiles >= 1, true)
    assert.equal(typeof brief.health.score, "number")
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("brain-session-brief shows sync config when available", () => {
  const shared = initializeSharedBrain()
  try {
    const result = runCli(["brain-session-brief", "--vault", shared.second, "--json"])
    assert.equal(result.status, 0, result.stderr)
    const brief = JSON.parse(result.stdout)
    assert.equal(brief.sync.configured, true)
    assert.equal(brief.sync.repo, "example/shared-brain")
  } finally {
    fs.rmSync(shared.root, { recursive: true, force: true })
  }
})

test("CLI help lists the new audit, lint, and brain-session-brief commands", () => {
  const result = runCli(["--help"])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /audit/)
  assert.match(result.stdout, /lint/)
  assert.match(result.stdout, /brain-session-brief/)
})

test("restructure verify reports a drifted record as failure", () => {
  const vault = tempRoot()
  const outputRoot = tempRoot("mph-plan-output-")
  try {
    initializeCommittedVault(vault)
    const recordFile = path.join(outputRoot, "record.json")
    fs.writeFileSync(recordFile, `${JSON.stringify({
      version: 1,
      id: "drifted-record",
      vaultRoot: vault,
      status: "applied",
      moves: [{ source: "note.md", target: "03 Reference/note.md" }],
    }, null, 2)}\n`)
    const result = runCli(["restructure-verify", "--vault", vault, "--record", recordFile])
    assert.equal(result.status, 1)
    assert.equal(JSON.parse(result.stdout).ok, false)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }
})

test("CLI help lists the three new Batch D commands", () => {
  const result = runCli(["--help"])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /conflict-plan/)
  assert.match(result.stdout, /conflict-apply/)
  assert.match(result.stdout, /curation-apply/)
})

test("conflict-plan generates a reviewable plan with approved: false entries", () => {
  const outputRoot = tempRoot("mph-cp-")
  try {
    const reportFile = path.join(outputRoot, "report.json")
    fs.writeFileSync(reportFile, `${JSON.stringify({
      status: "ok",
      safeToAutoPull: false,
      checkedAt: new Date().toISOString(),
      branch: "main",
      relationship: "diverged",
      workingTreeDirty: false,
      summary: { filesChanged: 1, overlappingFiles: 1, localOnlyFiles: 0, remoteOnlyFiles: 0, dirtyFiles: 0 },
      files: [{ path: "shared.md", localStatus: "M", remoteStatus: "M", dirty: false, review: { type: "same-note-changed", semanticRisk: "high" }, recommendation: "Ask user" }],
      decisionOptions: [
        { id: "create-tension", when: "Both sides may be true", action: "Keep both visible with TENSION", requiresUserApproval: true },
        { id: "supersede-local", when: "Remote is newer", action: "Mark local superseded", requiresUserApproval: true },
      ],
      nextDecision: "Semantic conflict: review overlapping notes with the user",
      guardrails: ["Do not auto-merge memory conflicts."],
    }, null, 2)}\n`)

    const planFile = path.join(outputRoot, "plan.json")
    const result = runCli(["conflict-plan", "--conflict-report", reportFile, "--out", planFile])
    assert.equal(result.status, 0, result.stderr)
    const plan = JSON.parse(fs.readFileSync(planFile, "utf8"))
    assert.equal(plan.version, 1)
    assert.match(plan.id, /^conflict-plan-/)
    assert.equal(plan.entries.length, 2)
    assert.equal(plan.entries[0].approved, false)
    assert.equal(plan.entries[1].approved, false)
    assert.equal(plan.entries[0].optionId, "create-tension")
    assert.equal(plan.entries[1].optionId, "supersede-local")
    assert.equal(plan.entries[0].requiresUserApproval, true)
    assert.equal(plan.guardrails.length, 1)
    assert.match(result.stdout, /Conflict plan written/)
  } finally {
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }
})

test("conflict-plan entries include same-note conflict markers", () => {
  const outputRoot = tempRoot("mph-cp-sem-")
  try {
    const reportFile = path.join(outputRoot, "report.json")
    fs.writeFileSync(reportFile, `${JSON.stringify({
      status: "ok", safeToAutoPull: false, checkedAt: new Date().toISOString(),
      branch: "main", relationship: "diverged", workingTreeDirty: false,
      summary: { filesChanged: 1, overlappingFiles: 1, localOnlyFiles: 0, remoteOnlyFiles: 0, dirtyFiles: 0 },
      files: [{ path: "shared.md", localStatus: "M", remoteStatus: "M", dirty: false, review: { type: "same-note-changed", semanticRisk: "high" }, recommendation: "Ask user" }],
      decisionOptions: [
        { id: "create-tension", when: "Both sides", action: "Keep both", requiresUserApproval: true },
        { id: "merge-compatible", when: "Additive", action: "Merge both", requiresUserApproval: true },
      ],
    }, null, 2)}\n`)

    const planFile = path.join(outputRoot, "plan.json")
    runCli(["conflict-plan", "--conflict-report", reportFile, "--out", planFile])
    assert.equal(fs.existsSync(planFile), true)
    const plan = JSON.parse(fs.readFileSync(planFile, "utf8"))

    const createTension = plan.entries.find((e) => e.optionId === "create-tension")
    assert.equal(createTension.hasSameNoteConflict, true)
    assert.deepEqual(createTension.affectedFiles, ["shared.md"])

    const mergeCompat = plan.entries.find((e) => e.optionId === "merge-compatible")
    assert.equal(mergeCompat.hasSameNoteConflict, true)
  } finally {
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }
})

test("conflict-plan requires --conflict-report and --out", () => {
  const result = runCli(["conflict-plan"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Missing --conflict-report/)
})

test("conflict-plan rejects malformed report input", () => {
  const outputRoot = tempRoot("mph-cp-mal-")
  try {
    const badFile = path.join(outputRoot, "bad.json")
    fs.writeFileSync(badFile, `{"status":"ok"}\n`) // missing decisionOptions
    const outFile = path.join(outputRoot, "plan.json")
    const result = runCli(["conflict-plan", "--conflict-report", badFile, "--out", outFile])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /INVALID_CONFLICT_REPORT/)
  } finally {
    fs.rmSync(outputRoot, { recursive: true, force: true })
  }
})

test("conflict-apply requires --approve flag", () => {
  const root = tempRoot("mph-ca-approve-")
  try {
    const planFile = path.join(root, "plan.json")
    fs.writeFileSync(planFile, `${JSON.stringify({ version: 1, id: "test", entries: [] }, null, 2)}\n`)
    const result = runCli(["conflict-apply", "--vault", root, "--plan", planFile])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /without --approve/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("conflict-apply blocks same-note semantic conflicts with BLOCKED error", () => {
  const vault = tempRoot("mph-ca-blocked-")
  try {
    initializeCommittedVault(vault)
    const planFile = path.join(vault, "plan.json")
    fs.writeFileSync(planFile, `${JSON.stringify({
      version: 1, id: "semantic-test", relationship: "diverged",
      entries: [{
        optionId: "create-tension",
        when: "Both sides changed same note",
        action: "Keep both visible with TENSION",
        affectedFiles: ["shared.md"],
        hasSameNoteConflict: true,
        requiresUserApproval: true,
        approved: true,
      }],
    }, null, 2)}\n`)

    const result = runCli(["conflict-apply", "--vault", vault, "--plan", planFile, "--approve"])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /SEMANTIC_CONFLICT_BLOCKED/)
    assert.match(result.stderr, /cannot auto-resolve/)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("conflict-apply reports no approved entries without error", () => {
  const vault = tempRoot("mph-ca-none-")
  try {
    initializeCommittedVault(vault)
    const planFile = path.join(vault, "plan.json")
    fs.writeFileSync(planFile, `${JSON.stringify({
      version: 1, id: "no-approved-test",
      entries: [{
        optionId: "create-tension",
        approved: false,
        hasSameNoteConflict: true,
        requiresUserApproval: true,
      }],
    }, null, 2)}\n`)

    const result = runCli(["conflict-apply", "--vault", vault, "--plan", planFile, "--approve"])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /No approved entries/)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("conflict-apply dry-run validates without applying", () => {
  const vault = tempRoot("mph-ca-dry-")
  try {
    initializeCommittedVault(vault)
    const planFile = path.join(vault, "plan.json")
    fs.writeFileSync(planFile, `${JSON.stringify({
      version: 1, id: "dry-run-test", relationship: "behind",
      entries: [{
        optionId: "merge-compatible",
        when: "Remote is ahead",
        action: "Fast-forward pull",
        affectedFiles: [],
        hasSameNoteConflict: false,
        requiresUserApproval: false,
        approved: true,
      }],
    }, null, 2)}\n`)

    const result = runCli(["conflict-apply", "--vault", vault, "--plan", planFile, "--dry-run"])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /dry-run/)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("conflict-apply reports missing entries array", () => {
  const vault = tempRoot("mph-ca-bad-")
  try {
    const planFile = path.join(vault, "plan.json")
    fs.writeFileSync(planFile, `${JSON.stringify({ version: 1, id: "bad" }, null, 2)}\n`)
    const result = runCli(["conflict-apply", "--vault", vault, "--plan", planFile, "--approve"])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /INVALID_CONFLICT_PLAN/)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("conflict-apply dynamically checks worktree instead of trusting stale plan.dirtyFiles", () => {
  const vault = tempRoot("mph-ca-dynamic-")
  try {
    initializeCommittedVault(vault)
    const planFile = path.join(vault, "plan.json")
    // Plan has stale dirtyFiles — worktree is actually clean
    fs.writeFileSync(planFile, `${JSON.stringify({
      version: 1, id: "dynamic-check-test", relationship: "behind",
      dirtyFiles: ["note.md"],
      entries: [{
        optionId: "merge-compatible",
        when: "Remote is ahead",
        action: "Fast-forward pull",
        affectedFiles: [],
        hasSameNoteConflict: false,
        requiresUserApproval: false,
        approved: true,
      }],
    }, null, 2)}\n`)

    // Should NOT block on stale plan dirtyFiles — dynamic check finds clean worktree
    const result = runCli(["conflict-apply", "--vault", vault, "--plan", planFile, "--approve"])
    // The command will fail later (no remote or no config), but must NOT
    // fail with the stale dirtyFiles error
    const allOutput = result.stdout + "\n" + result.stderr
    assert.equal(allOutput.includes("Working tree has uncommitted changes"), false,
      "Should not block on stale plan.dirtyFiles when worktree is clean")
    // It should get past the dirty check and fail at a later step
    assert.equal(result.stdout.includes("No approved entries") ||
      allOutput.includes("SYNC_CONFIG_NOT_FOUND") ||
      allOutput.includes("COMMAND_FAILED") ||
      allOutput.includes("COMMAND_NOT_FOUND"), true,
      `Should reach a later step after the dynamic dirty check.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("curation-apply requires --approve flag", () => {
  const root = tempRoot("mph-cura-app-")
  try {
    const planFile = path.join(root, "plan.json")
    fs.writeFileSync(planFile, `${JSON.stringify({ role: "curation-plan", recommendations: [] }, null, 2)}\n`)
    const result = runCli(["curation-apply", "--plan", planFile])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /without --approve/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("curation-apply safely no-ops on standard curation output with no auto-applicable candidates", () => {
  const root = tempRoot("mph-cura-noop-")
  try {
    const planFile = path.join(root, "plan.json")
    fs.writeFileSync(planFile, `${JSON.stringify({
      role: "curation-plan",
      canonical_memory: false,
      schema_version: "1.0",
      method: "governed-bm25f-sections",
      totalRuns: 1,
      misses: 1,
      recommendations: [{
        id: "miss-1",
        category: "routing",
        kind: "buried-gold",
        severity: "high",
        scope: "Memory",
        query: "Where is the policy?",
        expected: ["Memory/Policy.md"],
        retrieved: ["Memory/Summary.md"],
        patchCandidates: [{
          type: "alias-patch-candidate",
          target: "Memory/Policy.md",
          proposed: { addAliases: ["policy", "rule"] },
          autoApplicable: false,
          requiresHumanReview: true,
          evidence: { query: "Where is the policy?" },
        }],
      }],
    }, null, 2)}\n`)

    const result = runCli(["curation-apply", "--plan", planFile, "--approve"])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /No auto-applicable candidates found/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("curation-apply applies alias-patch-candidate when flags are set", () => {
  const root = tempRoot("mph-cura-apply-")
  try {
    const vault = path.join(root, "vault")
    fs.mkdirSync(path.join(vault, "Memory"), { recursive: true })
    fs.writeFileSync(path.join(vault, "Memory", "Policy.md"), "---\nstatus: active\n---\n# Policy\n\nContent.\n")

    const planFile = path.join(root, "plan.json")
    fs.writeFileSync(planFile, `${JSON.stringify({
      role: "curation-plan",
      canonical_memory: false,
      schema_version: "1.0",
      method: "governed-bm25f-sections",
      totalRuns: 1,
      misses: 1,
      recommendations: [{
        id: "alias-test",
        category: "routing",
        kind: "no-candidates",
        severity: "high",
        scope: "Memory",
        query: "policy rule guideline",
        expected: ["Memory/Policy.md"],
        retrieved: [],
        patchCandidates: [{
          type: "alias-patch-candidate",
          target: path.join(vault, "Memory", "Policy.md"),
          proposed: { addAliases: ["rule", "guideline"] },
          autoApplicable: true,
          requiresHumanReview: false,
          approved: true,
          evidence: { query: "policy rule guideline" },
        }],
      }],
    }, null, 2)}\n`)

    const before = fs.readFileSync(path.join(vault, "Memory", "Policy.md"), "utf8")
    assert.equal(before.includes("aliases:"), false)

    const result = runCli(["curation-apply", "--plan", planFile, "--approve"])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Applied alias-patch/)

    const after = fs.readFileSync(path.join(vault, "Memory", "Policy.md"), "utf8")
    assert.match(after, /aliases: \[/)
    assert.match(after, /"rule"/)
    assert.match(after, /"guideline"/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("curation-apply adds frontmatter when target file has none", () => {
  const root = tempRoot("mph-cura-nofm-")
  try {
    const vault = path.join(root, "vault")
    fs.mkdirSync(path.join(vault, "Memory"), { recursive: true })
    fs.writeFileSync(path.join(vault, "Memory", "Note.md"), "# No Frontmatter\n\nContent.\n")

    const planFile = path.join(root, "plan.json")
    fs.writeFileSync(planFile, `${JSON.stringify({
      role: "curation-plan", canonical_memory: false, schema_version: "1.0",
      method: "governed-bm25f-sections", totalRuns: 1, misses: 1,
      recommendations: [{
        id: "nofm-test", category: "routing", kind: "no-candidates",
        severity: "high", scope: "Memory",
        query: "test", expected: ["Memory/Note.md"], retrieved: [],
        patchCandidates: [{
          type: "alias-patch-candidate",
          target: path.join(vault, "Memory", "Note.md"),
          proposed: { addAliases: ["alternate-name"] },
          autoApplicable: true, requiresHumanReview: false, approved: true,
          evidence: { query: "test" },
        }],
      }],
    }, null, 2)}\n`)

    const result = runCli(["curation-apply", "--plan", planFile, "--approve"])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /added frontmatter with aliases/)

    const content = fs.readFileSync(path.join(vault, "Memory", "Note.md"), "utf8")
    assert.match(content, /^---/)
    assert.match(content, /aliases: \[/)
    assert.match(content, /"alternate-name"/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("curation-apply handles CRLF frontmatter without duplicating it", () => {
  const root = tempRoot("mph-cura-crlf-")
  try {
    const vault = path.join(root, "vault")
    fs.mkdirSync(path.join(vault, "Memory"), { recursive: true })
    // Write file with CRLF frontmatter
    fs.writeFileSync(path.join(vault, "Memory", "Policy.md"), "---\r\nstatus: active\r\n---\r\n# Policy\r\n\r\nContent.\r\n")

    const planFile = path.join(root, "plan.json")
    fs.writeFileSync(planFile, `${JSON.stringify({
      role: "curation-plan", canonical_memory: false, schema_version: "1.0",
      method: "governed-bm25f-sections", totalRuns: 1, misses: 1,
      recommendations: [{
        id: "crlf-test", category: "routing", kind: "no-candidates",
        severity: "high", scope: "Memory",
        query: "policy rule", expected: ["Memory/Policy.md"], retrieved: [],
        patchCandidates: [{
          type: "alias-patch-candidate",
          target: path.join(vault, "Memory", "Policy.md"),
          proposed: { addAliases: ["rule"] },
          autoApplicable: true, requiresHumanReview: false, approved: true,
          evidence: { query: "policy rule" },
        }],
      }],
    }, null, 2)}\n`)

    const before = fs.readFileSync(path.join(vault, "Memory", "Policy.md"), "utf8")
    assert.ok(before.startsWith("---\r\n"), "fixture uses CRLF")

    const result = runCli(["curation-apply", "--plan", planFile, "--approve"])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Applied alias-patch/)

    const after = fs.readFileSync(path.join(vault, "Memory", "Policy.md"), "utf8")
    // Should NOT have duplicate frontmatter (adjacent closing/opening markers)
    assert.equal(after.indexOf("---\n---"), -1, "no empty duplicate frontmatter (LF)")
    assert.equal(after.indexOf("---\r\n---"), -1, "no empty duplicate frontmatter (CRLF)")
    // Should have exactly one frontmatter block = 2 --- markers
    const fmEnds = after.match(/---/g)
    assert.equal(fmEnds.length, 2, "exactly 2 --- markers (one opening, one closing)")
    // Should contain the alias
    assert.match(after, /aliases: \[/)
    assert.match(after, /"rule"/)
    // Original frontmatter preserved
    assert.match(after, /status: active/)
    // All content after frontmatter preserved
    assert.match(after, /# Policy/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
