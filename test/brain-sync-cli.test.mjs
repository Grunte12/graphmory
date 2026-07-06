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

test("recall-semantic explains the optional dependency when it is not installed", () => {
  const vault = tempRoot("mph-recall-semantic-")
  fs.writeFileSync(path.join(vault, "Memory.md"), "# Memory\n\nSemantic recall fixture.")

  const result = runCli([
    "recall-semantic",
    "--vault",
    vault,
    "--query",
    "semantic fixture",
    "--json",
  ])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /OPTIONAL_DEPENDENCY_MISSING/)
  assert.match(result.stderr, /@huggingface\/transformers/)
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
