import fs from "node:fs"
import path from "node:path"
import { governedRank, parseMarkdown, sectionFocusRerank } from "./retrieval.mjs"

const SKIP_DIRECTORIES = new Set([".git", ".obsidian", ".memory-patch-harness", "node_modules"])
const RAW_ROOTS = new Set(["00 inbox", "clippings"])

export function loadVaultDocuments(vault, { includeRawPaths = false, maxFiles = 5000, scope = "" } = {}) {
  const root = path.resolve(vault)
  if (!fs.existsSync(root)) throw new Error(`VAULT_NOT_FOUND: ${root}`)
  if (!fs.statSync(root).isDirectory()) throw new Error(`INVALID_VAULT_PATH: not a directory: ${root}`)
  const documents = []
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
      const document = parseMarkdown(relative, fs.readFileSync(file, "utf8"))
      if (RAW_ROOTS.has(relative.split("/")[0].toLowerCase())) {
        document.metadata = { ...document.metadata, status: document.metadata.status ?? "raw" }
      }
      documents.push(document)
      if (documents.length >= maxFiles) break
    }
  }
  return documents.sort((a, b) => a.id.localeCompare(b.id))
}

export function recallVault(vault, query, {
  method = "bm25f-sections",
  k = 3,
  includeNoncanonical = false,
  includeRawPaths = false,
  maxFiles = 5000,
  scope = "",
  rerank = false,
} = {}) {
  if (!query?.trim()) throw new Error("query is required")
  if (!Number.isInteger(k) || k < 1 || k > 10) throw new Error("k must be between 1 and 10")
  if (!Number.isInteger(maxFiles) || maxFiles < 1) throw new Error("maxFiles must be positive")
  const documents = loadVaultDocuments(vault, { includeRawPaths, maxFiles, scope })
  const retrieval = governedRank(documents, query, method, { includeNoncanonical })
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
  includeNoncanonical = false,
  includeRawPaths = false,
  maxFiles = 5000,
  scope = "",
  perMethodLimit = 8,
  rerank = false,
  documents: suppliedDocuments,
} = {}) {
  if (!query?.trim()) throw new Error("query is required")
  if (!Number.isInteger(k) || k < 1 || k > 10) throw new Error("k must be between 1 and 10")
  const documents = suppliedDocuments ?? loadVaultDocuments(vault, { includeRawPaths, maxFiles, scope })
  const lanes = methods.map((method) => {
    const retrieval = governedRank(documents, query, method, { includeNoncanonical })
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
  const fused = fuseRankedLanes(lanes)
  const top = fused.slice(0, k)
  const confidence = top.length === 0
    ? "none"
    : lanes.some((lane) => lane.confidence === "bounded") || top[0].fusedScore >= 1
      ? "bounded"
      : "low"
  return {
    query,
    methods,
    k,
    scanned: documents.length,
    scanLimitReached: documents.length >= maxFiles,
    excludedByLifecycle: Math.max(...lanes.map((lane) => lane.excluded), 0),
    confidence,
    needsExpansion: confidence !== "bounded",
    reranked: rerank,
    nextSteps: confidence === "bounded"
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
      score: Number(item.fusedScore.toFixed(4)),
      status: item.metadata?.status ?? item.metadata?.lifecycle ?? "current",
      lanes: item.lanes,
    })),
  }
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
  return documents.filter((document) => matchesScope(document.id, scopes))
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
