#!/usr/bin/env node
// Exact full-rank parity screen for the experimental SQLite posting store.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { DatabaseSync } from 'node:sqlite'
import { loadVaultDocuments } from '../src/memory-recall.mjs'
import { rank } from '../src/retrieval.mjs'

const args = process.argv.slice(2)
const option = name => args[args.indexOf(name) + 1]
for (const name of ['--prepared', '--db', '--out', '--limit']) {
  if (!args.includes(name) || !option(name) || option(name).startsWith('--')) throw new Error('Missing ' + name)
}
const prepared = path.resolve(option('--prepared'))
const dbFile = path.resolve(option('--db'))
const out = path.resolve(option('--out'))
const limit = Number(option('--limit'))
if (fs.existsSync(out)) throw new Error('Preserve prior evaluation output')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const manifestBytes = fs.readFileSync(path.join(prepared, 'manifest.json'))
const manifest = JSON.parse(manifestBytes)
const queryBytes = fs.readFileSync(path.join(prepared, 'queries.json'))
if (sha(queryBytes) !== manifest.querySetSha256) throw new Error('Query book drift')
if (![500, manifest.corpusCount].includes(limit)) throw new Error('Only frozen 500/full corpus sizes supported')
const queries = JSON.parse(queryBytes).slice(0, limit === 500 ? 30 : manifest.evaluatedQueries)
  .map(({ id, query }) => ({ id, query }))
if (queries.length !== (limit === 500 ? 30 : manifest.evaluatedQueries)) throw new Error('Incomplete query set')
const db = new DatabaseSync(dbFile, { readOnly: true })
const metadata = JSON.parse(db.prepare("SELECT value FROM meta WHERE key = 'experiment'").get().value)
db.close()
if (metadata.limit !== limit || metadata.archiveSha256 !== manifest.archiveSha256 ||
  metadata.preparedManifestSha256 !== sha(manifestBytes) || Object.keys(metadata.sourceHashes).length !== limit)
  throw new Error('Index/data mismatch')
const vault = path.join(prepared, 'vault')
const documents = loadVaultDocuments(vault, { maxFiles: manifest.corpusCount + 1 }).slice(0, limit)
function checkSources() {
  if (documents.length !== limit) throw new Error('Incomplete corpus')
  for (const document of documents) {
    const digest = sha(fs.readFileSync(path.join(vault, document.id)))
    if (digest !== metadata.sourceHashes[document.id] || digest !== manifest.vaultSourceHashes[document.id])
      throw new Error('Source drift: ' + document.id)
  }
}
checkSources()
const codeNames = ['src/retrieval.mjs', 'src/memory-recall.mjs', 'scripts/experimental-sqlite-postings.mjs',
  'scripts/eval-sqlite-postings.mjs']
const codeHashes = Object.fromEntries(codeNames.map(name => [name, sha(fs.readFileSync(new URL('../' + name, import.meta.url)))]))
for (const name of Object.keys(metadata.codeHashes)) {
  if (metadata.codeHashes[name] !== codeHashes[name]) throw new Error('Index implementation drift: ' + name)
}
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const ledger = { protocol: 'sqlite-postings-parity-v1', complete: false, stopReason: null,
  limit, sourceCount: documents.length, sectionCount: metadata.sectionCount,
  archiveSha256: manifest.archiveSha256, preparedManifestSha256: sha(manifestBytes),
  querySetSha256: sha(queryBytes), codeHashes, indexSha256: sha(fs.readFileSync(dbFile)),
  planned: queries.map(row => row.id), attempted: [], rows: [],
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  limitations: ['Exposed SciFact retrieval data; no answer-level quality',
    'Baseline in one warm Node process versus each SQLite query in a fresh process; timings are not matched performance evidence'] }
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(ledger, null, 2) + '\n')
save()
try {
  const childScript = new URL('./experimental-sqlite-postings.mjs', import.meta.url)
  for (const item of queries) {
    const row = { id: item.id, querySha256: sha(item.query), complete: false }
    ledger.attempted.push(item.id)
    ledger.rows.push(row)
    save()
    let started = performance.now()
    const baseline = rank(documents, item.query, 'bm25f-focused-sections')
      .map(({ id, chunkId, score }) => ({ id, chunkId, score }))
    row.baselineMs = performance.now() - started
    started = performance.now()
    const child = spawnSync(process.execPath, [childScript.pathname, 'query', '--db', dbFile, '--query', item.query],
      { encoding: 'utf8', timeout: 120000, maxBuffer: 128 * 1024 * 1024 })
    row.sqliteColdProcessMs = performance.now() - started
    row.exitCode = child.status
    if (child.error) throw child.error
    if (child.status !== 0) throw new Error('SQLite query failed: ' + child.stderr.slice(0, 500))
    const indexed = JSON.parse(child.stdout)
    row.baselineResultSha256 = sha(JSON.stringify(baseline))
    row.indexedResultSha256 = sha(JSON.stringify(indexed))
    row.resultCount = baseline.length
    if (row.baselineResultSha256 !== row.indexedResultSha256) {
      const mismatch = baseline.findIndex((value, index) => JSON.stringify(value) !== JSON.stringify(indexed[index]))
      row.firstDifference = { index: mismatch, baseline: baseline[mismatch], indexed: indexed[mismatch] }
      throw new Error('Full-rank mismatch: ' + item.id)
    }
    assert.equal(indexed.length, baseline.length)
    row.complete = true
    save()
    if (ledger.attempted.length % 25 === 0) console.log(JSON.stringify({ completed: ledger.attempted.length, planned: queries.length }))
  }
  checkSources()
  for (const [name, digest] of Object.entries(codeHashes)) {
    if (sha(fs.readFileSync(new URL('../' + name, import.meta.url))) !== digest) throw new Error('Implementation drift: ' + name)
  }
  if (sha(fs.readFileSync(dbFile)) !== ledger.indexSha256) throw new Error('Index drift')
  ledger.processResourceUsage = process.resourceUsage()
  ledger.finalProcessMemoryBytes = process.memoryUsage()
  ledger.complete = true
  save()
} catch (error) {
  ledger.stopReason = error.message
  save()
  throw error
}
