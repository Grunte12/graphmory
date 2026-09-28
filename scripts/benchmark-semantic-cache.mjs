// Measure existing semantic API or vector-cache hits on a pinned prepared BEIR corpus.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { loadVaultDocuments } from '../src/memory-recall.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
for (const name of ['--prepared', '--model-cache', '--out']) {
  if (!option(name) || option(name).startsWith('--')) throw new Error('Missing ' + name)
}
const prepared = path.resolve(option('--prepared'))
const vault = path.join(prepared, 'vault')
const out = path.resolve(option('--out'))
if (fs.existsSync(out)) throw new Error('Preserve prior output')
const mode = option('--mode') ?? 'api'
if (!['api', 'cache'].includes(mode)) throw new Error('mode must be api or cache')
const count = Number(option('--count') ?? (mode === 'cache' ? 9 : 30))
if (!Number.isInteger(count) || count < 2) throw new Error('count must be an integer >= 2')
const implementation = option('--module') ? pathToFileURL(path.resolve(option('--module'))) : new URL('../src/semantic-recall.mjs', import.meta.url)
const api = await import(implementation.href)
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const input = JSON.parse(fs.readFileSync(path.join(prepared, 'manifest.json')))
const queryBytes = fs.readFileSync(path.join(prepared, 'queries.json'))
if (sha(queryBytes) !== input.querySetSha256) throw new Error('Query drift')
const queries = JSON.parse(queryBytes).map(({ id, query }) => ({ id, query }))
if (queries.length !== input.evaluatedQueries || (mode === 'api' && count > queries.length)) throw new Error('Invalid query count')
const documents = loadVaultDocuments(vault, { maxFiles: input.corpusCount + 1 })
function verifySources() {
  const current = loadVaultDocuments(vault, { maxFiles: input.corpusCount + 1 })
  if (current.length !== input.corpusCount) throw new Error('Incomplete corpus')
  for (const document of current) {
    if (sha(fs.readFileSync(path.join(vault, document.id))) !== input.vaultSourceHashes[document.id]) throw new Error('Source drift')
  }
}
verifySources()
const report = { mode, implementation: implementation.href,
  implementationSha256: sha(fs.readFileSync(implementation)), archiveSha256: input.archiveSha256,
  querySetSha256: input.querySetSha256, corpusCount: input.corpusCount,
  plannedCalls: count, plannedQueryIds: mode === 'api' ? queries.slice(0, count).map(query => query.id) : [],
  complete: false, stopReason: null, rows: [], timingScope: 'API calls only; first call separate; no forced GC' }
const save = () => fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
const options = { vault, model: 'Xenova/bge-small-en-v1.5', modelCache: path.resolve(option('--model-cache')), maxDocumentCharacters: 8000 }
save()
try {
  for (let index = 0; index < count; index++) {
    const start = performance.now()
    if (mode === 'cache') {
      const vectors = await api.cachedDocumentVectors(documents, () => { throw new Error('Unexpected embedding on cache-hit corpus') }, options)
      if (vectors.size !== input.corpusCount) throw new Error('Incomplete cached vectors')
      report.rows.push({ index, milliseconds: performance.now() - start, vectors: vectors.size })
    } else {
      const query = queries[index]
      const result = await api.recallVaultSemantic(vault, query.query, { k: 10, maxFiles: input.corpusCount + 1, modelCache: options.modelCache })
      if (result.scanned !== input.corpusCount || result.scanLimitReached) throw new Error('Partial recall')
      report.rows.push({ id: query.id, milliseconds: performance.now() - start, results: result.results })
    }
    save()
  }
  report.resources = process.resourceUsage()
  report.memory = process.memoryUsage()
  verifySources()
  report.complete = true
  save()
} catch (error) {
  report.stopReason = String(error.message)
  save()
  throw error
}
console.log(JSON.stringify({ out, complete: true, calls: report.rows.length, maxRSS: report.resources.maxRSS }))
