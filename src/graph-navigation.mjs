import path from "node:path"
import { createNoteLinkResolver } from "./brain-sync.mjs"
import { filterByScope } from "./memory-recall.mjs"
import { isRetrievable } from "./retrieval.mjs"

// Explicit note relations only: no inferred entity co-occurrence or generated facts.
export const NOTE_RELATIONS = ["part_of", "depends_on", "implements", "evidence_for", "related"]

function* noteReferences(document) {
  for (const relation of NOTE_RELATIONS) {
    const values = document.metadata?.[relation]
    for (const value of Array.isArray(values) ? values : values ? [values] : []) {
      const target = String(value).replace(/^\[\[|\]\]$/gu, "").split(/[|#]/u)[0].trim()
      if (target) yield { target, relation, kind: "property" }
    }
  }
  const body = document.markdown
    .replace(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?\1/gu, "")
    .replace(/`+[^`]*`+/gu, "").replace(/<!--[\s\S]*?-->/gu, "")
  for (const match of body.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/gu)) {
    yield { target: match[1].trim(), relation: "links_to", kind: "wiki" }
  }
  for (const match of body.matchAll(/(?<!!)\[[^\]]+\]\(<?([^\s>]+?\.md(?:#[^\s>]*?)?)>?(?:\s+["'][^\n]*?["'])?\)/giu)) {
    try {
      yield { target: decodeURIComponent(match[1].split("#")[0]), relation: "links_to", kind: "markdown" }
    } catch { /* Malformed URI escapes are not valid navigation edges. */ }
  }
}

// Derived navigation only. Ambiguous short names are deliberately not resolved.
export function buildNoteGraph(documents, { scope = "" } = {}) {
  const eligible = filterByScope(documents, scope).filter((document) => isRetrievable(document))
  const byId = new Map(eligible.map((document) => [document.id, document]))
  const resolve = createNoteLinkResolver(documents.map((document) => ({ path: document.id, title: document.title, text: document.markdown })))
  const outgoing = new Map(eligible.map((document) => [document.id, new Set()]))
  const incoming = new Map(eligible.map((document) => [document.id, new Set()]))
  const edgeDetails = new Map()
  const issues = []
  const issueCounts = {}
  let edges = 0
  let limitReached = false
  for (const document of eligible) {
    let examined = 0
    for (const reference of noteReferences(document)) {
      if (examined >= 64 || edges >= 20000) { limitReached = true; break }
      examined++
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(reference.target)) continue
      // Markdown URLs are source-relative, unlike Obsidian's basename links.
      const local = reference.kind === "markdown" && !/^[a-z][a-z0-9+.-]*:/iu.test(reference.target)
      const resolved = local
        ? { resolved: true, path: path.posix.normalize(reference.target.startsWith("/")
          ? reference.target.slice(1) : path.posix.join(path.posix.dirname(document.id), reference.target)) }
        : resolve(reference.target, document.id)
      const target = resolved.resolved ? resolved.path : null
      if (!target || !byId.has(target)) {
        const reason = !resolved.resolved ? resolved.reason : "excluded-or-missing"
        issueCounts[reason] = (issueCounts[reason] ?? 0) + 1
        if (issues.length < 20) issues.push({ source: document.id, target: reference.target, relation: reference.relation, reason })
        continue
      }
      if (target === document.id) continue
      const key = JSON.stringify([document.id, target])
      if (!edgeDetails.has(key)) edgeDetails.set(key, [])
      const details = edgeDetails.get(key)
      if (!(reference.kind === "wiki" && details.some((edge) => edge.kind === "property"))
        && !details.some((edge) => edge.relation === reference.relation && edge.kind === reference.kind)) details.push(reference)
      if (outgoing.get(document.id).has(target)) continue
      outgoing.get(document.id).add(target)
      incoming.get(target).add(document.id)
      edges++
    }
  }
  return { byId, outgoing, incoming, edgeDetails, edges, limitReached, issues, issueCounts }
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
  return [...result].map(([path, via]) => {
    const source = via === "backlink" ? path : id
    const target = via === "backlink" ? id : path
    return { path, via, relations: [...new Set((graph.edgeDetails.get(JSON.stringify([source, target])) ?? []).map((edge) => edge.relation))] }
  })
}

// Bounded diagnostics for curators; Markdown remains the source of truth.
export function summarizeNoteGraph(documents, options = {}) {
  const graph = buildNoteGraph(documents, options)
  const isolated = [...graph.byId.keys()].filter((id) => !graph.outgoing.get(id).size && !graph.incoming.get(id).size)
  const hubs = [...graph.byId.keys()].map((id) => ({ path: id, outgoing: graph.outgoing.get(id).size, incoming: graph.incoming.get(id).size }))
    .sort((a, b) => b.outgoing + b.incoming - a.outgoing - a.incoming || a.path.localeCompare(b.path)).slice(0, 10)
  return { notes: graph.byId.size, edges: graph.edges, isolatedCount: isolated.length, isolated: isolated.slice(0, 20),
    hubs, issueCounts: graph.issueCounts, issues: graph.issues, graphLimitReached: graph.limitReached,
    scanLimitReached: documents.length >= 5000 }
}
