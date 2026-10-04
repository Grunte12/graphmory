import fs from "node:fs"
import path from "node:path"
import { governedRank, isAnswerCandidate, isRetrievable, parseMarkdown, sectionFocusRerank } from "./retrieval.mjs"
import { applySummaryFreshness } from "./summary-memory.mjs"
import { applyRetrievalCandidates } from "./retrieval-candidates.mjs"
import { readSourceNotes } from "./source-read.mjs"

const SKIP_DIRECTORIES = new Set([".git", ".obsidian", ".memory-patch-harness", "node_modules"])
const RAW_ROOTS = new Set(["00 inbox", "clippings"])

function isSummaryDocument(document) {
  return String(document.metadata?.memory_kind ?? "").trim().toLowerCase() === "summary"
}

function applyRawPathStatus(document) {
  if (!RAW_ROOTS.has(document.id.split("/")[0].toLowerCase())) return document
  return { ...document, metadata: { ...document.metadata, status: document.metadata.status ?? "raw" } }
}

export function loadVaultDocuments(vault, { includeRawPaths = false, maxFiles = 5000, scope = "", priorDocuments = [] } = {}) {
  const root = path.resolve(vault)
  if (!fs.existsSync(root)) throw new Error(`VAULT_NOT_FOUND: ${root}`)
  if (!fs.statSync(root).isDirectory()) throw new Error(`INVALID_VAULT_PATH: not a directory: ${root}`)
  const documents = []
  const previous = new Map(priorDocuments.map(document => [document.id, document]))
  const scopes = normalizeScopes(scope)
  const stack = [root]
  while (stack.length && documents.length < maxFiles) {
    const directory = stack.pop()
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue
        const relative = path.relative(root, path.join(directory, entry.name)).replaceAll("\\", "/")
        if (!includeRawPaths && RAW_ROOTS.has(relative.split("/")[0].toLowerCase())) continue
        if (scopes.length && !mayContainScope(relative, scopes)) continue
        stack.push(path.join(directory, entry.name))
        continue
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".md") continue
      const file = path.join(directory, entry.name)
      const relative = path.relative(root, file).replaceAll("\\", "/")
      if (scopes.length && !matchesScope(relative, scopes)) continue
      const markdown = fs.readFileSync(file, "utf8")
      const prior = previous.get(relative)
      const document = prior?.markdown === markdown && !isSummaryDocument(prior) ? prior : parseMarkdown(relative, markdown)
      if (RAW_ROOTS.has(relative.split("/")[0].toLowerCase())) {
        document.metadata = { ...document.metadata, status: document.metadata.status ?? "raw" }
      }
      documents.push(document)
      if (documents.length >= maxFiles) break
    }
  }
  documents.sort((a, b) => a.id.localeCompare(b.id))
  if (!documents.some(isSummaryDocument)) return documents
  // Load only named dependencies outside the candidate scope, not the whole vault.
  const dependencyDocuments = new Map(documents.map(document => [document.id, document]))
  const queue = [...documents]
  for (let cursor = 0; cursor < queue.length && dependencyDocuments.size < maxFiles; cursor++) {
    const document = queue[cursor]
    if (!isSummaryDocument(document)) continue
    const entries = document.metadata.summary_sources
    for (const entry of Array.isArray(entries) ? entries : []) {
      const match = String(entry).match(/^[a-f0-9]{64} (.+)$/u)
      if (!match || dependencyDocuments.has(match[1]) || dependencyDocuments.size >= maxFiles) continue
      try {
        const source = readSourceNotes(root, [match[1]]).sources[0]
        const dependency = applyRawPathStatus(parseMarkdown(source.path, source.markdown))
        dependencyDocuments.set(dependency.id, dependency)
        queue.push(dependency)
      } catch { /* Missing/unsafe dependencies mark the summary stale. */ }
    }
  }
  const refreshed = new Map(applySummaryFreshness([...dependencyDocuments.values()]).documents.map(document => [document.id, document]))
  return documents.map(document => refreshed.get(document.id))
}

export function recallVault(vault, query, {
  method = "bm25f-sections",
  k = 3,
  includeNoncanonical = false,
  includeNavigation = false,
  includeRawPaths = false,
  maxFiles = 5000,
  scope = "",
  rerank = false,
} = {}) {
  if (!query?.trim()) throw new Error("query is required")
  if (!Number.isInteger(k) || k < 1 || k > 10) throw new Error("k must be between 1 and 10")
  if (!Number.isInteger(maxFiles) || maxFiles < 1) throw new Error("maxFiles must be positive")
  const documents = loadVaultDocuments(vault, { includeRawPaths, maxFiles, scope })
  const retrieval = governedRank(documents, query, method, { includeNoncanonical, answerCandidatesOnly: !includeNavigation })
  let results = retrieval.results
  if (rerank) {
    results = sectionFocusRerank(results, query, documents)
  }
  return {
    query,
    method,
    k,
    scanned: documents.length,
    scanLimitReached: documents.length >= maxFiles,
    excludedByLifecycle: retrieval.excluded,
    confidence: retrieval.confidence,
    needsExpansion: retrieval.needsExpansion,
    nextSteps: retrieval.nextSteps,
    reranked: rerank,
    results: results.slice(0, k).map((item) => ({
      path: item.id,
      title: item.title,
      score: Number(item.score.toFixed(4)),
      status: item.metadata?.status ?? item.metadata?.lifecycle ?? "current",
      ...(item.rerankApplied !== undefined ? { rerankApplied: item.rerankApplied, rerankSignals: item.rerankSignals } : {}),
    })),
  }
}

export function recallVaultLoop(vault, query, {
  methods = ["bm25", "bm25f-focused-sections"],
  k = 3,
  offset = 0,
  includeNoncanonical = false,
  includeSuperseded = false,
  includeNavigation = false,
  includeRawPaths = false,
  maxFiles = 5000,
  scope = "",
  perMethodLimit = 8,
  shortlistLimit = 0,
  rerank = false,
  documents: suppliedDocuments,
  precomputedRankedLanes = [],
  allowLargePage = false,
  rankImpl,
  pipeline = {},
} = {}) {
  if (!query?.trim()) throw new Error("query is required")
  if (!Number.isInteger(k) || k < 1 || k > (allowLargePage ? maxFiles : 10)) throw new Error(`k must be between 1 and ${allowLargePage ? maxFiles : 10}`)
  if (!Number.isInteger(offset) || offset < 0) throw new Error("offset must be a non-negative integer")
  const documents = suppliedDocuments ?? loadVaultDocuments(vault, { includeRawPaths, maxFiles, scope })
  const lanes = methods.map((method) => {
    const retrieval = governedRank(documents, query, method, { includeNoncanonical, includeSuperseded,
      answerCandidatesOnly: !includeNavigation, rankImpl })
    let laneResults = retrieval.results
    if (rerank) {
      laneResults = sectionFocusRerank(laneResults, query, documents)
    }
    return {
      method,
      confidence: retrieval.confidence,
      needsExpansion: retrieval.needsExpansion,
      results: laneResults.slice(0, perMethodLimit),
      excluded: retrieval.excluded,
    }
  })
  const extraLanes = sanitizePrecomputedLanes(precomputedRankedLanes, documents, {
    scope, includeNoncanonical, includeSuperseded, includeNavigation,
  })
  const rankedLanes = extraLanes.length ? [...lanes, ...extraLanes] : lanes
  const all = fuseRankedLanes(rankedLanes)
  // Preserve the previous first-page ordering; deeper lane results remain reachable.
  const shortlist = shortlistLimit > 0 ? fuseRankedLanes(rankedLanes.map((lane) => ({ ...lane, results: lane.results.slice(0, shortlistLimit) }))).slice(0, 10) : []
  const shortlistIds = new Set(shortlist.map((item) => item.id))
  const ordered = shortlistLimit > 0 ? [...shortlist, ...all.filter((item) => !shortlistIds.has(item.id))] : all
  const candidateReport = applyRetrievalCandidates(ordered, query, documents, pipeline)
  const fused = candidateReport.results
  const top = fused.slice(offset, offset + k)
  const confidence = fused.length === 0
    ? "none"
    : lanes.some((lane) => lane.confidence === "bounded") || fused[0].fusedScore >= 1
      ? "bounded"
      : "low"
  return {
    query,
    methods,
    k,
    offset,
    totalCandidates: fused.length,
    hasMore: offset + k < fused.length,
    nextOffset: offset + k < fused.length ? offset + k : null,
    scanned: documents.length,
    scanLimitReached: documents.length >= maxFiles,
    excludedByLifecycle: Math.max(...lanes.map((lane) => lane.excluded), 0),
    confidence,
    needsExpansion: !candidateReport.abstained && confidence !== "bounded",
    reranked: rerank || candidateReport.reranked,
    ...(candidateReport.abstained ? { status: "abstain", decisionGate: "abstain-floor" } : {}),
    nextSteps: candidateReport.abstained || confidence === "bounded"
      ? []
      : [
          "Add a narrower --scope if the active project/domain is known.",
          "Reformulate with note titles, aliases, or project vocabulary.",
          "Run curation recommendation on recent eval misses before adding heavier retrieval.",
        ],
    lanes: lanes.map((lane) => ({
      method: lane.method,
      confidence: lane.confidence,
      results: lane.results.slice(0, k).map((item) => item.id),
    })),
    results: top.map((item) => ({
      path: item.id,
      title: item.title,
      score: Number((item.rerankScore ?? item.fusedScore).toFixed(4)),
      status: item.metadata?.status ?? item.metadata?.lifecycle ?? "current",
      lanes: item.lanes,
    })),
  }
}

function sanitizePrecomputedLanes(precomputedRankedLanes, documents, {
  scope, includeNoncanonical, includeSuperseded, includeNavigation,
}) {
  if (!Array.isArray(precomputedRankedLanes)) throw new Error("precomputedRankedLanes must be an array")
  if (!precomputedRankedLanes.length) return []

  const governedDocuments = new Map(filterByScope(documents, scope)
    .filter((document) => isRetrievable(document, { includeNoncanonical, includeSuperseded })
      && (includeNavigation || isAnswerCandidate(document)))
    .map((document) => [document.id, document]))
  const sanitized = []
  for (const lane of precomputedRankedLanes) {
    if (!lane || typeof lane.method !== "string" || !Array.isArray(lane.results)) {
      throw new Error("precomputed ranked lanes must include a method and results array")
    }
    const seen = new Set()
    const results = []
    for (const item of lane.results) {
      const id = item?.id
      if (typeof id !== "string" || seen.has(id)) continue
      const document = governedDocuments.get(id)
      if (!document) continue
      seen.add(id)
      // Never trust semantic-lane titles, statuses, or other note metadata.
      results.push(document)
    }
    if (results.length) sanitized.push({ method: lane.method, results })
  }
  return sanitized
}

export function fuseRankedLanes(lanes, constant = 60) {
  const byId = new Map()
  for (const lane of lanes) {
    lane.results.forEach((item, index) => {
      const current = byId.get(item.id) ?? {
        ...item,
        fusedScore: 0,
        lanes: [],
      }
      current.fusedScore += 1 / (constant + index + 1)
      current.lanes.push(lane.method)
      byId.set(item.id, current)
    })
  }
  return [...byId.values()].sort((a, b) => b.fusedScore - a.fusedScore || a.id.localeCompare(b.id))
}

export function filterByScope(documents, scope = "") {
  const scopes = normalizeScopes(scope)
  if (!scopes.length) return documents
  const filtered = documents.filter((document) => matchesScope(document.id, scopes))
  return filtered.length === documents.length ? documents : filtered
}

function normalizeScopes(scope) {
  return String(scope).split(",")
    .map((item) => item.trim().replaceAll("\\", "/").replace(/\/+$/u, "").toLowerCase())
    .filter(Boolean)
}

function matchesScope(relative, scopes) {
  const id = relative.toLowerCase()
  return scopes.some((candidate) => id === candidate || id === `${candidate}.md` || id.startsWith(`${candidate}/`))
}

function mayContainScope(relative, scopes) {
  const directory = relative.toLowerCase()
  return scopes.some((candidate) => candidate === directory || candidate.startsWith(`${directory}/`) || directory.startsWith(`${candidate}/`))
}
