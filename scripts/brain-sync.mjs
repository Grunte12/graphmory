#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import {
  analyzeVaultHealth,
  applyRestructureManifest,
  assertSafeToBootstrap,
  buildAdoptionPlan,
  buildRestructureManifest,
  buildSyncPlan,
  initialBrainFiles,
  inspectMemoryRoot,
  makeSyncConfig,
  renderAdoptionPlanMarkdown,
  rollbackRestructureRecord,
  scanTextForSecrets,
  validateRestructureManifest,
  verifyRestructureRecord,
} from "../src/brain-sync.mjs"
import { recallVault, recallVaultLoop } from "../src/memory-recall.mjs"
import { recallVaultSemantic } from "../src/semantic-recall.mjs"
import { buildCurationRecommendations, renderCurationRecommendations } from "../src/curation-recommendations.mjs"
import { auditMemoryLifecycle } from "../src/memory-lifecycle-audit.mjs"
import { writeFileAtomic, writeJsonAtomic } from "../src/atomic-write.mjs"

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
  out.write(`Memory Patch Harness brain sync\n\n`)
  out.write(`Usage:\n`)
  out.write(`  node scripts/brain-sync.mjs adoption-plan --vault <path> [--out <file>] [--json]\n`)
  out.write(`  node scripts/brain-sync.mjs bootstrap --vault <path> --repo <owner/repo> [--create-remote]\n`)
  out.write(`  node scripts/brain-sync.mjs detect --vault <path> [--json]\n`)
  out.write(`  node scripts/brain-sync.mjs doctor [--vault <path>] [--json] [--require-github]\n`)
  out.write(`  node scripts/brain-sync.mjs health --vault <path> [--json] [--out <file>]\n`)
  out.write(`  node scripts/brain-sync.mjs recall --vault <path> --query <text> [--method bm25f-sections] [--k 3] [--scope <path>] [--json]\n`)
  out.write(`  node scripts/brain-sync.mjs recall-loop --vault <path> --query <text> [--scope <path>] [--k 3] [--json]\n`)
  out.write(`  node scripts/brain-sync.mjs recall-semantic --vault <path> --query <text> [--scope <path>] [--model Xenova/bge-small-en-v1.5] [--k 3] [--json]\n`)
  out.write(`  node scripts/brain-sync.mjs curation-recommend --report <eval-report.json> --queries <queries.json> [--method governed-bm25f-sections] [--json]\n`)
  out.write(`  node scripts/brain-sync.mjs lifecycle-audit --vault <path> [--json] [--out <file>]\n`)
  out.write(`  node scripts/brain-sync.mjs init --vault <path> --repo <owner/repo> [--create-remote]\n`)
  out.write(`  node scripts/brain-sync.mjs status --vault <path>\n`)
  out.write(`  node scripts/brain-sync.mjs sync-plan --vault <path> [--patches <count>] [--session-end] [--handoff] [--high-risk] [--json]\n`)
  out.write(`  node scripts/brain-sync.mjs auto-pull --vault <path> [--json] [--strict]\n`)
  out.write(`  node scripts/brain-sync.mjs conflict-assist --vault <path> [--json] [--out <file>]\n`)
  out.write(`  node scripts/brain-sync.mjs pull --vault <path>\n`)
  out.write(`  node scripts/brain-sync.mjs push --vault <path> [--message <msg>]\n\n`)
  out.write(`  node scripts/brain-sync.mjs restructure-plan --vault <path> [--out <file>]\n`)
  out.write(`  node scripts/brain-sync.mjs restructure-apply --vault <path> --plan <file> --approve\n`)
  out.write(`  node scripts/brain-sync.mjs restructure-verify --vault <path> --record <file>\n`)
  out.write(`  node scripts/brain-sync.mjs restructure-rollback --vault <path> --record <file> --approve\n\n`)
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
  const vault = option("--vault")
  if (!vault) {
    console.error("Missing --vault")
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
      const createArgs = ["repo", "create", config.repo, `--${config.visibility}`, "--description", "Markdown memory managed by Memory Patch Harness"]
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
  const vaultOption = option("--vault")
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
    console.log(`Memory Patch Harness doctor: ${report.ok ? "PASS" : "FAIL"}`)
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
  })
  if (flag("--json")) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  console.log(`Memory recall: ${report.confidence} confidence; ${report.results.length} result(s)`)
  for (const result of report.results) {
    console.log(`- ${result.path} | ${result.title} | score ${result.score}`)
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
  const methods = option("--methods", "bm25f-sections,bm25f-focused-sections,bm25-sections")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  const report = recallVaultLoop(vault, query, {
    methods,
    k,
    includeNoncanonical: flag("--include-noncanonical"),
    includeRawPaths: flag("--include-raw-paths"),
    scope: option("--scope", ""),
  })
  if (flag("--json")) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  console.log(`Memory recall loop: ${report.confidence} confidence; ${report.results.length} fused result(s)`)
  for (const result of report.results) {
    console.log(`- ${result.path} | ${result.title} | score ${result.score} | lanes ${result.lanes.join(",")}`)
  }
  if (report.needsExpansion) {
    console.log("Expansion required:")
    for (const step of report.nextSteps) console.log(`- ${step}`)
  }
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
    process.exit(1)
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

try {
  if (!command || command === "--help" || command === "-h" || flag("--help") || command === "help") usage(0)
  if (command === "adoption-plan") adoptionPlan()
  else if (command === "bootstrap") bootstrap()
  else if (command === "detect") detect()
  else if (command === "doctor") doctor()
  else if (command === "health") health()
  else if (command === "recall") recall()
  else if (command === "recall-loop") recallLoop()
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
  else if (command === "restructure-verify") restructureVerify()
  else if (command === "restructure-rollback") restructureRollback()
  else usage(2)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
