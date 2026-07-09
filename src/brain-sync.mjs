import defaultFs from "node:fs"
import path from "node:path"

export const DEFAULT_SYNC_CONFIG = {
  version: 1,
  visibility: "private",
  branch: "main",
  memoryRoot: ".",
  protectedGlobs: [
    ".env",
    ".env.*",
    "**/*.key",
    "**/*secret*",
    "**/*token*",
    "**/node_modules/**",
    "**/.git/**",
  ],
}

export const SECRET_PATTERNS = [
  { name: "generic api key", regex: /\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*['"]?[A-Za-z0-9_\-./+=]{12,}/i },
  { name: "openai / anthropic key", regex: /\b(sk-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9-]{20,})\b/ },
  { name: "github token", regex: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/ },
  { name: "private key block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "jwt", regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { name: "aws access key", regex: /\b(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16})\b/ },
  { name: "aws secret key", regex: /\b(?:aws[_-]?secret[_-]?access[_-]?key)\b\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/i },
  { name: "azure connection string", regex: /(DefaultEndpointsProtocol|AccountName|AccountKey|BlobEndpoint|QueueEndpoint|TableEndpoint|FileEndpoint)\s*=[^;\s]{10,}/ },
  { name: "azure subscription key", regex: /\b(SubscriptionId|subscription-id|azure_subscription)\s*[:=]\s*['"]?[a-f0-9-]{36}['"]?/i },
  { name: "gcp service account", regex: /"type"\s*:\s*"service_account"/i },
  { name: "heroku api key", regex: /\b(h?:[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}|heroku_api_key)\b/i },
  { name: "slack token", regex: /\b(xox[baprs]-[0-9A-Za-z-]{10,})\b/ },
  { name: "discord bot token", regex: /\b[MN][A-Za-z\d_-]{18,30}\.[A-Za-z\d_-]{6,10}\.[A-Za-z\d_-]{27,40}\b/ },
  { name: "env file export", regex: /^export\s+[A-Z_]+=\$?['"]?[A-Za-z0-9_\-./+=]{12,}['"]?$/m },
]

export const HARNESS_FOLDERS = [
  "00 Inbox",
  "02 Projects",
  "03 Reference",
  "99 Templates",
]

export const RESTRUCTURE_MANIFEST_VERSION = 1

export function buildSyncPlan({
  changedFiles = 0,
  verifiedPatches = 0,
  commitsAhead = 0,
  commitsBehind = 0,
  healthCritical = 0,
  secretFindings = 0,
  restructureActive = false,
  sessionEnd = false,
  handoff = false,
  highRiskPatch = false,
} = {}) {
  const triggers = []
  if (sessionEnd) triggers.push("session-end")
  if (handoff) triggers.push("account-machine-or-runtime-handoff")
  if (highRiskPatch) triggers.push("high-risk-patch")
  if (verifiedPatches >= 3) triggers.push("verified-patch-threshold")
  if (changedFiles >= 7) triggers.push("changed-file-threshold")
  if (commitsAhead > 0) triggers.push("local-commits-ahead")

  let decision = "hold"
  let reason = "Keep the small local batch until a healthy sync threshold is reached."
  if (restructureActive || healthCritical > 0 || secretFindings > 0) {
    decision = "blocked"
    reason = "Memory safety or structure findings must be resolved before publishing."
  } else if (commitsAhead > 0 && commitsBehind > 0) {
    decision = "human-review"
    reason = "Local and remote memory histories diverged; run conflict-assist and ask the user."
  } else if (commitsBehind > 0) {
    decision = "pull-first"
    reason = "Remote memory is newer; fast-forward or review it before publishing local memory."
  } else if (changedFiles === 0 && verifiedPatches === 0 && commitsAhead === 0) {
    decision = "no-changes"
    reason = "No durable memory change is waiting to sync."
  } else if (triggers.length > 0) {
    decision = "push-ready"
    reason = "A healthy publication threshold has been reached; request user approval before push."
  }

  return {
    decision,
    reason,
    requiresHumanApproval: ["push-ready", "human-review", "blocked"].includes(decision),
    triggers,
    observed: {
      changedFiles,
      verifiedPatches,
      commitsAhead,
      commitsBehind,
      healthCritical,
      secretFindings,
      restructureActive,
    },
  }
}

const PROTECTED_MIGRATION_ROOTS = new Set([
  ".git",
  ".obsidian",
  ".memory-patch-harness",
  "node_modules",
])

export function normalizeRepoName(repo) {
  if (typeof repo !== "string" || repo.trim() === "") return null
  const trimmed = repo.trim()
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed)) return null
  return trimmed
}

export function makeSyncConfig({ repo, branch = "main", visibility = "private", memoryRoot = "." } = {}) {
  const normalizedRepo = normalizeRepoName(repo)
  if (!normalizedRepo) throw new Error("repo must use OWNER/REPO format")
  if (!["private", "public", "internal"].includes(visibility)) {
    throw new Error("visibility must be private, public, or internal")
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(branch)) throw new Error("branch contains unsupported characters")
  return {
    ...DEFAULT_SYNC_CONFIG,
    repo: normalizedRepo,
    branch,
    visibility,
    memoryRoot,
  }
}

export function initialBrainFiles({ title = "Portable Brain" } = {}) {
  return new Map([
    [
      "README.md",
      `# ${title}\n\nThis repository stores Markdown memory managed by Memory Patch Harness.\n\nDo not store secrets, raw private logs, credentials, or full chat transcripts here.\n\nCanonical memory should be curated notes with provenance, lifecycle, and links. Inbox and clippings are temporary evidence until promoted or archived.\n`,
    ],
    [
      ".gitignore",
      `.env\n.env.*\n*.key\n*.pem\n*.p12\n*.pfx\nnode_modules/\n.DS_Store\nThumbs.db\n`,
    ],
    ["00 Inbox/.gitkeep", ""],
    ["02 Projects/.gitkeep", ""],
    ["03 Reference/.gitkeep", ""],
    ["99 Templates/.gitkeep", ""],
  ])
}

export function buildAdoptionPlan(root, fsApi = defaultFs) {
  const inspected = inspectMemoryRoot(root, fsApi)
  const markdownFiles = listMarkdownFiles(fsApi, root, 500)
  const topLevelFolders = safeReaddir(fsApi, root).filter((entry) => {
    try {
      return fsApi.statSync(joinPath(root, entry)).isDirectory() && !entry.startsWith(".")
    } catch {
      return false
    }
  })

  const existingHarnessFolders = HARNESS_FOLDERS.filter((folder) => fsApi.existsSync(joinPath(root, folder)))
  const missingHarnessFolders = HARNESS_FOLDERS.filter((folder) => !existingHarnessFolders.includes(folder))
  const candidateBuckets = bucketMarkdownFiles(markdownFiles)
  const requiresHumanReview = inspected.requiresAdoptionApproval || markdownFiles.length > 0

  return {
    root,
    inspected,
    current: {
      topLevelFolders,
      markdownFiles: markdownFiles.length,
      sampleMarkdownFiles: markdownFiles.slice(0, 20),
    },
    target: {
      folders: HARNESS_FOLDERS,
      existingHarnessFolders,
      missingHarnessFolders,
    },
    suggestedPlan: [
      "Create a git branch before structural migration.",
      "Run secret scan before any cloud push.",
      "Keep original notes in place until the user approves specific moves.",
      "Move raw captures and unsorted clippings to 00 Inbox only after review.",
      "Promote project-specific operational memory to 02 Projects/<project>.",
      "Promote reusable/reference knowledge to 03 Reference.",
      "Keep templates under 99 Templates.",
      "Add Memory Patch metadata gradually; do not rewrite every old note at once.",
    ],
    candidateBuckets,
    requiresHumanReview,
  }
}

export function renderAdoptionPlanMarkdown(plan) {
  const lines = []
  lines.push("# Memory Structure Adoption Plan")
  lines.push("")
  lines.push(`Root: \`${plan.root}\``)
  lines.push(`Detected kind: \`${plan.inspected.kind}\``)
  lines.push(`Requires human review: ${plan.requiresHumanReview ? "yes" : "no"}`)
  lines.push("")
  lines.push("## Current Signals")
  lines.push("")
  if (plan.inspected.signals.length === 0) lines.push("- None")
  else for (const signal of plan.inspected.signals) lines.push(`- ${signal}`)
  lines.push("")
  lines.push("## Target Harness Folders")
  lines.push("")
  lines.push("| Folder | Status | Purpose |")
  lines.push("|---|---|---|")
  for (const folder of plan.target.folders) {
    const status = plan.target.existingHarnessFolders.includes(folder) ? "exists" : "missing"
    lines.push(`| ${folder} | ${status} | ${folderPurpose(folder)} |`)
  }
  lines.push("")
  lines.push("## Markdown Inventory")
  lines.push("")
  lines.push(`Total Markdown files scanned: ${plan.current.markdownFiles}`)
  lines.push("")
  lines.push("| Bucket | Count | Examples |")
  lines.push("|---|---:|---|")
  for (const [bucket, files] of Object.entries(plan.candidateBuckets)) {
    lines.push(`| ${bucket} | ${files.length} | ${files.slice(0, 5).map((file) => `\`${file}\``).join("<br>") || "-" } |`)
  }
  lines.push("")
  lines.push("## Safe Migration Plan")
  lines.push("")
  for (const step of plan.suggestedPlan) lines.push(`- ${step}`)
  lines.push("")
  lines.push("## User Decision Needed")
  lines.push("")
  lines.push("Do you want Memory Patch Harness to gradually restructure this memory into the harness pattern?")
  lines.push("")
  lines.push("Recommended answer when unsure: adopt sync first, then migrate a small sample of notes manually before broad restructuring.")
  lines.push("")
  return `${lines.join("\n")}\n`
}

export function buildRestructureManifest(plan, { id = makeMigrationId() } = {}) {
  const routes = [
    ["inboxCandidates", "00 Inbox", "raw or untriaged memory candidate"],
    ["projectCandidates", "02 Projects/Imported", "project-scoped memory candidate"],
    ["referenceCandidates", "03 Reference/Imported", "reusable reference candidate"],
    ["templateCandidates", "99 Templates", "template candidate"],
  ]
  const entries = []

  for (const [bucket, targetRoot, reason] of routes) {
    for (const source of plan.candidateBuckets[bucket] || []) {
      entries.push({
        source,
        target: `${targetRoot}/${source}`.replace(/\/+/gu, "/"),
        approved: false,
        reason,
      })
    }
  }
  for (const source of plan.candidateBuckets.needsReview || []) {
    entries.push({
      source,
      target: null,
      approved: false,
      reason: "semantic destination requires agent and user review",
    })
  }

  return {
    version: RESTRUCTURE_MANIFEST_VERSION,
    id,
    vaultRoot: path.resolve(plan.root),
    status: "draft",
    policy: {
      explicitApprovalRequired: true,
      maxApprovedPerRun: 20,
      preserveOriginalContent: true,
    },
    instructions: [
      "Inspect note meaning before choosing a target.",
      "Set approved=true only after the user approves this exact batch.",
      "Keep the first batch small and repair links after moves.",
      "Do not rewrite note contents as part of structural migration.",
    ],
    entries,
  }
}

export function validateRestructureManifest(
  manifest,
  { vault, fsApi = defaultFs, maxApproved = 20, requireApproved = true } = {},
) {
  if (!manifest || manifest.version !== RESTRUCTURE_MANIFEST_VERSION) {
    throw new Error(`Unsupported restructure manifest version: ${manifest?.version ?? "missing"}`)
  }
  if (!vault) throw new Error("vault is required to validate a restructure manifest")
  if (!samePath(manifest.vaultRoot, vault)) {
    throw new Error("Manifest vaultRoot does not match the requested vault")
  }
  if (!Array.isArray(manifest.entries)) throw new Error("Manifest entries must be an array")

  const approved = []
  const sources = new Set()
  const targets = new Set()
  for (const [index, entry] of manifest.entries.entries()) {
    if (entry?.approved !== true) continue
    const source = safeMigrationPath(entry.source, `entries[${index}].source`)
    const target = safeMigrationPath(entry.target, `entries[${index}].target`)
    if (!source.toLowerCase().endsWith(".md") || !target.toLowerCase().endsWith(".md")) {
      throw new Error(`Only Markdown notes may be restructured: ${source} -> ${target}`)
    }
    if (source === target) throw new Error(`Source and target are identical: ${source}`)
    const sourceKey = source.toLowerCase()
    const targetKey = target.toLowerCase()
    if (sources.has(sourceKey)) throw new Error(`Duplicate approved source: ${source}`)
    if (targets.has(targetKey)) throw new Error(`Duplicate approved target: ${target}`)
    sources.add(sourceKey)
    targets.add(targetKey)

    const sourcePath = path.join(path.resolve(vault), source)
    const targetPath = path.join(path.resolve(vault), target)
    if (!fsApi.existsSync(sourcePath) || !fsApi.statSync(sourcePath).isFile()) {
      throw new Error(`Approved source does not exist as a file: ${source}`)
    }
    if (typeof fsApi.lstatSync === "function" && fsApi.lstatSync(sourcePath).isSymbolicLink()) {
      throw new Error(`Approved source must not be a symbolic link: ${source}`)
    }
    assertRealPathInsideVault(fsApi, vault, path.dirname(sourcePath), `source parent for ${source}`)
    assertRealPathInsideVault(fsApi, vault, path.dirname(targetPath), `target parent for ${target}`)
    if (fsApi.existsSync(targetPath)) throw new Error(`Approved target already exists: ${target}`)
    approved.push({ source, target, reason: entry.reason || "user-approved restructure" })
  }

  if (requireApproved && approved.length === 0) {
    throw new Error("Manifest has no approved entries")
  }
  if (Number.isFinite(maxApproved) && approved.length > maxApproved) {
    throw new Error(`Approved batch has ${approved.length} entries; maximum is ${maxApproved}`)
  }
  return approved
}

export function applyRestructureManifest(
  manifest,
  { vault, fsApi = defaultFs, maxApproved = 20 } = {},
) {
  const approved = validateRestructureManifest(manifest, { vault, fsApi, maxApproved })
  const root = path.resolve(vault)
  const applied = []
  try {
    for (const move of approved) {
      const sourcePath = path.join(root, move.source)
      const targetPath = path.join(root, move.target)
      fsApi.mkdirSync(path.dirname(targetPath), { recursive: true })
      fsApi.renameSync(sourcePath, targetPath)
      applied.push(move)
    }
  } catch (error) {
    for (const move of [...applied].reverse()) {
      const sourcePath = path.join(root, move.source)
      const targetPath = path.join(root, move.target)
      if (!fsApi.existsSync(targetPath) || fsApi.existsSync(sourcePath)) continue
      fsApi.mkdirSync(path.dirname(sourcePath), { recursive: true })
      fsApi.renameSync(targetPath, sourcePath)
    }
    throw new Error(`Restructure failed and applied moves were rolled back: ${error.message}`)
  }

  return {
    version: RESTRUCTURE_MANIFEST_VERSION,
    id: manifest.id,
    vaultRoot: root,
    status: "applied",
    appliedAt: new Date().toISOString(),
    moves: applied,
  }
}

export function verifyRestructureRecord(record, { vault, fsApi = defaultFs, state = "applied" } = {}) {
  if (!record || !Array.isArray(record.moves)) throw new Error("Invalid restructure record")
  if (!samePath(record.vaultRoot, vault)) throw new Error("Record vaultRoot does not match the requested vault")
  const root = path.resolve(vault)
  const findings = []
  for (const [index, move] of record.moves.entries()) {
    const source = safeMigrationPath(move.source, `moves[${index}].source`)
    const target = safeMigrationPath(move.target, `moves[${index}].target`)
    const sourceExists = fsApi.existsSync(path.join(root, source))
    const targetExists = fsApi.existsSync(path.join(root, target))
    const ok = state === "rolled-back"
      ? sourceExists && !targetExists
      : !sourceExists && targetExists
    findings.push({ source, target, sourceExists, targetExists, ok })
  }
  return { ok: findings.every((finding) => finding.ok), state, findings }
}

export function rollbackRestructureRecord(record, { vault, fsApi = defaultFs } = {}) {
  const verified = verifyRestructureRecord(record, { vault, fsApi, state: "applied" })
  if (!verified.ok) throw new Error("Cannot rollback because the applied migration state has drifted")
  const root = path.resolve(vault)
  const reversed = []
  try {
    for (const move of [...record.moves].reverse()) {
      const sourcePath = path.join(root, move.source)
      const targetPath = path.join(root, move.target)
      fsApi.mkdirSync(path.dirname(sourcePath), { recursive: true })
      fsApi.renameSync(targetPath, sourcePath)
      reversed.push(move)
    }
  } catch (error) {
    for (const move of [...reversed].reverse()) {
      const sourcePath = path.join(root, move.source)
      const targetPath = path.join(root, move.target)
      if (!fsApi.existsSync(sourcePath) || fsApi.existsSync(targetPath)) continue
      fsApi.mkdirSync(path.dirname(targetPath), { recursive: true })
      fsApi.renameSync(sourcePath, targetPath)
    }
    throw new Error(`Rollback failed and reversed moves were restored: ${error.message}`)
  }
  return { ...record, status: "rolled-back", rolledBackAt: new Date().toISOString() }
}

export function inspectMemoryRoot(root, fsApi = defaultFs) {
  const fs = fsApi
  const exists = fs.existsSync(root)
  if (!exists) {
    return {
      exists: false,
      kind: "missing",
      safeDefaultAction: "create",
      requiresAdoptionApproval: false,
      signals: [],
    }
  }

  try {
    if (!fs.statSync(root).isDirectory()) {
      return {
        exists: true,
        kind: "not-a-directory",
        safeDefaultAction: "choose-directory",
        requiresAdoptionApproval: true,
        signals: ["path-is-not-a-directory"],
      }
    }
  } catch {
    return {
      exists: true,
      kind: "unreadable-path",
      safeDefaultAction: "fix-permissions-or-choose-directory",
      requiresAdoptionApproval: true,
      signals: ["path-cannot-be-inspected"],
    }
  }

  const signals = []
  const entries = safeReaddir(fs, root)
  const nonEmpty = entries.length > 0
  const hasGit = fs.existsSync(joinPath(root, ".git"))
  const hasConfig = fs.existsSync(joinPath(root, ".memory-patch-harness", "brain-sync.json"))
  const hasObsidian = fs.existsSync(joinPath(root, ".obsidian"))
  const hasProjectHome = fs.existsSync(joinPath(root, "02 Projects")) || fs.existsSync(joinPath(root, "00 Inbox"))
  const hasReference = fs.existsSync(joinPath(root, "03 Reference")) || fs.existsSync(joinPath(root, "99 Templates"))
  const markdownCount = countMarkdownFiles(fs, root, 200)
  const hasCommonMemoryFile = ["MEMORY.md", "CLAUDE.md", "AGENTS.md", "README.md"].some((file) => fs.existsSync(joinPath(root, file)))

  if (hasGit) signals.push(".git")
  if (hasConfig) signals.push(".memory-patch-harness/brain-sync.json")
  if (hasObsidian) signals.push(".obsidian")
  if (hasProjectHome) signals.push("project-memory-folders")
  if (hasReference) signals.push("reference-template-folders")
  if (markdownCount > 0) signals.push(`${markdownCount}+ markdown file(s)`)
  if (hasCommonMemoryFile) signals.push("common-memory-doc")

  if (!nonEmpty) {
    return {
      exists: true,
      kind: "empty-directory",
      safeDefaultAction: "initialize",
      requiresAdoptionApproval: false,
      signals,
    }
  }
  if (hasConfig) {
    return {
      exists: true,
      kind: "configured-brain",
      safeDefaultAction: "connect",
      requiresAdoptionApproval: false,
      signals,
    }
  }
  if (hasProjectHome && hasReference) {
    return {
      exists: true,
      kind: "harness-compatible-memory",
      safeDefaultAction: "connect-with-config",
      requiresAdoptionApproval: false,
      signals,
    }
  }
  if (hasObsidian || markdownCount > 0 || hasCommonMemoryFile) {
    return {
      exists: true,
      kind: hasObsidian ? "existing-obsidian-vault" : "custom-markdown-memory",
      safeDefaultAction: "adopt-after-confirmation",
      requiresAdoptionApproval: true,
      signals,
    }
  }
  if (hasGit) {
    return {
      exists: true,
      kind: "generic-git-repo",
      safeDefaultAction: "adopt-after-confirmation",
      requiresAdoptionApproval: true,
      signals,
    }
  }
  return {
    exists: true,
    kind: "non-empty-directory",
    safeDefaultAction: "adopt-after-confirmation",
    requiresAdoptionApproval: true,
    signals,
  }
}

export function assertSafeToBootstrap(inspected, { adoptExisting = false } = {}) {
  if (["not-a-directory", "unreadable-path"].includes(inspected.kind)) {
    throw new Error(`INVALID_VAULT_PATH: ${inspected.kind}`)
  }
  if (inspected.requiresAdoptionApproval && !adoptExisting) {
    throw new Error(
      `Refusing to modify ${inspected.kind}. Re-run with explicit adoption after review.`,
    )
  }
}

export function scanTextForSecrets(text) {
  const findings = []
  for (const pattern of SECRET_PATTERNS) {
    const match = text.match(pattern.regex)
    if (match) findings.push({ name: pattern.name, sample: redact(match[0]) })
  }
  return findings
}

export function analyzeVaultHealth(root, { fsApi = defaultFs, inboxWarningThreshold = 20 } = {}) {
  const vault = path.resolve(root)
  const markdownFiles = listMarkdownFiles(fsApi, vault, 5000)
  const notes = markdownFiles.map((file) => {
    const fullPath = path.join(vault, file)
    const text = fsApi.readFileSync(fullPath, "utf8")
    return {
      path: file,
      title: extractTitle(file, text),
      text,
      outgoing: extractNoteLinks(text),
    }
  })
  const resolveNoteLink = createNoteLinkResolver(notes)
  const notePaths = new Set(notes.map((note) => normalizeLinkTarget(note.path)))
  const titleMap = new Map()
  const inbound = new Map(notes.map((note) => [note.path, 0]))
  const findings = []

  for (const note of notes) {
    const titleKey = note.title.toLowerCase()
    if (!titleMap.has(titleKey)) titleMap.set(titleKey, [])
    titleMap.get(titleKey).push(note.path)

    for (const link of note.outgoing) {
      const result = resolveNoteLink(link, note.path)
      if (!result.resolved && result.reason === "external") continue
      if (result.reason === "ambiguous") {
        findings.push({
          severity: "warning",
          kind: "ambiguous-link",
          file: note.path,
          detail: link,
          recommendation: `Multiple notes match this link: ${result.ambiguity.join(", ")}. Use a path-qualified link like [[${result.ambiguity.map((p) => p.replace(/\.md$/iu, "")).join("]] or [[")}]].`,
        })
        continue
      }
      if (!result.resolved || !notePaths.has(result.path)) {
        findings.push({
          severity: "warning",
          kind: "unresolved-link",
          file: note.path,
          detail: link,
          recommendation: "Create the target note, fix the link, or remove stale navigation.",
        })
      } else {
        const matched = notes.find((candidate) => normalizeLinkTarget(candidate.path) === result.path)
        if (matched) inbound.set(matched.path, (inbound.get(matched.path) ?? 0) + 1)
      }
    }

    for (const secret of scanTextForSecrets(note.text)) {
      findings.push({
        severity: "critical",
        kind: "secret-like-value",
        file: note.path,
        detail: `${secret.name} (${secret.sample})`,
        recommendation: "Remove or relocate the sensitive value before sync/push.",
      })
    }

    if (isCanonicalMemory(note.path) && !hasProvenance(note.text)) {
      findings.push({
        severity: "warning",
        kind: "missing-provenance",
        file: note.path,
        detail: "Canonical note lacks provenance/source marker.",
        recommendation: "Add source/provenance/evidence so future agents can audit the memory.",
      })
    }

    if (isCanonicalMemory(note.path) && !hasLifecycle(note.text)) {
      findings.push({
        severity: "info",
        kind: "missing-lifecycle",
        file: note.path,
        detail: "Canonical note lacks an explicit lifecycle/status marker.",
        recommendation: "Add active/superseded/tension/deprecated or APPLIED/TENSION/BLOCKED status when relevant.",
      })
    }

    if (/(stale|superseded|tension|blocked)/iu.test(note.text) && !/(revalidate|valid_until|supersedes|replacement)/iu.test(note.text)) {
      findings.push({
        severity: "warning",
        kind: "stale-without-revalidation",
        file: note.path,
        detail: "Stale/conflict language found without a revalidation or replacement marker.",
        recommendation: "Add revalidate_when, valid_until, supersedes, or replacement guidance.",
      })
    }

    if (!note.path.toLowerCase().startsWith("00 inbox/") && /clipping|raw capture|transcript/iu.test(note.path)) {
      findings.push({
        severity: "warning",
        kind: "raw-capture-outside-inbox",
        file: note.path,
        detail: "Raw or clipping-like note is outside 00 Inbox.",
        recommendation: "Move raw captures to Inbox or promote them into curated canonical memory.",
      })
    }
  }

  for (const [title, files] of titleMap.entries()) {
    if (title && files.length > 1) {
      findings.push({
        severity: "warning",
        kind: "duplicate-title",
        file: files.join(", "),
        detail: title,
        recommendation: "Deduplicate, rename, or link notes with the same title.",
      })
    }
  }

  for (const note of notes) {
    if (isCanonicalMemory(note.path) && (inbound.get(note.path) ?? 0) === 0 && note.outgoing.length === 0) {
      findings.push({
        severity: "info",
        kind: "orphan-note",
        file: note.path,
        detail: "No inbound or outbound note links detected.",
        recommendation: "Link from a project home/MOC or add related memory links when useful.",
      })
    }
  }

  const inboxCount = notes.filter((note) => note.path.toLowerCase().startsWith("00 inbox/")).length
  if (inboxCount > inboxWarningThreshold) {
    findings.push({
      severity: "warning",
      kind: "inbox-backlog",
      file: "00 Inbox",
      detail: `${inboxCount} inbox note(s)`,
      recommendation: "Triage inbox notes into promote/archive/ignore/block decisions.",
    })
  }

  const summary = {
    markdownFiles: notes.length,
    critical: findings.filter((finding) => finding.severity === "critical").length,
    warning: findings.filter((finding) => finding.severity === "warning").length,
    info: findings.filter((finding) => finding.severity === "info").length,
    inboxCount,
  }
  const score = Math.max(0, 100 - summary.critical * 30 - summary.warning * 6 - summary.info * 1)
  return {
    ok: summary.critical === 0,
    score,
    summary,
    findings,
    checkedAt: new Date().toISOString(),
  }
}

/**
 * Read-only schema audit: checks required metadata, invalid controlled values,
 * raw clipping outside inbox, stale/superseded lifecycle mismatch,
 * unresolved/ambiguous links, and oversized project hubs.
 */
export function auditVaultSchema(root, { fsApi = defaultFs, maxFiles = 5000 } = {}) {
  const vault = path.resolve(root)
  const markdownFiles = listMarkdownFiles(fsApi, vault, maxFiles)
  const notes = markdownFiles.map((file) => {
    const fullPath = path.join(vault, file)
    const text = fsApi.readFileSync(fullPath, "utf8")
    return {
      path: file,
      title: extractTitle(file, text),
      text,
      outgoing: extractNoteLinks(text),
      frontmatter: extractFrontmatter(text),
    }
  })
  const resolveNoteLink = createNoteLinkResolver(notes)
  const notePaths = new Set(notes.map((note) => normalizeLinkTarget(note.path)))
  const findings = []

  // Controlled value sets from contracts
  const VALID_STATUSES = new Set(["active", "superseded", "tension", "deprecated", "current", "applied", "stale", "archived", "raw", "unknown"])
  const VALID_PATCH_TYPES = new Set(["decision", "root-cause", "workflow", "preference", "source-map", "tension"])
  const VALID_PROVENANCE_TYPES = new Set(["user-statement", "file", "command", "artifact", "url"])
  const VALID_CATEGORIES = new Set(["policy", "preference", "workflow", "routing", "gotcha", "stale-warning", "open-question"])

  for (const note of notes) {
    const meta = note.frontmatter

    // Required metadata: canonical notes should have status/lifecycle
    if (isCanonicalMemory(note.path)) {
      const hasStatus = "status" in meta || "lifecycle" in meta
      if (!hasStatus) {
        findings.push({
          severity: "warning",
          kind: "missing-required-metadata",
          file: note.path,
          detail: "Canonical note lacks required status/lifecycle frontmatter.",
          recommendation: "Add status (active/superseded/tension/deprecated) to frontmatter.",
        })
      }
      if (!hasProvenance(note.text)) {
        findings.push({
          severity: "warning",
          kind: "missing-required-metadata",
          file: note.path,
          detail: "Canonical note lacks provenance marker.",
          recommendation: "Add provenance, source, or evidence field.",
        })
      }
    }

    // Invalid controlled values in frontmatter
    if ("status" in meta && typeof meta.status === "string" && !VALID_STATUSES.has(meta.status.toLowerCase())) {
      findings.push({
        severity: "warning",
        kind: "invalid-controlled-value",
        file: note.path,
        detail: `Invalid status value: "${meta.status}"`,
        recommendation: `Use one of: ${[...VALID_STATUSES].join(", ")}`,
      })
    }
    if ("suggested_type" in meta && typeof meta.suggested_type === "string" && !VALID_PATCH_TYPES.has(meta.suggested_type)) {
      findings.push({
        severity: "info",
        kind: "invalid-controlled-value",
        file: note.path,
        detail: `Invalid patch type: "${meta.suggested_type}"`,
        recommendation: `Use one of: ${[...VALID_PATCH_TYPES].join(", ")}`,
      })
    }
    if ("category" in meta && typeof meta.category === "string" && !VALID_CATEGORIES.has(meta.category)) {
      findings.push({
        severity: "info",
        kind: "invalid-controlled-value",
        file: note.path,
        detail: `Invalid category: "${meta.category}"`,
        recommendation: `Use one of: ${[...VALID_CATEGORIES].join(", ")}`,
      })
    }

    // Raw clipping outside inbox
    if (!note.path.toLowerCase().startsWith("00 inbox/") && /clipping|raw[_-]?capture|transcript|dump/iu.test(note.path)) {
      findings.push({
        severity: "warning",
        kind: "raw-clipping-outside-inbox",
        file: note.path,
        detail: "Raw/clipping note is not in the 00 Inbox folder.",
        recommendation: "Move raw captures to 00 Inbox or promote into curated memory.",
      })
    }

    // Stale/superseded lifecycle mismatch: status says stale/superseded but content doesn't indicate it
    const status = (meta.status || meta.lifecycle || "unknown").toString().toLowerCase()
    if (["stale", "superseded", "deprecated", "archived"].includes(status)) {
      const hasStaleContent = /\b(stale|superseded|deprecated|no longer valid|replaced by)\b/iu.test(note.text)
      if (!hasStaleContent) {
        findings.push({
          severity: "warning",
          kind: "stale-lifecycle-mismatch",
          file: note.path,
          detail: `Note is "${status}" but content lacks explicit stale/obsolete language.`,
          recommendation: "Add a clear statement of why this note is stale and what replaced it.",
        })
      }
    }

    // Links: unresolved or ambiguous
    for (const link of note.outgoing) {
      const result = resolveNoteLink(link, note.path)
      if (!result.resolved && result.reason === "external") continue
      if (result.reason === "ambiguous") {
        findings.push({
          severity: "warning",
          kind: "ambiguous-link",
          file: note.path,
          detail: `Ambiguous link: [[${link}]]`,
          recommendation: `Use a path-qualified link like [[${result.ambiguity.map((p) => p.replace(/\.md$/iu, "")).join("]] or [[")}]].`,
        })
        continue
      }
      if (!result.resolved || !notePaths.has(result.path)) {
        findings.push({
          severity: "warning",
          kind: "unresolved-link",
          file: note.path,
          detail: `Unresolved link: [[${link}]]`,
          recommendation: "Create the target note or fix the link reference.",
        })
      }
    }

    // Oversized project hubs: notes with excessive outgoing links (>50)
    if (isCanonicalMemory(note.path) && note.outgoing.length > 50) {
      findings.push({
        severity: "info",
        kind: "oversized-project-hub",
        file: note.path,
        detail: `${note.outgoing.length} outgoing links detected.`,
        recommendation: "Consider splitting into focused sub-notes or a structured index with curated summaries.",
      })
    }
  }

  const summary = {
    total: findings.length,
    warning: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  }

  return {
    ok: summary.warning === 0,
    summary,
    findings,
    checkedAt: new Date().toISOString(),
  }
}

/**
 * Read-only memory lint: duplicate titles, missing provenance,
 * stale lifecycle triggers, derived outputs promoted as truth,
 * orphan/vague claims without links.
 */
export function lintVaultMemory(root, { fsApi = defaultFs, maxFiles = 5000 } = {}) {
  const vault = path.resolve(root)
  const markdownFiles = listMarkdownFiles(fsApi, vault, maxFiles)
  const notes = markdownFiles.map((file) => {
    const fullPath = path.join(vault, file)
    const text = fsApi.readFileSync(fullPath, "utf8")
    return {
      path: file,
      title: extractTitle(file, text),
      text,
      outgoing: extractNoteLinks(text),
      frontmatter: extractFrontmatter(text),
    }
  })
  const resolveNoteLink = createNoteLinkResolver(notes)
  const inbound = new Map(notes.map((note) => [note.path, 0]))
  const titleMap = new Map()
  const findings = []

  // Duplicate titles
  for (const note of notes) {
    const titleKey = note.title.toLowerCase()
    if (!titleMap.has(titleKey)) titleMap.set(titleKey, [])
    titleMap.get(titleKey).push(note.path)
  }
  for (const [title, files] of titleMap.entries()) {
    if (title && files.length > 1) {
      findings.push({
        severity: "warning",
        kind: "duplicate-title",
        file: files.join(", "),
        detail: `Title "${title}" appears in ${files.length} notes.`,
        recommendation: "Deduplicate, rename, or link notes with the same title.",
      })
    }
  }

  for (const note of notes) {
    // Missing provenance
    if (isCanonicalMemory(note.path) && !hasProvenance(note.text)) {
      findings.push({
        severity: "warning",
        kind: "missing-provenance",
        file: note.path,
        detail: "Canonical note lacks source/provenance.",
        recommendation: "Add provenance, source, or evidence marker.",
      })
    }

    // Stale lifecycle triggers (stale-without-revalidation)
    if (/(stale|superseded|tension|blocked)/iu.test(note.text) && !/(revalidate|valid_until|supersedes|replacement)/iu.test(note.text)) {
      findings.push({
        severity: "warning",
        kind: "stale-without-revalidation",
        file: note.path,
        detail: "Stale/conflict language found without revalidation or replacement marker.",
        recommendation: "Add revalidate_when, valid_until, supersedes, or replacement guidance.",
      })
    }

    // Derived outputs promoted as truth
    const meta = note.frontmatter
    if (meta.canonical_memory === false && isCanonicalMemory(note.path) && !note.path.split("/").some((seg) => seg.toLowerCase() === "derived")) {
      findings.push({
        severity: "warning",
        kind: "derived-promoted-as-truth",
        file: note.path,
        detail: "Non-canonical (canonical_memory: false) note is outside inbox/templates and may be treated as canonical.",
        recommendation: "Move derived outputs to an explicit derived/ subfolder or mark with a clear reference to the source canonical note.",
      })
    }
    if (meta.role === "derived-index" && !note.path.toLowerCase().includes("derived")) {
      findings.push({
        severity: "info",
        kind: "derived-promoted-as-truth",
        file: note.path,
        detail: "Derived index placed outside a 'derived' folder path.",
        recommendation: "Move to a derived/ subfolder to prevent confusion with canonical memory.",
      })
    }

    // Track inbound links
    for (const link of note.outgoing) {
      const result = resolveNoteLink(link, note.path)
      if (result.resolved && notePathsSet(notes).has(result.path)) {
        const matched = notes.find((candidate) => normalizeLinkTarget(candidate.path) === result.path)
        if (matched) inbound.set(matched.path, (inbound.get(matched.path) ?? 0) + 1)
      }
    }
  }

  // Note isolation / vague claims (orphan notes with short content)
  for (const note of notes) {
    const hasInbound = (inbound.get(note.path) ?? 0) > 0
    const hasOutbound = note.outgoing.length > 0
    if (isCanonicalMemory(note.path) && !hasInbound && !hasOutbound) {
      const wordCount = note.text.split(/\s+/u).filter(Boolean).length
      if (wordCount < 20) {
        findings.push({
          severity: "info",
          kind: "vague-isolated-note",
          file: note.path,
          detail: `Short orphan note (${wordCount} words) with no inbound or outbound links.`,
          recommendation: "Provide more context, add links, or integrate into broader memory structure.",
        })
      }
    }
  }

  const summary = {
    total: findings.length,
    warning: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  }

  return {
    ok: summary.warning === 0,
    summary,
    findings,
    checkedAt: new Date().toISOString(),
  }
}

function notePathsSet(notes) {
  return new Set(notes.map((note) => normalizeLinkTarget(note.path)))
}

/**
 * Extract YAML-like frontmatter from Markdown text.
 * Returns a plain object with known keys.
 */
function extractFrontmatter(text) {
  const result = {}
  if (!text.startsWith("---")) return result
  const end = text.indexOf("---", 3)
  if (end === -1) return result
  const block = text.slice(3, end).trim()
  for (const line of block.split(/\r?\n/u)) {
    const match = line.match(/^(\w[\w_-]*)\s*:\s*(.+)$/u)
    if (match) {
      let value = match[2].trim()
      // Try boolean/number parsing
      if (value === "true") value = true
      else if (value === "false") value = false
      else if (/^\d+$/.test(value)) value = Number.parseInt(value, 10)
      else if (/^\d+\.\d+$/.test(value)) value = Number.parseFloat(value)
      result[match[1]] = value
    }
  }
  return result
}

/**
 * Compose sync/health/recall state into a compact handoff brief.
 * Read-only, deterministic, no network required.
 */
export function buildBrainSessionBrief(vault, { fsApi = defaultFs, maxFiles = 200, configPath = null } = {}) {
  const root = path.resolve(vault)
  const health = analyzeVaultHealth(root, { fsApi })
  const configFile = configPath || path.join(root, ".memory-patch-harness", "brain-sync.json")
  const hasConfig = fsApi.existsSync(configFile)
  let config = null
  if (hasConfig) {
    try {
      config = readJsonFileWithFs(configFile, fsApi)
    } catch {
      config = { error: "unreadable-config" }
    }
  }

  const brief = {
    checkedAt: new Date().toISOString(),
    vault: root,
    sync: config
      ? { configured: true, repo: config.repo || "unknown", branch: config.branch || "main" }
      : { configured: false },
    health: {
      ok: health.ok,
      score: health.score,
      markdownFiles: health.summary.markdownFiles,
      critical: health.summary.critical,
      warning: health.summary.warning,
      info: health.summary.info,
      inboxCount: health.summary.inboxCount,
    },
  }

  return brief
}

function readJsonFileWithFs(file, fsApi) {
  const target = path.resolve(file)
  if (!fsApi.existsSync(target)) throw new Error(`INPUT_NOT_FOUND: ${target}`)
  try {
    return JSON.parse(fsApi.readFileSync(target, "utf8"))
  } catch (error) {
    throw new Error(`INVALID_JSON: ${target}: ${error.message}`)
  }
}

export function redact(value) {
  if (typeof value !== "string") return ""
  if (value.length <= 10) return "[redacted]"
  return `${value.slice(0, 4)}...[redacted]...${value.slice(-4)}`
}

function safeReaddir(fs, root) {
  try {
    return fs.readdirSync(root)
  } catch {
    return []
  }
}

function joinPath(...parts) {
  return parts.join("/").replace(/\/+/g, "/")
}

function safeMigrationPath(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} is required`)
  if (path.isAbsolute(value) || value.includes("\0")) throw new Error(`${label} must be a safe relative path`)
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"))
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`${label} escapes the vault root`)
  }
  const root = normalized.split("/")[0].toLowerCase()
  if (PROTECTED_MIGRATION_ROOTS.has(root)) throw new Error(`${label} targets a protected path`)
  return normalized
}

function samePath(left, right) {
  if (!left || !right) return false
  const a = path.resolve(left)
  const b = path.resolve(right)
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b
}

function assertRealPathInsideVault(fsApi, vault, candidate, label) {
  if (typeof fsApi.realpathSync !== "function") return
  const rootReal = fsApi.realpathSync(path.resolve(vault))
  let existing = path.resolve(candidate)
  while (!fsApi.existsSync(existing)) {
    const parent = path.dirname(existing)
    if (parent === existing) break
    existing = parent
  }
  const candidateReal = fsApi.realpathSync(existing)
  const relative = path.relative(rootReal, candidateReal)
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`PATH_ESCAPE: ${label} resolves outside the vault`)
  }
}

function makeMigrationId() {
  return `restructure-${new Date().toISOString().replace(/[:.]/gu, "-")}`
}

function countMarkdownFiles(fs, root, max) {
  let count = 0
  const stack = [root]
  while (stack.length > 0 && count < max) {
    const current = stack.pop()
    for (const entry of safeReaddir(fs, current)) {
      if (entry === ".git" || entry === "node_modules") continue
      const full = joinPath(current, entry)
      let stat
      try {
        stat = fs.statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) stack.push(full)
      else if (entry.toLowerCase().endsWith(".md")) count += 1
      if (count >= max) break
    }
  }
  return count
}

function listMarkdownFiles(fs, root, max) {
  const files = []
  const stack = [{ absolute: root, relative: "" }]
  while (stack.length > 0 && files.length < max) {
    const current = stack.pop()
    for (const entry of safeReaddir(fs, current.absolute)) {
      if (entry === ".git" || entry === "node_modules") continue
      const absolute = joinPath(current.absolute, entry)
      const relative = current.relative ? `${current.relative}/${entry}` : entry
      let stat
      try {
        stat = fs.statSync(absolute)
      } catch {
        continue
      }
      if (stat.isDirectory()) stack.push({ absolute, relative })
      else if (entry.toLowerCase().endsWith(".md")) files.push(relative)
      if (files.length >= max) break
    }
  }
  return files.sort()
}

function bucketMarkdownFiles(files) {
  const buckets = {
    inboxCandidates: [],
    projectCandidates: [],
    referenceCandidates: [],
    templateCandidates: [],
    existingHarnessNotes: [],
    needsReview: [],
  }
  for (const file of files) {
    const lowered = file.toLowerCase()
    if (lowered.startsWith("00 inbox/") || lowered.includes("inbox") || lowered.includes("clipping")) {
      buckets.inboxCandidates.push(file)
    } else if (lowered.startsWith("02 projects/") || lowered.includes("project") || lowered.includes("client")) {
      buckets.projectCandidates.push(file)
    } else if (lowered.startsWith("03 reference/") || lowered.includes("reference") || lowered.includes("source")) {
      buckets.referenceCandidates.push(file)
    } else if (lowered.startsWith("99 templates/") || lowered.includes("template")) {
      buckets.templateCandidates.push(file)
    } else if (HARNESS_FOLDERS.some((folder) => lowered.startsWith(`${folder.toLowerCase()}/`))) {
      buckets.existingHarnessNotes.push(file)
    } else {
      buckets.needsReview.push(file)
    }
  }
  return buckets
}

function folderPurpose(folder) {
  if (folder === "00 Inbox") return "temporary captures and untriaged memory candidates"
  if (folder === "02 Projects") return "project-scoped operational memory"
  if (folder === "03 Reference") return "durable reusable knowledge and source maps"
  if (folder === "99 Templates") return "note templates and reusable structures"
  return "memory"
}

function extractTitle(file, text) {
  return text.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(file, path.extname(file))
}

function extractNoteLinks(text) {
  const links = []
  // Strip fenced code blocks to avoid false-positive wiki-link matches in code
  const stripped = text.replace(/```[\s\S]*?```/gu, "").replace(/`[^`]+`/gu, "")
  for (const match of stripped.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/gu)) {
    links.push(match[1].trim())
  }
  for (const match of stripped.matchAll(/\[[^\]]+\]\(([^)]+\.md(?:#[^)]+)?)\)/giu)) {
    links.push(decodeURIComponent(match[1].split("#")[0].trim()))
  }
  return links.filter(Boolean)
}

function extractAliases(text) {
  if (!text.startsWith("---")) return []
  const frontmatter = text.split("---", 3)[1] ?? ""
  const aliases = []
  let inAliases = false
  for (const line of frontmatter.split(/\r?\n/u)) {
    const single = line.match(/^alias(?:es)?:\s*(.*)$/u)
    if (single) {
      const raw = single[1].trim()
      if (raw.startsWith("[") && raw.endsWith("]")) {
        const items = raw.slice(1, -1).split(",").map((s) => s.trim().replace(/^['"]|['"]$/gu, "")).filter(Boolean)
        aliases.push(...items)
      } else if (!raw) {
        inAliases = true
      } else {
        aliases.push(raw.replace(/^['"]|['"]$/gu, ""))
      }
      continue
    }
    if (inAliases) {
      const item = line.match(/^\s+-\s+(.+?)\s*$/u)
      if (item) {
        aliases.push(item[1].replace(/^['"]|['"]$/gu, ""))
      } else if (line.trim()) {
        inAliases = false
      }
    }
  }
  return [...new Set(aliases)]
}

function normalizeLinkTarget(value) {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+/u, "")
  return normalized.toLowerCase().endsWith(".md") ? normalized : `${normalized}.md`
}

/**
 * Creates a wiki-link resolver for Obsidian-style [[links]] with full context.
 * Returns a function that resolves a single link and returns an object:
 *   { resolved: true,  path: "normalized.md", method: "exact-path"|"relative"|"basename"|"title"|"alias" }
 *   { resolved: false, path: null,              reason: "ambiguous", ambiguity: ["a.md","b.md"] }
 *   { resolved: false, path: null,              reason: "unresolved" }
 *   { resolved: false, path: null,              reason: "external" }
 */
export function createNoteLinkResolver(notes) {
  const notePaths = new Set(notes.map((note) => normalizeLinkTarget(note.path)))
  const byBasename = new Map()
  const byTitle = new Map()
  const byAlias = new Map()

  for (const note of notes) {
    const pathLower = note.path.toLowerCase()
    const ext = path.extname(pathLower)
    const basename = path.basename(pathLower, ext)
    if (!byBasename.has(basename)) byBasename.set(basename, [])
    byBasename.get(basename).push(note.path)

    const titleKey = note.title.toLowerCase()
    if (!byTitle.has(titleKey)) byTitle.set(titleKey, [])
    byTitle.get(titleKey).push(note.path)

    for (const alias of extractAliases(note.text)) {
      const aliasKey = alias.toLowerCase()
      if (!byAlias.has(aliasKey)) byAlias.set(aliasKey, [])
      byAlias.get(aliasKey).push(note.path)
    }
  }

  return function resolveNoteLink(link, fromFile) {
    if (/^[a-z]+:\/\//iu.test(link) || link.startsWith("#")) {
      return { resolved: false, path: null, reason: "external" }
    }

    const clean = link.replaceAll("\\", "/").replace(/^\/+/u, "")
    if (!clean) return { resolved: false, path: null, reason: "unresolved" }

    const normalizedClean = normalizeLinkTarget(clean)
    const fromDir = path.posix.dirname(fromFile.replaceAll("\\", "/"))

    // Step 1: Exact vault-relative path when path separator present
    if (clean.includes("/") && notePaths.has(normalizedClean)) {
      return { resolved: true, path: normalizedClean, method: "exact-path" }
    }

    // Step 2: Relative to current note's directory
    const relativePath = normalizeLinkTarget(path.posix.join(fromDir, clean))
    if (notePaths.has(relativePath)) {
      return { resolved: true, path: relativePath, method: "relative" }
    }

    const linkKey = clean.toLowerCase().replace(/\.md$/iu, "")

    // Step 3a: Unique basename match
    const basenameMatches = byBasename.get(linkKey)
    if (basenameMatches?.length === 1) {
      return { resolved: true, path: normalizeLinkTarget(basenameMatches[0]), method: "basename" }
    }
    if (basenameMatches?.length > 1) {
      return { resolved: false, path: null, reason: "ambiguous", ambiguity: [...basenameMatches] }
    }

    // Step 3b: Unique title match
    const titleMatches = byTitle.get(linkKey)
    if (titleMatches?.length === 1) {
      return { resolved: true, path: normalizeLinkTarget(titleMatches[0]), method: "title" }
    }
    if (titleMatches?.length > 1) {
      return { resolved: false, path: null, reason: "ambiguous", ambiguity: [...titleMatches] }
    }

    // Step 4: Unique alias match
    const aliasMatches = byAlias.get(linkKey)
    if (aliasMatches?.length === 1) {
      return { resolved: true, path: normalizeLinkTarget(aliasMatches[0]), method: "alias" }
    }
    if (aliasMatches?.length > 1) {
      return { resolved: false, path: null, reason: "ambiguous", ambiguity: [...aliasMatches] }
    }

    // Step 5: Completely unresolved — return the expected path so the caller can report it
    return { resolved: false, path: normalizedClean, reason: "unresolved" }
  }
}

function isCanonicalMemory(file) {
  const lowered = file.toLowerCase()
  return lowered.endsWith(".md") &&
    !lowered.startsWith("00 inbox/") &&
    !lowered.startsWith("99 templates/") &&
    !lowered.endsWith("readme.md")
}

function hasProvenance(text) {
  return /\b(provenance|source|evidence|verified|references?)\b/iu.test(text)
}

function hasLifecycle(text) {
  return /\b(status|lifecycle|applied|tension|blocked|active|superseded|deprecated|stale)\b/iu.test(text)
}
