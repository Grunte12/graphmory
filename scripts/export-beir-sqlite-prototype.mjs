#!/usr/bin/env node
// Export both actual focused-BM25F implementations to the unchanged BEIR scorer.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { loadVaultDocuments } from '../src/memory-recall.mjs'
import { rank } from '../src/retrieval.mjs'

const args = process.argv.slice(2)
const option = name => args[args.indexOf(name) + 1]
for (const name of ['--prepared', '--db', '--out']) {
  if (!args.includes(name) || !option(name) || option(name).startsWith('--')) throw new Error('Missing ' + name)
}
const prepared = path.resolve(option('--prepared'))
const db = path.resolve(option('--db'))
const out = path.resolve(option('--out'))
if (fs.existsSync(out)) throw new Error('Preserve prior run outputs')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const manifestBytes = fs.readFileSync(path.join(prepared, 'manifest.json'))
const input = JSON.parse(manifestBytes)
const queryBytes = fs.readFileSync(path.join(prepared, 'queries.json'))
if (sha(queryBytes) !== input.querySetSha256) throw new Error('Query book drift')
const queries = JSON.parse(queryBytes).map(({ id, query }) => ({ id, query }))
if (queries.length !== input.evaluatedQueries) throw new Error('Incomplete query set')
const mapping = JSON.parse(fs.readFileSync(path.join(prepared, 'mapping.json')))
const originals = new Map(Object.entries(mapping).map(([id, note]) => [note, id]))
const vault = path.join(prepared, 'vault')
const documents = loadVaultDocuments(vault, { maxFiles: input.corpusCount + 1 })
function verifySources() {
  if (documents.length !== input.corpusCount || originals.size !== documents.length) throw new Error('Incomplete corpus')
  for (const document of documents) {
    if (sha(fs.readFileSync(path.join(vault, document.id))) !== input.vaultSourceHashes[document.id]) throw new Error('Source drift')
  }
}
verifySources()
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const names = ['src/retrieval.mjs', 'src/memory-recall.mjs', 'scripts/experimental-sqlite-postings.mjs',
  'scripts/export-beir-sqlite-prototype.mjs']
const codeHashes = Object.fromEntries(names.map(name => [name, sha(fs.readFileSync(new URL('../' + name, import.meta.url)))]))
const ledger = { protocol: 'sqlite-postings-BEIR-development-v1', archiveSha256: input.archiveSha256,
  preparedManifestSha256: sha(manifestBytes), corpusCount: documents.length,
  planned: queries.map(row => row.id), attempted: [], complete: false, stopReason: null,
  arms: ['bm25fFocusedCurrent', 'bm25fFocusedSqlite'], kValues: [1, 3, 5, 10], codeHashes,
  indexSha256: sha(fs.readFileSync(db)),
  limitation: 'Exposed SciFact retrieval scores only; treatment is experimental Node 24 index, not production CLI' }
const runs = Object.fromEntries(ledger.arms.map(name => [name, {}]))
const save = () => {
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(ledger, null, 2) + '\n')
  for (const [name, results] of Object.entries(runs)) fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(results) + '\n')
}
save()
function toRun(results) {
  return Object.fromEntries(results.slice(0, 10).map((item, index) => {
    if (!originals.has(item.id)) throw new Error('Unmapped note')
    return [originals.get(item.id), Math.min(results.length, 10) - index]
  }))
}
try {
  const script = new URL('./experimental-sqlite-postings.mjs', import.meta.url)
  for (const item of queries) {
    const baseline = rank(documents, item.query, 'bm25f-focused-sections')
      .map(({ id, chunkId, score }) => ({ id, chunkId, score }))
    const child = spawnSync(process.execPath, [script.pathname, 'query', '--db', db, '--query', item.query],
      { encoding: 'utf8', timeout: 120000, maxBuffer: 128 * 1024 * 1024 })
    if (child.error) throw child.error
    if (child.status !== 0) throw new Error('SQLite query failed: ' + child.stderr.slice(0, 500))
    const indexed = JSON.parse(child.stdout)
    assert.deepEqual(indexed, baseline, 'Full rank/score mismatch: ' + item.id)
    runs.bm25fFocusedCurrent[item.id] = toRun(baseline)
    runs.bm25fFocusedSqlite[item.id] = toRun(indexed)
    ledger.attempted.push(item.id)
    save()
    if (ledger.attempted.length % 25 === 0) console.log(JSON.stringify({ completed: ledger.attempted.length, planned: queries.length }))
  }
  verifySources()
  for (const [name, digest] of Object.entries(codeHashes)) {
    if (sha(fs.readFileSync(new URL('../' + name, import.meta.url))) !== digest) throw new Error('Implementation drift')
  }
  if (sha(fs.readFileSync(db)) !== ledger.indexSha256) throw new Error('Index drift')
  ledger.complete = true
  save()
} catch (error) {
  ledger.stopReason = error.message
  save()
  throw error
}
