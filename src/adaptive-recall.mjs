import { createHash } from "node:crypto"
import { buildNoteGraph, linkedNeighbors } from "./graph-navigation.mjs"
import { filterByScope, fuseRankedLanes, loadVaultDocuments } from "./memory-recall.mjs"
import { governedRank } from "./retrieval.mjs"
import { relevantExcerpt } from "./decision-recall.mjs"

const ACTIONS = new Set(["enough", "partial", "none", "conflict"])
const DIRECTIONS = new Set(["outgoing", "backlinks", "both"])

export function graphNavigationIntent(query) {
  const text = query.toLocaleLowerCase("en")
  if (!/(?:\bother\s+(?:papers|notes|documents|sources|files)\b|\b(?:papers|notes|documents|sources|files)\s+(?:associated|related|linked|connected)\b|\b(?:backlinks|wikilinks)\b|(?:โน้ต|บันทึก|เอกสาร|งานวิจัย).*(?:เกี่ยวข้อง|เชื่อมโยง|อ้างถึง))/u.test(text)) return null
  return { direction: "both", excludeSeed: /(?:\bother\b|อื่น|อีก)/u.test(text) }
}

export async function recallVaultAdaptive(vault, query, {
  k = 3,
  scope = "",
  facets = [],
  maxCandidates = 12,
  maxRounds = 2,
  perRound = 4,
  graphPolicy = "none",
  assessEvidence,
  assessorTimeoutMs = 10000,
} = {}) {
  if (typeof query !== "string" || !query.trim()) throw new Error("query is required")
  if (!Number.isInteger(k) || k < 1 || k > 10) throw new Error("k must be 1–10")
  if (!Number.isInteger(maxCandidates) || maxCandidates < k || maxCandidates > 20) throw new Error("maxCandidates must be k–20")
  if (!Number.isInteger(maxRounds) || maxRounds < 0 || maxRounds > 2) throw new Error("maxRounds must be 0–2")
  if (!Number.isInteger(perRound) || perRound < 1 || perRound > 8) throw new Error("perRound must be 1–8")
  if (!Array.isArray(facets) || facets.length > 4 || facets.some((facet) => typeof facet !== "string" || facet.length > 200)) throw new Error("facets must be at most four short strings")
  if (!["none", "auto", "force"].includes(graphPolicy)) throw new Error("graphPolicy must be none, auto, or force")
  if (!Number.isInteger(assessorTimeoutMs) || assessorTimeoutMs < 1 || assessorTimeoutMs > 30000) throw new Error("assessorTimeoutMs must be 1–30000")

  const catalog = loadVaultDocuments(vault)
  const documents = filterByScope(catalog, scope)
  const graph = buildNoteGraph(catalog, { scope })
  const initial = fuseRankedLanes(["bm25", "bm25f-focused-sections"].map((method) => ({
    method, results: governedRank(documents, query, method).results.slice(0, maxCandidates),
  }))).slice(0, maxCandidates)
  const baseline = initial.slice(0, k)
  const intent = graphNavigationIntent(query)
  const navigate = Boolean(assessEvidence) || graphPolicy === "force" || graphPolicy === "auto" && Boolean(intent)
  const pool = new Map(initial.slice(0, navigate ? Math.min(Math.max(4, k), maxCandidates) : maxCandidates).map((item) => [item.id, {
    path: item.id, title: item.title, score: item.fusedScore, status: item.metadata?.status ?? item.metadata?.lifecycle ?? "current", depth: 0, via: "lexical",
  }]))
  let frontier = [...pool.values()].slice(0, 3)
  let rounds = 0
  let decisionCalls = 0
  let stopReason = "lead-review"
  let assessedEvidence = []
  const expansionSources = []

  while (rounds < maxRounds && pool.size < maxCandidates && frontier.length) {
    let assessment
    if (assessEvidence) {
      decisionCalls++
      const evidenceItems = [...new Map([...pool.values()].slice(0, 2).concat(frontier).map((item) => [item.path, item])).values()].slice(0, 6)
      const boundedEvidence = evidenceItems.map(({ path, depth, via }) => {
        const excerpt = relevantExcerpt(graph.byId.get(path), query).slice(0, 800)
        return { path, depth, via, excerpt, excerptHash: createHash("sha256").update(excerpt).digest("hex") }
      })
      assessedEvidence = boundedEvidence.map(({ path, excerptHash }) => ({ path, excerptHash }))
      const controller = new AbortController()
      let timer
      try {
        assessment = await Promise.race([
          assessEvidence({ query, facets, candidates: boundedEvidence, round: rounds, signal: controller.signal }),
          new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Evidence assessor timed out")) }, assessorTimeoutMs) }),
        ])
      } finally { clearTimeout(timer) }
      if (!assessment || !ACTIONS.has(assessment.status)) throw new Error("Invalid evidence assessment")
      if (assessment.status === "enough" && (!Array.isArray(assessment.evidenceIds) || !assessment.evidenceIds.length
        || assessment.evidenceIds.some((id) => !assessedEvidence.some((item) => item.path === id)))) {
        throw new Error("Enough assessment must cite assessed evidence IDs")
      }
      if (assessment.status === "enough" || assessment.status === "conflict") {
        stopReason = assessment.status === "enough" ? "assessor-enough" : "assessor-conflict"
        break
      }
    } else if (!navigate) break

    const direction = assessment?.direction ?? intent?.direction ?? "both"
    if (!DIRECTIONS.has(direction)) throw new Error("Invalid graph direction")
    if (assessment?.seedPaths !== undefined && (!Array.isArray(assessment.seedPaths)
      || assessment.seedPaths.length < 1 || assessment.seedPaths.length > 3
      || new Set(assessment.seedPaths).size !== assessment.seedPaths.length
      || assessment.seedPaths.some((id) => !frontier.some((item) => item.path === id)))) throw new Error("Invalid seed paths")
    const seeds = assessment?.seedPaths?.length
      ? frontier.filter((item) => assessment.seedPaths.includes(item.path))
      : frontier
    if (!seeds.length) {
      stopReason = "no-valid-seed"
      break
    }
    const next = []
    for (const seed of seeds) {
      for (const neighbor of linkedNeighbors(graph, seed.path, direction)) {
        if (pool.has(neighbor.path)) continue
        const document = graph.byId.get(neighbor.path)
        if (!document) continue
        const score = seed.score * (neighbor.via === "backlink" ? 0.92 : 0.85)
        const item = { path: neighbor.path, title: document.title, score, status: document.metadata?.status ?? document.metadata?.lifecycle ?? "current",
          depth: seed.depth + 1, via: neighbor.via, parent: seed.path }
        pool.set(item.path, item)
        next.push(item)
        expansionSources.push({ path: item.path, parent: seed.path, via: neighbor.via })
        if (next.length >= perRound || pool.size >= maxCandidates) break
      }
      if (next.length >= perRound || pool.size >= maxCandidates) break
    }
    rounds++
    if (!next.length) {
      stopReason = "no-new-evidence"
      break
    }
    frontier = next
    stopReason = pool.size >= maxCandidates ? "candidate-budget" : rounds >= maxRounds ? "round-budget" : "lead-review"
  }

  if (stopReason !== "assessor-conflict") {
    for (const item of initial) {
      if (pool.size >= maxCandidates) break
      if (!pool.has(item.id)) pool.set(item.id, { path: item.id, title: item.title, score: item.fusedScore,
        status: item.metadata?.status ?? item.metadata?.lifecycle ?? "current", depth: 0, via: "lexical" })
    }
  }
  const lexical = [...pool.values()].filter((item) => item.depth === 0).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
  const expanded = [...pool.values()].filter((item) => item.depth > 0).sort((a, b) => {
    const canonicalA = graph.byId.get(a.path)?.metadata?.canonical_memory === "true" || graph.byId.get(a.path)?.metadata?.canonical_memory === true
    const canonicalB = graph.byId.get(b.path)?.metadata?.canonical_memory === "true" || graph.byId.get(b.path)?.metadata?.canonical_memory === true
    return Number(canonicalB) - Number(canonicalA) || b.score - a.score || a.path.localeCompare(b.path)
  })
  const ranked = expanded.length && navigate ? (intent?.excludeSeed ? [...expanded, ...lexical.slice(1)] : [lexical[0], ...expanded, ...lexical.slice(1)]) : lexical
  const candidatePool = [...ranked.map((item) => item.path), ...[...pool.keys()].filter((id) => !ranked.some((item) => item.path === id))]
  return {
    query, workflow: "adaptive-graph-experiment", results: ranked.slice(0, k),
    baseline: baseline.map(({ id }) => id), candidatePool,
    rounds, uniqueCandidates: pool.size, decisionCalls, stopReason, expansionSources, assessedEvidence,
    evidenceStatus: "unverified",
    scanLimitReached: catalog.length >= 5000,
    graphLimitReached: graph.limitReached,
    nextAction: stopReason === "assessor-conflict" ? "lead-review-conflict" : "lead-review",
  }
}
