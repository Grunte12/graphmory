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
  buildSyncPlan,
  createNoteLinkResolver,
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
import { loadVaultDocuments } from "../src/memory-recall.mjs"

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mph-brain-sync-test-"))
}

test("accepts OWNER/REPO GitHub repository names", () => {
  assert.equal(normalizeRepoName("example-owner/example-brain"), "example-owner/example-brain")
})

test("raw vault roots are marked noncanonical when deliberately included", () => {
  const vault = tempRoot()
  fs.mkdirSync(path.join(vault, "Clippings"), { recursive: true })
  fs.writeFileSync(path.join(vault, "Clippings", "Article.md"), "# Article\nRaw web clipping.")
  const documents = loadVaultDocuments(vault, { includeRawPaths: true })
  assert.equal(documents[0].id, "Clippings/Article.md")
  assert.equal(documents[0].metadata.status, "raw")
})

test("nested inbox and archive paths are excluded by default and raw when included", () => {
  const vault = tempRoot()
  const nested = path.join(vault, "02 Projects", "Example", "inbox", "auto-triggers", "archive")
  fs.mkdirSync(nested, { recursive: true })
  fs.writeFileSync(
    path.join(nested, "Session.md"),
    "\uFEFF---\nstatus: active\n---\n# Session\nUnverified raw handoff.",
  )

  assert.deepEqual(loadVaultDocuments(vault), [])
  const documents = loadVaultDocuments(vault, { includeRawPaths: true })
  assert.equal(documents[0].metadata.status, "raw")
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

test("detects AWS access keys", () => {
  const findings = scanTextForSecrets("AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE")
  assert.ok(findings.some((f) => f.name === "aws access key"))
})

test("detects AWS secret keys", () => {
  const findings = scanTextForSecrets("aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY")
  assert.ok(findings.some((f) => f.name === "aws secret key"))
})

test("detects Azure connection strings", () => {
  const findings = scanTextForSecrets("DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=mykey1234567890")
  assert.ok(findings.some((f) => f.name === "azure connection string"))
})

test("detects Azure subscription IDs", () => {
  const findings = scanTextForSecrets("SubscriptionId: 123e4567-e89b-12d3-a456-426614174000")
  assert.ok(findings.some((f) => f.name === "azure subscription key"))
})

test("detects GCP service account keys", () => {
  const findings = scanTextForSecrets('"type": "service_account"')
  assert.ok(findings.some((f) => f.name === "gcp service account"))
})

test("detects Slack tokens", () => {
  // Assemble at runtime to avoid push protection matching the literal
  const token = "xoxb-" + "123456789012-abcdefghijklmnopqrst"
  const findings = scanTextForSecrets(token)
  assert.ok(findings.some((f) => f.name === "slack token"))
})

test("detects Discord bot tokens", () => {
  // Assemble at runtime to avoid push protection matching the literal
  const token = "MTA2" + "NzM5MzY4NzE2MjM5OTM2OA.Gd4R5k." + "abcdefghijklmnopqrstuvwxyz123456"
  const findings = scanTextForSecrets(token)
  assert.ok(findings.some((f) => f.name === "discord bot token"))
})

test("detects .env export lines", () => {
  const findings = scanTextForSecrets("export MY_SECRET_KEY=super-secret-value-abcdef")
  assert.ok(findings.some((f) => f.name === "env file export"))
})

test("detects Anthropic API keys", () => {
  const findings = scanTextForSecrets("sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456")
  assert.ok(findings.some((f) => f.name === "openai / anthropic key"))
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

// ─── Wiki-link resolution contract tests ────────────────────────────────

function fixtureNote(path, title, text, frontmatter) {
  const fm = frontmatter ? `---\n${frontmatter}\n---\n\n` : ""
  return {
    path,
    title,
    text: fm + text,
    outgoing: [],
  }
}

test("createNoteLinkResolver: bare title from nested note resolves to root note", () => {
  const notes = [
    fixtureNote("Root.md", "Root Note", "Content.", "status: active\nprovenance: fixture"),
    fixtureNote("02 Projects/Sub/Detail.md", "Detail", "See [[Root Note]]."),
  ]
  const resolver = createNoteLinkResolver(notes)
  const result = resolver("Root Note", "02 Projects/Sub/Detail.md")
  assert.equal(result.resolved, true)
  assert.equal(result.path, "Root.md")
  assert.equal(result.method, "title")
})

test("createNoteLinkResolver: nested unique bare title resolves to nested note", () => {
  const notes = [
    fixtureNote("Root.md", "Root Note", "Content."),
    fixtureNote("02 Projects/UniqueName.md", "Unique Name", "See [[Unique Name]]."),
  ]
  const resolver = createNoteLinkResolver(notes)
  const result = resolver("Unique Name", "Root.md")
  assert.equal(result.resolved, true)
  assert.equal(result.path, "02 Projects/UniqueName.md")
  assert.equal(result.method, "title")
})

test("createNoteLinkResolver: duplicate ambiguous title is not resolved", () => {
  const notes = [
    fixtureNote("02 Projects/A.md", "Same Title", "Content A."),
    fixtureNote("03 Reference/B.md", "Same Title", "Content B."),
  ]
  const resolver = createNoteLinkResolver(notes)
  const result = resolver("Same Title", "02 Projects/A.md")
  assert.equal(result.resolved, false)
  assert.equal(result.reason, "ambiguous")
  assert.ok(result.ambiguity.length >= 2)
})

test("createNoteLinkResolver: exact path-qualified link resolves", () => {
  const notes = [
    fixtureNote("Root.md", "Root Note", "Content."),
    fixtureNote("02 Projects/Sub/Detail.md", "Detail", "See [[02 Projects/Sub/Detail]]."),
  ]
  const resolver = createNoteLinkResolver(notes)
  const result = resolver("02 Projects/Sub/Detail", "Root.md")
  assert.equal(result.resolved, true)
  assert.equal(result.path, "02 Projects/Sub/Detail.md")
  assert.equal(result.method, "exact-path")
})

test("createNoteLinkResolver: current-note-relative link resolves", () => {
  const notes = [
    fixtureNote("02 Projects/Home.md", "Home", "See [[Sibling]]."),
    fixtureNote("02 Projects/Sibling.md", "Sibling", "Content."),
  ]
  const resolver = createNoteLinkResolver(notes)
  const result = resolver("Sibling", "02 Projects/Home.md")
  assert.equal(result.resolved, true)
  assert.equal(result.path, "02 Projects/Sibling.md")
  assert.equal(result.method, "relative")
})

test("createNoteLinkResolver: heading anchor is stripped and still resolves", () => {
  const notes = [
    fixtureNote("Note.md", "Note", "Content."),
  ]
  const resolver = createNoteLinkResolver(notes)
  const result = resolver("Note", "Any.md")
  assert.equal(result.resolved, true)
  assert.equal(result.path, "Note.md")
  // resolves by relative path since "Note" without path prefix and Any.md is in same dir
  assert.equal(result.method, "relative")
})

test("createNoteLinkResolver: unique alias from frontmatter resolves", () => {
  const notes = [
    fixtureNote("02 Projects/Config.md", "Configuration Guide", "Content.", "aliases:\n  - cfg\n  - setup-guide"),
    fixtureNote("Other.md", "Other", "Different."),
  ]
  const resolver = createNoteLinkResolver(notes)
  const result = resolver("cfg", "Root.md")
  assert.equal(result.resolved, true)
  assert.equal(result.path, "02 Projects/Config.md")
  assert.equal(result.method, "alias")
})

test("createNoteLinkResolver: alias with single-line string format", () => {
  const notes = [
    fixtureNote("LongName.md", "A Very Long Title", "Content.", "aliases: shorty"),
  ]
  const resolver = createNoteLinkResolver(notes)
  const result = resolver("shorty", "Root.md")
  assert.equal(result.resolved, true)
  assert.equal(result.path, "LongName.md")
  assert.equal(result.method, "alias")
})

test("createNoteLinkResolver: duplicate ambiguous alias is not resolved", () => {
  const notes = [
    fixtureNote("A.md", "Note A", "Content.", "aliases: [shared-alias]"),
    fixtureNote("B.md", "Note B", "Content.", "aliases: [shared-alias]"),
  ]
  const resolver = createNoteLinkResolver(notes)
  const result = resolver("shared-alias", "Root.md")
  assert.equal(result.resolved, false)
  assert.equal(result.reason, "ambiguous")
  assert.ok(result.ambiguity.length >= 2)
})

test("createNoteLinkResolver: external URL and pure anchors return external", () => {
  const notes = [fixtureNote("Note.md", "Note", "Content.")]
  const resolver = createNoteLinkResolver(notes)
  assert.deepEqual(resolver("https://example.com", "Note.md"), { resolved: false, path: null, reason: "external" })
  assert.deepEqual(resolver("ftp://files", "Note.md"), { resolved: false, path: null, reason: "external" })
  assert.deepEqual(resolver("#local-heading", "Note.md"), { resolved: false, path: null, reason: "external" })
})

test("createNoteLinkResolver: missing link returns unresolved", () => {
  const notes = [fixtureNote("Note.md", "Note", "Content.")]
  const resolver = createNoteLinkResolver(notes)
  const result = resolver("NonExistent", "Note.md")
  assert.equal(result.resolved, false)
  assert.equal(result.reason, "unresolved")
  assert.ok(result.path)
})

test("createNoteLinkResolver: basename takes priority over title for same match", () => {
  const notes = [
    fixtureNote("Matching.md", "Other Title", "Content."),
    fixtureNote("Other.md", "Matching", "A note whose title matches but file does not."),
  ]
  const resolver = createNoteLinkResolver(notes)
  // "Matching" should match basename "matching" not title "Matching" from Other.md
  // But since basename and title are on different notes, only one should win
  const result = resolver("Matching", "Root.md")
  assert.equal(result.resolved, true)
  // basename check passes first for matching.md
  assert.equal(result.path, "Matching.md")
})

test("analyzeVaultHealth: code blocks with wikilink syntax do not cause false unresolved-link findings", () => {
  const root = tempRoot()
  try {
    fs.writeFileSync(path.join(root, "RealNote.md"), [
      "# Real Note",
      "status: active",
      "provenance: fixture",
      "",
      "Some real content.",
      "",
    ].join("\n"))
    fs.writeFileSync(path.join(root, "Main.md"), [
      "# Main",
      "status: active",
      "provenance: fixture",
      "",
      "Normal link to [[RealNote]].",
      "",
      "```js",
      "// This is not a real wikilink: [[NonExistentTarget]]",
      "const x = 1;",
      "```",
      "",
      "Inline `[[AlsoNotReal]]` too.",
    ].join("\n"))
    const report = analyzeVaultHealth(root)
    const unresolved = report.findings.filter((f) => f.kind === "unresolved-link")
    const ambiguous = report.findings.filter((f) => f.kind === "ambiguous-link")
    // The only link extracted should be [[RealNote]] which resolves fine
    assert.equal(unresolved.length, 0, "should have no unresolved links from code blocks")
    assert.equal(ambiguous.length, 0, "should have no ambiguous links")
    assert.equal(report.ok, true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("analyzeVaultHealth: ambiguous duplicate title is detected as ambiguous-link not unresolved-link", () => {
  const root = tempRoot()
  try {
    fs.writeFileSync(path.join(root, "NoteA.md"), [
      "# Shared Title",
      "status: active",
      "provenance: fixture",
      "See [[Shared Title]].",
    ].join("\n"))
    fs.writeFileSync(path.join(root, "NoteB.md"), [
      "# Shared Title",
      "status: active",
      "provenance: fixture",
      "Content.",
    ].join("\n"))
    const report = analyzeVaultHealth(root)
    const ambiguous = report.findings.filter((f) => f.kind === "ambiguous-link")
    assert.equal(ambiguous.length, 1, "should flag ambiguous title")
    const unresolved = report.findings.filter((f) => f.kind === "unresolved-link")
    assert.equal(unresolved.length, 0, "should NOT be unresolved since note exists")
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

test("sync plan batches small changes and requests approval at healthy thresholds", () => {
  assert.equal(buildSyncPlan({ changedFiles: 1 }).decision, "hold")
  const ready = buildSyncPlan({ changedFiles: 3, verifiedPatches: 3 })
  assert.equal(ready.decision, "push-ready")
  assert.equal(ready.requiresHumanApproval, true)
  assert.ok(ready.triggers.includes("verified-patch-threshold"))
})

test("sync plan blocks unsafe publication and escalates divergence", () => {
  assert.equal(buildSyncPlan({ changedFiles: 8, healthCritical: 1 }).decision, "blocked")
  assert.equal(buildSyncPlan({ commitsAhead: 1, commitsBehind: 1 }).decision, "human-review")
  assert.equal(buildSyncPlan({ commitsBehind: 1 }).decision, "pull-first")
})
