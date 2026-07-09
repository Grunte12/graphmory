const WORD = /[\p{L}\p{M}\p{N}_-]+/gu
const SECTION_CACHE = Symbol("memoryPatchHarness.sections")
const FIELD_COUNTS_CACHE = Symbol("memoryPatchHarness.fieldCounts")
const FREQUENCY_CACHE = new WeakMap()
const ELIGIBLE_CACHE = new WeakMap()
const SECTION_ARRAY_CACHE = new WeakMap()
const BM25_CORPUS_CACHE = new WeakMap()
const BM25F_CORPUS_CACHE = new WeakMap()
const REFERENCE_INDEX_CACHE = new WeakMap()

export function tokenize(value) {
  const tokens = String(value)
    .toLocaleLowerCase("en")
    .match(WORD)
    ?.filter((token) => token.length > 1) ?? []
  return tokens.flatMap((token) => {
    const parts = token.split(/[-_]/u).filter((part) => part.length > 1)
    return parts.length > 1 ? [token, ...parts] : [token]
  })
}

function retrievalTokens(value) {
  return tokenize(value).flatMap((token) => {
    if (token.length <= 3 || !token.endsWith("s") || token.endsWith("ss") || token.endsWith("us") || token.endsWith("is")) {
      return [token]
    }
    return [token, token.slice(0, -1)]
  })
}

export function parseMarkdown(id, markdown) {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? id
  const frontmatter = markdown.startsWith("---")
    ? markdown.split("---", 3)[1] ?? ""
    : ""
  const metadata = parseFrontmatter(frontmatter)
  return {
    id,
    title,
    metadata,
    text: `${id}\n${frontmatter}\n${markdown}`,
    tokens: tokenize(`${id}\n${title}\n${frontmatter}\n${markdown}`),
    characters: markdown.length,
    markdown,
  }
}

function parseFrontmatter(frontmatter) {
  const metadata = {}
  let activeList = ""
  for (const line of frontmatter.split(/\r?\n/u)) {
    const property = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/u)
    if (property) {
      activeList = property[1].toLowerCase()
      const raw = property[2].trim()
      if (!raw) {
        metadata[activeList] = []
      } else if (raw.startsWith("[") && raw.endsWith("]")) {
        metadata[activeList] = raw.slice(1, -1).split(",").map(cleanScalar).filter(Boolean)
      } else {
        metadata[activeList] = cleanScalar(raw)
        activeList = ""
      }
      continue
    }
    const item = line.match(/^\s+-\s+(.+?)\s*$/u)
    if (item && activeList && Array.isArray(metadata[activeList])) {
      metadata[activeList].push(cleanScalar(item[1]))
      continue
    }
    if (line.trim()) activeList = ""
  }
  return metadata
}

function cleanScalar(value) {
  return String(value).trim().replace(/^['"]|['"]$/gu, "")
}

const EXCLUDED_LIFECYCLES = new Set(["raw", "stale", "superseded", "archived"])

export function isRetrievable(document, { includeNoncanonical = false } = {}) {
  const status = String(document.metadata?.status ?? document.metadata?.lifecycle ?? "current").toLowerCase()
  if (!includeNoncanonical && EXCLUDED_LIFECYCLES.has(status)) return false
  return true
}

export function governedRank(documents, query, method, options = {}) {
  const eligible = eligibleDocuments(documents, options)
  const direct = rank(eligible, query, method).map((item) => ({ ...item, retrievalSource: "direct" }))
  const results = options.followLinks === false
    ? direct
    : expandLinkedResults(direct, eligible, options.linkSeeds ?? 3)
  const minimumResults = options.minimumResults ?? 1
  const topScore = results[0]?.score ?? 0
  const secondScore = results[1]?.score ?? 0
  const confidence = topScore <= 0
    ? "none"
    : results.length < minimumResults || (secondScore > 0 && topScore / secondScore < 1.15)
      ? "low"
      : "bounded"
  return {
    results,
    confidence,
    needsExpansion: confidence !== "bounded",
    excluded: documents.length - eligible.length,
    nextSteps: confidence === "bounded"
      ? []
      : [
          "Try an alias or paraphrase of the task language.",
          "Inspect matching MOC/backlink paths before broad vault reads.",
          "Ask the lead agent to reformulate the query when meaning remains ambiguous.",
        ],
  }
}

function eligibleDocuments(documents, options) {
  if (options.includeNoncanonical) return documents
  const cached = ELIGIBLE_CACHE.get(documents)
  if (cached) return cached
  const eligible = documents.filter((document) => isRetrievable(document, options))
  ELIGIBLE_CACHE.set(documents, eligible)
  return eligible
}

function expandLinkedResults(results, documents, seedCount) {
  const seedLinks = []
  let byId
  for (const parent of results.slice(0, seedCount)) {
    if (!parent.markdown && !byId) byId = documentReferenceIndex(documents).byId
    const source = parent.markdown ?? byId?.get(parent.id)?.markdown ?? ""
    for (const match of source.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/gu)) {
      seedLinks.push({ parent, reference: match[1] })
    }
  }
  if (!seedLinks.length) return results

  const { byReference } = documentReferenceIndex(documents)
  const rankedById = new Map(results.map((item) => [item.id, { ...item }]))
  const linked = new Map()
  for (const { parent, reference } of seedLinks) {
    const document = byReference.get(normalizeReference(reference))
    if (!document || document.id === parent.id) continue
    const graphScore = parent.score * 0.1
    const existing = rankedById.get(document.id)
    if (existing) {
      const priorBoost = linked.get(document.id)?.graphBoost ?? 0
      if (graphScore <= priorBoost) continue
      linked.set(document.id, { graphBoost: graphScore })
      rankedById.set(document.id, {
        ...existing,
        score: existing.score - priorBoost + graphScore,
        retrievalSource: `direct+wikilink:${parent.id}`,
      })
    } else if (!linked.has(document.id)) {
      linked.set(document.id, { graphBoost: graphScore })
      rankedById.set(document.id, {
        ...document,
        score: graphScore,
        retrievalSource: `wikilink:${parent.id}`,
      })
    }
  }
  return [...rankedById.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

function documentReferenceIndex(documents) {
  const cached = REFERENCE_INDEX_CACHE.get(documents)
  if (cached) return cached
  const byId = new Map(documents.map((document) => [document.id, document]))
  const byReference = new Map()
  for (const document of documents) {
    for (const reference of [document.id, document.title, document.id.replace(/\.md$/iu, ""), document.id.split("/").at(-1)?.replace(/\.md$/iu, "")]) {
      if (reference) byReference.set(normalizeReference(reference), document)
    }
  }
  const index = { byId, byReference }
  REFERENCE_INDEX_CACHE.set(documents, index)
  return index
}

function normalizeReference(value) {
  return String(value).trim().replaceAll("\\", "/").replace(/\.md$/iu, "").toLowerCase()
}

export function splitMarkdownSections(document) {
  if (document[SECTION_CACHE]) return document[SECTION_CACHE]
  const markdown = document.markdown.startsWith("---")
    ? document.markdown.split("---").slice(2).join("---").trimStart()
    : document.markdown
  const lines = markdown.split(/\r?\n/)
  const sections = []
  const headingStack = [{ level: 1, text: document.title }]
  let heading = document.title
  let body = []

  function flush() {
    const content = body.join("\n").trim()
    if (!content) return
    const metadata = Object.entries(document.metadata ?? {}).map(([key, value]) => `${key}: ${value}`).join("\n")
    const headingTrail = headingStack.map((item) => item.text).join(" > ")
    const text = `${document.id}\n${document.title}\n${metadata}\n${headingTrail}\n${heading}\n${content}`
    sections.push({
      id: document.id,
      chunkId: `${document.id}#${sections.length + 1}`,
      title: `${document.title} - ${headingTrail}`,
      text,
      tokens: tokenize(text),
      characters: content.length,
      markdown: content,
      fields: {
        path: retrievalTokens(document.id),
        title: retrievalTokens(document.title),
        metadata: retrievalTokens(metadata),
        headings: retrievalTokens(headingTrail),
        body: retrievalTokens(content),
      },
    })
  }

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      flush()
      const level = match[1].length
      const text = match[2].trim()
      while (headingStack.length && headingStack.at(-1).level >= level) headingStack.pop()
      headingStack.push({ level, text })
      heading = text
      body = []
    } else {
      body.push(line)
    }
  }
  flush()

  const result = sections.length
    ? sections
    : [{
        id: document.id,
        chunkId: `${document.id}#1`,
        title: document.title,
        text: document.text,
        tokens: document.tokens,
        characters: document.characters,
      }]
  Object.defineProperty(document, SECTION_CACHE, {
    value: result,
    enumerable: false,
    configurable: true,
  })
  return result
}

function frequencies(tokens) {
  const cached = FREQUENCY_CACHE.get(tokens)
  if (cached) return cached
  const counts = new Map()
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)
  FREQUENCY_CACHE.set(tokens, counts)
  return counts
}

export function lexicalRank(documents, query) {
  const queryTokens = [...new Set(tokenize(query))]
  return documents
    .map((document) => {
      const counts = frequencies(document.tokens)
      const score = queryTokens.reduce((sum, token) => sum + Math.min(counts.get(token) ?? 0, 3), 0)
      return { ...document, score }
    })
    .filter((document) => document.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

export function bm25Rank(documents, query, { k1 = 1.2, b = 0.75 } = {}) {
  const queryTokens = [...new Set(tokenize(query))]
  const { prepared, averageLength, tokenIndex } = bm25Corpus(documents)
  const documentFrequency = new Map()
  const candidateIndexes = new Set()
  for (const token of queryTokens) {
    const indexes = tokenIndex.get(token) ?? []
    documentFrequency.set(token, indexes.length)
    for (const index of indexes) candidateIndexes.add(index)
  }

  return [...candidateIndexes]
    .map((index) => {
      const { document, counts } = prepared[index]
      let score = 0
      for (const token of queryTokens) {
        const frequency = counts.get(token) ?? 0
        if (!frequency) continue
        const containing = documentFrequency.get(token) ?? 0
        const idf = Math.log(1 + (documents.length - containing + 0.5) / (containing + 0.5))
        const lengthNormalization =
          frequency +
          k1 * (1 - b + b * (document.tokens.length / Math.max(averageLength, 1)))
        score += idf * ((frequency * (k1 + 1)) / lengthNormalization)
      }
      return { ...document, score }
    })
    .filter((document) => document.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

function bm25Corpus(documents) {
  const cached = BM25_CORPUS_CACHE.get(documents)
  if (cached) return cached
  const prepared = documents.map((document) => ({
    document,
    counts: frequencies(document.tokens),
  }))
  const averageLength =
    documents.reduce((sum, document) => sum + document.tokens.length, 0) /
    Math.max(documents.length, 1)
  const tokenIndex = new Map()
  prepared.forEach(({ counts }, index) => {
    for (const token of counts.keys()) {
      const indexes = tokenIndex.get(token)
      if (indexes) indexes.push(index)
      else tokenIndex.set(token, [index])
    }
  })
  const corpus = { prepared, averageLength, tokenIndex }
  BM25_CORPUS_CACHE.set(documents, corpus)
  return corpus
}

const DEFAULT_FIELD_WEIGHTS = Object.freeze({
  path: 1.5,
  title: 4,
  metadata: 3,
  headings: 2.5,
  body: 1,
})

const QUERY_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "before", "by", "for", "from", "how", "in", "is", "it",
  "of", "on", "or", "should", "that", "the", "this", "to", "was", "what", "when", "where", "which", "who", "with",
])

export function bm25fRank(documents, query, {
  k1 = 1.2,
  b = 0.75,
  fieldWeights = DEFAULT_FIELD_WEIGHTS,
  focusQuery = false,
} = {}) {
  const queryTokens = [...new Set(retrievalTokens(query).filter((token) => !focusQuery || !QUERY_STOPWORDS.has(token)))]
  const { fieldNames, prepared, averages, tokenIndex } = bm25fCorpus(documents)
  const documentFrequency = new Map()
  const candidateIndexes = new Set()
  for (const token of queryTokens) {
    const indexes = tokenIndex.get(token) ?? []
    documentFrequency.set(token, indexes.length)
    for (const index of indexes) candidateIndexes.add(index)
  }

  return [...candidateIndexes]
    .map((index) => {
      const { document, counts } = prepared[index]
      let score = 0
      for (const token of queryTokens) {
        const containing = documentFrequency.get(token) ?? 0
        if (!containing) continue
        let weightedFrequency = 0
        for (const field of fieldNames) {
          const tokens = document.fields?.[field] ?? []
          const frequency = counts[field].get(token) ?? 0
          if (!frequency) continue
          const averageLength = Math.max(averages[field], 1)
          const lengthNormalization = 1 - b + b * (tokens.length / averageLength)
          weightedFrequency += (fieldWeights[field] ?? 1) * (frequency / lengthNormalization)
        }
        const idf = Math.log(1 + (documents.length - containing + 0.5) / (containing + 0.5))
        score += idf * ((weightedFrequency * (k1 + 1)) / (weightedFrequency + k1))
      }
      return { ...document, score }
    })
    .filter((document) => document.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

function bm25fCorpus(documents) {
  const cached = BM25F_CORPUS_CACHE.get(documents)
  if (cached) return cached
  const fieldNames = Object.keys(DEFAULT_FIELD_WEIGHTS)
  const prepared = documents.map((document) => ({
    document,
    counts: fieldCounts(document, fieldNames),
  }))
  const averages = Object.fromEntries(fieldNames.map((field) => [
    field,
    documents.reduce((sum, document) => sum + (document.fields?.[field]?.length ?? 0), 0) /
      Math.max(documents.length, 1),
  ]))
  const tokenIndex = new Map()
  prepared.forEach(({ counts }, index) => {
    const tokens = new Set()
    for (const field of fieldNames) {
      for (const token of counts[field].keys()) tokens.add(token)
    }
    for (const token of tokens) {
      const indexes = tokenIndex.get(token) ?? []
      indexes.push(index)
      tokenIndex.set(token, indexes)
    }
  })
  const corpus = { fieldNames, prepared, averages, tokenIndex }
  BM25F_CORPUS_CACHE.set(documents, corpus)
  return corpus
}

function fieldCounts(document, fieldNames) {
  if (document[FIELD_COUNTS_CACHE]) return document[FIELD_COUNTS_CACHE]
  const counts = Object.fromEntries(fieldNames.map((field) => [field, frequencies(document.fields?.[field] ?? [])]))
  Object.defineProperty(document, FIELD_COUNTS_CACHE, {
    value: counts,
    enumerable: false,
    configurable: true,
  })
  return counts
}

export function rank(documents, query, method) {
  if (method === "lexical") return lexicalRank(documents, query)
  if (method === "bm25") return bm25Rank(documents, query)
  if (method === "bm25-sections") {
    const sections = sectionDocuments(documents)
    const rankedSections = bm25Rank(sections, query)
    const seen = new Set()
    return rankedSections.filter((section) => {
      if (seen.has(section.id)) return false
      seen.add(section.id)
      return true
    })
  }
  if (method === "bm25f-sections") {
    const sections = sectionDocuments(documents)
    const rankedSections = bm25fRank(sections, query)
    const seen = new Set()
    return rankedSections.filter((section) => {
      if (seen.has(section.id)) return false
      seen.add(section.id)
      return true
    })
  }
  if (method === "bm25f-focused-sections") {
    const sections = sectionDocuments(documents)
    const rankedSections = bm25fRank(sections, query, { focusQuery: true })
    const seen = new Set()
    return rankedSections.filter((section) => {
      if (seen.has(section.id)) return false
      seen.add(section.id)
      return true
    })
  }
  throw new Error(`Unknown retrieval method: ${method}`)
}

function sectionDocuments(documents) {
  const cached = SECTION_ARRAY_CACHE.get(documents)
  if (cached) return cached
  const sections = documents.flatMap(splitMarkdownSections)
  SECTION_ARRAY_CACHE.set(documents, sections)
  return sections
}

export function scoreRun(results, relevantIds, k = 3) {
  const relevant = new Set(relevantIds)
  const top = results.slice(0, k)
  const hits = top.filter((result) => relevant.has(result.id))
  const firstRelevant = results.findIndex((result) => relevant.has(result.id))

  let dcg = 0
  top.forEach((result, index) => {
    if (relevant.has(result.id)) dcg += 1 / Math.log2(index + 2)
  })
  let ideal = 0
  for (let index = 0; index < Math.min(k, relevant.size); index += 1) {
    ideal += 1 / Math.log2(index + 2)
  }

  return {
    hit: hits.length > 0 ? 1 : 0,
    recall: relevant.size ? hits.length / relevant.size : 1,
    reciprocalRank: firstRelevant >= 0 ? 1 / (firstRelevant + 1) : 0,
    ndcg: ideal ? dcg / ideal : 1,
    contextCharacters: top.reduce((sum, result) => sum + result.characters, 0),
  }
}

export function scoreRunGroups(results, relevantGroups, k = 3) {
  const groups = relevantGroups.map((group) => new Set(group))
  const top = results.slice(0, k)
  const satisfied = groups.filter((group) => top.some((result) => group.has(result.id)))
  const firstRelevant = results.findIndex((result) => groups.some((group) => group.has(result.id)))

  let dcg = 0
  const creditedGroups = new Set()
  top.forEach((result, index) => {
    const groupIndex = groups.findIndex((group) => group.has(result.id))
    if (groupIndex >= 0 && !creditedGroups.has(groupIndex)) {
      creditedGroups.add(groupIndex)
      dcg += 1 / Math.log2(index + 2)
    }
  })
  let ideal = 0
  for (let index = 0; index < Math.min(k, groups.length); index += 1) {
    ideal += 1 / Math.log2(index + 2)
  }

  return {
    hit: satisfied.length > 0 ? 1 : 0,
    recall: groups.length ? satisfied.length / groups.length : 1,
    reciprocalRank: firstRelevant >= 0 ? 1 / (firstRelevant + 1) : 0,
    ndcg: ideal ? Math.min(dcg / ideal, 1) : 1,
    contextCharacters: top.reduce((sum, result) => sum + result.characters, 0),
  }
}

export function summarizeRuns(runs) {
  const total = Math.max(runs.length, 1)
  const average = (field) => runs.reduce((sum, run) => sum + run.metrics[field], 0) / total
  return {
    queries: runs.length,
    hitAtK: average("hit"),
    recallAtK: average("recall"),
    mrr: average("reciprocalRank"),
    ndcgAtK: average("ndcg"),
    averageContextCharacters: average("contextCharacters"),
  }
}

/**
 * Deterministic section-aware rerank for retrieval results.
 *
 * Re-orders candidates with a lightweight structural pass that is
 * orthogonal to BM25F field weighting. Uses three transparent signals:
 *
 * 1. Section focus: what fraction of unique query tokens appear in the
 *    single best-matching section of a document.  Rewards documents
 *    where relevant content is concentrated rather than scattered.
 * 2. Heading affinity: how many distinct query tokens appear in any
 *    section heading of the document.
 * 3. Co-occurrence: how many query tokens appear together (>=2 per
 *    section) across sections.
 *
 * No LLMs, no paid APIs, no external calls.  Each result gains a
 * `rerankApplied` boolean and a `rerankSignals` object documenting
 * the structural scores that contributed to the new rank.
 *
 * @param {import("./retrieval.mjs").RankedResult[]} results
 * @param {string} query
 * @param {import("./retrieval.mjs").ParsedDocument[]} documents
 * @returns {import("./retrieval.mjs").RankedResult[]}
 */
export function sectionFocusRerank(results, query, documents) {
  const docById = new Map()
  for (const doc of documents) docById.set(doc.id, doc)

  const queryTokens = [...new Set(tokenize(query).filter((t) => !QUERY_STOPWORDS.has(t)))]
  if (!queryTokens.length) {
    return results.map((r) => ({ ...r, rerankApplied: false, rerankSignals: null }))
  }

  const scored = results.map((result) => {
    const doc = docById.get(result.id)
    if (!doc) {
      return { ...result, score: Math.max(result.score, 0), rerankApplied: false, rerankSignals: null }
    }

    const sections = splitMarkdownSections(doc)
    if (!sections.length) {
      return { ...result, score: Math.max(result.score, 0), rerankApplied: false, rerankSignals: null }
    }

    let bestSectionFocus = 0
    let headingMatchCount = 0
    let coOccurrenceCount = 0

    for (const section of sections) {
      const sectionTokens = [...new Set(section.tokens)]
      const matched = queryTokens.filter((t) => sectionTokens.includes(t))

      if (matched.length >= 2) {
        coOccurrenceCount += matched.length
      }

      const matchedFraction = matched.length / Math.max(queryTokens.length, 1)
      if (matchedFraction > bestSectionFocus) {
        bestSectionFocus = matchedFraction
      }

      const headingTokens = [...new Set(tokenize(section.title))]
      const headingMatches = queryTokens.filter((t) => headingTokens.includes(t))
      headingMatchCount += headingMatches.length
    }

    const focusBoost = bestSectionFocus * 0.25
    const headingBoost = Math.min(headingMatchCount / Math.max(queryTokens.length, 1), 1) * 0.2
    const coOccurrenceBoost = Math.min(coOccurrenceCount / (Math.max(queryTokens.length, 1) * 2), 1) * 0.1

    const boost = 1 + focusBoost + headingBoost + coOccurrenceBoost
    const originalScore = Math.max(result.score, 0)

    return {
      ...result,
      score: originalScore * boost,
      rerankApplied: true,
      rerankSignals: {
        sectionFocus: Number(bestSectionFocus.toFixed(3)),
        headingMatches: headingMatchCount,
        coOccurrenceMatches: coOccurrenceCount,
        boost: Number(boost.toFixed(4)),
      },
    }
  })

  return scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}
