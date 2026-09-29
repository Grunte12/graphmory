#!/usr/bin/env node
// Evaluate the existing public semantic API without changing its model or ranking.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { loadVaultDocuments } from '../src/memory-recall.mjs'
import { recallVaultSemantic } from '../src/semantic-recall.mjs'

const args = process.argv.slice(2)
const option = name => args[args.indexOf(name) + 1]
for (const name of ['--prepared', '--out', '--model-cache']) {
  if (!args.includes(name) || !option(name) || option(name).startsWith('--')) throw new Error('Missing ' + name)
}
const prepared = path.resolve(option('--prepared'))
const out = path.resolve(option('--out'))
const modelCache = path.resolve(option('--model-cache'))
if (fs.existsSync(out)) throw new Error('Preserve prior run outputs')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const manifestBytes = fs.readFileSync(path.join(prepared, 'manifest.json'))
const input = JSON.parse(manifestBytes)
const queryBytes = fs.readFileSync(path.join(prepared, 'queries.json'))
if (sha(queryBytes) !== input.querySetSha256) throw new Error('Query book drift')
const mapping = JSON.parse(fs.readFileSync(path.join(prepared, 'mapping.json')))
const originalIds = new Map(Object.entries(mapping).map(([id, note]) => [note, id]))
const vault = path.join(prepared, 'vault')
const documents = loadVaultDocuments(vault, { maxFiles: input.corpusCount + 1 })
function verifySources() {
  if (documents.length !== input.corpusCount || originalIds.size !== documents.length) throw new Error('Incomplete corpus')
  for (const document of documents) {
    if (sha(fs.readFileSync(path.join(vault, document.id))) !== input.vaultSourceHashes[document.id]) throw new Error('Source drift')
  }
}
verifySources()
const queries = JSON.parse(queryBytes).map(({ id, query }) => ({ id, query }))
if (queries.length !== input.evaluatedQueries) throw new Error('Incomplete query book')
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const ledger = { archiveSha256: input.archiveSha256, preparedManifestSha256: sha(manifestBytes),
  corpusCount: input.corpusCount, planned: queries.map(item => item.id), attempted: [],
  complete: false, stopReason: null, arms: ['existingBgeHybrid'], kValues: [1, 3, 5, 10],
  configuration: { model: 'Xenova/bge-small-en-v1.5', k: 10, maxDocumentCharacters: 8000,
    sparseLimit: 20, vectorLimit: 20, dtype: 'unchanged pipeline default', modelCache },
  codeHashes: Object.fromEntries(['scripts/export-beir-existing-semantic.mjs', 'src/semantic-recall.mjs', 'src/retrieval.mjs', 'src/memory-recall.mjs']
    .map(name => [name, sha(fs.readFileSync(new URL('../' + name, import.meta.url)))])),
  queryMilliseconds: [], usage: 'no LLM calls; local embeddings; timed API includes vault/cache IO and query inference' }
const results = {}
const save = () => {
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(ledger, null, 2) + '\n')
  fs.writeFileSync(path.join(out, 'existingBgeHybrid.json'), JSON.stringify(results) + '\n')
}
save()
try {
  for (const item of queries) {
    const start = performance.now()
    const report = await recallVaultSemantic(vault, item.query, {
      k: 10, maxFiles: input.corpusCount + 1, modelCache,
    })
    if (report.scanned !== input.corpusCount || report.scanLimitReached) throw new Error('Partial semantic corpus')
    results[item.id] = Object.fromEntries(report.results.map((row, index) => {
      if (!originalIds.has(row.path)) throw new Error('Unmapped result')
      return [originalIds.get(row.path), report.results.length - index]
    }))
    ledger.attempted.push(item.id)
    ledger.queryMilliseconds.push(performance.now() - start)
    save()
    if (ledger.attempted.length % 25 === 0) console.log(JSON.stringify({ completed: ledger.attempted.length, planned: queries.length }))
  }
  verifySources()
  for (const [name, digest] of Object.entries(ledger.codeHashes)) {
    if (sha(fs.readFileSync(new URL('../' + name, import.meta.url))) !== digest) throw new Error('Implementation drift: ' + name)
  }
  ledger.processResourceUsage = process.resourceUsage()
  ledger.finalProcessMemoryBytes = process.memoryUsage()
  ledger.complete = true
  save()
} catch (error) {
  ledger.stopReason = String(error.message)
  save()
  throw error
}
