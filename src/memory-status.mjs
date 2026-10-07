import { inspectCurationCheckpoint } from "./curation-checkpoint.mjs"
import { listReviews } from "./review-queue.mjs"
import { analyzeVaultHealth, buildSyncPlan } from "./brain-sync.mjs"
import { localSyncState, restructureActive } from "./vault-sync.mjs"
import { auditMemoryLifecycle } from "./memory-lifecycle-audit.mjs"

// One read-only picture of the vault for the agent: an interrupted write, memory waiting for the
// owner, lifecycle and link health, and the local Git state. Nothing here writes or fetches.
const LIST_LIMIT = 10
const SYNC_HINTS = {
  "push-ready": "Memory is ready to sync. Call sync with action: \"push\"; the owner approves the push in the host's question UI.",
  "pull-first": "Remote memory is newer. Call sync with action: \"pull\" before pushing.",
  "human-review": "Local and remote memory histories diverged. Tell the owner; they review it with `graphmory conflict-assist` in a terminal.",
  blocked: "Sync is blocked by a vault health or restructure finding. Tell the owner.",
}
export const RESTORABLE = new Set(["pending", "recovery-in-progress", "interrupted-registration"])

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
  if (sync.git === "ok") {
    const plan = buildSyncPlan({ changedFiles: sync.changedFiles, commitsAhead: sync.commitsAhead ?? 0, commitsBehind: sync.commitsBehind ?? 0,
      healthCritical: health.summary.critical, restructureActive: restructureActive(vault) })
    sync.plan = { decision: plan.decision, reason: plan.reason }
  }
  const next = []
  if (pending?.restorable) next.push("An interrupted memory write blocks recall and remember. Call status with ask: \"recovery\" so the owner can restore the notes it touched.")
  else if (pending) next.push(`Pending curation state "${pending.state}" needs the owner. Ask them to run \`graphmory curation-checkpoint status\` in a terminal.`)
  if (reviews.length) next.push(`${reviews.length} memory item(s) wait for the owner. Call status with ask: "reviews" so the owner can decide them.`)
  const due = lifecycle.summary.high + lifecycle.summary.medium
  if (due) next.push(`${due} note(s) need lifecycle attention; recall them, check with the user, then file updates with remember.`)
  if (health.summary.critical) next.push(`${health.summary.critical} critical vault health finding(s); tell the owner.`)
  const syncHint = SYNC_HINTS[sync.plan?.decision]
  if (syncHint) next.push(syncHint)
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
