import { loadVaultDocuments } from "./memory-recall.mjs"

const EXPIRED_STATUSES = new Set(["stale", "superseded", "deprecated", "archived"])
const ACTIVE_STATUSES = new Set(["active", "current", "applied"])
const CONFLICT_STATUSES = new Set(["tension", "blocked", "conflict"])

export function auditMemoryLifecycle(vault, {
  includeRawPaths = false,
  maxFiles = 5000,
  now = new Date(),
} = {}) {
  const documents = loadVaultDocuments(vault, { includeRawPaths, maxFiles })
  const findings = []
  for (const document of documents) {
    findings.push(...auditDocument(document, now))
  }
  const actions = summarizeLifecycleActions(findings)
  return {
    checkedAt: now.toISOString(),
    scanned: documents.length,
    scanLimitReached: documents.length >= maxFiles,
    summary: summarizeFindings(findings),
    actions,
    findings,
  }
}

export function auditDocument(document, now = new Date()) {
  const findings = []
  const metadata = document.metadata ?? {}
  const status = lifecycleStatus(metadata)
  const text = document.markdown ?? document.text ?? ""
  const lowerText = text.toLowerCase()
  const validUntil = parseDate(metadataValue(metadata, ["valid_until", "valid-until", "validuntil"]))
  const revalidateWhen = parseDate(metadataValue(metadata, ["revalidate_when", "revalidate-when", "revalidate"]))
  const hasReplacement = hasAny(metadata, ["supersedes", "superseded_by", "superseded-by", "replacement", "replaced_by", "replaced-by"])
    || /\b(supersedes|superseded by|replacement|replaced by|valid_until|revalidate_when)\b/iu.test(text)

  if (validUntil && validUntil < now) {
    findings.push(finding("high", "expired-valid-until", document, `valid_until ${validUntil.toISOString().slice(0, 10)} is in the past.`, "Revalidate this note before using it as current memory."))
  }

  if (revalidateWhen && revalidateWhen <= now && !EXPIRED_STATUSES.has(status)) {
    findings.push(finding("medium", "revalidation-due", document, `revalidate_when ${revalidateWhen.toISOString().slice(0, 10)} is due.`, "Refresh evidence or mark the memory stale/tension if it cannot be verified."))
  }

  if (EXPIRED_STATUSES.has(status) && !hasReplacement) {
    findings.push(finding("medium", "obsolete-without-replacement", document, `Lifecycle is ${status} but no replacement/supersession marker was found.`, "Add replaced_by, superseded_by, or a short replacement note so future agents do not resurrect stale context."))
  }

  if ((ACTIVE_STATUSES.has(status) || status === "unknown") && /\b(stale|superseded|deprecated|obsolete|no longer valid)\b/iu.test(text)) {
    findings.push(finding("medium", "active-note-has-stale-language", document, "Active/current note contains stale or obsolete language.", "Split the obsolete part into TENSION/BLOCKED or mark the affected section with replacement guidance."))
  }

  if ((CONFLICT_STATUSES.has(status) || /\bTENSION\b/u.test(text)) && !/\b(decision|owner|blocked|next step|resolve|evidence)\b/iu.test(text)) {
    findings.push(finding("medium", "tension-without-decision-path", document, "Tension/conflict marker found without a clear decision path.", "Add owner, required evidence, and next decision so agents do not guess."))
  }

  if (status === "raw" && !document.id.toLowerCase().startsWith("00 inbox/")) {
    findings.push(finding("low", "raw-memory-outside-inbox", document, "Raw lifecycle/status appears outside the Inbox.", "Move raw capture to Inbox or promote it into curated memory with provenance."))
  }

  if (status === "unknown" && isLikelyCanonical(document.id)) {
    findings.push(finding("info", "missing-lifecycle-status", document, "Canonical-looking note has no explicit lifecycle/status metadata.", "Add status/lifecycle when the note becomes durable operational memory."))
  }

  if (lowerText.includes("todo") && lowerText.includes("revalidate") && !revalidateWhen) {
    findings.push(finding("info", "revalidation-mentioned-without-date", document, "Revalidation is mentioned but no revalidate_when date was found.", "Add a date when the memory should be checked again."))
  }

  return findings
}

function lifecycleStatus(metadata) {
  return String(metadata.status ?? metadata.lifecycle ?? "unknown").trim().toLowerCase()
}

function metadataValue(metadata, keys) {
  for (const key of keys) {
    if (metadata[key] !== undefined && metadata[key] !== "") return metadata[key]
  }
  return ""
}

function hasAny(metadata, keys) {
  return keys.some((key) => metadata[key] !== undefined && metadata[key] !== "")
}

function parseDate(value) {
  if (!value) return null
  const match = String(value).match(/\d{4}-\d{2}-\d{2}/u)
  if (!match) return null
  const date = new Date(`${match[0]}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function finding(severity, kind, document, detail, recommendation) {
  return {
    severity,
    kind,
    file: document.id,
    title: document.title,
    detail,
    recommendation,
  }
}

function isLikelyCanonical(id) {
  const lower = id.toLowerCase()
  return !lower.startsWith("00 inbox/") && !lower.startsWith("clippings/") && !lower.includes("/archive/")
}

function summarizeFindings(findings) {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: findings.length }
  for (const item of findings) {
    if (summary[item.severity] !== undefined) summary[item.severity] += 1
  }
  return summary
}

function summarizeLifecycleActions(findings) {
  const actions = []
  for (const item of findings) {
    const base = { file: item.file, reason: item.detail }
    if (item.kind === "expired-valid-until") {
      actions.push({ ...base, action: "revalidate", type: "expired-valid-until", target: "valid_until" })
    } else if (item.kind === "revalidation-due") {
      actions.push({ ...base, action: "revalidate", type: "revalidation-due", target: "revalidate_when" })
    } else if (item.kind === "obsolete-without-replacement") {
      actions.push({ ...base, action: "add-replacement-marker", type: "obsolete-without-replacement", target: "supersedes/superseded_by" })
    } else if (item.kind === "active-note-has-stale-language") {
      actions.push({ ...base, action: "split-or-mark-tension", type: "active-note-has-stale-language", target: "content" })
    } else if (item.kind === "tension-without-decision-path") {
      actions.push({ ...base, action: "add-decision-path", type: "tension-without-decision-path", target: "content" })
    } else if (item.kind === "raw-memory-outside-inbox") {
      actions.push({ ...base, action: "triage-raw-memory", type: "raw-memory-outside-inbox", target: "file-location" })
    } else if (item.kind === "missing-lifecycle-status") {
      actions.push({ ...base, action: "add-lifecycle-when-durable", type: "missing-lifecycle-status", target: "frontmatter" })
    }
  }
  return actions
}
