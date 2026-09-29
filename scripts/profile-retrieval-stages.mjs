#!/usr/bin/env node
// Diagnostic decomposition of the existing public retrieval components.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { loadVaultDocuments } from '../src/memory-recall.mjs'
import { governedRank, isRetrievable } from '../src/retrieval.mjs'
import { cachedDocumentVectors } from '../src/semantic-recall.mjs'

const args = process.argv.slice(2)
const option = name => args[args.indexOf(name) + 1]
for (const name of ['--prepared', '--out', '--model-cache']) {
  if (!args.includes(name) || !option(name) || option(name).startsWith('--')) throw new Error('Missing ' + name)
}
const prepared = path.resolve(option('--prepared'))
const out = path.resolve(option('--out'))
const modelCache = path.resolve(option('--model-cache'))
if (fs.existsSync(out)) throw new Error('Preserve prior experiment outputs')
const model = 'Xenova/bge-small-en-v1.5'
const vault = path.join(prepared, 'vault')
const sha = data => createHash('sha256').update(data).digest('hex')
const manifestBytes = fs.readFileSync(path.join(prepared, 'manifest.json'))
const preparedManifest = JSON.parse(manifestBytes)
const queryBytes = fs.readFileSync(path.join(prepared, 'queries.json'))
if (sha(queryBytes) !== preparedManifest.querySetSha256) throw new Error('Query book drift')
const queries = JSON.parse(queryBytes).slice(0, 30).map(({ id, query }) => ({ id, query }))
if (queries.length !== 30 || new Set(queries.map(row => row.id)).size !== 30) throw new Error('Expected 30 distinct pinned queries')
const modelFile = path.join(modelCache, model, 'onnx', 'model.onnx')
if (!fs.existsSync(modelFile)) throw new Error('Precached BGE model missing')
const codeNames = ['src/memory-recall.mjs', 'src/retrieval.mjs', 'src/semantic-recall.mjs',
  'scripts/profile-retrieval-stages.mjs']
const codeHashes = Object.fromEntries(codeNames.map(name => [name, sha(fs.readFileSync(new URL('../' + name, import.meta.url)))]))
function checkSources() {
  const documents = loadVaultDocuments(vault, { maxFiles: preparedManifest.corpusCount + 1 })
  if (documents.length !== preparedManifest.corpusCount) throw new Error('Incomplete corpus')
  for (const document of documents) {
    if (sha(fs.readFileSync(path.join(vault, document.id))) !== preparedManifest.vaultSourceHashes[document.id])
      throw new Error('Source drift: ' + document.id)
  }
}
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const ledger = { protocol: 'retrieval-stage-profile-development-v1', complete: false, stopReason: null,
  corpusCount: preparedManifest.corpusCount, archiveSha256: preparedManifest.archiveSha256,
  preparedManifestSha256: sha(manifestBytes), querySetSha256: sha(queryBytes),
  model, modelFileSha256: sha(fs.readFileSync(modelFile)), codeHashes,
  planned: queries.map(row => row.id), attempted: [], rows: [],
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  limitations: ['Diagnostic stage composition; not whole API/CLI latency', 'Warm uncontrolled filesystem cache',
    'No answer quality, model-call tokens or cost'] }
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(ledger, null, 2) + '\n')
save()
try {
  checkSources()
  const transformers = await import('@huggingface/transformers')
  transformers.env.cacheDir = modelCache
  transformers.env.allowRemoteModels = false
  let started = performance.now()
  const embed = await transformers.pipeline('feature-extraction', model)
  ledger.modelInitMs = performance.now() - started
  save()
  const cacheOnly = async () => { throw new Error('Vector cache miss; no embedding allowed in this profile') }
  for (const item of queries) {
    const row = { id: item.id, querySha256: sha(item.query), stageMs: {}, complete: false }
    ledger.attempted.push(item.id)
    ledger.rows.push(row)
    save()
    started = performance.now()
    const documents = loadVaultDocuments(vault, { maxFiles: preparedManifest.corpusCount + 1 })
    row.stageMs.loadVaultDocuments = performance.now() - started
    assert.equal(documents.length, preparedManifest.corpusCount)
    started = performance.now()
    const bm25 = governedRank(documents, item.query, 'bm25')
    row.stageMs.bm25 = performance.now() - started
    started = performance.now()
    const focused = governedRank(documents, item.query, 'bm25f-focused-sections')
    row.stageMs.bm25fFocusedSections = performance.now() - started
    const eligible = documents.filter(document => isRetrievable(document))
    started = performance.now()
    const vectors = await cachedDocumentVectors(eligible, cacheOnly, { vault, model, modelCache, maxDocumentCharacters: 8000 })
    row.stageMs.cachedDocumentVectors = performance.now() - started
    assert.equal(vectors.size, eligible.length)
    started = performance.now()
    const queryVector = (await embed(item.query, { pooling: 'mean', normalize: true })).tolist()[0]
    row.stageMs.queryEmbedding = performance.now() - started
    started = performance.now()
    const dense = eligible.map(document => {
      const vector = vectors.get(document.id)
      assert.equal(vector.length, queryVector.length)
      let score = 0
      for (let i = 0; i < vector.length; i++) score += queryVector[i] * vector[i]
      return { id: document.id, score }
    }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    row.stageMs.denseScanSort = performance.now() - started
    row.counts = { documents: documents.length, eligible: eligible.length,
      bm25: bm25.results.length, focused: focused.results.length, dense: dense.length }
    row.rssBytes = process.memoryUsage().rss
    row.complete = true
    save()
    if (ledger.attempted.length % 5 === 0) console.log(JSON.stringify({ completed: ledger.attempted.length, planned: queries.length }))
  }
  checkSources()
  for (const [name, digest] of Object.entries(codeHashes)) {
    if (sha(fs.readFileSync(new URL('../' + name, import.meta.url))) !== digest) throw new Error('Implementation drift: ' + name)
  }
  ledger.processResourceUsage = process.resourceUsage()
  ledger.finalProcessMemoryBytes = process.memoryUsage()
  ledger.complete = true
  save()
} catch (error) {
  ledger.stopReason = error.message
  save()
  throw error
}
