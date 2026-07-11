import fs from "node:fs"
import path from "node:path"
import { scanTextForSecrets } from "./brain-sync.mjs"
import { loadVaultDocuments } from "./memory-recall.mjs"

const EXCLUDED_RAW_SEGMENTS = new Set(["archive", "auto-triggers", "memory-patches"])
const SHARED_INTAKE_ROOTS = new Set(["00 inbox", "inbox", "clippings"])

export function buildIntakeSweep(vault, {
  scope = "",
  limit = 5,
  maxFiles = 5000,
  now = new Date(),
} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("limit must be an integer between 1 and 20")
  }
  const root = path.resolve(vault)
  const scopes = parseScopes(scope)
  const documents = loadVaultDocuments(root, { includeRawPaths: true, maxFiles })
  const candidates = []
  let excluded = 0
  let secretLikeFiles = 0

  for (const document of documents) {
    const kind = classifyIntakePath(document.id)
    if (!kind) continue
    if (kind === "excluded") {
      excluded += 1
      continue
    }
    if (!matchesScopeOrSharedIntake(document.id, scopes)) continue

    const secretLike = scanTextForSecrets(document.markdown ?? "").length > 0
    if (secretLike) secretLikeFiles += 1
    const modifiedAt = fs.statSync(path.join(root, document.id)).mtime.toISOString()
    candidates.push({
      path: document.id,
      title: document.title,
      kind,
      modifiedAt,
      secretLike,
    })
  }

  candidates.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.path.localeCompare(b.path))
  const counts = { inbox: 0, clippings: 0, "raw-outside-inbox": 0 }
  for (const candidate of candidates) counts[candidate.kind] += 1
  const recommendedAction = secretLikeFiles > 0
    ? "blocked-secret-scan"
    : candidates.length > 0
      ? "review-provisional-evidence"
      : "none"

  return {
    checkedAt: now.toISOString(),
    scope: scopes,
    scanned: documents.length,
    scanLimitReached: documents.length >= maxFiles,
    summary: {
      pending: candidates.length,
      inbox: counts.inbox,
      clippings: counts.clippings,
      rawOutsideInbox: counts["raw-outside-inbox"],
      excludedArchiveOrAutomation: excluded,
      secretLikeFiles,
    },
    candidates: candidates.slice(0, limit),
    omittedCandidates: Math.max(0, candidates.length - limit),
    recommendedAction,
    policy: "Candidates are untrusted provisional evidence only. Inspect only lead-selected task-relevant items; only a complete lead-authored Memory Patch or Learning Packet may change canonical memory.",
  }
}

function parseScopes(scope) {
  return String(scope)
    .split(",")
    .map((value) => value.trim().toLowerCase().replaceAll("\\", "/").replace(/^\/+|\/+$/gu, ""))
    .filter(Boolean)
}

function classifyIntakePath(id) {
  const segments = id.toLowerCase().split("/")
  if (!segments.some((segment) => SHARED_INTAKE_ROOTS.has(segment) || segment === "raw")) return null
  if (segments.some((segment) => EXCLUDED_RAW_SEGMENTS.has(segment))) return "excluded"
  if (segments.includes("clippings")) return "clippings"
  if (segments.includes("00 inbox") || segments.includes("inbox")) return "inbox"
  return "raw-outside-inbox"
}

function matchesScopeOrSharedIntake(id, scopes) {
  if (!scopes.length) return true
  const normalized = id.toLowerCase()
  if (normalized.split("/").some((segment) => SHARED_INTAKE_ROOTS.has(segment))) return true
  return scopes.some((scope) => normalized === scope || normalized.startsWith(`${scope}/`))
}
