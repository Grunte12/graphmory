import { governedRank } from "./retrieval.mjs"
import { filterByScope, loadVaultDocuments } from "./memory-recall.mjs"

const DEFAULT_MODEL = "Xenova/bge-small-en-v1.5"

export async function recallVaultSemantic(vault, query, {
  k = 3,
  scope = "",
  includeNoncanonical = false,
  includeRawPaths = false,
  maxFiles = 5000,
  model = DEFAULT_MODEL,
  modelCache = "",
  maxDocumentCharacters = 8000,
  sparseLimit = 20,
  vectorLimit = 20,
} = {}) {
  if (!query?.trim()) throw new Error("query is required")
  if (!Number.isInteger(k) || k < 1 || k > 10) throw new Error("k must be between 1 and 10")
  if (!Number.isInteger(maxFiles) || maxFiles < 1) throw new Error("maxFiles must be positive")

  const documents = filterByScope(loadVaultDocuments(vault, { includeRawPaths, maxFiles }), scope)
  const transformers = await loadTransformers()
  if (modelCache) transformers.env.cacheDir = modelCache
  const embed = await transformers.pipeline("feature-extraction", model)

  const textById = new Map(documents.map((document) => [
    document.id,
    semanticText(document, maxDocumentCharacters),
  ]))
  const documentVectors = await embed([...textById.values()], { pooling: "mean", normalize: true })
  const vectors = documentVectors.tolist()
  const vectorById = new Map(documents.map((document, index) => [document.id, vectors[index]]))
  const queryOutput = await embed(query, { pooling: "mean", normalize: true })
  const queryVector = queryOutput.tolist()[0]

  const vectorResults = documents
    .map((document) => ({ ...document, score: dot(queryVector, vectorById.get(document.id)), retrievalSource: "semantic-vector" }))
    .filter((document) => includeNoncanonical || !["raw", "stale", "superseded", "archived"].includes(String(document.metadata?.status ?? document.metadata?.lifecycle ?? "current").toLowerCase()))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))

  const sparse = governedRank(documents, query, "bm25f-sections", { includeNoncanonical }).results
  const fused = reciprocalRankFuse([
    { name: "bm25f-sections", results: sparse.slice(0, sparseLimit) },
    { name: "semantic-vector", results: vectorResults.slice(0, vectorLimit) },
  ])

  const top = fused.slice(0, k)
  const confidence = top.length === 0
    ? "none"
    : top[0].fusedScore >= 1 / 61
      ? "bounded"
      : "low"

  return {
    query,
    method: "semantic-hybrid",
    model,
    k,
    scanned: documents.length,
    scanLimitReached: documents.length >= maxFiles,
    confidence,
    needsExpansion: confidence !== "bounded",
    nextSteps: confidence === "bounded"
      ? []
      : [
          "Run sparse recall with a narrower --scope first.",
          "Add aliases/frontmatter when repeated paraphrase misses occur.",
          "Use semantic recall only as an escalation lane, not as the canonical memory truth.",
        ],
    results: top.map((item) => ({
      path: item.id,
      title: item.title,
      score: Number(item.fusedScore.toFixed(4)),
      status: item.metadata?.status ?? item.metadata?.lifecycle ?? "current",
      lanes: item.lanes,
    })),
  }
}

async function loadTransformers() {
  try {
    return await import("@huggingface/transformers")
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND" || /@huggingface\/transformers/u.test(error.message)) {
      throw new Error(
        "OPTIONAL_DEPENDENCY_MISSING: install @huggingface/transformers to use recall-semantic, or use recall/recall-loop for dependency-free retrieval.",
      )
    }
    throw error
  }
}

function semanticText(document, maxCharacters) {
  const metadata = JSON.stringify(document.metadata ?? {})
  const body = document.markdown.slice(0, maxCharacters)
  return `title: ${document.title}\npath: ${document.id}\nmetadata: ${metadata}\nbody:\n${body}`
}

function dot(a, b) {
  let value = 0
  for (let index = 0; index < a.length; index += 1) value += a[index] * b[index]
  return value
}

function reciprocalRankFuse(lanes, constant = 60) {
  const byId = new Map()
  for (const lane of lanes) {
    lane.results.forEach((item, index) => {
      const current = byId.get(item.id) ?? {
        ...item,
        fusedScore: 0,
        lanes: [],
      }
      current.fusedScore += 1 / (constant + index + 1)
      current.lanes.push(lane.name)
      byId.set(item.id, current)
    })
  }
  return [...byId.values()].sort((a, b) => b.fusedScore - a.fusedScore || a.id.localeCompare(b.id))
}
