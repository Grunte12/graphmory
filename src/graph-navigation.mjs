import { createNoteLinkResolver } from "./brain-sync.mjs"
import { filterByScope } from "./memory-recall.mjs"
import { isRetrievable } from "./retrieval.mjs"

// Derived navigation only. Ambiguous short names are deliberately not resolved.
export function buildNoteGraph(documents, { scope = "" } = {}) {
  const eligible = filterByScope(documents, scope).filter((document) => isRetrievable(document))
  const byId = new Map(eligible.map((document) => [document.id, document]))
  const resolve = createNoteLinkResolver(documents.map((document) => ({ path: document.id, title: document.title, text: document.markdown })))
  const outgoing = new Map(eligible.map((document) => [document.id, new Set()]))
  const incoming = new Map(eligible.map((document) => [document.id, new Set()]))
  let edges = 0
  let limitReached = false
  for (const document of eligible) {
    let examined = 0
    for (const match of document.markdown.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/gu)) {
      if (examined >= 64 || edges >= 20000) { limitReached = true; break }
      examined++
      const resolved = resolve(match[1], document.id)
      const target = resolved.resolved ? resolved.path : null
      if (!target || !byId.has(target) || target === document.id) continue
      if (outgoing.get(document.id).has(target)) continue
      outgoing.get(document.id).add(target)
      incoming.get(target).add(document.id)
      edges++
    }
  }
  return { byId, outgoing, incoming, edges, limitReached }
}

export function linkedNeighbors(graph, id, direction = "both") {
  const result = new Map()
  if (direction === "both" || direction === "outgoing") {
    for (const target of graph.outgoing.get(id) ?? []) result.set(target, "outgoing")
  }
  if (direction === "both" || direction === "backlinks") {
    for (const target of graph.incoming.get(id) ?? []) {
      if (!result.has(target)) result.set(target, "backlink")
    }
  }
  return [...result].map(([path, via]) => ({ path, via }))
}
