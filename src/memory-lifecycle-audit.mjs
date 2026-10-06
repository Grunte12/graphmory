import { loadVaultDocuments } from "./memory-recall.mjs"
import { createNoteLinkResolver } from "./brain-sync.mjs"
import { isValidUntilExpired, validUntilState } from "./lifecycle-date.mjs"

const EXPIRED_STATUSES = new Set(["stale", "superseded", "deprecated", "archived"])
const ACTIVE_STATUSES = new Set(["active", "current", "applied"])
const CONFLICT_STATUSES = new Set(["tension", "blocked", "conflict"])
const STALE_LANGUAGE = /\b(stale|superseded|deprecated|obsolete|no longer valid)\b/giu
const WIKILINK = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/gu
const HISTORICAL_PREDECESSOR_PHRASE = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]\s+(?:for\s+the\s+)?(?<marker>stale|superseded|deprecated|obsolete|no\s+longer\s+valid)\s+(?:predecessor|(?:prior|previous|earlier)\s+(?:rule|policy|record|version))\b/giu
const REPLACEMENT_KEYS = ["superseded_by", "superseded-by", "replacement", "replaced_by", "replaced-by"]

export function auditMemoryLifecycle(vault, {
  includeRawPaths = false,
  maxFiles = 5000,
  now = new Date(),
} = {}) {
  const documents = loadVaultDocuments(vault, { includeRawPaths, maxFiles })
  const contextDocuments = includeRawPaths
    ? documents
    : loadVaultDocuments(vault, { includeRawPaths: true, maxFiles })
  const findings = auditDocuments(documents, now, {
    inventoryComplete: contextDocuments.length < maxFiles,
    contextDocuments,
  })
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

/**
 * Audits documents using a complete relationship inventory so explicit
 * historical links can be checked against predecessor and successor metadata.
 * Set inventoryComplete=true only after that inventory is known to be
 * complete. The default is fail-closed for filtered or truncated inputs.
 */
export function auditDocuments(documents, now = new Date(), { inventoryComplete = false, contextDocuments = documents } = {}) {
  if (!Array.isArray(documents)) throw new TypeError("documents must be an array")
  if (!Array.isArray(contextDocuments)) throw new TypeError("contextDocuments must be an array")
  const context = inventoryComplete ? createLifecycleContext(contextDocuments) : null
  const findings = []
  for (const document of documents) {
    const historicalMarkers = context ? provenHistoricalMarkers(document, context, now) : new Set()
    findings.push(...auditDocumentWithMarkers(document, now, historicalMarkers))
  }
  return findings
}

export function auditDocument(document, now = new Date()) {
  return auditDocumentWithMarkers(document, now, new Set())
}

function auditDocumentWithMarkers(document, now, historicalMarkers) {
  const findings = []
  const metadata = document.metadata ?? {}
  const status = lifecycleStatus(metadata)
  const text = document.markdown ?? document.text ?? ""
  const prose = maskNonProse(text)
  const lowerText = text.toLowerCase()
  const validUntil = validUntilState(document)
  const revalidateWhen = parseDate(metadataValue(metadata, ["revalidate_when", "revalidate-when", "revalidate"]))
  const hasReplacement = hasAny(metadata, ["supersedes", "superseded_by", "superseded-by", "replacement", "replaced_by", "replaced-by"])
    || /\b(supersedes|superseded by|replacement|replaced by|valid_until|revalidate_when)\b/iu.test(text)

  if (validUntil.present && !validUntil.valid) {
    findings.push(finding("high", "invalid-valid-until", document, "valid_until is invalid or ambiguous and cannot establish current authority.", "Correct the date to YYYY-MM-DD or an explicitly timezone-qualified timestamp."))
  } else if (validUntil.present && isValidUntilExpired(validUntil, now)) {
    findings.push(finding("high", "expired-valid-until", document, "valid_until has expired.", "Revalidate this note before using it as current memory."))
  }

  if (revalidateWhen && revalidateWhen <= now && !EXPIRED_STATUSES.has(status)) {
    findings.push(finding("medium", "revalidation-due", document, `revalidate_when ${revalidateWhen.toISOString().slice(0, 10)} is due.`, "Refresh evidence or mark the memory stale/tension if it cannot be verified."))
  }

  const changedSources = document.summaryFreshness?.changedSources ?? []
  if (changedSources.length) {
    findings.push(finding("medium", "summary-source-changed", document, `Summary is stale because its sources changed: ${changedSources.join(", ")}.`, "Recheck the summary against the current sources, then refresh it through the approved patch workflow or retire it."))
  }

  // A summary marked stale only because of its sources has no authored status to replace.
  if (EXPIRED_STATUSES.has(status) && !hasReplacement && !document.summaryFreshness) {
    findings.push(finding("medium", "obsolete-without-replacement", document, `Lifecycle is ${status} but no replacement/supersession marker was found.`, "Add replaced_by, superseded_by, or a short replacement note so future agents do not resurrect stale context."))
  }

  if ((ACTIVE_STATUSES.has(status) || status === "unknown") && hasUnexplainedStaleLanguage(prose, historicalMarkers)) {
    findings.push(finding("medium", "active-note-has-stale-language", document, "Active/current note contains stale or obsolete language.", "Split the obsolete part into TENSION/BLOCKED or mark the affected section with replacement guidance."))
  }

  if ((CONFLICT_STATUSES.has(status) || /\bTENSION\b/u.test(prose)) && !hasDecisionPath(prose)) {
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

function createLifecycleContext(documents) {
  const byPath = new Map()
  const duplicatePaths = new Set()
  for (const document of documents) {
    if (byPath.has(document.id)) duplicatePaths.add(document.id)
    else byPath.set(document.id, document)
  }
  const resolver = createNoteLinkResolver(documents.map((document) => ({
    path: document.id,
    title: document.title ?? document.id,
    text: document.markdown ?? document.text ?? "",
  })))
  return { byPath, duplicatePaths, resolver }
}

function provenHistoricalMarkers(document, context, now) {
  const markers = new Set()
  if (context.duplicatePaths.has(document.id)) return markers
  const prose = maskNonProse(document.markdown ?? document.text ?? "")
  const successorPaths = resolvedWikiLinks(prose, document.id, context)
  if (!successorPaths.size) return markers

  for (const match of prose.matchAll(HISTORICAL_PREDECESSOR_PHRASE)) {
    const predecessorReference = match[1].trim()
    const predecessorResolution = context.resolver(predecessorReference, document.id)
    if (!predecessorResolution.resolved) continue
    const predecessorPath = predecessorResolution.path
    if (context.duplicatePaths.has(predecessorPath)) continue
    const predecessor = context.byPath.get(predecessorPath)
    if (!predecessor || lifecycleStatus(predecessor.metadata ?? {}) !== "superseded") continue

    const replacementPath = exactReplacementPath(predecessor.metadata ?? {})
    if (!replacementPath || context.duplicatePaths.has(replacementPath)) continue
    const successor = context.byPath.get(replacementPath)
    if (!successor || !ACTIVE_STATUSES.has(lifecycleStatus(successor.metadata ?? {}))) continue
    if (!successorPaths.has(successor.id)) continue
    if (!isCurrentSuccessor(successor, now)) continue
    if (!supersedesPath(successor.metadata ?? {}, predecessor.id)) continue

    const marker = match.groups?.marker
    const markerOffset = marker ? match.index + match[0].lastIndexOf(marker) : -1
    if (markerOffset >= 0) markers.add(markerOffset)
  }
  return markers
}

function isCurrentSuccessor(document, now) {
  const state = validUntilState(document)
  return state.valid && (!state.present || !isValidUntilExpired(state, now))
}

function exactReplacementPath(metadata) {
  const keys = REPLACEMENT_KEYS.filter((key) => Object.hasOwn(metadata, key) && metadata[key] !== "")
  if (keys.length !== 1) return null
  const value = metadata[keys[0]]
  const targets = Array.isArray(value) ? value : [value]
  if (targets.length !== 1 || typeof targets[0] !== "string" || !targets[0] || targets[0] !== targets[0].trim()) return null
  return targets[0]
}

function supersedesPath(metadata, predecessorPath) {
  const value = metadata.supersedes
  const paths = Array.isArray(value) ? value : typeof value === "string" ? [value] : []
  return paths.some((item) => typeof item === "string" && item === predecessorPath)
}

function resolvedWikiLinks(text, fromFile, context) {
  const resolved = new Set()
  for (const match of text.matchAll(WIKILINK)) {
    const result = context.resolver(match[1].trim(), fromFile)
    if (result.resolved && !context.duplicatePaths.has(result.path)) resolved.add(result.path)
  }
  return resolved
}

function hasUnexplainedStaleLanguage(text, historicalMarkers) {
  const prose = text
  for (const match of prose.matchAll(STALE_LANGUAGE)) {
    if (!historicalMarkers.has(match.index)) return true
  }
  return false
}

function hasDecisionPath(text) {
  const prose = maskNonProse(text)
  const field = /^[ \t]*(?:[-*+][ \t]*)?(?:decision|owner|next[ _-]?step|required evidence|evidence required|evidence|resolver|review path|review)[ \t]*:[ \t]*(?<value>[^\r\n]*)/gimu
  const emptyOrUnresolved = /^(?:none\b|n\/?a\b|unknown\b|pending\b|tbd\b|unassigned\b|undecided\b|unresolved\b|no\s+(?:decision|owner|next step|evidence|resolver|review)\b|not\s+(?:decided|assigned|resolved|known|available|selected|determined)\b|to be determined\b)/iu
  for (const match of prose.matchAll(field)) {
    const value = match.groups?.value?.trim() ?? ""
    if (value && !emptyOrUnresolved.test(value)) return true
  }

  // Preserve a concrete narrative path without treating a bare mention of
  // "owner", "decision", or "evidence" as proof that a path exists.
  return /\b(?:the\s+)?(?:owner|reviewer|maintainer|lead|committee|resolver)\s+(?:will|must|should)\s+(?:review|resolve|reconcile|decide|compare|verify)\b[^\r\n]{1,180}\b(?:by|after|when|once|at)\b[^\r\n]{1,100}/iu.test(prose)
}

function maskNonProse(markdown) {
  const blank = (value) => value.replace(/[^\r\n]/g, " ")
  return String(markdown)
    .replace(/^---[ \t]*\r?\n[\s\S]*?^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/mu, blank)
    .replace(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?\1/gu, blank)
    .replace(/`+[^`\r\n]*`+/gu, blank)
    .replace(/<!--[\s\S]*?-->/gu, blank)
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
    } else if (item.kind === "invalid-valid-until") {
      actions.push({ ...base, action: "revalidate", type: "invalid-valid-until", target: "valid_until" })
    } else if (item.kind === "revalidation-due") {
      actions.push({ ...base, action: "revalidate", type: "revalidation-due", target: "revalidate_when" })
    } else if (item.kind === "summary-source-changed") {
      actions.push({ ...base, action: "recheck-summary", type: "summary-source-changed", target: "summary_sources" })
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
