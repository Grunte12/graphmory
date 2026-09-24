import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { governedRank, isRetrievable } from "./retrieval.mjs"
import { loadVaultDocuments } from "./memory-recall.mjs"
import { writeJsonAtomic } from "./atomic-write.mjs"

const DEFAULT_MODEL = "Xenova/bge-small-en-v1.5"
const PIPELINES = new Map()

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

  const documents = loadVaultDocuments(vault, { includeRawPaths, maxFiles, scope })
  const eligible = documents.filter((document) => isRetrievable(document, { includeNoncanonical }))
  const embed = await loadEmbeddingPipeline(model, modelCache)
  const vectorById = await cachedDocumentVectors(eligible, embed, {
    vault, scope, model, modelCache, maxDocumentCharacters,
  })
  const queryOutput = await embed(query, { pooling: "mean", normalize: true })
  const queryVector = queryOutput.tolist()[0]

  const vectorResults = eligible
    .map((document) => ({ ...document, score: dot(queryVector, vectorById.get(document.id)), retrievalSource: "semantic-vector" }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))

  const sparse = governedRank(documents, query, "bm25f-sections", { includeNoncanonical }).results
  const fused = reciprocalRankFuse([
    { name: "bm25f-sections", results: sparse.slice(0, sparseLimit) },
    { name: "semantic-vector", results: vectorResults.slice(0, vectorLimit) },
  ])

  const top = fused.slice(0, k)
  const confidence = semanticConfidence(fused)

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

export function semanticConfidence(results) {
  if (!results.length) return "none"
  const [first, second] = results
  if (first.lanes.length < 2) return "low"
  if (second && first.fusedScore / second.fusedScore < 1.15) return "low"
  return "bounded"
}

async function loadTransformers() {
  if (process.env.MPH_TEST_SEMANTIC_MOCK_MISSING === "1") {
    throw new Error(
      "OPTIONAL_DEPENDENCY_MISSING: install @huggingface/transformers to use recall-semantic, or use recall/recall-loop for dependency-free retrieval.",
    )
  }
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

async function loadEmbeddingPipeline(model, modelCache) {
  const key = `${model}\0${modelCache}`
  if (!PIPELINES.has(key)) PIPELINES.set(key, (async () => {
    const transformers = await loadTransformers()
    if (modelCache) transformers.env.cacheDir = modelCache
    return transformers.pipeline("feature-extraction", model)
  })())
  try { return await PIPELINES.get(key) } catch (error) { PIPELINES.delete(key); throw error }
}

export async function cachedDocumentVectors(documents, embed, {
  vault, scope = "", model, modelCache = "", maxDocumentCharacters = 8000,
} = {}) {
  const directory = modelCache || path.join(os.homedir(), ".cache", "graphmory", "semantic")
  const cacheId = createHash("sha256").update(`${path.resolve(vault)}\0${scope}\0${model}\0${maxDocumentCharacters}`).digest("hex")
  const file = path.join(directory, "graphmory-vectors", `${cacheId}.json`)
  let prior = {}
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
    if (parsed.version === 1 && parsed.model === model && parsed.maxDocumentCharacters === maxDocumentCharacters) prior = parsed.vectors ?? {}
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error
  }
  const vectors = {}
  const pending = []
  for (const document of documents) {
    const text = semanticText(document, maxDocumentCharacters)
    const digest = createHash("sha256").update(text).digest("hex")
    const cached = prior[document.id]
    if (cached?.digest === digest && Array.isArray(cached.vector) && cached.vector.every(Number.isFinite)) {
      vectors[document.id] = cached
    } else pending.push({ id: document.id, text, digest })
  }
  for (let offset = 0; offset < pending.length; offset += 16) {
    const batch = pending.slice(offset, offset + 16)
    const output = await embed(batch.map((item) => item.text), { pooling: "mean", normalize: true })
    const batchVectors = output.tolist()
    if (batchVectors.length !== batch.length) throw new Error("Semantic embedding model returned an unexpected vector count")
    batch.forEach((item, index) => { vectors[item.id] = { digest: item.digest, vector: batchVectors[index] } })
  }
  if (pending.length || Object.keys(prior).length !== documents.length) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
    writeJsonAtomic(file, { version: 1, model, maxDocumentCharacters, vectors })
    fs.chmodSync(file, 0o600)
  }
  return new Map(documents.map((document) => [document.id, vectors[document.id].vector]))
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
