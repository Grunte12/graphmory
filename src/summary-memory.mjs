import { createHash } from "node:crypto"
import path from "node:path"
import { isRetrievable } from "./retrieval.mjs"

const SHA256 = /^[a-f0-9]{64}$/u
const SOURCE_ENTRY = /^([a-f0-9]{64}) (.+)$/u
const INACTIVE_STATUSES = new Set(["raw", "stale", "superseded", "deprecated", "archived"])

/**
 * Capture exact Markdown-content hashes for a summary's source paths.
 *
 * Entries use a flat frontmatter list (`summary_sources`) so existing
 * Graphmory frontmatter readers can preserve them without a YAML dependency.
 * Each entry is `<sha256> <canonical vault-relative path>`; hashes identify
 * content only and do not grant a source authority or make claims canonical.
 */
export function captureSummaryDependencies(documents, paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error("paths must be a non-empty array")
  }

  const byPath = indexDocuments(documents)
  const uniquePaths = [...new Set(paths.map((value) => canonicalVaultPath(value, "source path")))].sort()
  return uniquePaths.map((sourcePath) => {
    const document = byPath.get(sourcePath)
    if (!document) throw new Error(`SUMMARY_SOURCE_MISSING: ${sourcePath}`)
    const hash = sha256(markdownBytes(document))
    return `${hash} ${sourcePath}`
  })
}

/** Inspect one summary and its transitive summary dependencies. */
export function inspectSummaryFreshness(documents, summaryPath) {
  const byPath = indexDocuments(documents)
  const canonicalPath = canonicalVaultPath(summaryPath, "summary path")
  return inspectPath(canonicalPath, byPath, [], new Map())
}

/**
 * Return document copies with stale summaries marked `status: stale`, plus a
 * sorted report. Callers can pass the copies into normal recall eligibility;
 * the source documents and files are never modified.
 */
export function applySummaryFreshness(documents) {
  const normalized = normalizeDocuments(documents)
  const byPath = indexNormalizedDocuments(normalized)
  const summaryPaths = normalized
    .filter((document) => isSummary(document.metadata))
    .map((document) => document.id)
    .sort()
  const summaries = summaryPaths.map((summaryPath) => inspectPath(summaryPath, byPath, [], new Map()))
  const statusByPath = new Map(summaries.map((report) => [report.path, report.status]))
  const updatedDocuments = normalized.map((document) => {
    if (statusByPath.get(document.id) !== "stale") return cloneDocument(document)
    return {
      ...cloneDocument(document),
      metadata: { ...document.metadata, status: "stale" },
    }
  })

  return {
    documents: updatedDocuments,
    summaries,
    freshCount: summaries.filter((report) => report.status === "fresh").length,
    staleCount: summaries.filter((report) => report.status === "stale").length,
  }
}

function inspectPath(summaryPath, byPath, stack, memo) {
  if (stack.length >= 128) return { path: summaryPath, status: "stale", reasons: [{ code: "summary-depth-limit", path: summaryPath }] }
  if (stack.includes(summaryPath)) {
    const cycleStart = stack.indexOf(summaryPath)
    const cycle = [...stack.slice(cycleStart), summaryPath]
    return {
      path: summaryPath,
      status: "stale",
      reasons: [{ code: "summary-cycle", path: summaryPath, cycle }],
    }
  }
  if (memo.has(summaryPath)) return memo.get(summaryPath)

  const document = byPath.get(summaryPath)
  if (!document) {
    const missing = { path: summaryPath, status: "stale", reasons: [{ code: "summary-missing", path: summaryPath }] }
    memo.set(summaryPath, missing)
    return missing
  }

  const reasons = []
  if (!isSummary(document.metadata)) {
    reasons.push({ code: "not-a-summary", path: summaryPath })
  }
  const status = lifecycleStatus(document.metadata)
  if (INACTIVE_STATUSES.has(status) || !isRetrievable(document)) {
    reasons.push({ code: "summary-inactive", path: summaryPath, sourceStatus: status })
  }

  const sourceEntries = summarySourceEntries(document)
  if (!sourceEntries.length) {
    reasons.push({ code: "summary-sources-missing", path: summaryPath })
  }

  for (const entry of [...sourceEntries].sort()) {
    const parsed = parseSourceEntry(entry)
    if (!parsed.ok) {
      reasons.push({ code: parsed.code, path: summaryPath, entry: parsed.entry })
      continue
    }

    const source = byPath.get(parsed.path)
    if (!source) {
      reasons.push({ code: "source-missing", path: parsed.path })
      continue
    }

    const sourceStatus = lifecycleStatus(source.metadata)
    if (INACTIVE_STATUSES.has(sourceStatus) || !isRetrievable(source)) {
      reasons.push({ code: "source-inactive", path: parsed.path, sourceStatus })
    }

    const currentHash = sha256(markdownBytes(source))
    if (currentHash !== parsed.sha256) {
      reasons.push({ code: "source-changed", path: parsed.path, expectedSha256: parsed.sha256, actualSha256: currentHash })
    }

    if (isSummary(source.metadata)) {
      const dependencyReport = inspectPath(parsed.path, byPath, [...stack, summaryPath], memo)
      if (dependencyReport.status === "stale") {
        reasons.push({
          code: "summary-dependency-stale",
          path: parsed.path,
          causes: reasonCodes(dependencyReport.reasons),
        })
      }
    }
  }

  const report = { path: summaryPath, status: reasons.length ? "stale" : "fresh", reasons: sortReasons(reasons) }
  memo.set(summaryPath, report)
  return report
}

function parseSourceEntry(value) {
  if (typeof value !== "string") return { ok: false, code: "source-entry-invalid", entry: String(value) }
  const match = SOURCE_ENTRY.exec(value)
  if (!match || !SHA256.test(match[1])) return { ok: false, code: "source-entry-invalid", entry: value }
  try {
    const sourcePath = canonicalVaultPath(match[2], "summary source path")
    return { ok: true, sha256: match[1], path: sourcePath }
  } catch {
    return { ok: false, code: "source-path-unsafe", entry: value }
  }
}

function summarySourceEntries(document) {
  const value = document.metadata?.summary_sources ?? frontmatterValue(document.markdown, "summary_sources")
  if (Array.isArray(value)) return value.map((item) => String(item))
  // Also accept a structured mapping from callers which already parse YAML.
  // The persisted format remains the flat list documented above.
  if (value && typeof value === "object") {
    return Object.entries(value).map(([sourcePath, hash]) => `${String(hash)} ${sourcePath}`)
  }
  if (typeof value === "string" && value.trim()) return [value.trim()]
  return []
}

function frontmatterValue(markdown, wantedKey) {
  if (typeof markdown !== "string" || !markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) return undefined
  const lines = markdown.split(/\r?\n/u)
  let closingIndex = -1
  for (let index = 1; index < lines.length; index++) {
    if (lines[index].trim() === "---") { closingIndex = index; break }
  }
  if (closingIndex < 0) return undefined

  const key = wantedKey.toLowerCase()
  const propertyIndex = lines.slice(1, closingIndex).findIndex((line) => {
    const match = /^([A-Za-z0-9_-]+):\s*(.*?)\s*$/u.exec(line)
    return match?.[1].toLowerCase() === key
  })
  if (propertyIndex < 0) return undefined
  const absoluteIndex = propertyIndex + 1
  const property = /^([A-Za-z0-9_-]+):\s*(.*?)\s*$/u.exec(lines[absoluteIndex])
  if (property?.[2]) return cleanScalar(property[2])

  const values = []
  for (let index = absoluteIndex + 1; index < closingIndex; index++) {
    const line = lines[index]
    if (!line.trim()) continue
    const item = /^\s+-\s+(.+?)\s*$/u.exec(line)
    if (item) {
      values.push(cleanScalar(item[1]))
      continue
    }
    if (!/^\s+/u.test(line)) break
  }
  return values
}

function cleanScalar(value) {
  const trimmed = String(value).trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try { return JSON.parse(trimmed) } catch { return trimmed.slice(1, -1) }
  }
  return trimmed.replace(/^'|'$/gu, "")
}

function normalizeDocuments(documents) {
  const entries = documents instanceof Map
    ? [...documents.entries()]
    : Array.isArray(documents)
      ? documents.map((document) => [null, document])
      : documents && typeof documents === "object"
        ? Object.entries(documents)
        : null
  if (!entries) throw new TypeError("documents must be an array, Map, or object")

  return entries.map(([key, value]) => {
    const document = typeof value === "string" ? { markdown: value } : value
    if (!document || typeof document !== "object") throw new TypeError("each document must include Markdown content")
    const id = canonicalVaultPath(document.id ?? document.path ?? key, "document path")
    const markdown = document.markdown ?? document.content
    if (typeof markdown !== "string") throw new TypeError(`document ${id} must include Markdown content`)
    return {
      ...document,
      id,
      markdown,
      metadata: {
        ...parseSimpleFrontmatter(markdown),
        ...(document.metadata && typeof document.metadata === "object" ? document.metadata : {}),
      },
    }
  })
}

function parseSimpleFrontmatter(markdown) {
  const metadata = {}
  const lines = markdown.split(/\r?\n/u)
  if (lines[0] !== "---") return metadata
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---")
  if (end < 0) return metadata
  let listKey = null
  for (const line of lines.slice(1, end)) {
    const property = /^([A-Za-z0-9_-]+):\s*(.*?)\s*$/u.exec(line)
    if (property) {
      listKey = property[1].toLowerCase()
      metadata[listKey] = property[2] ? cleanScalar(property[2]) : []
      continue
    }
    const item = /^\s+-\s+(.+?)\s*$/u.exec(line)
    if (item && listKey && Array.isArray(metadata[listKey])) {
      metadata[listKey].push(cleanScalar(item[1]))
      continue
    }
    if (line.trim()) listKey = null
  }
  return metadata
}

function indexDocuments(documents) {
  return indexNormalizedDocuments(normalizeDocuments(documents))
}

function indexNormalizedDocuments(documents) {
  const indexed = new Map()
  for (const document of documents) {
    if (indexed.has(document.id)) throw new Error(`SUMMARY_DOCUMENT_DUPLICATE: ${document.id}`)
    indexed.set(document.id, document)
  }
  return indexed
}

function canonicalVaultPath(value, label) {
  if (typeof value !== "string" || value.length === 0 || /[\u0000-\u001f\u007f]/u.test(value) || !value.toLowerCase().endsWith(".md")) {
    throw new Error(`${label} must be a canonical relative path`)
  }
  if (value.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(value) || value.includes("\\")) {
    throw new Error(`${label} must stay inside the vault`)
  }
  const segments = value.split("/")
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment === ".git" || segment === "node_modules")) {
    throw new Error(`${label} must be a canonical relative path`)
  }
  if (path.posix.normalize(value) !== value) throw new Error(`${label} must be a canonical relative path`)
  return value
}

function markdownBytes(document) {
  if (Buffer.isBuffer(document.bytes) || document.bytes instanceof Uint8Array) return Buffer.from(document.bytes)
  return Buffer.from(document.markdown, "utf8")
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function isSummary(metadata) {
  return String(metadata?.memory_kind ?? "").trim().toLowerCase() === "summary"
}

function lifecycleStatus(metadata) {
  return String(metadata?.status ?? metadata?.lifecycle ?? "current").trim().toLowerCase()
}

function sortReasons(reasons) {
  const unique = new Map()
  for (const reason of reasons) {
    const key = JSON.stringify(reason)
    unique.set(key, reason)
  }
  return [...unique.values()].sort((left, right) => {
    const codeOrder = compareStrings(left.code, right.code)
    if (codeOrder !== 0) return codeOrder
    const pathOrder = compareStrings(String(left.path ?? ""), String(right.path ?? ""))
    return pathOrder || compareStrings(JSON.stringify(left), JSON.stringify(right))
  })
}

function reasonCodes(reasons) {
  const codes = new Set()
  const add = (reason) => {
    codes.add(reason.code)
    for (const cause of reason.causes ?? []) codes.add(cause)
  }
  reasons.forEach(add)
  return [...codes].sort(compareStrings)
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function cloneDocument(document) {
  return { ...document, metadata: { ...document.metadata } }
}
