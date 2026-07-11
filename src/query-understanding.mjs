// Deterministic query understanding: language/script detection, cheap
// class rules, and vault-mined alias expansion. No model calls, no network.
// Pure functions only so this module stays unit-testable in isolation from
// the retrieval index.
import { tokenize } from "./retrieval.mjs"

const THAI_RANGE = /[฀-๿]/u
const LATIN_RANGE = /[A-Za-z]/u

// Reduced weight applied to alias-sourced expansion terms relative to the
// original query terms. See expandQueryTerms() for how this is used given
// that bm25fRank has no native per-term query weighting today (Phase A
// approximates weighting by appending expansion terms once; see A3 wiring
// in memory-recall.mjs for the full rationale).
const ALIAS_EXPANSION_WEIGHT = 0.4

const TEMPORAL_PATTERN = /\b(latest|when|current(ly)?|now|today|recent(ly)?|deadline|schedule|upcoming|date)\b/iu
const TEMPORAL_PATTERN_THAI = /(ล่าสุด|เมื่อไหร่|ตอนนี้|วันนี้|กำหนด)/u
const AGGREGATION_PATTERN = /\b(all|list|every|how many|count|enumerate|total)\b/iu
const AGGREGATION_PATTERN_THAI = /(ทั้งหมด|ทุก|กี่)/u

/**
 * Detect the dominant script family of a query string.
 * @param {string} query
 * @returns {"latin"|"thai"|"mixed"}
 */
export function detectScript(query) {
  const text = String(query)
  const hasThai = THAI_RANGE.test(text)
  const hasLatin = LATIN_RANGE.test(text)
  if (hasThai && hasLatin) return "mixed"
  if (hasThai) return "thai"
  return "latin"
}

/**
 * Cheap, deterministic query classification by regex/lexicon rules.
 * Out-of-scope classification (requires corpus-overlap signal) is left as a
 * documented stub for Phase B, where the retrieval planner has direct access
 * to candidate scores and can classify no-overlap queries as out-of-scope.
 * @param {string} query
 * @returns {string[]} one or more of "temporal", "aggregation", "factual"
 */
export function classifyQuery(query) {
  const text = String(query)
  const classes = []
  if (TEMPORAL_PATTERN.test(text) || TEMPORAL_PATTERN_THAI.test(text)) classes.push("temporal")
  if (AGGREGATION_PATTERN.test(text) || AGGREGATION_PATTERN_THAI.test(text)) classes.push("aggregation")
  if (!classes.length) classes.push("factual")
  return classes
}

/**
 * Mine an alias-synonym map from a vault's parsed documents. Reuses the
 * frontmatter `aliases` field already parsed by parseMarkdown/loadVaultDocuments
 * (no re-parsing of raw markdown). Maps every canonical token (drawn from a
 * document's title/id) and every alias token to its sibling tokens, so a
 * match on either side of an alias relationship can expand to the other.
 * @param {import("./retrieval.mjs").ParsedDocument[]} documents
 * @returns {Map<string, Set<string>>}
 */
export function buildAliasMap(documents) {
  const map = new Map()
  const addSiblings = (token, siblings) => {
    if (!siblings.size) return
    const existing = map.get(token) ?? new Set()
    for (const sibling of siblings) {
      if (sibling !== token) existing.add(sibling)
    }
    if (existing.size) map.set(token, existing)
  }

  for (const document of documents ?? []) {
    const rawAliases = document?.metadata?.aliases
    if (!rawAliases) continue
    const aliasList = Array.isArray(rawAliases) ? rawAliases : [rawAliases]
    const aliasTokens = new Set(aliasList.flatMap((alias) => tokenize(String(alias))))
    if (!aliasTokens.size) continue
    const canonicalTokens = new Set([
      ...tokenize(document.title ?? ""),
      ...tokenize(document.id ?? ""),
    ])

    for (const canonical of canonicalTokens) addSiblings(canonical, aliasTokens)
    for (const aliasToken of aliasTokens) {
      addSiblings(aliasToken, aliasTokens)
      addSiblings(aliasToken, canonicalTokens)
    }
  }
  return map
}

/**
 * Expand query tokens to alias siblings drawn from a vault-mined alias map.
 * Source-tagged and weighted so callers can distinguish original terms from
 * lower-confidence alias-derived terms.
 * @param {string[]} queryTokens
 * @param {Map<string, Set<string>>} aliasMap
 * @returns {{term: string, source: "alias", weight: number}[]}
 */
export function expandQueryTerms(queryTokens, aliasMap) {
  if (!aliasMap?.size) return []
  const seen = new Set(queryTokens)
  const expansions = []
  for (const token of queryTokens) {
    const siblings = aliasMap.get(token)
    if (!siblings) continue
    for (const sibling of siblings) {
      if (seen.has(sibling)) continue
      seen.add(sibling)
      expansions.push({ term: sibling, source: "alias", weight: ALIAS_EXPANSION_WEIGHT })
    }
  }
  return expansions
}

/**
 * Analyze a query deterministically: script/lang, tokenized segments, class
 * labels, vault-mined alias expansions, and alias-substituted query variants
 * for use by a retry rung. No model calls.
 * @param {string} query
 * @param {{aliasMap?: Map<string, Set<string>>}} [vaultIndex]
 */
export function analyzeQuery(query, vaultIndex = {}) {
  const lang = detectScript(query)
  const segments = tokenize(query)
  const classes = classifyQuery(query)
  const aliasMap = vaultIndex.aliasMap ?? new Map()
  const expansions = expandQueryTerms(segments, aliasMap)
  const variants = expansions.length
    ? [`${query} ${expansions.map((expansion) => expansion.term).join(" ")}`]
    : []
  return { lang, segments, classes, expansions, variants }
}
