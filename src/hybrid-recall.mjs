import { buildNoteGraph, linkedNeighbors } from "./graph-navigation.mjs"
import { governedRank, isAnswerCandidate, isRetrievable } from "./retrieval.mjs"
import { fuseRankedLanes } from "./memory-recall.mjs"

// Question scaffolding must not outvote content words across two sparse lanes.
const QUESTION_WORDS = new Set(["a", "an", "the", "how", "what", "who", "where", "when", "why", "which", "do", "does", "did", "is", "are", "was", "were", "be", "we", "our", "i", "you", "your", "should", "can", "could", "would", "to", "of", "for", "in", "on", "at", "with", "it", "this", "that", "and", "or"])
export function sparseHybridQuery(query) {
  const words = String(query).match(/[\p{L}\p{M}\p{N}_-]+/gu) ?? []
  const content = words.filter(word => !QUESTION_WORDS.has(word.toLowerCase()))
  return content.length ? content.join(" ") : query
}

// Navigation follows authored links only; a trail is not evidence of its contents.
export function rankGraphLane(documents, query, semanticLane, { methods, includeSuperseded = false } = {}) {
  const eligible = documents.filter(document => isRetrievable(document, { includeSuperseded }))
  const graph = buildNoteGraph(eligible)
  const seedLanes = (methods ?? ["bm25", "bm25f-focused-sections"]).map(method => ({ method,
    results: governedRank(eligible, sparseHybridQuery(query), method, { includeSuperseded, followLinks: false }).results.filter(item => item.score > 0).slice(0, 8) }))
  if (semanticLane) seedLanes.push({ method: semanticLane.method, results: semanticLane.results.slice(0, 8) })
  const seeds = fuseRankedLanes(seedLanes).slice(0, 8)
  const found = new Map()
  const queue = seeds.filter(seed => graph.byId.has(seed.id)).map(seed => ({ id: seed.id, trail: [seed.id] }))
  const visited = new Set(queue.map(item => item.id))
  let limited = false
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const node = queue[cursor]
    if (node.trail.length >= 4) {
      if (linkedNeighbors(graph, node.id).some(neighbor => !visited.has(neighbor.path))) limited = true
      continue
    }
    for (const neighbor of linkedNeighbors(graph, node.id)) {
      if (visited.has(neighbor.path)) continue
      if (visited.size >= 512) { limited = true; break }
      visited.add(neighbor.path)
      const trail = [...node.trail, neighbor.path]
      queue.push({ id: neighbor.path, trail })
      const document = graph.byId.get(neighbor.path)
      if (isAnswerCandidate(document)) found.set(neighbor.path, { ...document, score: 1 / trail.length, graphTrail: trail })
    }
  }
  return { method: "graph", results: [...found.values()], graphLimitReached: limited || graph.limitReached,
    graphIssues: graph.issueCounts }
}
