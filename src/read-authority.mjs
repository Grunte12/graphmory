import { inspectCurationCheckpoint } from "./curation-checkpoint.mjs"

function errorCode(error) {
  const match = /^([A-Z][A-Z0-9_]+):/u.exec(String(error?.message ?? ""))
  if (match?.[1]) return match[1]
  if (["EACCES", "EPERM", "EIO", "ENOENT", "ENOTDIR"].includes(error?.code)) return "CHECKPOINT_STATE_UNREADABLE"
  return "READ_AUTHORITY_UNAVAILABLE"
}

function blockedDecision(checkpoint) {
  const operationStatus = checkpoint?.status ?? "unknown"
  return {
    ok: false,
    status: "BLOCKED",
    code: operationStatus === "interrupted-state-lock" ? "CHECKPOINT_STATE_BUSY" : "CURATION_PENDING",
    ...(checkpoint?.operation ? { operation: checkpoint.operation } : {}),
    operationStatus,
    nextAction: checkpoint?.nextAction ?? "inspect curation-checkpoint status before reading memory",
  }
}

function failedDecision(error) {
  return {
    ok: false,
    status: "BLOCKED",
    code: errorCode(error),
    nextAction: "inspect checkpoint state; do not use memory until its authority status is readable",
  }
}

// Agent-facing content routes use this boundary. Low-level readers intentionally
// remain raw primitives for checkpoint preparation, verification, and recovery.
export function beginAgentRead({ vault, stateRoot, inspect = inspectCurationCheckpoint } = {}) {
  try {
    const checkpoint = inspect({ vault, stateRoot })
    if (!checkpoint || typeof checkpoint.authorityToken !== "string") {
      return failedDecision(new Error("CHECKPOINT_STATE_UNREADABLE: authority token is missing"))
    }
    if (checkpoint.blocked) return blockedDecision(checkpoint)
    return { ok: true, authorityToken: checkpoint.authorityToken, checkpoint }
  } catch (error) {
    return failedDecision(error)
  }
}

export function finishAgentRead({ vault, stateRoot, authorityToken, inspect = inspectCurationCheckpoint } = {}) {
  try {
    const checkpoint = inspect({ vault, stateRoot })
    if (!checkpoint || typeof checkpoint.authorityToken !== "string") {
      return failedDecision(new Error("CHECKPOINT_STATE_UNREADABLE: authority token is missing"))
    }
    if (checkpoint.blocked || checkpoint.authorityToken !== authorityToken) {
      return {
        ok: false,
        status: "BLOCKED",
        code: "STATE_CHANGED_DURING_READ",
        ...(checkpoint.operation ? { operation: checkpoint.operation } : {}),
        operationStatus: checkpoint.status ?? "unknown",
        nextAction: "discard this read and inspect checkpoint status before retrying",
      }
    }
    return { ok: true, authorityToken: checkpoint.authorityToken, checkpoint }
  } catch (error) {
    return failedDecision(error)
  }
}

export function requireCurrentAgentRead({ vault, stateRoot, authorityToken, inspect = inspectCurationCheckpoint } = {}) {
  const decision = finishAgentRead({ vault, stateRoot, authorityToken, inspect })
  if (decision.ok) return decision
  const error = new Error(`${decision.code}: ${decision.nextAction}`)
  error.authorityDecision = decision
  throw error
}

export async function withAgentReadAuthority({ vault, stateRoot, inspect, read } = {}) {
  if (typeof read !== "function") throw new TypeError("read must be a function")
  const start = beginAgentRead({ vault, stateRoot, inspect })
  if (!start.ok) return start
  const value = await read(start.checkpoint)
  const end = finishAgentRead({ vault, stateRoot, authorityToken: start.authorityToken, inspect })
  return end.ok ? { ok: true, authorityToken: end.authorityToken, value } : end
}

export function blockedReadEnvelope(decision) {
  return {
    status: "BLOCKED",
    code: decision.code,
    ...(decision.operation ? { operation: decision.operation } : {}),
    ...(decision.operationStatus ? { operationStatus: decision.operationStatus } : {}),
    nextAction: decision.nextAction,
    results: [],
  }
}
