import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { scanTextForSecrets } from "./brain-sync.mjs"

// Git sync for a vault, shared by the CLI and the MCP sync tool. Pull only fast-forwards;
// push refuses secrets and a remote that moved. Neither ever merges or rewrites history.
const failure = (code, message, extra = {}) => Object.assign(new Error(`${code}: ${message}`), { publicCode: code, ...extra })

export function git(vault, args, { allowFail = false } = {}) {
  const result = spawnSync("git", args, { cwd: vault, encoding: "utf8", shell: false })
  if (result.error?.code === "ENOENT" || result.status === null) throw failure("COMMAND_NOT_FOUND", "'git' is not available on PATH")
  if (result.status !== 0 && !allowFail) {
    const detail = `${result.stderr || result.stdout || ""}`.trim().split(/\r?\n/u)[0]
    throw failure("COMMAND_FAILED", `git ${args[0]} exited with ${result.status}${detail ? `: ${detail}` : ""}`, { stdout: result.stdout, stderr: result.stderr })
  }
  return result
}

export function syncConfigPath(vault) {
  return path.join(vault, ".memory-patch-harness", "brain-sync.json")
}

export function readSyncConfig(vault) {
  if (!fs.existsSync(syncConfigPath(vault))) return null
  try { return JSON.parse(fs.readFileSync(syncConfigPath(vault), "utf8")) } catch { return { unreadable: true } }
}

// Local view only: ahead/behind compares with the last fetched remote branch.
export function localSyncState(vault) {
  const config = readSyncConfig(vault)
  if (!config) return { configured: false }
  if (config.unreadable) return { configured: false, problem: "unreadable-config" }
  const branch = typeof config.branch === "string" ? config.branch : "main"
  const base = { configured: true, repo: config.repo, branch }
  let inside
  try { inside = git(vault, ["rev-parse", "--is-inside-work-tree"], { allowFail: true }) }
  catch { return { ...base, git: "unavailable" } }
  if (inside.status !== 0) return { ...base, git: "not-a-repository" }
  const dirty = git(vault, ["status", "--porcelain"]).stdout.trim()
  const counts = git(vault, ["rev-list", "--left-right", "--count", `refs/remotes/origin/${branch}...HEAD`], { allowFail: true })
  const [behind, ahead] = counts.stdout.trim().split(/\s+/u).map(Number)
  return { ...base, git: "ok", changedFiles: dirty ? dirty.split(/\r?\n/u).length : 0,
    ...(counts.status === 0 ? { commitsAhead: ahead, commitsBehind: behind } : { remoteBranch: "not-fetched" }) }
}

export function restructureActive(vault) {
  return fs.existsSync(path.join(vault, ".memory-patch-harness", "restructure.lock"))
}

export function withSyncLock(vault, action) {
  const gitPath = git(vault, ["rev-parse", "--git-path", "memory-patch-harness-sync.lock"]).stdout.trim()
  const lock = path.isAbsolute(gitPath) ? gitPath : path.join(vault, gitPath)
  fs.mkdirSync(path.dirname(lock), { recursive: true })
  let handle
  try { handle = fs.openSync(lock, "wx") } catch { throw failure("SYNC_BUSY", `another sync operation may be running: ${lock}`) }
  try { return action() } finally {
    fs.closeSync(handle)
    fs.rmSync(lock, { force: true })
  }
}

function trackedFiles(vault) {
  return git(vault, ["ls-files", "--others", "--cached", "--exclude-standard"]).stdout
    .split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
}

export function scanVaultForSecrets(vault) {
  const findings = []
  for (const relativePath of trackedFiles(vault)) {
    const file = path.join(vault, relativePath)
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue
    if (!["", ".md", ".json", ".txt", ".yaml", ".yml", ".csv"].includes(path.extname(file).toLowerCase())) continue
    for (const finding of scanTextForSecrets(fs.readFileSync(file, "utf8"))) findings.push({ file: relativePath, ...finding })
  }
  return findings
}

function report(status, safeToContinue, detail) {
  return { status, safeToContinue, detail, checkedAt: new Date().toISOString() }
}

/** Fetch and fast-forward. A dirty tree, a diverged history or a failed fetch is reported, never merged. */
export function pullMemory(vault, { branch }) {
  try {
    return withSyncLock(vault, () => {
      if (restructureActive(vault)) return report("blocked-restructure", false, "A memory restructure operation is active")
      if (git(vault, ["status", "--porcelain"]).stdout.trim()) return report("skipped-dirty", false, "Local memory changes must be reviewed before pull")
      const fetched = git(vault, ["fetch", "origin", branch], { allowFail: true })
      if (fetched.status !== 0) {
        return report("offline-or-auth-failed", false, `${fetched.stderr || fetched.stdout || "fetch failed"}`.trim().split(/\r?\n/u)[0])
      }
      const remoteRef = `refs/remotes/origin/${branch}`
      const remote = git(vault, ["rev-parse", "--verify", remoteRef], { allowFail: true })
      if (remote.status !== 0) return report("remote-branch-missing", true, `No remote branch ${branch} yet`)
      const local = git(vault, ["rev-parse", "--verify", "HEAD"], { allowFail: true })
      if (local.status !== 0) return report("local-history-missing", false, "Local vault has no baseline commit")
      const localHead = local.stdout.trim(), remoteHead = remote.stdout.trim()
      if (localHead === remoteHead) return report("up-to-date", true, "Local and remote memory match")
      if (git(vault, ["merge-base", "--is-ancestor", localHead, remoteHead], { allowFail: true }).status === 0) {
        git(vault, ["merge", "--ff-only", remoteRef])
        return report("updated", true, `Fast-forwarded to ${remoteHead.slice(0, 12)}`)
      }
      if (git(vault, ["merge-base", "--is-ancestor", remoteHead, localHead], { allowFail: true }).status === 0) {
        return report("local-ahead", true, "Local commits are not yet pushed")
      }
      return report("diverged", false, "Local and remote memory histories diverged; semantic review is required")
    })
  } catch (error) {
    if (error.publicCode !== "SYNC_BUSY") throw error
    return report("sync-busy", false, error.message)
  }
}

// Every changed path with a hash of its current bytes, so an approval binds what was shown.
export function pendingChanges(vault) {
  const entries = git(vault, ["status", "--porcelain=v1", "-z", "-uall"]).stdout.split("\0").filter(Boolean)
  const changes = []
  for (let index = 0; index < entries.length; index++) {
    const code = entries[index].slice(0, 2), file = entries[index].slice(3)
    if (/[RC]/u.test(code)) index++ // The next entry is the rename source.
    const absolute = path.join(vault, file)
    const bytes = fs.existsSync(absolute) && fs.statSync(absolute).isFile() ? fs.readFileSync(absolute) : null
    changes.push({ path: file, change: code.trim() || code, sha256: bytes ? createHash("sha256").update(bytes).digest("hex") : null })
  }
  const head = git(vault, ["rev-parse", "--verify", "HEAD"], { allowFail: true })
  const snapshot = createHash("sha256").update(JSON.stringify([head.stdout.trim(), changes])).digest("hex")
  return { changes, snapshot }
}

function unpushedCommits(vault, branch, remoteExists) {
  if (git(vault, ["rev-parse", "--verify", "HEAD"], { allowFail: true }).status !== 0) return 0
  if (!remoteExists) return 1
  return Number(git(vault, ["rev-list", "--count", `refs/remotes/origin/${branch}..HEAD`]).stdout.trim())
}

/**
 * Commit everything and push. With expectedSnapshot, the tree must still match the
 * changes the owner approved; anything newer is refused instead of being pushed unseen.
 */
export function pushMemory(vault, { branch }, message, { expectedSnapshot } = {}) {
  return withSyncLock(vault, () => {
    const findings = scanVaultForSecrets(vault)
    if (findings.length) throw failure("SECRET_FOUND", "push aborted due to secret-like values in vault", { findings })
    if (expectedSnapshot && pendingChanges(vault).snapshot !== expectedSnapshot) {
      throw failure("CHANGED_DURING_REVIEW", "memory changed after the owner approved the push")
    }
    const remoteBranch = git(vault, ["ls-remote", "--exit-code", "--heads", "origin", branch], { allowFail: true })
    if (remoteBranch.status === 0) {
      git(vault, ["fetch", "origin", branch])
      if (git(vault, ["rev-parse", "--verify", "HEAD"], { allowFail: true }).status === 0
        && git(vault, ["merge-base", "--is-ancestor", `refs/remotes/origin/${branch}`, "HEAD"], { allowFail: true }).status !== 0) {
        throw failure("REMOTE_CHANGED", "pull and review remote memory before committing local changes")
      }
    }
    git(vault, ["add", "-A"])
    if (git(vault, ["diff", "--cached", "--quiet"], { allowFail: true }).status !== 0) git(vault, ["commit", "-m", message])
    else if (!unpushedCommits(vault, branch, remoteBranch.status === 0)) return { status: "no-changes" }
    git(vault, ["push", "-u", "origin", branch])
    return { status: "pushed", commit: git(vault, ["rev-parse", "HEAD"]).stdout.trim() }
  })
}
