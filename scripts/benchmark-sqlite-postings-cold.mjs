#!/usr/bin/env node
// Paired fresh-process CLI wall-time screen, alternating arm order by query.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { DatabaseSync } from 'node:sqlite'

const args = process.argv.slice(2)
const option = name => args[args.indexOf(name) + 1]
for (const name of ['--prepared', '--db', '--out']) {
  if (!args.includes(name) || !option(name) || option(name).startsWith('--')) throw new Error('Missing ' + name)
}
const prepared = path.resolve(option('--prepared'))
const dbFile = path.resolve(option('--db'))
const out = path.resolve(option('--out'))
if (fs.existsSync(out)) throw new Error('Preserve prior benchmark output')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const manifestBytes = fs.readFileSync(path.join(prepared, 'manifest.json'))
const manifest = JSON.parse(manifestBytes)
const queryBytes = fs.readFileSync(path.join(prepared, 'queries.json'))
if (sha(queryBytes) !== manifest.querySetSha256) throw new Error('Query book drift')
const queries = JSON.parse(queryBytes).slice(0, 30).map(({ id, query }) => ({ id, query }))
if (queries.length !== 30 || new Set(queries.map(row => row.id)).size !== 30) throw new Error('Incomplete 30-query screen')
const db = new DatabaseSync(dbFile, { readOnly: true })
const metadata = JSON.parse(db.prepare("SELECT value FROM meta WHERE key = 'experiment'").get().value)
db.close()
if (metadata.limit !== manifest.corpusCount || metadata.archiveSha256 !== manifest.archiveSha256)
  throw new Error('Index/data mismatch')
const script = new URL('./experimental-sqlite-postings.mjs', import.meta.url)
const codeHashes = Object.fromEntries(['src/retrieval.mjs', 'src/memory-recall.mjs',
  'scripts/experimental-sqlite-postings.mjs', 'scripts/benchmark-sqlite-postings-cold.mjs']
  .map(name => [name, sha(fs.readFileSync(new URL('../' + name, import.meta.url)))]))
for (const [name, digest] of Object.entries(metadata.codeHashes)) {
  if (codeHashes[name] !== digest) throw new Error('Index implementation drift')
}
const vault = path.join(prepared, 'vault')
function checkSources() {
  if (Object.keys(metadata.sourceHashes).length !== manifest.corpusCount) throw new Error('Incomplete indexed corpus')
  for (const [name, digest] of Object.entries(metadata.sourceHashes)) {
    if (digest !== manifest.vaultSourceHashes[name] || sha(fs.readFileSync(path.join(vault, name))) !== digest)
      throw new Error('Source drift: ' + name)
  }
}
checkSources()
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const ledger = { protocol: 'sqlite-postings-cold-process-development-v1', complete: false,
  stopReason: null, corpusCount: manifest.corpusCount, archiveSha256: manifest.archiveSha256,
  preparedManifestSha256: sha(manifestBytes), querySetSha256: sha(queryBytes),
  indexSha256: sha(fs.readFileSync(dbFile)), codeHashes,
  planned: queries.flatMap((row, index) => (index % 2 ? ['sqlite', 'baseline'] : ['baseline', 'sqlite'])
    .map(arm => `${row.id}:${arm}`)), attempted: [], rows: [],
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  limitations: ['Cold Node process with warmed/uncontrolled OS file cache',
    'Full JSON output serialization included; no Curator/Lead answer model or actual agent workflow',
    'SQLite treatment is experimental Node 24-only; production Graphmory still supports Node >=20'] }
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(ledger, null, 2) + '\n')
save()
try {
  for (const [index, item] of queries.entries()) {
    const order = index % 2 ? ['sqlite', 'baseline'] : ['baseline', 'sqlite']
    const row = { id: item.id, querySha256: sha(item.query), order, arms: {}, complete: false }
    ledger.rows.push(row)
    save()
    for (const arm of order) {
      ledger.attempted.push(`${item.id}:${arm}`)
      const current = { exitCode: null, complete: false }
      row.arms[arm] = current
      save()
      const command = arm === 'baseline'
        ? [script.pathname, 'baseline-query', '--prepared', prepared, '--limit', String(manifest.corpusCount), '--query', item.query]
        : [script.pathname, 'query', '--db', dbFile, '--query', item.query]
      const started = performance.now()
      const child = spawnSync(process.execPath, command, { encoding: 'utf8', timeout: 120000,
        maxBuffer: 128 * 1024 * 1024, env: { ...process.env, GRAPHMORY_EXPERIMENT_METRICS: '1' } })
      current.wallMs = performance.now() - started
      current.exitCode = child.status
      if (child.error) throw child.error
      if (child.status !== 0) throw new Error(`${arm} failed: ${child.stderr.slice(0, 500)}`)
      const results = JSON.parse(child.stdout)
      const metrics = JSON.parse(child.stderr.trim().split('\n').at(-1))
      if (!Number.isFinite(metrics.rssBytes) || !Number.isFinite(metrics.maxRssRaw)) throw new Error('Missing memory telemetry')
      current.resultSha256 = sha(JSON.stringify(results))
      current.resultCount = results.length
      current.stdoutBytes = Buffer.byteLength(child.stdout)
      current.rssBytes = metrics.rssBytes
      current.maxRssRaw = metrics.maxRssRaw
      current.complete = true
      save()
    }
    assert.equal(row.arms.baseline.resultSha256, row.arms.sqlite.resultSha256, 'Output parity: ' + item.id)
    assert.equal(row.arms.baseline.resultCount, row.arms.sqlite.resultCount)
    row.complete = true
    save()
    if ((index + 1) % 5 === 0) console.log(JSON.stringify({ completedPairs: index + 1, plannedPairs: queries.length }))
  }
  checkSources()
  for (const [name, digest] of Object.entries(codeHashes)) {
    if (sha(fs.readFileSync(new URL('../' + name, import.meta.url))) !== digest) throw new Error('Implementation drift')
  }
  if (sha(fs.readFileSync(dbFile)) !== ledger.indexSha256) throw new Error('Index drift')
  ledger.complete = true
  save()
} catch (error) {
  ledger.stopReason = error.message
  save()
  throw error
}
