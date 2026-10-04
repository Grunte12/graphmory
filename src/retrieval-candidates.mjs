// Experimental deterministic stages. Defaults remain off until held-out gates pass.
import { linkedNeighbors } from "./graph-navigation.mjs"
import { sectionFocusRerank, tokenize } from "./retrieval.mjs"

export function validatePipelineOptions(options = {}) {
  if (![undefined, "bfs", "ppr"].includes(options.graphExpansion)) throw Error("INVALID_PIPELINE: graphExpansion must be bfs or ppr")
  for (const [key, fallback] of [["pprDamping", 0.85], ["mmrLambda", 0.7], ["rerankMargin", 0.1]]) {
    const value = options[key] ?? fallback
    if (!Number.isFinite(value) || value < 0 || value > 1) throw Error(`INVALID_PIPELINE: ${key} must be 0–1`)
  }
  if (options.abstainFloor !== undefined && (!Number.isFinite(options.abstainFloor) || options.abstainFloor < 0)) throw Error("INVALID_PIPELINE: abstainFloor must be nonnegative")
  if (![undefined, "ranked", "strongest-first"].includes(options.contextOrder)) throw Error("INVALID_PIPELINE: invalid context order")
  if (options.mmr !== undefined && typeof options.mmr !== "boolean") throw Error("INVALID_PIPELINE: mmr must be boolean")
  return options
}

export function personalizedPageRank(graph, seeds, { damping = 0.85, iterations = 30 } = {}) {
  if (!Number.isFinite(damping) || damping < 0 || damping > 1 || !Number.isInteger(iterations) || iterations < 1 || iterations > 100) throw Error("INVALID_PIPELINE: invalid PPR constants")
  const initial = seeds.filter(s => graph.byId.has(s.id)).slice(0, 8)
  const seedIds = new Set(initial.map(s => s.id))
  const trails = new Map(initial.map(s => [s.id, [s.id]]))
  const queue = [...seedIds]
  let limited = false
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor], trail = trails.get(id)
    for (const neighbor of linkedNeighbors(graph, id)) {
      if (trails.has(neighbor.path)) continue
      if (trail.length >= 4 || trails.size >= 512) { limited = true; continue }
      trails.set(neighbor.path, [...trail, neighbor.path]); queue.push(neighbor.path)
    }
  }
  if (!initial.length) return { results: [], visited: 0, limited }
  const total = initial.reduce((sum, s) => sum + (s.fusedScore || 1), 0)
  const prior = new Map(queue.map(id => [id, 0]))
  for (const seed of initial) prior.set(seed.id, (seed.fusedScore || 1) / total)
  const adjacency = new Map(queue.map(id => [id, linkedNeighbors(graph, id).map(n => n.path).filter(p => trails.has(p))]))
  let values = new Map(prior)
  for (let iteration = 0; iteration < iterations; iteration++) {
    const next = new Map(queue.map(id => [id, (1 - damping) * prior.get(id)]))
    let dangling = 0
    for (const id of queue) {
      const neighbors = adjacency.get(id)
      if (!neighbors.length) { dangling += damping * values.get(id); continue }
      for (const neighbor of neighbors) next.set(neighbor, next.get(neighbor) + damping * values.get(id) / neighbors.length)
    }
    for (const id of queue) next.set(id, next.get(id) + dangling * prior.get(id))
    values = next
  }
  return { results: queue.filter(id => !seedIds.has(id)).map(id => ({ ...graph.byId.get(id), score: values.get(id), graphTrail: trails.get(id) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)), visited: trails.size, limited }
}
function overlap(a, b) {
  let common = 0
  for (const word of a) if (b.has(word)) common++
  return common / Math.max(1, a.size + b.size - common)
}
export function mmrOrder(results, documents, lambda = 0.7) {
  const tokens = new Map(documents.map(d => [d.id, new Set(tokenize(d.markdown))]))
  const selected = [], remaining = [...results]
  const maximum = Math.max(...results.map(r => r.rerankScore ?? r.fusedScore), 1e-12)
  while (remaining.length) {
    let best = 0, value = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i]
      const redundancy = Math.max(0, ...selected.map(s => overlap(tokens.get(item.id) ?? new Set(), tokens.get(s.id) ?? new Set())))
      const score = lambda * (item.rerankScore ?? item.fusedScore) / maximum - (1 - lambda) * redundancy
      if (score > value) { best = i; value = score }
    }
    selected.push(remaining.splice(best, 1)[0])
  }
  return selected
}
export function applyRetrievalCandidates(results, query, documents, options = {}) {
  validatePipelineOptions(options)
  let ranked = results
  let reranked = false
  const topScore = ranked[0]?.fusedScore ?? 0
  if (options.abstainFloor !== undefined && (!ranked.length || topScore < options.abstainFloor)) return { results: [], abstained: true, reranked }
  if (options.rerankMargin !== undefined && ranked.length > 1) {
    const margin = (topScore - ranked[1].fusedScore) / Math.max(topScore, 1e-12)
    if (margin <= options.rerankMargin) {
      ranked = sectionFocusRerank(ranked.map(r => ({ ...r, score: r.fusedScore })), query, documents).map(r => ({ ...r, rerankScore: r.score }))
      reranked = true
    }
  }
  if (options.mmr) ranked = mmrOrder(ranked, documents, options.mmrLambda ?? 0.7)
  if (options.contextOrder === "strongest-first") {
    // Preserve the strongest selected item at the beginning. Never interleave low
    // quality evidence ahead of it; the remainder keeps diversity ordering.
    const strongest = [...ranked].sort((a, b) => (b.rerankScore ?? b.fusedScore) - (a.rerankScore ?? a.fusedScore) || a.id.localeCompare(b.id))[0]
    if (strongest) ranked = [strongest, ...ranked.filter(r => r.id !== strongest.id)]
  }
  return { results: ranked, abstained: false, reranked }
}
