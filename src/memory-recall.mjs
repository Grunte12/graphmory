import fs from "node:fs"
import path from "node:path"
import { governedRank, parseMarkdown, sectionFocusRerank } from "./retrieval.mjs"
import { analyzeQuery, buildAliasMap } from "./query-understanding.mjs"

const SKIP_DIRECTORIES = new Set([".git", ".obsidian", ".memory-patch-harness", "node_modules"])
const RAW_DIRECTORIES = new Set(["00 inbox", "inbox", "clippings", "archive", "auto-triggers", "memory-patches"])

function isRawPath(relative) {
  return relative
    .replaceAll("\\", "/")
    .split("/")
    .some((segment) => RAW_DIRECTORIES.has(segment.toLowerCase()))
}

export function loadVaultDocuments(vault, { includeRawPaths = false, maxFiles = 5000 } = {}) {
  const root = path.resolve(vault)
  if (!fs.existsSync(root)) throw new Error(`VAULT_NOT_FOUND: ${root}`)
  if (!fs.statSync(root).isDirectory()) throw new Error(`INVALID_VAULT_PATH: not a directory: ${root}`)
  const documents = []
  const stack = [root]
  while (stack.length && documents.length < maxFiles) {
    const directory = stack.pop()
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue
        const relative = path.relative(root, path.join(directory, entry.name)).replaceAll("\\", "/")
        if (!includeRawPaths && isRawPath(relative)) continue
        stack.push(path.join(directory, entry.name))
        continue
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".md") continue
      const file = path.join(directory, entry.name)
      const relative = path.relative(root, file).replaceAll("\\", "/")
      const document = parseMarkdown(relative, fs.readFileSync(file, "utf8"))
      if (isRawPath(relative)) {
        document.metadata = { ...document.metadata, status: "raw" }
      }
      documents.push(document)
      if (documents.length >= maxFiles) break
    }
  }
  return documents.sort((a, b) => a.id.localeCompare(b.id))
}

export async function recallVault(vault, query, {
  method = "bm25f-sections",
  k = 3,
  includeNoncanonical = false,
  includeRawPaths = false,
  maxFiles = 5000,
  scope = "",
  rerank = false,
  escalate = "off",
} = {}) {
  if (!query?.trim()) throw new Error("query is required")
  if (!Number.isInteger(k) || k < 1 || k > 10) throw new Error("k must be between 1 and 10")
  if (!Number.isInteger(maxFiles) || maxFiles < 1) throw new Error("maxFiles must be positive")
  const documents = filterByScope(loadVaultDocuments(vault, { includeRawPaths, maxFiles }), scope)
  const analysis = analyzeQuery(query, { aliasMap: buildAliasMap(documents) })

  let retrieval = governedRank(documents, query, method, { includeNoncanonical })
  let retrievalRung = 1
  let expansionsUsed = []

  // Rung 2: one cheap alias-expanded retry before semantic escalation. Only
  // taken when rung 1 is not already bounded, and only kept when it reaches
  // "bounded" confidence itself (otherwise rung 1's result stays authoritative
  // so escalation still sees the same signal it saw before this rung existed).
  if ((retrieval.confidence === "low" || retrieval.confidence === "none") && analysis.variants.length) {
    const retryQuery = analysis.variants[0]
    const retry = governedRank(documents, retryQuery, method, { includeNoncanonical })
    if (retry.confidence === "bounded") {
      retrieval = retry
      retrievalRung = 2
      expansionsUsed = analysis.expansions.map((expansion) => expansion.term)
    }
  }

  let results = retrieval.results
  if (rerank) {
    results = sectionFocusRerank(results, query, documents)
  }
  const report = {
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
    escalated: false,
    escalationMethod: null,
    escalationSkipped: null,
    queryAnalysis: { lang: analysis.lang, classes: analysis.classes, expansionsUsed },
    retrievalRung,
    results: results.slice(0, k).map((item) => ({
      path: item.id,
      title: item.title,
      score: Number(item.score.toFixed(4)),
      status: item.metadata?.status ?? item.metadata?.lifecycle ?? "current",
      ...(item.rerankApplied !== undefined ? { rerankApplied: item.rerankApplied, rerankSignals: item.rerankSignals } : {}),
    })),
  }

  if (escalate === "auto" && (retrieval.confidence === "low" || retrieval.confidence === "none")) {
    return escalateWithSemanticRecall(report, vault, query, { k, scope, includeNoncanonical, includeRawPaths, maxFiles })
  }
  return report
}

// Confidence-gated semantic escalation (opt-in via --escalate auto). Fails closed:
// when the optional @huggingface/transformers dependency is not installed,
// recallVaultSemantic throws an OPTIONAL_DEPENDENCY_MISSING error which is caught
// here and degrades to the original lexical-only report with no crash.
async function escalateWithSemanticRecall(report, vault, query, options) {
  try {
    const { recallVaultSemantic } = await import("./semantic-recall.mjs")
    const semantic = await recallVaultSemantic(vault, query, options)
    return {
      ...report,
      confidence: semantic.confidence,
      needsExpansion: semantic.needsExpansion,
      nextSteps: semantic.nextSteps,
      escalated: true,
      escalationMethod: "semantic-hybrid",
      escalationSkipped: null,
      retrievalRung: "semantic",
      results: semantic.results,
    }
  } catch (error) {
    if (/OPTIONAL_DEPENDENCY_MISSING/u.test(error?.message ?? "")) {
      return { ...report, escalated: false, escalationMethod: null, escalationSkipped: "OPTIONAL_DEPENDENCY_MISSING" }
    }
    throw error
  }
}

export function recallVaultLoop(vault, query, {
  methods = ["bm25f-sections", "bm25f-focused-sections", "bm25-sections"],
  k = 3,
  includeNoncanonical = false,
  includeRawPaths = false,
  maxFiles = 5000,
  scope = "",
  perMethodLimit = 8,
  rerank = false,
} = {}) {
  if (!query?.trim()) throw new Error("query is required")
  if (!Number.isInteger(k) || k < 1 || k > 10) throw new Error("k must be between 1 and 10")
  const documents = filterByScope(loadVaultDocuments(vault, { includeRawPaths, maxFiles }), scope)
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

export function fuseRankedLanes(lanes) {
  const byId = new Map()
  for (const lane of lanes) {
    lane.results.forEach((item, index) => {
      const current = byId.get(item.id) ?? {
        ...item,
        fusedScore: 0,
        lanes: [],
      }
      current.fusedScore += 1 / (index + 1)
      current.lanes.push(lane.method)
      byId.set(item.id, current)
    })
  }
  return [...byId.values()].sort((a, b) => b.fusedScore - a.fusedScore || a.id.localeCompare(b.id))
}

export function filterByScope(documents, scope = "") {
  const scopes = String(scope)
    .split(",")
    .map((item) => item.trim().toLowerCase().replaceAll("\\", "/"))
    .filter(Boolean)
  if (!scopes.length) return documents
  return documents.filter((document) => {
    const id = document.id.toLowerCase()
    return scopes.some((candidate) => id === candidate || id.startsWith(`${candidate.replace(/\/$/u, "")}/`) || id.includes(candidate))
  })
}
