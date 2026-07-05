import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  analyzeVaultHealth,
  applyRestructureManifest,
  assertSafeToBootstrap,
  buildAdoptionPlan,
  buildRestructureManifest,
  initialBrainFiles,
  inspectMemoryRoot,
  makeSyncConfig,
  normalizeRepoName,
  renderAdoptionPlanMarkdown,
  rollbackRestructureRecord,
  scanTextForSecrets,
  validateRestructureManifest,
  verifyRestructureRecord,
} from "../src/brain-sync.mjs"

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mph-brain-sync-test-"))
}

test("accepts OWNER/REPO GitHub repository names", () => {
  assert.equal(normalizeRepoName("example-owner/example-brain"), "example-owner/example-brain")
})

test("rejects repository names without an owner", () => {
  assert.equal(normalizeRepoName("my-brain"), null)
})

test("builds a private brain sync config by default", () => {
  const config = makeSyncConfig({ repo: "example-owner/example-brain" })
  assert.equal(config.repo, "example-owner/example-brain")
  assert.equal(config.visibility, "private")
  assert.equal(config.branch, "main")
  assert.equal(config.memoryRoot, ".")
})

test("rejects unsupported repo visibility", () => {
  assert.throws(() => makeSyncConfig({ repo: "example-owner/example-brain", visibility: "secret" }), /visibility/)
})

test("creates a minimal memory-only repository skeleton", () => {
  const files = initialBrainFiles({ title: "My Brain" })
  assert.equal(files.has("README.md"), true)
  assert.equal(files.has("00 Inbox/.gitkeep"), true)
  assert.equal(files.has("02 Projects/.gitkeep"), true)
  assert.match(files.get("README.md"), /Do not store secrets/)
})

test("detects secret-like values before sync", () => {
  const findings = scanTextForSecrets("api_key = example-secret-value-123456")
  assert.equal(findings.length > 0, true)
})

test("does not flag normal Markdown links as secrets", () => {
  const findings = scanTextForSecrets("[source](https://github.com/example/repo)")
  assert.deepEqual(findings, [])
})

test("analyzes a healthy linked vault without critical findings", () => {
  const root = tempRoot()
  try {
    fs.mkdirSync(path.join(root, "02 Projects", "Example"), { recursive: true })
    fs.writeFileSync(path.join(root, "02 Projects", "Example", "Home.md"), [
      "# Example Home",
      "status: active",
      "provenance: local fixture",
      "",
      "Related: [[Decision]]",
      "",
    ].join("\n"))
    fs.writeFileSync(path.join(root, "02 Projects", "Example", "Decision.md"), [
      "# Decision",
      "status: active",
      "source: local fixture",
      "",
      "Back: [[Home]]",
      "",
    ].join("\n"))
    const report = analyzeVaultHealth(root)
    assert.equal(report.ok, true)
    assert.equal(report.summary.critical, 0)
    assert.equal(report.findings.some((finding) => finding.kind === "unresolved-link"), false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("detects vault health issues that should guide a curator", () => {
  const root = tempRoot()
  try {
    fs.mkdirSync(path.join(root, "02 Projects"), { recursive: true })
    fs.mkdirSync(path.join(root, "03 Reference"), { recursive: true })
    fs.writeFileSync(path.join(root, "02 Projects", "A.md"), [
      "# Same Title",
      "api_key = example-secret-value-123456",
      "See [[Missing Note]]",
      "",
    ].join("\n"))
    fs.writeFileSync(path.join(root, "03 Reference", "B.md"), "# Same Title\nThis stale note has no next step.\n")
    const report = analyzeVaultHealth(root)
    const kinds = report.findings.map((finding) => finding.kind)
    assert.equal(report.ok, false)
    assert.equal(report.summary.critical, 1)
    assert.equal(kinds.includes("secret-like-value"), true)
    assert.equal(kinds.includes("unresolved-link"), true)
    assert.equal(kinds.includes("duplicate-title"), true)
    assert.equal(kinds.includes("missing-provenance"), true)
    assert.equal(kinds.includes("stale-without-revalidation"), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("classifies a missing vault as safe to create", () => {
  const root = path.join(os.tmpdir(), `mph-missing-${Date.now()}`)
  const inspected = inspectMemoryRoot(root)
  assert.equal(inspected.kind, "missing")
  assert.equal(inspected.safeDefaultAction, "create")
  assert.equal(inspected.requiresAdoptionApproval, false)
})

test("classifies an empty directory as safe to initialize", () => {
  const root = tempRoot()
  try {
    const inspected = inspectMemoryRoot(root)
    assert.equal(inspected.kind, "empty-directory")
    assert.equal(inspected.requiresAdoptionApproval, false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("rejects a file path used as a vault directory", () => {
  const root = tempRoot()
  try {
    const file = path.join(root, "brain.md")
    fs.writeFileSync(file, "# Not a vault directory\n")
    const inspected = inspectMemoryRoot(file)
    assert.equal(inspected.kind, "not-a-directory")
    assert.equal(inspected.safeDefaultAction, "choose-directory")
    assert.throws(
      () => assertSafeToBootstrap(inspected, { adoptExisting: true }),
      /INVALID_VAULT_PATH/,
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("classifies an existing configured brain as safe to connect", () => {
  const root = tempRoot()
  try {
    fs.mkdirSync(path.join(root, ".memory-patch-harness"), { recursive: true })
    fs.writeFileSync(path.join(root, ".memory-patch-harness", "brain-sync.json"), "{}")
    const inspected = inspectMemoryRoot(root)
    assert.equal(inspected.kind, "configured-brain")
    assert.equal(inspected.requiresAdoptionApproval, false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("classifies a harness-shaped memory vault as compatible", () => {
  const root = tempRoot()
  try {
    fs.mkdirSync(path.join(root, "02 Projects"), { recursive: true })
    fs.mkdirSync(path.join(root, "03 Reference"), { recursive: true })
    const inspected = inspectMemoryRoot(root)
    assert.equal(inspected.kind, "harness-compatible-memory")
    assert.equal(inspected.requiresAdoptionApproval, false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("requires explicit adoption for an existing Obsidian vault", () => {
  const root = tempRoot()
  try {
    fs.mkdirSync(path.join(root, ".obsidian"), { recursive: true })
    fs.writeFileSync(path.join(root, "Agent Memory.md"), "# Agent Memory\n")
    const inspected = inspectMemoryRoot(root)
    assert.equal(inspected.kind, "existing-obsidian-vault")
    assert.equal(inspected.requiresAdoptionApproval, true)
    assert.throws(() => assertSafeToBootstrap(inspected), /Refusing to modify/)
    assert.doesNotThrow(() => assertSafeToBootstrap(inspected, { adoptExisting: true }))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("requires explicit adoption for a custom markdown memory repo", () => {
  const root = tempRoot()
  try {
    for (let index = 0; index < 5; index += 1) {
      fs.writeFileSync(path.join(root, `note-${index}.md`), `# Note ${index}\n`)
    }
    const inspected = inspectMemoryRoot(root)
    assert.equal(inspected.kind, "custom-markdown-memory")
    assert.equal(inspected.safeDefaultAction, "adopt-after-confirmation")
    assert.throws(() => assertSafeToBootstrap(inspected), /Refusing to modify/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("requires explicit adoption for a generic git repo", () => {
  const root = tempRoot()
  try {
    fs.mkdirSync(path.join(root, ".git"), { recursive: true })
    fs.writeFileSync(path.join(root, "data.txt"), "custom data\n")
    const inspected = inspectMemoryRoot(root)
    assert.equal(inspected.kind, "generic-git-repo")
    assert.equal(inspected.requiresAdoptionApproval, true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("classifies a non-markdown random folder separately from memory", () => {
  const root = tempRoot()
  try {
    fs.writeFileSync(path.join(root, "data.bin"), "not markdown\n")
    const inspected = inspectMemoryRoot(root)
    assert.equal(inspected.kind, "non-empty-directory")
    assert.equal(inspected.requiresAdoptionApproval, true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("builds an adoption plan for custom memory without moving files", () => {
  const root = tempRoot()
  try {
    fs.mkdirSync(path.join(root, "clippings"), { recursive: true })
    fs.mkdirSync(path.join(root, "projects"), { recursive: true })
    fs.writeFileSync(path.join(root, "clippings", "agent-loop.md"), "# Agent Loop\n")
    fs.writeFileSync(path.join(root, "projects", "stock-app.md"), "# Stock App\n")
    fs.writeFileSync(path.join(root, "random-note.md"), "# Random\n")

    const plan = buildAdoptionPlan(root)
    assert.equal(plan.inspected.kind, "custom-markdown-memory")
    assert.equal(plan.requiresHumanReview, true)
    assert.equal(plan.candidateBuckets.inboxCandidates.length, 1)
    assert.equal(plan.candidateBuckets.projectCandidates.length, 1)
    assert.equal(plan.candidateBuckets.needsReview.length, 1)
    assert.equal(fs.existsSync(path.join(root, "00 Inbox")), false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("renders an adoption plan with an explicit user decision section", () => {
  const plan = {
    root: "C:/Brain",
    inspected: { kind: "custom-markdown-memory", signals: ["5+ markdown file(s)"] },
    current: { markdownFiles: 5 },
    target: {
      folders: ["00 Inbox"],
      existingHarnessFolders: [],
      missingHarnessFolders: ["00 Inbox"],
    },
    candidateBuckets: { needsReview: ["note.md"] },
    suggestedPlan: ["Review before moving files."],
    requiresHumanReview: true,
  }
  const markdown = renderAdoptionPlanMarkdown(plan)
  assert.match(markdown, /User Decision Needed/)
  assert.match(markdown, /Review before moving files/)
})

test("builds a draft restructure manifest without approving suggestions", () => {
  const root = tempRoot()
  try {
    fs.mkdirSync(path.join(root, "clippings"), { recursive: true })
    fs.writeFileSync(path.join(root, "clippings", "agent-loop.md"), "# Agent Loop\n")
    const manifest = buildRestructureManifest(buildAdoptionPlan(root), { id: "test-plan" })
    assert.equal(manifest.status, "draft")
    assert.equal(manifest.policy.explicitApprovalRequired, true)
    assert.equal(manifest.entries.length, 1)
    assert.equal(manifest.entries[0].approved, false)
    assert.match(manifest.entries[0].target, /^00 Inbox\//)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("rejects a restructure manifest with no approved entries", () => {
  const root = tempRoot()
  try {
    fs.writeFileSync(path.join(root, "note.md"), "# Note\n")
    const manifest = buildRestructureManifest(buildAdoptionPlan(root), { id: "empty-approval" })
    assert.throws(
      () => validateRestructureManifest(manifest, { vault: root }),
      /no approved entries/,
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("rejects restructure plans created for another vault", () => {
  const root = tempRoot()
  const other = tempRoot()
  try {
    fs.writeFileSync(path.join(root, "note.md"), "# Note\n")
    const manifest = {
      version: 1,
      id: "wrong-vault",
      vaultRoot: other,
      entries: [{ source: "note.md", target: "03 Reference/note.md", approved: true }],
    }
    assert.throws(
      () => validateRestructureManifest(manifest, { vault: root }),
      /vaultRoot does not match/,
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(other, { recursive: true, force: true })
  }
})

test("rejects path traversal and absolute paths", () => {
  const root = tempRoot()
  try {
    fs.writeFileSync(path.join(root, "note.md"), "# Note\n")
    const base = { version: 1, id: "unsafe", vaultRoot: root }
    assert.throws(
      () => validateRestructureManifest({ ...base, entries: [{ source: "note.md", target: "../outside.md", approved: true }] }, { vault: root }),
      /escapes the vault root/,
    )
    assert.throws(
      () => validateRestructureManifest({ ...base, entries: [{ source: path.resolve(root, "note.md"), target: "03 Reference/note.md", approved: true }] }, { vault: root }),
      /safe relative path/,
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("rejects protected migration roots", () => {
  const root = tempRoot()
  try {
    fs.writeFileSync(path.join(root, "note.md"), "# Note\n")
    const manifest = {
      version: 1,
      id: "protected",
      vaultRoot: root,
      entries: [{ source: "note.md", target: ".obsidian/note.md", approved: true }],
    }
    assert.throws(
      () => validateRestructureManifest(manifest, { vault: root }),
      /protected path/,
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("rejects duplicate targets and existing targets", () => {
  const root = tempRoot()
  try {
    fs.writeFileSync(path.join(root, "one.md"), "# One\n")
    fs.writeFileSync(path.join(root, "two.md"), "# Two\n")
    const duplicate = {
      version: 1,
      id: "duplicate",
      vaultRoot: root,
      entries: [
        { source: "one.md", target: "03 Reference/shared.md", approved: true },
        { source: "two.md", target: "03 Reference/shared.md", approved: true },
      ],
    }
    assert.throws(
      () => validateRestructureManifest(duplicate, { vault: root }),
      /Duplicate approved target/,
    )
    const caseCollision = {
      version: 1,
      id: "case-collision",
      vaultRoot: root,
      entries: [
        { source: "one.md", target: "03 Reference/Shared.md", approved: true },
        { source: "two.md", target: "03 Reference/shared.md", approved: true },
      ],
    }
    assert.throws(
      () => validateRestructureManifest(caseCollision, { vault: root }),
      /Duplicate approved target/,
    )
    fs.mkdirSync(path.join(root, "03 Reference"), { recursive: true })
    fs.writeFileSync(path.join(root, "03 Reference", "existing.md"), "# Existing\n")
    const collision = {
      version: 1,
      id: "collision",
      vaultRoot: root,
      entries: [{ source: "one.md", target: "03 Reference/existing.md", approved: true }],
    }
    assert.throws(
      () => validateRestructureManifest(collision, { vault: root }),
      /target already exists/,
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("rejects target directories that resolve outside the vault through a link", () => {
  const root = tempRoot()
  const outside = tempRoot("mph-outside-")
  try {
    fs.writeFileSync(path.join(root, "note.md"), "# Note\n")
    fs.symlinkSync(outside, path.join(root, "linked"), process.platform === "win32" ? "junction" : "dir")
    const manifest = {
      version: 1,
      id: "linked-target",
      vaultRoot: root,
      entries: [{ source: "note.md", target: "linked/note.md", approved: true }],
    }
    assert.throws(
      () => validateRestructureManifest(manifest, { vault: root }),
      /PATH_ESCAPE/,
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(outside, { recursive: true, force: true })
  }
})

test("rejects non-Markdown moves and oversized batches", () => {
  const root = tempRoot()
  try {
    fs.writeFileSync(path.join(root, "note.txt"), "not markdown\n")
    const nonMarkdown = {
      version: 1,
      id: "non-markdown",
      vaultRoot: root,
      entries: [{ source: "note.txt", target: "03 Reference/note.txt", approved: true }],
    }
    assert.throws(
      () => validateRestructureManifest(nonMarkdown, { vault: root }),
      /Only Markdown notes/,
    )

    const entries = []
    for (let index = 0; index < 3; index += 1) {
      fs.writeFileSync(path.join(root, `note-${index}.md`), `# Note ${index}\n`)
      entries.push({ source: `note-${index}.md`, target: `03 Reference/note-${index}.md`, approved: true })
    }
    assert.throws(
      () => validateRestructureManifest({ version: 1, id: "large", vaultRoot: root, entries }, { vault: root, maxApproved: 2 }),
      /maximum is 2/,
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("applies, verifies, and rolls back an approved restructure batch", () => {
  const root = tempRoot()
  try {
    fs.mkdirSync(path.join(root, "clippings"), { recursive: true })
    fs.writeFileSync(path.join(root, "clippings", "agent-loop.md"), "# Agent Loop\n")
    const manifest = {
      version: 1,
      id: "round-trip",
      vaultRoot: root,
      entries: [{
        source: "clippings/agent-loop.md",
        target: "00 Inbox/agent-loop.md",
        approved: true,
        reason: "user approved raw clipping intake",
      }],
    }
    const record = applyRestructureManifest(manifest, { vault: root })
    assert.equal(record.moves.length, 1)
    assert.equal(verifyRestructureRecord(record, { vault: root }).ok, true)
    assert.equal(fs.readFileSync(path.join(root, "00 Inbox", "agent-loop.md"), "utf8"), "# Agent Loop\n")

    const rolledBack = rollbackRestructureRecord(record, { vault: root })
    assert.equal(rolledBack.status, "rolled-back")
    assert.equal(verifyRestructureRecord(rolledBack, { vault: root, state: "rolled-back" }).ok, true)
    assert.equal(fs.readFileSync(path.join(root, "clippings", "agent-loop.md"), "utf8"), "# Agent Loop\n")
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("rolls back already-applied moves when a later move fails", () => {
  const root = tempRoot()
  try {
    fs.writeFileSync(path.join(root, "one.md"), "# One\n")
    fs.writeFileSync(path.join(root, "two.md"), "# Two\n")
    const manifest = {
      version: 1,
      id: "transaction",
      vaultRoot: root,
      entries: [
        { source: "one.md", target: "03 Reference/one.md", approved: true },
        { source: "two.md", target: "03 Reference/two.md", approved: true },
      ],
    }
    let calls = 0
    const failingFs = Object.create(fs)
    failingFs.renameSync = (source, target) => {
      calls += 1
      if (calls === 2) throw new Error("simulated disk failure")
      return fs.renameSync(source, target)
    }
    assert.throws(
      () => applyRestructureManifest(manifest, { vault: root, fsApi: failingFs }),
      /applied moves were rolled back/,
    )
    assert.equal(fs.existsSync(path.join(root, "one.md")), true)
    assert.equal(fs.existsSync(path.join(root, "03 Reference", "one.md")), false)
    assert.equal(fs.existsSync(path.join(root, "two.md")), true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("refuses rollback when migration state has drifted", () => {
  const root = tempRoot()
  try {
    fs.writeFileSync(path.join(root, "note.md"), "# Note\n")
    const record = applyRestructureManifest({
      version: 1,
      id: "drift",
      vaultRoot: root,
      entries: [{ source: "note.md", target: "03 Reference/note.md", approved: true }],
    }, { vault: root })
    fs.writeFileSync(path.join(root, "note.md"), "# Conflicting replacement\n")
    assert.throws(
      () => rollbackRestructureRecord(record, { vault: root }),
      /state has drifted/,
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
