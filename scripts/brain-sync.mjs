#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { createInterface } from "node:readline/promises"
import {
  analyzeVaultHealth,
  applyRestructureManifest,
  assertRealPathInsideVault,
  assertSafeToBootstrap,
  auditVaultSchema,
  buildAdoptionPlan,
  buildBrainSessionBrief,
  buildRestructureManifest,
  buildSyncPlan,
  initialBrainFiles,
  inspectMemoryRoot,
  lintVaultMemory,
  makeSyncConfig,
  renderAdoptionPlanMarkdown,
  rollbackRestructureRecord,
  safeMigrationPath,
  scanTextForSecrets,
  validateRestructureManifest,
  verifyRestructureRecord,
} from "../src/brain-sync.mjs"
import { recallVault, recallVaultLoop } from "../src/memory-recall.mjs"
import { recallVaultSemantic } from "../src/semantic-recall.mjs"
import { buildCurationRecommendations, renderCurationRecommendations } from "../src/curation-recommendations.mjs"
import { auditMemoryLifecycle } from "../src/memory-lifecycle-audit.mjs"
import { writeFileAtomic, writeJsonAtomic } from "../src/atomic-write.mjs"
import { loadRuntimeConfig, runtimeConfigPath, saveRuntimeConfig } from "../src/runtime-config.mjs"
import { managedRecall } from "../src/decision-recall.mjs"
import { planDecisionCuration } from "../src/decision-curation.mjs"
import { recallVaultAdaptive } from "../src/adaptive-recall.mjs"

const args = process.argv.slice(2)
const command = args[0]
const rest = args.slice(1)

function option(name, fallback) {
  const index = rest.indexOf(name)
  return index >= 0 && rest[index + 1] ? rest[index + 1] : fallback
}

function flag(name) {
  return rest.includes(name)
}

function usage(exitCode = 0) {
  const out = exitCode === 0 ? process.stdout : process.stderr
  out.write(`Graphmory brain sync\n\n`)
  out.write(`Usage:\n`)
  out.write(`  node scripts/brain-sync.mjs adoption-plan --vault <path> [--out <file>] [--json]\n`)
  out.write(`  node scripts/brain-sync.mjs bootstrap --vault <path> --repo <owner/repo> [--create-remote]\n`)
  out.write(`  node scripts/brain-sync.mjs detect --vault <path> [--json]\n`)
  out.write(`  node scripts/brain-sync.mjs doctor [--vault <path>] [--json] [--require-github]\n`)
  out.write(`  node scripts/brain-sync.mjs health --vault <path> [--json] [--out <file>]\n`)
  out.write(`  node scripts/brain-sync.mjs recall --vault <path> --query <text> [--method bm25f-sections] [--k 3] [--scope <path>] [--rerank] [--agent|--json]\n`)
  out.write(`  node scripts/brain-sync.mjs recall-loop --vault <path> --query <text> [--scope <path>] [--k 3] [--rerank] [--agent|--json]\n`)
  out.write(`  node scripts/brain-sync.mjs recall-semantic --vault <path> --query <text> [--scope <path>] [--model Xenova/bge-small-en-v1.5] [--k 3] [--json]\n`)
  out.write(`  node scripts/brain-sync.mjs recall-rerank --vault <path> --query <text> [--method bm25f-sections] [--k 3] [--scope <path>] [--json]\n`)
  out.write(`  node scripts/brain-sync.mjs config [show] [--config <path>] [--json]\n`)
  out.write(`  node scripts/brain-sync.mjs recall-managed --vault <path> --query <text> [--scope <path>] [--k 3] [--semantic-expansion] [--agent|--json]\n`)
  out.write(`  node scripts/brain-sync.mjs recall-explore --vault <path> --query <text> [--scope <path>] [--k 3] [--agent|--json] (experimental)\n`)
  out.write(`  node scripts/brain-sync.mjs curate-plan --vault <path> --input <bundle.json> [--agent|--json]\n`)
  out.write(`  node scripts/brain-sync.mjs curation-recommend --report <eval-report.json> --queries <queries.json> [--method governed-bm25f-sections] [--json]\n`)
  out.write(`  node scripts/brain-sync.mjs lifecycle-audit --vault <path> [--json] [--out <file>]\n`)
  out.write(`  node scripts/brain-sync.mjs init --vault <path> --repo <owner/repo> [--create-remote]\n`)
  out.write(`  node scripts/brain-sync.mjs status --vault <path>\n`)
  out.write(`  node scripts/brain-sync.mjs sync-plan --vault <path> [--patches <count>] [--session-end] [--handoff] [--high-risk] [--json]\n`)
  out.write(`  node scripts/brain-sync.mjs auto-pull --vault <path> [--json] [--strict]\n`)
  out.write(`  node scripts/brain-sync.mjs conflict-assist --vault <path> [--json] [--out <file>]\n`)
  out.write(`  node scripts/brain-sync.mjs pull --vault <path>\n`)
  out.write(`  node scripts/brain-sync.mjs push --vault <path> [--message <msg>]\n`)
  out.write(`  node scripts/brain-sync.mjs audit --vault <path> [--json] [--out <file>]\n`)
  out.write(`  node scripts/brain-sync.mjs lint --vault <path> [--json] [--out <file>]\n`)
  out.write(`  node scripts/brain-sync.mjs brain-session-brief --vault <path> [--json] [--out <file>]\n\n`)
  out.write(`  node scripts/brain-sync.mjs restructure-plan --vault <path> [--out <file>]\n`)
  out.write(`  node scripts/brain-sync.mjs restructure-apply --vault <path> --plan <file> --approve\n`)
  out.write(`  node scripts/brain-sync.mjs restructure-verify --vault <path> --record <file>\n`)
  out.write(`  node scripts/brain-sync.mjs restructure-rollback --vault <path> --record <file> --approve\n`)
  out.write(`  node scripts/brain-sync.mjs conflict-plan --conflict-report <file> --out <file>\n`)
  out.write(`  node scripts/brain-sync.mjs conflict-apply --vault <path> --plan <file> --approve\n`)
  out.write(`  node scripts/brain-sync.mjs curation-apply --vault <path> --plan <file> --approve\n\n`)
  out.write(`Defaults: private GitHub repo, branch main, no public repo creation unless --allow-public is present.\n`)
  out.write(`Agent flow: detect -> ask user when adoption is required -> bootstrap -> status.\n`)
  out.write(`Existing memory flow: adoption-plan first; never restructure silently.\n`)
  process.exit(exitCode)
}

function run(bin, commandArgs, { cwd = process.cwd(), dryRun = false, allowFail = false } = {}) {
  const printable = `${bin} ${commandArgs.join(" ")}`
  if (dryRun) {
    console.log(`[dry-run] ${printable}`)
    return { status: 0, stdout: "", stderr: "" }
  }
  const result = spawnSync(bin, commandArgs, {
    cwd,
    encoding: "utf8",
    shell: false,
  })
  if (result.error?.code === "ENOENT" || result.status === null) {
    throw new Error(`COMMAND_NOT_FOUND: '${bin}' is not available on PATH. Run brain-sync doctor for setup guidance.`)
  }
  if (result.status !== 0 && !allowFail) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    throw new Error(`COMMAND_FAILED: ${printable} exited with ${result.status}`)
  }
  return result
}

function requireVault() {
  const vault = option("--vault") || process.env.OBSIDIAN_VAULT
  if (!vault) {
    console.error("Missing --vault (or set OBSIDIAN_VAULT environment variable)")
    process.exit(2)
  }
  return path.resolve(vault)
}

function configPath(vault) {
  return path.join(vault, ".memory-patch-harness", "brain-sync.json")
}

function requiredOption(name) {
  const value = option(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function readJsonFile(file) {
  const target = path.resolve(file)
  if (!fs.existsSync(target)) throw new Error(`INPUT_NOT_FOUND: ${target}`)
  try {
    return JSON.parse(fs.readFileSync(target, "utf8"))
  } catch (error) {
    throw new Error(`INVALID_JSON: ${target}: ${error.message}`)
  }
}

function migrationRecordPath(vault, id) {
  const safeId = String(id || "migration").replace(/[^A-Za-z0-9._-]/gu, "-")
  return path.join(vault, ".memory-patch-harness", "migrations", `${safeId}.json`)
}

function writeJsonFile(file, value) {
  writeJsonAtomic(file, value)
}

function readConfig(vault) {
  const file = configPath(vault)
  if (!fs.existsSync(file)) throw new Error(`SYNC_CONFIG_NOT_FOUND: ${file}`)
  return readJsonFile(file)
}

function writeConfig(vault, config, dryRun = false) {
  const file = configPath(vault)
  if (dryRun) {
    console.log(`[dry-run] write ${file}`)
    return
  }
  writeJsonAtomic(file, config)
}

function ensureGitRepo(vault, branch, dryRun) {
  if (fs.existsSync(path.join(vault, ".git"))) return
  fs.mkdirSync(vault, { recursive: true })
  run("git", ["init", "-b", branch], { cwd: vault, dryRun })
}

function ensureRemote(vault, repo, dryRun) {
  const existing = run("git", ["remote", "get-url", "origin"], {
    cwd: vault,
    dryRun,
    allowFail: true,
  })
  if (dryRun || existing.status === 0) return
  run("git", ["remote", "add", "origin", `https://github.com/${repo}.git`], { cwd: vault })
}

function pathExistsAndIsNonEmpty(target) {
  if (!fs.existsSync(target)) return false
  if (!fs.statSync(target).isDirectory()) throw new Error(`INVALID_VAULT_PATH: not a directory: ${target}`)
  return fs.readdirSync(target).length > 0
}

function writeInitialFiles(vault, dryRun, { adoptionMode = false } = {}) {
  for (const [relativePath, content] of initialBrainFiles({ title: path.basename(vault) })) {
    if (adoptionMode && (relativePath === "README.md" || relativePath === ".gitignore")) continue
    const target = path.join(vault, relativePath)
    if (fs.existsSync(target)) continue
    if (dryRun) {
      console.log(`[dry-run] write ${target}`)
      continue
    }
    writeFileAtomic(target, content)
  }
}

function trackedFiles(vault) {
  const listed = run("git", ["ls-files", "--others", "--cached", "--exclude-standard"], {
    cwd: vault,
  }).stdout
  return listed.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
}

function scanVault(vault) {
  const findings = []
  for (const relativePath of trackedFiles(vault)) {
    const file = path.join(vault, relativePath)
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue
    const ext = path.extname(file).toLowerCase()
    if (!["", ".md", ".json", ".txt", ".yaml", ".yml", ".csv"].includes(ext)) continue
    const text = fs.readFileSync(file, "utf8")
    for (const finding of scanTextForSecrets(text)) {
      findings.push({ file: relativePath, ...finding })
    }
  }
  return findings
}

function assertCleanEnoughForPull(vault) {
  const status = run("git", ["status", "--porcelain"], { cwd: vault }).stdout.trim()
  if (status) {
    throw new Error("Refusing to pull with uncommitted memory changes. Commit/push or stash them first.")
  }
}

function assertCleanGitBaseline(vault) {
  if (!fs.existsSync(path.join(vault, ".git"))) {
    throw new Error("Restructure requires a Git-backed vault. Bootstrap/adopt and commit a baseline first.")
  }
  const head = run("git", ["rev-parse", "--verify", "HEAD"], { cwd: vault, allowFail: true })
  if (head.status !== 0) throw new Error("Restructure requires at least one baseline commit")
  const status = run("git", ["status", "--porcelain"], { cwd: vault }).stdout.trim()
  if (status) throw new Error("Restructure requires a clean Git worktree")
}

function withRestructureLock(vault, action) {
  const lock = path.join(vault, ".memory-patch-harness", "restructure.lock")
  fs.mkdirSync(path.dirname(lock), { recursive: true })
  let handle
  try {
    handle = fs.openSync(lock, "wx")
  } catch {
    throw new Error(`Another restructure operation may be running: ${lock}`)
  }
  try {
    return action()
  } finally {
    fs.closeSync(handle)
    fs.rmSync(lock, { force: true })
  }
}

function withSyncLock(vault, action) {
  const gitPath = run("git", ["rev-parse", "--git-path", "memory-patch-harness-sync.lock"], { cwd: vault }).stdout.trim()
  const lock = path.isAbsolute(gitPath) ? gitPath : path.join(vault, gitPath)
  fs.mkdirSync(path.dirname(lock), { recursive: true })
  let handle
  try {
    handle = fs.openSync(lock, "wx")
  } catch {
    throw new Error(`SYNC_BUSY: another sync operation may be running: ${lock}`)
  }
  try {
    return action()
  } finally {
    fs.closeSync(handle)
    fs.rmSync(lock, { force: true })
  }
}

function init() {
  const vault = requireVault()
  const repo = option("--repo")
  const branch = option("--branch", "main")
  const visibility = option("--visibility", "private")
  const dryRun = flag("--dry-run")
  const createRemote = flag("--create-remote")
  const allowPublic = flag("--allow-public")
  const adoptExisting = flag("--adopt-existing")
  if (visibility === "public" && !allowPublic) {
    throw new Error("Refusing public brain repo without --allow-public")
  }
  const config = makeSyncConfig({ repo, branch, visibility })

  ensureRemoteRepo(config, createRemote, dryRun)
  const inspected = inspectMemoryRoot(vault)
  assertSafeToBootstrap(inspected, { adoptExisting })
  ensureGitRepo(vault, config.branch, dryRun)
  writeInitialFiles(vault, dryRun, { adoptionMode: inspected.requiresAdoptionApproval })
  writeConfig(vault, config, dryRun)
  ensureRemote(vault, config.repo, dryRun)

  console.log(`Brain sync initialized: ${vault}`)
  console.log(`Remote memory repo: ${config.repo} (${config.visibility})`)
  console.log("Next: node scripts/brain-sync.mjs push --vault <path> --message \"memory: initialize portable brain\"")
}

function ensureRemoteRepo(config, createRemote, dryRun) {
  if (createRemote) {
    run("gh", ["auth", "status"], { dryRun })
    const existing = run("gh", ["repo", "view", config.repo], { dryRun, allowFail: true })
    if (dryRun || existing.status !== 0) {
      const createArgs = ["repo", "create", config.repo, `--${config.visibility}`, "--description", "Markdown memory managed by Graphmory"]
      run("gh", createArgs, { dryRun })
    }
  }
}

function bootstrap() {
  const vault = requireVault()
  const repo = option("--repo")
  const branch = option("--branch", "main")
  const visibility = option("--visibility", "private")
  const dryRun = flag("--dry-run")
  const createRemote = flag("--create-remote")
  const allowPublic = flag("--allow-public")
  const adoptExisting = flag("--adopt-existing")
  if (visibility === "public" && !allowPublic) {
    throw new Error("Refusing public brain repo without --allow-public")
  }
  const config = makeSyncConfig({ repo, branch, visibility })

  run("gh", ["auth", "status"], { dryRun })
  const existing = run("gh", ["repo", "view", config.repo], { dryRun, allowFail: true })
  if (existing.status === 0 && !fs.existsSync(path.join(vault, ".git"))) {
    if (pathExistsAndIsNonEmpty(vault)) {
      const inspected = inspectMemoryRoot(vault)
      assertSafeToBootstrap(inspected, { adoptExisting })
      ensureGitRepo(vault, config.branch, dryRun)
      ensureRemote(vault, config.repo, dryRun)
    } else {
      run("gh", ["repo", "clone", config.repo, vault], { dryRun })
    }
  } else {
    ensureRemoteRepo(config, createRemote, dryRun)
    assertSafeToBootstrap(inspectMemoryRoot(vault), { adoptExisting })
    ensureGitRepo(vault, config.branch, dryRun)
  }

  const inspected = inspectMemoryRoot(vault)
  if (!dryRun) assertSafeToBootstrap(inspected, { adoptExisting })
  writeInitialFiles(vault, dryRun, { adoptionMode: inspected.requiresAdoptionApproval })
  writeConfig(vault, config, dryRun)
  ensureRemote(vault, config.repo, dryRun)

  console.log(`Brain sync bootstrapped: ${vault}`)
  console.log(`Remote memory repo: ${config.repo} (${config.visibility})`)
  console.log("Next: node scripts/brain-sync.mjs status --vault <path>")
}

function detect() {
  const vault = requireVault()
  const json = flag("--json")
  const inspected = inspectMemoryRoot(vault)
  if (json) {
    console.log(JSON.stringify({ vault, ...inspected }, null, 2))
    return
  }
  console.log(`Vault: ${vault}`)
  console.log(`Kind: ${inspected.kind}`)
  console.log(`Safe default action: ${inspected.safeDefaultAction}`)
  console.log(`Requires adoption approval: ${inspected.requiresAdoptionApproval ? "yes" : "no"}`)
  if (inspected.signals.length) {
    console.log("Signals:")
    for (const signal of inspected.signals) console.log(`- ${signal}`)
  }
}

function doctor() {
  const vaultOption = option("--vault") || process.env.OBSIDIAN_VAULT
  const vault = vaultOption ? path.resolve(vaultOption) : null
  const requireGithub = flag("--require-github")
  const json = flag("--json")
  const checks = []

  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10)
  checks.push({
    id: "node-version",
    status: nodeMajor >= 20 ? "pass" : "fail",
    required: true,
    detail: `Node.js ${process.versions.node}`,
    fix: nodeMajor >= 20 ? null : "Install Node.js 20 or newer, then reopen the terminal.",
  })

  checks.push(commandCheck("git", ["--version"], {
    id: "git-cli",
    required: true,
    fix: "Install Git and reopen the terminal so git is available on PATH.",
  }))
  checks.push(commandCheck("gh", ["--version"], {
    id: "github-cli",
    required: requireGithub,
    fix: "Install GitHub CLI (gh) or omit GitHub-backed sync and use the harness locally.",
  }))

  const ghAvailable = checks.find((check) => check.id === "github-cli")?.status === "pass"
  if (ghAvailable) {
    checks.push(commandCheck("gh", ["auth", "status"], {
      id: "github-auth",
      required: requireGithub,
      fix: "Run 'gh auth login', complete browser authentication, then run doctor again.",
    }))
  }

  if (vault) {
    const inspected = inspectMemoryRoot(vault)
    const validVaultPath = !["not-a-directory", "unreadable-path"].includes(inspected.kind)
    checks.push({
      id: "vault-detection",
      status: validVaultPath ? "pass" : "fail",
      required: true,
      detail: `${inspected.kind}; action=${inspected.safeDefaultAction}`,
      fix: validVaultPath ? null : "Choose a directory path for the memory vault; do not overwrite or delete the existing file.",
    })
    const writableRoot = nearestExistingParent(vault)
    let writable = false
    try {
      fs.accessSync(writableRoot, fs.constants.R_OK | fs.constants.W_OK)
      writable = true
    } catch {}
    checks.push({
      id: "vault-permission",
      status: writable ? "pass" : "fail",
      required: true,
      detail: writable ? `Readable and writable: ${writableRoot}` : `Cannot write: ${writableRoot}`,
      fix: writable ? null : "Choose a user-writable vault path or fix folder permissions; do not run the agent as administrator by default.",
    })

    const syncFile = configPath(vault)
    if (fs.existsSync(syncFile)) {
      try {
        const config = readJsonFile(syncFile)
        makeSyncConfig(config)
        checks.push({ id: "sync-config", status: "pass", required: true, detail: syncFile, fix: null })
      } catch (error) {
        checks.push({
          id: "sync-config",
          status: "fail",
          required: true,
          detail: error.message,
          fix: "Restore .memory-patch-harness/brain-sync.json from Git or regenerate it after reviewing the configured repo and branch.",
        })
      }
    } else {
      checks.push({
        id: "sync-config",
        status: "warn",
        required: false,
        detail: "No brain-sync.json yet",
        fix: "Run detect, then bootstrap only after confirming the vault and repository.",
      })
    }
  }

  const failedRequired = checks.filter((check) => check.required && check.status === "fail")
  const report = {
    ok: failedRequired.length === 0,
    platform: process.platform,
    architecture: process.arch,
    cwd: process.cwd(),
    vault,
    checks,
  }
  if (json) console.log(JSON.stringify(report, null, 2))
  else {
    console.log(`Graphmory doctor: ${report.ok ? "PASS" : "FAIL"}`)
    for (const check of checks) {
      console.log(`- [${check.status.toUpperCase()}] ${check.id}: ${check.detail}`)
      if (check.fix) console.log(`  Fix: ${check.fix}`)
    }
  }
  if (!report.ok) process.exitCode = 1
}

function health() {
  const vault = requireVault()
  const json = flag("--json")
  const out = option("--out")
  const report = analyzeVaultHealth(vault)
  const content = json ? `${JSON.stringify(report, null, 2)}\n` : renderHealthMarkdown(report)
  if (out) {
    const target = path.resolve(out)
    writeFileAtomic(target, content)
    console.log(`Memory health report written: ${target}`)
    return
  }
  process.stdout.write(content)
  if (!report.ok) process.exitCode = 1
}

function agentRecallPacket(report, { includeLanes = false } = {}) {
  return {
    confidence: report.confidence,
    needsExpansion: report.needsExpansion,
    scanLimitReached: report.scanLimitReached,
    ...(report.excludedByLifecycle ? { excludedByLifecycle: report.excludedByLifecycle } : {}),
    results: report.results.map(({ path, status, lanes }) => ({
      path, status, ...(includeLanes ? { lanes } : {}),
    })),
  }
}

function recall() {
  const vault = requireVault()
  const query = requiredOption("--query")
  const method = option("--method", "bm25f-sections")
  const k = Number.parseInt(option("--k", "3"), 10)
  const report = recallVault(vault, query, {
    method,
    k,
    includeNoncanonical: flag("--include-noncanonical"),
    includeRawPaths: flag("--include-raw-paths"),
    scope: option("--scope", ""),
    rerank: flag("--rerank"),
  })
  if (flag("--agent")) {
    console.log(JSON.stringify(agentRecallPacket(report)))
    return
  }
  if (flag("--json")) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  console.log(`Memory recall: ${report.confidence} confidence; ${report.results.length} result(s)${report.reranked ? " (reranked)" : ""}`)
  for (const result of report.results) {
    const signals = result.rerankApplied && result.rerankSignals
      ? ` [focus=${result.rerankSignals.sectionFocus} headings=${result.rerankSignals.headingMatches} boost=${result.rerankSignals.boost}]`
      : ""
    console.log(`- ${result.path} | ${result.title} | score ${result.score}${signals}`)
  }
  if (report.needsExpansion) {
    console.log("Expansion required:")
    for (const step of report.nextSteps) console.log(`- ${step}`)
  }
}

function curationRecommend() {
  const report = readJsonFile(requiredOption("--report"))
  const queries = readJsonFile(requiredOption("--queries"))
  const method = option("--method", "governed-bm25f-sections")
  const result = buildCurationRecommendations(report, queries, { method })
  if (flag("--json")) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  process.stdout.write(renderCurationRecommendations(result))
}

function renderHealthMarkdown(report) {
  const lines = []
  lines.push("# Memory Health Report")
  lines.push("")
  lines.push(`Checked: ${report.checkedAt}`)
  lines.push(`Score: ${report.score}/100`)
  lines.push(`OK: ${report.ok ? "yes" : "no"}`)
  lines.push("")
  lines.push("## Summary")
  lines.push("")
  lines.push(`- Markdown files: ${report.summary.markdownFiles}`)
  lines.push(`- Critical: ${report.summary.critical}`)
  lines.push(`- Warning: ${report.summary.warning}`)
  lines.push(`- Info: ${report.summary.info}`)
  lines.push(`- Inbox notes: ${report.summary.inboxCount}`)
  if (report.findings.length) {
    lines.push("")
    lines.push("## Findings")
    lines.push("")
    lines.push("| Severity | Kind | File | Recommendation |")
    lines.push("|---|---|---|---|")
    for (const finding of report.findings) {
      lines.push(`| ${finding.severity} | ${finding.kind} | ${finding.file} | ${finding.recommendation} |`)
    }
  }
  lines.push("")
  return `${lines.join("\n")}\n`
}

function commandCheck(bin, commandArgs, { id, required, fix }) {
  const result = spawnSync(bin, commandArgs, { encoding: "utf8", shell: false })
  if (result.error?.code === "ENOENT" || result.status === null) {
    return { id, status: required ? "fail" : "warn", required, detail: `${bin} not found on PATH`, fix }
  }
  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim().split(/\r?\n/u)[0] || `exit ${result.status}`
  return {
    id,
    status: result.status === 0 ? "pass" : required ? "fail" : "warn",
    required,
    detail: output,
    fix: result.status === 0 ? null : fix,
  }
}

function nearestExistingParent(target) {
  let current = path.resolve(target)
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current)
    if (parent === current) return current
    current = parent
  }
  return current
}

function adoptionPlan() {
  const vault = requireVault()
  const json = flag("--json")
  const out = option("--out")
  const plan = buildAdoptionPlan(vault)
  const content = json ? `${JSON.stringify(plan, null, 2)}\n` : renderAdoptionPlanMarkdown(plan)
  if (out) {
    const target = path.resolve(out)
    writeFileAtomic(target, content)
    console.log(`Adoption plan written: ${target}`)
    return
  }
  process.stdout.write(content)
}

function restructurePlan() {
  const vault = requireVault()
  const out = option("--out")
  const plan = buildAdoptionPlan(vault)
  const manifest = buildRestructureManifest(plan)
  const content = `${JSON.stringify(manifest, null, 2)}\n`
  if (!out) {
    process.stdout.write(content)
    return
  }
  const target = path.resolve(out)
  writeJsonFile(target, manifest)
  console.log(`Restructure plan written: ${target}`)
  console.log("Review note meaning, choose exact targets, then set approved=true only for the user-approved batch.")
}

function restructureApply() {
  const vault = requireVault()
  const planFile = requiredOption("--plan")
  const dryRun = flag("--dry-run")
  const explicitlyApproved = flag("--approve")
  const allowLargeMigration = flag("--allow-large-migration")
  if (!explicitlyApproved && !dryRun) {
    throw new Error("Refusing restructure without --approve after explicit user approval")
  }
  const manifest = readJsonFile(planFile)
  const maxApproved = allowLargeMigration ? Number.POSITIVE_INFINITY : 20
  const approved = validateRestructureManifest(manifest, { vault, maxApproved })
  if (dryRun) {
    console.log(`Restructure dry-run passed: ${approved.length} approved move(s)`)
    return
  }

  assertCleanGitBaseline(vault)
  const findings = scanVault(vault)
  if (findings.length) throw new Error("Refusing restructure because secret-like values were found in the vault")

  withRestructureLock(vault, () => {
    const backupBranch = `memory-harness-backup/${String(manifest.id).replace(/[^A-Za-z0-9._-]/gu, "-")}`
    run("git", ["branch", backupBranch, "HEAD"], { cwd: vault })
    const record = applyRestructureManifest(manifest, { vault, maxApproved })
    record.backupBranch = backupBranch
    record.planFile = path.resolve(planFile)
    record.linkRepairRequired = true
    const target = migrationRecordPath(vault, manifest.id)
    writeJsonFile(target, record)
    console.log(`Restructure applied: ${record.moves.length} note(s)`)
    console.log(`Record: ${target}`)
    console.log(`Local backup branch: ${backupBranch}`)
    console.log("Next: run restructure-verify, then repair and validate links before committing.")
  })
}

function restructureVerify() {
  const vault = requireVault()
  const recordFile = requiredOption("--record")
  const record = readJsonFile(recordFile)
  const state = record.status === "rolled-back" ? "rolled-back" : "applied"
  const result = verifyRestructureRecord(record, { vault, state })
  console.log(JSON.stringify(result, null, 2))
  if (!result.ok) process.exitCode = 1
}

function restructureRollback() {
  const vault = requireVault()
  const recordFile = requiredOption("--record")
  if (!flag("--approve")) throw new Error("Refusing rollback without --approve")
  const record = readJsonFile(recordFile)
  withRestructureLock(vault, () => {
    const rolledBack = rollbackRestructureRecord(record, { vault })
    writeJsonFile(path.resolve(recordFile), rolledBack)
    console.log(`Restructure rolled back: ${rolledBack.moves.length} note(s)`)
  })
}

function status() {
  const vault = requireVault()
  const config = readConfig(vault)
  console.log(`Vault: ${vault}`)
  console.log(`Repo: ${config.repo}`)
  console.log(`Branch: ${config.branch}`)
  const gitStatus = run("git", ["status", "--short", "--branch"], { cwd: vault }).stdout
  process.stdout.write(gitStatus)
  const findings = scanVault(vault)
  if (findings.length) {
    console.log("\nSecret-like findings:")
    for (const finding of findings) console.log(`- ${finding.file}: ${finding.name} (${finding.sample})`)
    process.exitCode = 1
  }
}

function recallLoop() {
  const vault = requireVault()
  const query = requiredOption("--query")
  const k = Number.parseInt(option("--k", "3"), 10)
  const methods = option("--methods", "bm25,bm25f-focused-sections")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  const report = recallVaultLoop(vault, query, {
    methods,
    k,
    includeNoncanonical: flag("--include-noncanonical"),
    includeRawPaths: flag("--include-raw-paths"),
    scope: option("--scope", ""),
    rerank: flag("--rerank"),
  })
  if (flag("--agent")) {
    console.log(JSON.stringify(agentRecallPacket(report, { includeLanes: true })))
    return
  }
  if (flag("--json")) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  console.log(`Memory recall loop: ${report.confidence} confidence; ${report.results.length} fused result(s)${report.reranked ? " (reranked)" : ""}`)
  for (const result of report.results) {
    console.log(`- ${result.path} | ${result.title} | score ${result.score} | lanes ${result.lanes.join(",")}`)
  }
  if (report.needsExpansion) {
    console.log("Expansion required:")
    for (const step of report.nextSteps) console.log(`- ${step}`)
  }
}

async function configureRuntime() {
  const file = runtimeConfigPath(option("--config"))
  const config = loadRuntimeConfig(file)
  if (rest.includes("show") || flag("--json")) {
    console.log(JSON.stringify({ path: file, ...config }, null, 2))
    return
  }
  if (!process.stdin.isTTY) throw new Error("Interactive config requires a terminal; use `graphmory config show` to inspect settings")
  const input = createInterface({ input: process.stdin, output: process.stdout })
  const ask = async (label, current) => (await input.question(`${label} [${current}]: `)).trim() || current
  try {
    console.log("Graphmory · setup")
    console.log("1 Curator only   2 Hosted Jev decision gate   3 Local System One decision gate   4 Local retrieval reranker")
    const selected = await ask("Workflow", { curator: "1", "hosted-jev": "2", "local-decision": "3", "local-rerank": "4" }[config.workflow])
    const workflows = { "1": "curator", "2": "hosted-jev", "3": "local-decision", "4": "local-rerank" }
    if (!workflows[selected]) throw new Error("Choose workflow 1, 2, 3, or 4")
    config.workflow = workflows[selected]
    if (config.workflow === "curator") {
      config.curator ??= { provider: "openai", model: "gpt-6-luna" }
      config.curator.provider = await ask("Curator provider (openai/anthropic/google/other)", config.curator.provider)
      config.curator.model = await ask("Curator model", config.curator.model)
    }
    if (config.workflow === "hosted-jev") {
      const gateway = config.decision.endpoint === "https://ai-gateway.vercel.sh/typesafe/v1/systemone"
      const provider = await ask("Jev access (1 TypeSafe direct, 2 Vercel AI Gateway)", gateway ? "2" : "1")
      if (!["1", "2"].includes(provider)) throw new Error("Choose Jev access option 1 or 2")
      config.decision.endpoint = provider === "2"
        ? "https://ai-gateway.vercel.sh/typesafe/v1/systemone"
        : "https://api.typesafe.ai/v1/systemone"
      config.decision.model = await ask("Jev model", provider === "2" ? "typesafe-ai/jev" : "jev-latest")
      config.decision.apiKeyEnv = await ask("API key environment variable name", provider === "2" ? "AI_GATEWAY_API_KEY" : "TYPESAFE_API_KEY")
      const consent = await ask("Send retrieved vault note excerpts to the selected hosted provider? (yes/no)", config.decision.allowRemoteVaultContent ? "yes" : "no")
      if (!["yes", "no"].includes(consent)) throw new Error("Answer yes or no for remote vault content")
      config.decision.allowRemoteVaultContent = consent === "yes"
    } else if (config.workflow === "local-rerank") {
      const preset = await ask("Local reranker (1 Qwen3 4B quality candidate, 2 MiniLM CPU light, 3 Qwen3 0.6B multilingual, 4 custom)",
        config.decision.model === "cross-encoder/ms-marco-MiniLM-L-6-v2" ? "2"
          : config.decision.model === "Qwen/Qwen3-Reranker-0.6B" ? "3" : "1")
      if (!["1", "2", "3", "4"].includes(preset)) throw new Error("Choose local reranker option 1, 2, 3, or 4")
      config.decision.endpoint = await ask("Local /v1/rerank endpoint", "http://127.0.0.1:8000/v1/rerank")
      const rerankModels = { "1": "Qwen3-Reranker-4B-4bit", "2": "cross-encoder/ms-marco-MiniLM-L-6-v2", "3": "Qwen/Qwen3-Reranker-0.6B" }
      config.decision.model = await ask("Local reranker model", rerankModels[preset] ?? config.decision.model)
    } else if (config.workflow === "local-decision") {
      const preset = await ask("Local model (1 OpenThai-SystemOne, 2 Laya, 3 custom)",
        config.decision.model === "iapp/OpenThai-SystemOne" ? "1" : config.decision.model === "laya" ? "2" : "3")
      if (!["1", "2", "3"].includes(preset)) throw new Error("Choose local model option 1, 2, or 3")
      const localDefault = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])/u.test(config.decision.endpoint)
        ? config.decision.endpoint : "http://127.0.0.1:8000/v1/systemone"
      config.decision.endpoint = await ask("Local System One-compatible endpoint", localDefault)
      const modelDefault = preset === "1" ? "iapp/OpenThai-SystemOne" : preset === "2" ? "laya" : config.decision.model
      config.decision.model = await ask("Local decision model identifier", modelDefault)
    }
    if (["hosted-jev", "local-decision"].includes(config.workflow)) {
      config.decision.relevanceThreshold = Number(await ask("Minimum relevance probability (0–1)", config.decision.relevanceThreshold))
    }
    if (config.workflow !== "curator") {
      config.decision.maxCandidates = Number(await ask("Maximum candidates (1–10)", config.workflow === "local-rerank" && config.decision.maxCandidates === 8 ? 4 : config.decision.maxCandidates))
    }
    saveRuntimeConfig(file, config)
    console.log(`Saved ${file}`)
    console.log(config.workflow === "curator"
      ? `Workflow: curator; agent: ${config.curator.provider}/${config.curator.model}`
      : `Workflow: ${config.workflow}; decision model: ${config.decision.model}; evidence goes directly to the lead agent`)
  } finally {
    input.close()
  }
}

async function recallManaged() {
  const report = await managedRecall(requireVault(), requiredOption("--query"), loadRuntimeConfig(runtimeConfigPath(option("--config"))), {
    k: Number.parseInt(option("--k", "3"), 10),
    scope: option("--scope", ""),
    semanticExpansion: flag("--semantic-expansion"),
  })
  if (flag("--agent")) console.log(JSON.stringify(report.evidencePacket || {
    workflow: report.workflow,
    retrievalConfidence: report.retrievalConfidence,
    needsExpansion: report.needsExpansion,
    scanLimitReached: report.scanLimitReached,
    results: report.results.map(({ path, relevance, status }) => ({ path, ...(relevance === undefined ? {} : { relevance }), status })),
  }))
  else if (flag("--json")) console.log(JSON.stringify(report, null, 2))
  else {
    console.log(`Managed recall: ${report.workflow}; ${report.confidence} retrieval confidence${report.decisionGate ? `; gate ${report.decisionGate}` : ""}`)
    for (const item of report.results) console.log(`- ${item.path} | ${item.title} | ${item.rankScore === undefined ? `relevance ${item.relevance ?? "curator review"}` : `rank score ${item.rankScore}`}`)
    for (const step of report.nextSteps) console.log(`- ${step}`)
  }
}

async function recallExplore() {
  const report = await recallVaultAdaptive(requireVault(), requiredOption("--query"), {
    k: Number.parseInt(option("--k", "3"), 10), scope: option("--scope", ""), graphPolicy: "auto",
  })
  if (flag("--agent")) console.log(JSON.stringify({ workflow: report.workflow, evidenceStatus: report.evidenceStatus,
    stopReason: report.stopReason, rounds: report.rounds, uniqueCandidates: report.uniqueCandidates,
    scanLimitReached: report.scanLimitReached, graphLimitReached: report.graphLimitReached,
    results: report.results.map(({ path, via, parent, depth }) => ({ path, via, ...(parent ? { parent } : {}), depth })),
    nextAction: report.nextAction }))
  else if (flag("--json")) console.log(JSON.stringify(report, null, 2))
  else {
    console.log(`Experimental graph recall: ${report.stopReason}; ${report.rounds} expansion round(s); evidence unverified`)
    for (const item of report.results) console.log(`- ${item.path} (${item.via})`)
  }
}

async function curatePlan() {
  const input = JSON.parse(fs.readFileSync(requiredOption("--input"), "utf8"))
  const report = await planDecisionCuration(requireVault(), input, loadRuntimeConfig(runtimeConfigPath(option("--config"))))
  console.log(JSON.stringify(report, null, flag("--agent") ? 0 : 2))
}

function lifecycleAudit() {
  const vault = requireVault()
  const out = option("--out")
  const now = option("--now") ? new Date(option("--now")) : new Date()
  if (Number.isNaN(now.getTime())) throw new Error("--now must be an ISO date")
  const maxFiles = Number.parseInt(option("--max-files", "5000"), 10)
  if (!Number.isInteger(maxFiles) || maxFiles < 1) throw new Error("--max-files must be a positive integer")
  const report = auditMemoryLifecycle(vault, {
    includeRawPaths: flag("--include-raw-paths"),
    maxFiles,
    now,
  })
  const content = flag("--json") ? `${JSON.stringify(report, null, 2)}\n` : renderLifecycleAuditMarkdown(report)
  if (out) {
    const target = path.resolve(out)
    writeFileAtomic(target, content)
    console.log(`Lifecycle audit written: ${target}`)
    return
  }
  process.stdout.write(content)
  if (report.summary.high > 0 || report.summary.medium > 0) process.exitCode = 1
}

function audit() {
  const vault = requireVault()
  const json = flag("--json")
  const out = option("--out")
  const report = auditVaultSchema(vault)
  const content = json ? `${JSON.stringify(report, null, 2)}\n` : renderAuditMarkdown(report)
  if (out) {
    const target = path.resolve(out)
    writeFileAtomic(target, content)
    console.log(`Schema audit written: ${target}`)
    return
  }
  process.stdout.write(content)
  if (!report.ok) process.exitCode = 1
}

function renderAuditMarkdown(report) {
  const lines = []
  lines.push("# Memory Schema Audit")
  lines.push("")
  lines.push(`Checked: ${report.checkedAt}`)
  lines.push(`Findings: ${report.summary.total} (warning ${report.summary.warning}, info ${report.summary.info})`)
  lines.push(`OK: ${report.ok ? "yes" : "no"}`)
  lines.push("")
  if (!report.findings.length) {
    lines.push("- No findings")
  } else {
    for (const item of report.findings) {
      lines.push(`- [${item.severity.toUpperCase()}] ${item.kind}: \`${item.file}\``)
      lines.push(`  Detail: ${item.detail}`)
      lines.push(`  Recommendation: ${item.recommendation}`)
    }
  }
  lines.push("")
  return `${lines.join("\n")}\n`
}

function lint() {
  const vault = requireVault()
  const json = flag("--json")
  const out = option("--out")
  const report = lintVaultMemory(vault)
  const content = json ? `${JSON.stringify(report, null, 2)}\n` : renderLintMarkdown(report)
  if (out) {
    const target = path.resolve(out)
    writeFileAtomic(target, content)
    console.log(`Memory lint written: ${target}`)
    return
  }
  process.stdout.write(content)
  if (!report.ok) process.exitCode = 1
}

function renderLintMarkdown(report) {
  const lines = []
  lines.push("# Memory Lint Report")
  lines.push("")
  lines.push(`Checked: ${report.checkedAt}`)
  lines.push(`Findings: ${report.summary.total} (warning ${report.summary.warning}, info ${report.summary.info})`)
  lines.push(`OK: ${report.ok ? "yes" : "no"}`)
  lines.push("")
  if (!report.findings.length) {
    lines.push("- No findings")
  } else {
    for (const item of report.findings) {
      lines.push(`- [${item.severity.toUpperCase()}] ${item.kind}: \`${item.file}\``)
      lines.push(`  Detail: ${item.detail}`)
      lines.push(`  Recommendation: ${item.recommendation}`)
    }
  }
  lines.push("")
  return `${lines.join("\n")}\n`
}

function brainSessionBrief() {
  const vault = requireVault()
  const json = flag("--json")
  const out = option("--out")
  const brief = buildBrainSessionBrief(vault)
  const content = json ? `${JSON.stringify(brief, null, 2)}\n` : renderBrainSessionBriefMarkdown(brief)
  if (out) {
    const target = path.resolve(out)
    writeFileAtomic(target, content)
    console.log(`Brain session brief written: ${target}`)
    return
  }
  process.stdout.write(content)
}

function renderBrainSessionBriefMarkdown(brief) {
  const lines = []
  lines.push("# Brain Session Brief")
  lines.push("")
  lines.push(`Generated: ${brief.checkedAt}`)
  lines.push(`Vault: ${brief.vault}`)
  lines.push("")
  if (brief.sync.configured) {
    lines.push(`Sync: configured (repo: ${brief.sync.repo}, branch: ${brief.sync.branch})`)
  } else {
    lines.push("Sync: not configured")
  }
  lines.push("")
  lines.push("## Health Summary")
  lines.push("")
  lines.push(`- Score: ${brief.health.score}/100`)
  lines.push(`- Status: ${brief.health.ok ? "OK" : "Issues found"}`)
  lines.push(`- Markdown files: ${brief.health.markdownFiles}`)
  lines.push(`- Critical: ${brief.health.critical}`)
  lines.push(`- Warning: ${brief.health.warning}`)
  lines.push(`- Info: ${brief.health.info}`)
  lines.push(`- Inbox count: ${brief.health.inboxCount}`)
  lines.push("")
  return `${lines.join("\n")}\n`
}

function renderLifecycleAuditMarkdown(report) {
  const lines = []
  lines.push("# Memory Lifecycle Audit")
  lines.push("")
  lines.push(`Checked: ${report.checkedAt}`)
  lines.push(`Scanned notes: ${report.scanned}`)
  lines.push(`Findings: ${report.summary.total} (high ${report.summary.high}, medium ${report.summary.medium}, low ${report.summary.low}, info ${report.summary.info})`)
  lines.push("")
  lines.push("## Findings")
  lines.push("")
  if (!report.findings.length) {
    lines.push("- None")
  } else {
    for (const item of report.findings) {
      lines.push(`- [${item.severity}] ${item.kind}: \`${item.file}\` - ${item.detail}`)
      lines.push(`  Recommendation: ${item.recommendation}`)
    }
  }
  lines.push("")
  lines.push("## Suggested Actions")
  lines.push("")
  if (!report.actions.length) {
    lines.push("- None")
  } else {
    for (const item of report.actions) lines.push(`- ${item.action}: \`${item.file}\` - ${item.reason}`)
  }
  lines.push("")
  return `${lines.join("\n")}\n`
}

function recallRerank() {
  const vault = requireVault()
  const query = requiredOption("--query")
  const method = option("--method", "bm25f-sections")
  const k = Number.parseInt(option("--k", "3"), 10)
  const report = recallVault(vault, query, {
    method,
    k,
    includeNoncanonical: flag("--include-noncanonical"),
    includeRawPaths: flag("--include-raw-paths"),
    scope: option("--scope", ""),
    rerank: true,
  })
  if (flag("--json")) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  console.log(`Memory recall with rerank: ${report.confidence} confidence; ${report.results.length} result(s)`)
  for (const result of report.results) {
    const signals = result.rerankSignals
      ? ` [focus=${result.rerankSignals.sectionFocus} headings=${result.rerankSignals.headingMatches} boost=${result.rerankSignals.boost}]`
      : ""
    console.log(`- ${result.path} | ${result.title} | score ${result.score}${signals}`)
  }
  if (report.reranked) {
    console.log(`Rerank applied: section-focus + heading-affinity + co-occurrence boost`)
  }
  if (report.needsExpansion) {
    console.log("Expansion required:")
    for (const step of report.nextSteps) console.log(`- ${step}`)
  }
}

async function recallSemantic() {
  const vault = requireVault()
  const query = requiredOption("--query")
  const k = Number.parseInt(option("--k", "3"), 10)
  const report = await recallVaultSemantic(vault, query, {
    k,
    includeNoncanonical: flag("--include-noncanonical"),
    includeRawPaths: flag("--include-raw-paths"),
    scope: option("--scope", ""),
    model: option("--model", "Xenova/bge-small-en-v1.5"),
    modelCache: option("--model-cache", ""),
  })
  if (flag("--json")) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  console.log(`Semantic memory recall: ${report.confidence} confidence; ${report.results.length} fused result(s)`)
  for (const result of report.results) {
    console.log(`- ${result.path} | ${result.title} | score ${result.score} | lanes ${result.lanes.join(",")}`)
  }
  if (report.needsExpansion) {
    console.log("Expansion required:")
    for (const step of report.nextSteps) console.log(`- ${step}`)
  }
}

function syncPlan() {
  const vault = requireVault()
  const config = readConfig(vault)
  const dirty = run("git", ["status", "--porcelain"], { cwd: vault }).stdout.trim()
  const changedFiles = dirty ? dirty.split(/\r?\n/u).filter(Boolean).length : 0
  const secretFindings = scanVault(vault).length
  const health = analyzeVaultHealth(vault)
  const remoteRef = `refs/remotes/origin/${config.branch}`
  const counts = run("git", ["rev-list", "--left-right", "--count", `${remoteRef}...HEAD`], {
    cwd: vault,
    allowFail: true,
  })
  let commitsBehind = 0
  let commitsAhead = 0
  if (counts.status === 0) {
    const [behind, ahead] = counts.stdout.trim().split(/\s+/u).map((value) => Number.parseInt(value, 10))
    commitsBehind = Number.isInteger(behind) ? behind : 0
    commitsAhead = Number.isInteger(ahead) ? ahead : 0
  }
  const verifiedPatches = Number.parseInt(option("--patches", "0"), 10)
  if (!Number.isInteger(verifiedPatches) || verifiedPatches < 0) throw new Error("--patches must be a non-negative integer")
  const report = buildSyncPlan({
    changedFiles,
    verifiedPatches,
    commitsAhead,
    commitsBehind,
    healthCritical: health.summary.critical,
    secretFindings,
    restructureActive: fs.existsSync(path.join(vault, ".memory-patch-harness", "restructure.lock")),
    sessionEnd: flag("--session-end"),
    handoff: flag("--handoff"),
    highRiskPatch: flag("--high-risk"),
  })
  if (flag("--json")) console.log(JSON.stringify(report, null, 2))
  else {
    console.log(`Sync plan: ${report.decision}`)
    console.log(report.reason)
    if (report.triggers.length) console.log(`Triggers: ${report.triggers.join(", ")}`)
  }
}

function pull() {
  const vault = requireVault()
  const config = readConfig(vault)
  assertCleanEnoughForPull(vault)
  run("git", ["fetch", "origin", config.branch], { cwd: vault })
  run("git", ["pull", "--ff-only", "origin", config.branch], { cwd: vault })
  console.log("Brain memory pulled.")
}

function autoPull() {
  const vault = requireVault()
  const config = readConfig(vault)
  const json = flag("--json")
  const strict = flag("--strict")
  let report
  try {
    report = withSyncLock(vault, () => {
      if (fs.existsSync(path.join(vault, ".memory-patch-harness", "restructure.lock"))) {
        return syncReport("blocked-restructure", false, "A memory restructure operation is active")
      }
      const dirty = run("git", ["status", "--porcelain"], { cwd: vault }).stdout.trim()
      if (dirty) return syncReport("skipped-dirty", false, "Local memory changes must be reviewed before pull")

      const fetched = run("git", ["fetch", "origin", config.branch], { cwd: vault, allowFail: true })
      if (fetched.status !== 0) {
        const detail = `${fetched.stderr || fetched.stdout || "fetch failed"}`.trim().split(/\r?\n/u)[0]
        return syncReport("offline-or-auth-failed", false, detail)
      }

      const remoteRef = `refs/remotes/origin/${config.branch}`
      const remote = run("git", ["rev-parse", "--verify", remoteRef], { cwd: vault, allowFail: true })
      if (remote.status !== 0) return syncReport("remote-branch-missing", true, `No remote branch ${config.branch} yet`)
      const local = run("git", ["rev-parse", "--verify", "HEAD"], { cwd: vault, allowFail: true })
      if (local.status !== 0) return syncReport("local-history-missing", false, "Local vault has no baseline commit")

      const localHead = local.stdout.trim()
      const remoteHead = remote.stdout.trim()
      if (localHead === remoteHead) return syncReport("up-to-date", true, "Local and remote memory match")

      const localBehind = run("git", ["merge-base", "--is-ancestor", localHead, remoteHead], { cwd: vault, allowFail: true })
      if (localBehind.status === 0) {
        run("git", ["merge", "--ff-only", remoteRef], { cwd: vault })
        return syncReport("updated", true, `Fast-forwarded to ${remoteHead.slice(0, 12)}`)
      }
      const localAhead = run("git", ["merge-base", "--is-ancestor", remoteHead, localHead], { cwd: vault, allowFail: true })
      if (localAhead.status === 0) return syncReport("local-ahead", true, "Local commits are not yet pushed")
      return syncReport("diverged", false, "Local and remote memory histories diverged; semantic review is required")
    })
  } catch (error) {
    if (!error.message.startsWith("SYNC_BUSY:")) throw error
    report = syncReport("sync-busy", false, error.message)
  }

  if (json) console.log(JSON.stringify(report, null, 2))
  else console.log(`Auto-pull ${report.status}: ${report.detail}`)
  if (strict && !report.safeToContinue) process.exitCode = 1
}

function syncReport(status, safeToContinue, detail) {
  return {
    status,
    safeToContinue,
    detail,
    checkedAt: new Date().toISOString(),
  }
}

function conflictAssist() {
  const vault = requireVault()
  const config = readConfig(vault)
  const json = flag("--json")
  const out = option("--out")
  const report = withSyncLock(vault, () => buildConflictAssistReport(vault, config))
  const content = json ? `${JSON.stringify(report, null, 2)}\n` : renderConflictAssistMarkdown(report)
  if (out) {
    const target = path.resolve(out)
    writeFileAtomic(target, content)
    console.log(`Conflict assist report written: ${target}`)
    return
  }
  process.stdout.write(content)
  if (!report.safeToAutoPull) process.exitCode = report.status === "ok" ? 0 : 1
}

function buildConflictAssistReport(vault, config) {
  const fetched = run("git", ["fetch", "origin", config.branch], { cwd: vault, allowFail: true })
  if (fetched.status !== 0) {
    return {
      status: "remote-unavailable",
      safeToAutoPull: false,
      checkedAt: new Date().toISOString(),
      detail: `${fetched.stderr || fetched.stdout || "fetch failed"}`.trim().split(/\r?\n/u)[0],
      nextDecision: "Fix network/auth/remote access before resolving memory conflict.",
    }
  }

  const remoteRef = `refs/remotes/origin/${config.branch}`
  const local = run("git", ["rev-parse", "--verify", "HEAD"], { cwd: vault, allowFail: true })
  const remote = run("git", ["rev-parse", "--verify", remoteRef], { cwd: vault, allowFail: true })
  if (local.status !== 0 || remote.status !== 0) {
    return {
      status: "missing-history",
      safeToAutoPull: false,
      checkedAt: new Date().toISOString(),
      detail: "Local or remote history is missing.",
      nextDecision: "Create or connect the baseline brain repo before conflict review.",
    }
  }

  const localHead = local.stdout.trim()
  const remoteHead = remote.stdout.trim()
  const dirty = run("git", ["status", "--porcelain"], { cwd: vault }).stdout.trim()
  const baseResult = run("git", ["merge-base", "HEAD", remoteRef], { cwd: vault, allowFail: true })
  if (baseResult.status !== 0) {
    return {
      status: "unrelated-history",
      safeToAutoPull: false,
      checkedAt: new Date().toISOString(),
      localHead,
      remoteHead,
      workingTreeDirty: Boolean(dirty),
      nextDecision: "Do not merge automatically. Ask the user whether these are the same brain or separate memories.",
    }
  }

  const base = baseResult.stdout.trim()
  const localChanged = changedFiles(vault, `${base}..HEAD`)
  const remoteChanged = changedFiles(vault, `${base}..${remoteRef}`)
  const dirtyChanged = dirtyFiles(dirty)
  const localMap = new Map(localChanged.map((item) => [item.path, item]))
  const remoteMap = new Map(remoteChanged.map((item) => [item.path, item]))
  const allPaths = [...new Set([...localMap.keys(), ...remoteMap.keys(), ...dirtyChanged])]
    .filter((file) => !file.startsWith(".git/"))
    .sort()

  const files = allPaths.map((file) => {
    const localItem = localMap.get(file) || null
    const remoteItem = remoteMap.get(file) || null
    const dirtyItem = dirtyChanged.includes(file)
    const overlap = Boolean(localItem && remoteItem)
    return {
      path: file,
      localStatus: localItem?.status || (dirtyItem ? "WT" : null),
      remoteStatus: remoteItem?.status || null,
      dirty: dirtyItem,
      review: classifyConflictFile(vault, { file, base, localHead, remoteRef, localItem, remoteItem, dirtyItem }),
      recommendation: recommendConflictAction({ localItem, remoteItem, dirtyItem, overlap }),
    }
  })

  const overlapping = files.filter((file) => file.localStatus && file.remoteStatus)
  const localOnly = files.filter((file) => file.localStatus && !file.remoteStatus)
  const remoteOnly = files.filter((file) => !file.localStatus && file.remoteStatus)
  const localAhead = run("git", ["merge-base", "--is-ancestor", remoteHead, localHead], { cwd: vault, allowFail: true }).status === 0
  const localBehind = run("git", ["merge-base", "--is-ancestor", localHead, remoteHead], { cwd: vault, allowFail: true }).status === 0

  return {
    status: "ok",
    safeToAutoPull: !dirty && localBehind,
    checkedAt: new Date().toISOString(),
    branch: config.branch,
    base,
    localHead,
    remoteHead,
    workingTreeDirty: Boolean(dirty),
    relationship: localHead === remoteHead ? "equal" : localBehind ? "behind" : localAhead ? "ahead" : "diverged",
    summary: {
      filesChanged: files.length,
      overlappingFiles: overlapping.length,
      localOnlyFiles: localOnly.length,
      remoteOnlyFiles: remoteOnly.length,
      dirtyFiles: dirtyChanged.length,
    },
    files,
    decisionOptions: buildConflictDecisionOptions({ files, dirty, localBehind, localAhead, overlapping }),
    nextDecision: conflictNextDecision({ dirty, overlapping, localBehind, localAhead, localHead, remoteHead }),
    guardrails: [
      "Do not auto-merge memory conflicts.",
      "Preserve provenance from both sides until a human approves the semantic decision.",
      "If both sides changed the same note, decide truth lifecycle first: apply, supersede, tension, or blocked.",
      "After resolution, run vault health and push only after secret scan passes.",
    ],
  }
}

function changedFiles(vault, range) {
  const output = run("git", ["diff", "--name-status", range], { cwd: vault }).stdout.trim()
  if (!output) return []
  return output.split(/\r?\n/u).map((line) => {
    const [status, ...rest] = line.split(/\t/u)
    const file = rest.at(-1)
    return { status, path: file }
  }).filter((item) => item.path)
}

function dirtyFiles(statusText) {
  if (!statusText) return []
  return statusText.split(/\r?\n/u).map((line) => line.slice(3).trim()).filter(Boolean).sort()
}

function classifyConflictFile(vault, { file, base, localHead, remoteRef, localItem, remoteItem, dirtyItem }) {
  if (!file.toLowerCase().endsWith(".md")) {
    return { type: "structural-or-config", semanticRisk: "medium", reason: "Non-Markdown memory support file changed." }
  }
  if (dirtyItem && !localItem && !remoteItem) {
    return { type: "local-draft", semanticRisk: "medium", reason: "Uncommitted local note is not in Git history yet." }
  }
  if (localItem && remoteItem) {
    const baseText = gitShowText(vault, base, file)
    const localText = gitShowText(vault, localHead, file)
    const remoteText = gitShowText(vault, remoteRef, file)
    const lifecycleSignals = detectLifecycleSignals(`${localText}\n${remoteText}`)
    return {
      type: "same-note-changed",
      semanticRisk: "high",
      reason: "Both local and remote changed the same Markdown note.",
      lifecycleSignals,
      lineDelta: {
        localAddedLines: addedLineCount(baseText, localText),
        remoteAddedLines: addedLineCount(baseText, remoteText),
      },
    }
  }
  if (localItem) return { type: "local-only", semanticRisk: dirtyItem ? "medium" : "low", reason: "Only local history changed this note." }
  if (remoteItem) return { type: "remote-only", semanticRisk: "low", reason: "Only remote history changed this note." }
  return { type: "working-tree-only", semanticRisk: "medium", reason: "Only the working tree changed this note." }
}

function gitShowText(vault, ref, file) {
  const result = run("git", ["show", `${ref}:${file.replaceAll("\\", "/")}`], { cwd: vault, allowFail: true })
  return result.status === 0 ? result.stdout : ""
}

function detectLifecycleSignals(text) {
  const signals = []
  for (const term of ["APPLIED", "TENSION", "BLOCKED", "SUPERSEDED", "STALE", "DEPRECATED", "rollback", "provenance"]) {
    if (text.toLowerCase().includes(term.toLowerCase())) signals.push(term)
  }
  return signals
}

function addedLineCount(before, after) {
  if (!after) return 0
  const beforeLines = new Set(before.split(/\r?\n/u))
  return after.split(/\r?\n/u).filter((line) => line.trim() && !beforeLines.has(line)).length
}

function recommendConflictAction({ localItem, remoteItem, dirtyItem, overlap }) {
  if (overlap) return "Ask user to choose memory lifecycle: merge both, prefer one side, mark stale, or create TENSION."
  if (dirtyItem) return "Review and commit/stash the local draft before pulling."
  if (localItem && !remoteItem) return "Keep local commit, then push after remote review."
  if (!localItem && remoteItem) return "Safe candidate to pull after local worktree is clean."
  return "Review manually."
}

function buildConflictDecisionOptions({ files, dirty, localBehind, localAhead, overlapping }) {
  const options = []
  if (!dirty && localBehind && overlapping.length === 0) {
    options.push(decisionOption(
      "merge-compatible",
      "Remote is ahead and no overlapping note conflict is detected.",
      "Fast-forward pull is mechanically safe after ordinary health checks.",
    ))
  }
  if (!dirty && !localBehind && !localAhead && overlapping.length === 0 && files.length > 0) {
    options.push(decisionOption(
      "merge-compatible",
      "Local and remote histories diverged, but they changed different memory files.",
      "Review both file sets, then merge both sides while preserving provenance.",
    ))
  }
  if (localAhead && files.every((file) => !file.remoteStatus)) {
    options.push(decisionOption(
      "prefer-local",
      "Local memory is ahead only.",
      "Push after secret scan and user approval of durable memory publication.",
    ))
  }
  if (files.some((file) => file.remoteStatus && !file.localStatus)) {
    options.push(decisionOption(
      "prefer-remote",
      "Remote-only memory exists.",
      "Pull or inspect remote-only notes when local worktree is clean.",
    ))
  }
  if (overlapping.length > 0) {
    options.push(
      decisionOption(
        "merge-compatible",
        "Both sides changed the same note but the meanings may be additive.",
        "Preserve provenance from both sides and verify no current/stale contradiction.",
      ),
      decisionOption(
        "supersede-local",
        "Remote memory is newer or better evidenced than local memory.",
        "Mark local claim superseded instead of deleting it silently.",
      ),
      decisionOption(
        "supersede-remote",
        "Local memory is newer or better evidenced than remote memory.",
        "Mark remote claim superseded instead of deleting it silently.",
      ),
      decisionOption(
        "create-tension",
        "Both sides may be true in different scopes or evidence is insufficient.",
        "Keep both claims visible with TENSION and required evidence.",
      ),
      decisionOption(
        "blocked-needs-evidence",
        "Neither side has enough provenance to choose safely.",
        "Stop sync resolution and ask for the smallest missing evidence.",
      ),
    )
  }
  if (dirty) {
    options.push(decisionOption(
      "blocked-needs-evidence",
      "Working tree has uncommitted memory.",
      "Commit, stash, or discard the local draft before sync decisions.",
    ))
  }
  return dedupeDecisionOptions(options)
}

function decisionOption(id, when, action) {
  return { id, when, action, requiresUserApproval: id !== "merge-compatible" }
}

function dedupeDecisionOptions(options) {
  const seen = new Set()
  return options.filter((option) => {
    const key = `${option.id}:${option.when}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function conflictNextDecision({ dirty, overlapping, localBehind, localAhead, localHead, remoteHead }) {
  if (localHead === remoteHead && !dirty) return "No conflict: local and remote match."
  if (dirty) return "Working tree has uncommitted memory. Ask whether to commit, stash, or discard the draft before sync."
  if (overlapping.length > 0) return "Semantic conflict: review overlapping notes with the user before merge or rewrite."
  if (localBehind) return "Fast-forward auto-pull is safe."
  if (localAhead) return "Local is ahead only. Push after secret scan and user-approved durable patch."
  return "Histories diverged without same-file overlap. A merge may be mechanically simple, but ask user before creating a merge commit."
}

function renderConflictAssistMarkdown(report) {
  const lines = []
  lines.push("# Memory Sync Conflict Assist")
  lines.push("")
  lines.push(`Checked: ${report.checkedAt}`)
  lines.push(`Status: ${report.status}`)
  if (report.detail) lines.push(`Detail: ${report.detail}`)
  lines.push(`Safe to auto-pull: ${report.safeToAutoPull ? "yes" : "no"}`)
  if (report.relationship) lines.push(`Relationship: ${report.relationship}`)
  lines.push("")
  lines.push("## Next Decision")
  lines.push("")
  lines.push(report.nextDecision || "Review required.")
  if (report.summary) {
    lines.push("")
    lines.push("## Summary")
    lines.push("")
    lines.push(`- Files changed: ${report.summary.filesChanged}`)
    lines.push(`- Overlapping files: ${report.summary.overlappingFiles}`)
    lines.push(`- Local-only files: ${report.summary.localOnlyFiles}`)
    lines.push(`- Remote-only files: ${report.summary.remoteOnlyFiles}`)
    lines.push(`- Dirty files: ${report.summary.dirtyFiles}`)
  }
  if (report.files?.length) {
    lines.push("")
    lines.push("## Files")
    lines.push("")
    lines.push("| File | Local | Remote | Risk | Recommendation |")
    lines.push("|---|---|---|---|---|")
    for (const file of report.files) {
      lines.push(`| ${file.path} | ${file.localStatus || "-"} | ${file.remoteStatus || "-"} | ${file.review.semanticRisk} | ${file.recommendation} |`)
    }
  }
  if (report.decisionOptions?.length) {
    lines.push("")
    lines.push("## Decision Options")
    lines.push("")
    lines.push("| Option | When | Action | User approval |")
    lines.push("|---|---|---|---|")
    for (const option of report.decisionOptions) {
      lines.push(`| ${option.id} | ${option.when} | ${option.action} | ${option.requiresUserApproval ? "yes" : "no"} |`)
    }
  }
  if (report.guardrails?.length) {
    lines.push("")
    lines.push("## Guardrails")
    lines.push("")
    for (const guardrail of report.guardrails) lines.push(`- ${guardrail}`)
  }
  lines.push("")
  return `${lines.join("\n")}\n`
}

function push() {
  const vault = requireVault()
  const config = readConfig(vault)
  const message = option("--message", `memory: update brain snapshot ${new Date().toISOString().slice(0, 10)}`)
  return withSyncLock(vault, () => pushUnlocked(vault, config, message))
}

function pushUnlocked(vault, config, message) {
  const findings = scanVault(vault)
  if (findings.length) {
    console.error("Refusing to push because secret-like values were found:")
    for (const finding of findings) console.error(`- ${finding.file}: ${finding.name} (${finding.sample})`)
    throw new Error("SECRET_FOUND: push aborted due to secret-like values in vault")
  }
  const remoteBranch = run("git", ["ls-remote", "--exit-code", "--heads", "origin", config.branch], {
    cwd: vault,
    allowFail: true,
  })
  if (remoteBranch.status === 0) {
    run("git", ["fetch", "origin", config.branch], { cwd: vault })
    const localHead = run("git", ["rev-parse", "--verify", "HEAD"], { cwd: vault, allowFail: true })
    if (localHead.status === 0) {
      const remoteRef = `refs/remotes/origin/${config.branch}`
      const remoteIsAncestor = run("git", ["merge-base", "--is-ancestor", remoteRef, "HEAD"], {
        cwd: vault,
        allowFail: true,
      })
      if (remoteIsAncestor.status !== 0) {
        throw new Error("REMOTE_CHANGED: pull and review remote memory before committing local changes")
      }
    }
  }
  run("git", ["add", "-A"], { cwd: vault })
  const staged = run("git", ["diff", "--cached", "--quiet"], { cwd: vault, allowFail: true })
  if (staged.status === 0) {
    console.log("No memory changes to push.")
    return
  }
  run("git", ["commit", "-m", message], { cwd: vault })
  run("git", ["push", "-u", "origin", config.branch], { cwd: vault })
  console.log("Brain memory pushed.")
}

function conflictPlan() {
  const reportFile = requiredOption("--conflict-report")
  const out = option("--out")
  if (!out) throw new Error("Missing --out for conflict plan output")
  const report = readJsonFile(reportFile)

  if (!Array.isArray(report.decisionOptions)) {
    throw new Error("INVALID_CONFLICT_REPORT: missing decisionOptions array")
  }

  // Determine which files have same-note semantic conflicts
  const sameNoteConflictFiles = new Set(
    (report.files || [])
      .filter((f) => f.review?.type === "same-note-changed")
      .map((f) => f.path),
  )

  // Categorize files by change type
  const overlappingFiles = new Set(
    (report.files || [])
      .filter((f) => f.localStatus && f.remoteStatus)
      .map((f) => f.path),
  )
  const localOnlyFiles = new Set(
    (report.files || [])
      .filter((f) => f.localStatus && !f.remoteStatus)
      .map((f) => f.path),
  )
  const remoteOnlyFiles = new Set(
    (report.files || [])
      .filter((f) => f.remoteStatus && !f.localStatus)
      .map((f) => f.path),
  )
  const dirtyFiles = (report.files || []).filter((f) => f.dirty).map((f) => f.path).sort()

  // Deterministic hash from report content for repeatable plan IDs
  const hash = crypto.createHash("sha256").update(JSON.stringify({
    decisionOptions: report.decisionOptions,
    files: (report.files || []).map((f) => `${f.path}:${f.localStatus}:${f.remoteStatus}:${f.review?.type}`),
  })).digest("hex").slice(0, 12)

  const entries = report.decisionOptions.map((option) => {
    let affectedFiles = []
    let hasSameNoteConflict = false

    if (option.id === "merge-compatible" && report.relationship === "behind") {
      // Fast-forward safe: all remote-changed files
      affectedFiles = [...new Set([...overlappingFiles, ...remoteOnlyFiles])].sort()
      hasSameNoteConflict = false
    } else if (option.id === "merge-compatible" && report.relationship === "diverged") {
      affectedFiles = [...new Set([...overlappingFiles, ...localOnlyFiles, ...remoteOnlyFiles])].sort()
      hasSameNoteConflict = overlappingFiles.size > 0 && sameNoteConflictFiles.size > 0
    } else if (option.id === "prefer-local") {
      affectedFiles = [...localOnlyFiles].sort()
      hasSameNoteConflict = false
    } else if (option.id === "prefer-remote") {
      affectedFiles = [...remoteOnlyFiles].sort()
      hasSameNoteConflict = false
    } else if (["supersede-local", "supersede-remote", "create-tension", "blocked-needs-evidence"].includes(option.id)) {
      affectedFiles = [...overlappingFiles].sort()
      hasSameNoteConflict = sameNoteConflictFiles.size > 0
    }

    return {
      optionId: option.id,
      when: option.when,
      action: option.action,
      affectedFiles,
      hasSameNoteConflict,
      requiresUserApproval: option.requiresUserApproval !== false,
      approved: false,
    }
  })

  const plan = {
    version: 1,
    id: `conflict-plan-${hash}`,
    generatedAt: new Date().toISOString(),
    conflictCheckedAt: report.checkedAt || "",
    vault: report.vault || "",
    relationship: report.relationship || "",
    guardrails: report.guardrails || [],
    dirtyFiles,
    entries,
  }

  const target = path.resolve(out)
  writeJsonFile(target, plan)
  console.log(`Conflict plan written: ${target}`)
  console.log("Review each entry and set approved=true only for the user-approved resolution decisions.")
}

function conflictApply() {
  const vault = requireVault()
  const planFile = requiredOption("--plan")
  const dryRun = flag("--dry-run")

  if (!flag("--approve") && !dryRun) {
    throw new Error("Refusing conflict apply without --approve after explicit user approval")
  }

  const plan = readJsonFile(planFile)
  if (!Array.isArray(plan.entries)) {
    throw new Error("INVALID_CONFLICT_PLAN: missing entries array")
  }

  // Dynamic worktree check: don't trust stale plan.dirtyFiles metadata
  // Only check tracked changes — untracked files (like the plan itself) don't block
  const statusResult = run("git", ["status", "--porcelain"], { cwd: vault, allowFail: true })
  const dirtyFiles = statusResult.status === 0 && statusResult.stdout.trim()
    ? statusResult.stdout.trim().split(/\r?\n/u).filter(Boolean).filter((l) => !l.startsWith("??"))
    : []
  if (dirtyFiles.length > 0 && !dryRun) {
    throw new Error(`Working tree has uncommitted changes. Commit/stash before applying conflict plan: ${dirtyFiles.join(", ")}`)
  }

  const approved = plan.entries.filter((e) => e.approved === true)
  if (approved.length === 0) {
    console.log("No approved entries in the conflict plan. Nothing to apply.")
    return
  }

  // Block any approved entry that involves same-note semantic conflict
  const semanticBlocked = approved.filter((e) => e.hasSameNoteConflict)
  if (semanticBlocked.length > 0) {
    console.error("BLOCKED: The following approved entries involve same-note semantic conflicts that require manual resolution:")
    for (const entry of semanticBlocked) {
      console.error(`  - ${entry.optionId}: ${entry.when}`)
      console.error(`    Affected files: ${entry.affectedFiles.join(", ")}`)
      console.error(`    Manual action: ${entry.action}`)
    }
    throw new Error("SEMANTIC_CONFLICT_BLOCKED: Apply the user's lifecycle decision to each affected note file manually; this command cannot auto-resolve same-note semantic conflicts.")
  }

  const safeEntries = approved.filter((e) => !e.hasSameNoteConflict)
  if (safeEntries.length === 0) {
    console.log("No safely applicable entries remain after blocking semantic conflicts.")
    return
  }

  if (dryRun) {
    console.log(`Conflict apply dry-run: ${safeEntries.length} safe approved entry/entries`)
    for (const entry of safeEntries) {
      console.log(`  [${entry.optionId}] ${entry.action}`)
    }
    return
  }

  // Apply mechanically safe entries
  let applied = 0
  for (const entry of safeEntries) {
    if (entry.optionId === "merge-compatible" && plan.relationship === "behind") {
      const config = readConfig(vault)
      const branch = config.branch || "main"
      run("git", ["pull", "--ff-only", "origin", branch], { cwd: vault })
      console.log(`Applied: fast-forward pull from origin/${branch}`)
      applied++
    } else if (entry.optionId === "prefer-remote" && plan.relationship === "behind") {
      const config = readConfig(vault)
      const branch = config.branch || "main"
      run("git", ["pull", "--ff-only", "origin", branch], { cwd: vault })
      console.log(`Applied: fast-forward pull from origin/${branch}`)
      applied++
    } else {
      console.log(`Skipped: ${entry.optionId} (${entry.action}) - requires separate command or manual steps.`)
    }
  }

  console.log(`Conflict apply complete: ${applied} action(s) applied, ${safeEntries.length - applied} action(s) skipped.`)
}

function curationApply() {
  const planFile = requiredOption("--plan")

  if (!flag("--approve")) {
    throw new Error("Refusing curation apply without --approve after explicit user approval")
  }

  const vault = requireVault()
  const plan = readJsonFile(planFile)

  // Find auto-applicable approved candidates across all recommendations
  const candidates = []
  if (Array.isArray(plan.recommendations)) {
    for (const rec of plan.recommendations) {
      if (Array.isArray(rec.patchCandidates)) {
        for (const candidate of rec.patchCandidates) {
          if (candidate.autoApplicable === true && candidate.requiresHumanReview === false && candidate.approved === true) {
            candidates.push({ recommendationId: rec.id, ...candidate })
          }
        }
      }
    }
  }

  if (candidates.length === 0) {
    console.log("No auto-applicable candidates found.")
    console.log("Only candidates with autoApplicable: true, requiresHumanReview: false, and approved: true can be applied.")
    console.log("The current curation recommender does not emit auto-applicable candidates.")
    console.log("To apply: edit the plan file and set the three required flags on desired patchCandidates.")
    return
  }

  // Apply auto-applicable candidates
  let applied = 0
  let skipped = 0

  for (const candidate of candidates) {
    if (candidate.type === "alias-patch-candidate") {
      let targetPath
      try {
        const safeRelative = safeMigrationPath(candidate.target, "curation candidate target")
        targetPath = path.join(vault, safeRelative)
        assertRealPathInsideVault(fs, vault, targetPath, "curation candidate target")
      } catch (error) {
        console.log(`Skipped alias-patch: unsafe target ${candidate.target} (${error.message})`)
        skipped++
        continue
      }
      if (!fs.existsSync(targetPath)) {
        console.log(`Skipped alias-patch: target file not found: ${targetPath}`)
        skipped++
        continue
      }
      const aliases = candidate.proposed?.addAliases
      if (!Array.isArray(aliases) || aliases.length === 0) {
        console.log(`Skipped alias-patch: no aliases to add for ${candidate.target}`)
        skipped++
        continue
      }
      let content = fs.readFileSync(targetPath, "utf8")
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
      if (fmMatch) {
        if (fmMatch[1].includes("aliases:")) {
          console.log(`Skipped alias-patch: ${candidate.target} already has aliases in frontmatter.`)
          skipped++
          continue
        }
        const aliasLine = `aliases: [${aliases.map((a) => `"${a.replace(/"/gu, '\\"')}"`).join(", ")}]`
        // Preserve original line ending style from frontmatter block
        const lineEnding = fmMatch[0].includes("\r\n") ? "\r\n" : "\n"
        const newContent = content.replace(fmMatch[0], `---${lineEnding}${fmMatch[1]}${lineEnding}${aliasLine}${lineEnding}---`)
        writeFileAtomic(targetPath, newContent)
        console.log(`Applied alias-patch: added aliases to ${candidate.target}`)
        applied++
      } else {
        // No frontmatter — add it
        const aliasLine = `aliases: [${aliases.map((a) => `"${a.replace(/"/gu, '\\"')}"`).join(", ")}]`
        const newContent = `---\n${aliasLine}\n---\n${content}`
        writeFileAtomic(targetPath, newContent)
        console.log(`Applied alias-patch: added frontmatter with aliases to ${candidate.target}`)
        applied++
      }
    } else {
      console.log(`Skipped: ${candidate.type} - not yet auto-applicable. Requires manual review or a separate tool.`)
      skipped++
    }
  }

  console.log(`Curation apply complete: ${applied} applied, ${skipped} skipped.`)
}

try {
  if (!command || command === "--help" || command === "-h" || flag("--help") || command === "help") usage(0)
  if (command === "adoption-plan") adoptionPlan()
  else if (command === "bootstrap") bootstrap()
  else if (command === "detect") detect()
  else if (command === "doctor") doctor()
  else if (command === "health") health()
  else if (command === "recall") recall()
  else if (command === "recall-loop") recallLoop()
  else if (command === "recall-managed") await recallManaged()
  else if (command === "recall-explore") await recallExplore()
  else if (command === "curate-plan") await curatePlan()
  else if (command === "config") await configureRuntime()
  else if (command === "recall-rerank") recallRerank()
  else if (command === "recall-semantic") await recallSemantic()
  else if (command === "curation-recommend") curationRecommend()
  else if (command === "lifecycle-audit") lifecycleAudit()
  else if (command === "init") init()
  else if (command === "status") status()
  else if (command === "sync-plan") syncPlan()
  else if (command === "auto-pull") autoPull()
  else if (command === "conflict-assist") conflictAssist()
  else if (command === "pull") pull()
  else if (command === "push") push()
  else if (command === "restructure-plan") restructurePlan()
  else if (command === "restructure-apply") restructureApply()
  else if (command === "audit") audit()
  else if (command === "lint") lint()
  else if (command === "brain-session-brief") brainSessionBrief()
  else if (command === "restructure-verify") restructureVerify()
  else if (command === "restructure-rollback") restructureRollback()
  else if (command === "conflict-plan") conflictPlan()
  else if (command === "conflict-apply") conflictApply()
  else if (command === "curation-apply") curationApply()
  else usage(2)
} catch (error) {
  if (["recall-managed", "recall-explore", "curate-plan"].includes(command) && flag("--agent")) {
    console.log(JSON.stringify({ error: error.message, retryable: /HTTP 429|HTTP 529|fetch failed|timeout/iu.test(error.message) }))
  } else if (flag("--verbose")) {
    console.error(error.stack || error.message)
  } else {
    console.error(error.message)
  }
  process.exit(1)
}
