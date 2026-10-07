import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { inspectCurationCheckpoint } from "./curation-checkpoint.mjs"
import { listReviews } from "./review-queue.mjs"
import { analyzeVaultHealth } from "./brain-sync.mjs"
import { auditMemoryLifecycle } from "./memory-lifecycle-audit.mjs"

// One read-only picture of the vault for the agent: an interrupted write, memory waiting for the
// owner, lifecycle and link health, and the local Git state. Nothing here writes or fetches.
const LIST_LIMIT = 10
export const RESTORABLE = new Set(["pending", "recovery-in-progress", "interrupted-registration"])

function git(vault, args) {
  const result = spawnSync("git", args, { cwd: vault, encoding: "utf8", shell: false })
  if (result.error || result.status === null) return { ok: false, missing: true }
  return { ok: result.status === 0, stdout: result.stdout.trim() }
}

export function readSyncConfig(vault) {
  const file = path.join(vault, ".memory-patch-harness", "brain-sync.json")
  if (!fs.existsSync(file)) return null
  try { return JSON.parse(fs.readFileSync(file, "utf8")) } catch { return { unreadable: true } }
}

// Local view only: ahead/behind compares with the last fetched remote branch.
export function localSyncState(vault) {
  const config = readSyncConfig(vault)
  if (!config) return { configured: false }
  if (config.unreadable) return { configured: false, problem: "unreadable-config" }
  const branch = typeof config.branch === "string" ? config.branch : "main"
  const inside = git(vault, ["rev-parse", "--is-inside-work-tree"])
  if (inside.missing) return { configured: true, repo: config.repo, branch, git: "unavailable" }
  if (!inside.ok) return { configured: true, repo: config.repo, branch, git: "not-a-repository" }
  const dirty = git(vault, ["status", "--porcelain"])
  const changedFiles = dirty.ok && dirty.stdout ? dirty.stdout.split(/\r?\n/u).length : 0
  const counts = git(vault, ["rev-list", "--left-right", "--count", `refs/remotes/origin/${branch}...HEAD`])
  const [behind, ahead] = counts.ok ? counts.stdout.split(/\s+/u).map(Number) : [null, null]
  return { configured: true, repo: config.repo, branch, git: "ok", changedFiles,
    ...(counts.ok ? { commitsAhead: ahead, commitsBehind: behind } : { remoteBranch: "not-fetched" }) }
}

function pendingWork(checkpoint) {
  if (!checkpoint.blocked) return null
  return {
    operation: checkpoint.operation, state: checkpoint.status, locked: Boolean(checkpoint.locked),
    targets: checkpoint.targets ?? [], sources: checkpoint.sources ?? [],
    sourceDrift: (checkpoint.sourceDrift ?? []).map(({ path: drifted, status }) => ({ path: drifted, status })),
    ...(checkpoint.unsafeTargets ? { unsafeTargets: checkpoint.unsafeTargets } : {}),
    restorable: Boolean(checkpoint.operation) && RESTORABLE.has(checkpoint.status) && !checkpoint.unsafeTargets,
  }
}

export function memoryStatus({ vault, stateRoot, now = new Date() }) {
  const checkpoint = inspectCurationCheckpoint({ vault, stateRoot })
  const pending = pendingWork(checkpoint)
  const reviews = listReviews({ vault, stateRoot })
  const lifecycle = auditMemoryLifecycle(vault, { now })
  const health = analyzeVaultHealth(vault)
  const sync = localSyncState(vault)
  const next = []
  if (pending?.restorable) next.push("An interrupted memory write blocks recall and remember. Call status with ask: \"recovery\" so the owner can restore the notes it touched.")
  else if (pending) next.push(`Pending curation state "${pending.state}" needs the owner. Ask them to run \`graphmory curation-checkpoint status\` in a terminal.`)
  if (reviews.length) next.push(`${reviews.length} memory item(s) wait for the owner. Call status with ask: "reviews" so the owner can decide them.`)
  const due = lifecycle.summary.high + lifecycle.summary.medium
  if (due) next.push(`${due} note(s) need lifecycle attention; recall them, check with the user, then file updates with remember.`)
  if (health.summary.critical) next.push(`${health.summary.critical} critical vault health finding(s); tell the owner.`)
  if (sync.configured && sync.changedFiles) next.push(`${sync.changedFiles} changed file(s) are not synced to Git yet.`)
  return {
    status: next.length ? "attention" : "ok",
    pending,
    reviews: { count: reviews.length, items: reviews.slice(0, LIST_LIMIT).map(({ reviewId, claim, target, createdAt }) => ({ reviewId, claim, target, createdAt })) },
    lifecycle: { scanned: lifecycle.scanned, ...lifecycle.summary,
      actions: lifecycle.actions.slice(0, LIST_LIMIT).map(({ file, action, reason }) => ({ path: file, action, reason })) },
    health: { ok: health.ok, score: health.score, ...health.summary,
      findings: health.findings.filter(item => item.severity !== "info").slice(0, LIST_LIMIT)
        .map(({ severity, kind, file, detail }) => ({ severity, kind, path: file, detail })) },
    sync,
    next,
  }
}
