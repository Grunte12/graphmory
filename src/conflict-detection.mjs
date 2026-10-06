import { isRetrievable } from "./retrieval.mjs"

// Deterministic, provider-free check that a new memory does not quietly overlap an active one.
// It cannot tell agreement from contradiction; it only makes sure the host looked before writing.
const MIN_SHARED_TERMS = 3
const MIN_CONTAINMENT = 0.6
const MIN_TITLE_COVERAGE = 0.5
const HEAD_CHARACTERS = 600
const MAX_REPORTED = 5
const STOPWORDS = new Set(["the", "and", "for", "are", "was", "were", "with", "that", "this", "from", "have", "has", "per", "not", "all", "any", "can", "its", "into", "when", "then", "than", "they", "their", "will", "should", "must", "need", "needs", "use", "uses", "used"])

function stem(word) {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3)
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2)
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1)
  return word
}

function terms(text) {
  return new Set((text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((word) => !STOPWORDS.has(word)).map(stem))
}

function noteHead(document) {
  const body = document.markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/u, "")
  return `${document.title}\n${body.slice(0, HEAD_CHARACTERS)}`
}

/**
 * Active notes whose subject (title) and content strongly overlap the claim. Notes of a different declared type, notes the patch
 * supersedes, the target and the cited evidence are never reported.
 */
export function findOverlappingNotes({ documents, patch, exclude = [] }) {
  const claimTerms = terms(`${patch.claim} ${patch.scope.applies.join(" ")}`)
  if (claimTerms.size < MIN_SHARED_TERMS) return []
  const skipped = new Set([...exclude, ...(patch.lifecycle.supersedes ?? [])])
  const overlaps = []
  for (const document of documents) {
    if (skipped.has(document.id) || !isRetrievable(document)) continue
    const declared = document.metadata?.type
    if (typeof declared === "string" && declared && declared !== patch.suggested_type) continue
    // The note must be about the claim's subject: its title terms appear in the claim. Vocabulary shared across a
    // whole domain is not enough, or every note in a focused vault would overlap every other.
    const titleTerms = terms(document.title)
    let titled = 0
    for (const term of titleTerms) if (claimTerms.has(term)) titled += 1
    if (!titleTerms.size || titled / titleTerms.size < MIN_TITLE_COVERAGE) continue
    const noteTerms = terms(noteHead(document))
    let shared = 0
    for (const term of claimTerms) if (noteTerms.has(term)) shared += 1
    const containment = shared / claimTerms.size
    if (shared >= MIN_SHARED_TERMS && containment >= MIN_CONTAINMENT) overlaps.push({ path: document.id, containment })
  }
  return overlaps.sort((a, b) => b.containment - a.containment || a.path.localeCompare(b.path)).slice(0, MAX_REPORTED)
}
