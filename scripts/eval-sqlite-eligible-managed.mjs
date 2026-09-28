#!/usr/bin/env node
// Paired full managed-response parity and fresh-process latency screen.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { loadVaultDocuments } from '../src/memory-recall.mjs'

const argv = process.argv.slice(2)
const option = name => argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined
for (const name of ['--prepared', '--db', '--mutations', '--out']) {
  if (!option(name) || option(name).startsWith('--')) throw new Error('Missing ' + name)
}
const prepared = path.resolve(option('--prepared'))
const db = path.resolve(option('--db'))
const mutations = path.resolve(option('--mutations'))
const out = path.resolve(option('--out'))
if (fs.existsSync(out)) throw new Error('Preserve previous evaluation output')
const sha = value => createHash('sha256').update(value).digest('hex')
const worker = new URL('./experimental-managed-sqlite-arm.mjs', import.meta.url)
const codeNames = ['src/retrieval.mjs', 'src/memory-recall.mjs', 'src/decision-recall.mjs',
  'scripts/experimental-sqlite-postings.mjs', 'scripts/experimental-sqlite-eligible-ranker.mjs',
  'scripts/experimental-managed-sqlite-arm.mjs', 'scripts/eval-sqlite-eligible-managed.mjs']
const codeHashes = Object.fromEntries(codeNames.map(name => [name, sha(fs.readFileSync(new URL('../' + name, import.meta.url)))]))
const manifestBytes = fs.readFileSync(path.join(prepared, 'manifest.json'))
const manifest = JSON.parse(manifestBytes)
const queryBytes = fs.readFileSync(path.join(prepared, 'queries.json'))
if (sha(queryBytes) !== manifest.querySetSha256) throw new Error('Query set drift')
const sciQueries = JSON.parse(queryBytes).slice(0, 30).map(row => ({ id: row.id, query: row.query }))
const mutationReportBytes = fs.readFileSync(path.join(mutations, 'report.json'))
const mutationReport = JSON.parse(mutationReportBytes)
if (!mutationReport.complete || mutationReport.rows.length !== 6) throw new Error('Mutation fixture incomplete')
const syntheticQueries = mutationReport.queries
const contexts = [
  { name: 'default', scope: '', includeSuperseded: false },
  { name: 'historical', scope: '', includeSuperseded: true },
  { name: 'projects', scope: 'Projects', includeSuperseded: false },
  { name: 'archive', scope: 'Archive', includeSuperseded: false },
]
const plannedSynthetic = mutationReport.steps.flatMap(step => contexts.flatMap(context =>
  syntheticQueries.map(query => `${step}:${context.name}:${query}`)))
const plannedSciFact = sciQueries.flatMap(row => ['baseline', 'sqlite'].map(arm => `${row.id}:${arm}`))
const ledger = { protocol: 'sqlite-eligible-managed-development-v1', complete: false, stopReason: null,
  plannedSynthetic, attemptedSynthetic: [], syntheticRows: [], plannedSciFact,
  attemptedSciFact: [], sciFactRows: [],
  preparedManifestSha256: sha(manifestBytes), querySetSha256: sha(queryBytes),
  mutationReportSha256: sha(mutationReportBytes), indexSha256: sha(fs.readFileSync(db)),
  codeHashes, environment: { platform: process.platform, arch: process.arch, node: process.version },
  limitations: ['Exposed SciFact development, first 5000 loaded notes only',
    'No Curator/Lead model, independent answer holdout, competitor or monetary cost',
    'Node 24 experimental index and warm/uncontrolled OS filesystem cache'] }
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(ledger, null, 2) + '\n')
save()
function runArm(arm, { vault, dbFile, query, context = {} }) {
  const command = [worker.pathname, '--arm', arm, '--vault', vault, '--query', query,
    '--db', dbFile]
  if (context.scope) command.push('--scope', context.scope)
  if (context.includeSuperseded) command.push('--include-superseded')
  const started = performance.now()
  const child = spawnSync(process.execPath, command, { encoding: 'utf8', timeout: 120000,
    maxBuffer: 128 * 1024 * 1024, env: { ...process.env, GRAPHMORY_EXPERIMENT_METRICS: '1' } })
  const wallMs = performance.now() - started
  if (child.error) throw child.error
  const record = { arm, exitCode: child.status, wallMs,
    stdoutBytes: Buffer.byteLength(child.stdout), outputSha256: sha(child.stdout) }
  if (child.status === 0) {
    const metrics = JSON.parse(child.stderr.trim().split('\n').at(-1))
    record.rssBytes = metrics.rssBytes
    record.maxRssRaw = metrics.maxRssRaw
    record.report = JSON.parse(child.stdout)
  } else record.error = child.stderr.slice(0, 500)
  return record
}
function summarizeDifference(a, b) {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]
  const topLevel = keys.filter(key => JSON.stringify(a[key]) !== JSON.stringify(b[key]))
  const resultFields = []
  for (let index = 0; index < Math.max(a.results?.length ?? 0, b.results?.length ?? 0); index += 1) {
    const left = a.results?.[index] ?? {}, right = b.results?.[index] ?? {}
    const fields = [...new Set([...Object.keys(left), ...Object.keys(right)])]
      .filter(key => JSON.stringify(left[key]) !== JSON.stringify(right[key]))
    if (fields.length) resultFields.push({ rank: index + 1, leftPath: left.path, rightPath: right.path, fields })
  }
  return { topLevel, resultFields: resultFields.slice(0, 10) }
}
function publicRecord(value) {
  const { report, ...record } = value
  return record
}
function checkSciFactSource() {
  const documents = loadVaultDocuments(path.join(prepared, 'vault'), { maxFiles: 5000 })
  if (documents.length !== 5000) throw new Error('Managed scan count drift')
  for (const document of documents) {
    if (sha(fs.readFileSync(path.join(prepared, 'vault', document.id))) !== manifest.vaultSourceHashes[document.id])
      throw new Error('SciFact source drift: ' + document.id)
  }
}
try {
  for (const [stateIndex, step] of mutationReport.steps.entries()) {
    const vault = path.join(mutations, 'fixture', String(stateIndex), 'vault')
    const dbFile = path.join(mutations, `${stateIndex}-fresh.db`)
    for (const context of contexts) for (const query of syntheticQueries) {
      const marker = `${step}:${context.name}:${query}`
      const row = { marker, querySha256: sha(query), complete: false }
      ledger.attemptedSynthetic.push(marker)
      ledger.syntheticRows.push(row)
      save()
      const baseline = runArm('baseline', { vault, dbFile, query, context })
      const indexed = runArm('sqlite', { vault, dbFile, query, context })
      row.baseline = publicRecord(baseline)
      row.sqlite = publicRecord(indexed)
      if (baseline.exitCode !== 0 || indexed.exitCode !== 0) throw new Error('Synthetic arm failed: ' + marker)
      if (baseline.outputSha256 !== indexed.outputSha256) {
        row.difference = summarizeDifference(baseline.report, indexed.report)
        save()
        throw new Error('Synthetic managed mismatch: ' + marker)
      }
      row.complete = true
      save()
    }
    console.log(JSON.stringify({ syntheticStatesCompleted: stateIndex + 1, total: 6 }))
  }
  const staleVault = path.join(out, 'stale-vault')
  fs.cpSync(path.join(mutations, 'fixture', '0', 'vault'), staleVault, { recursive: true })
  fs.appendFileSync(path.join(staleVault, 'Projects/Project-02.md'), '\nChanged after indexing.\n')
  const firstDb = path.join(mutations, '0-fresh.db')
  const indexBefore = sha(fs.readFileSync(firstDb))
  const rejected = runArm('sqlite', { vault: staleVault, dbFile: firstDb, query: 'memory' })
  ledger.staleSource = { exitCode: rejected.exitCode,
    errorContainsStale: rejected.error?.includes('Stale SQLite index source') ?? false,
    indexBeforeSha256: indexBefore, indexAfterSha256: sha(fs.readFileSync(firstDb)) }
  assert.ok(ledger.staleSource.exitCode !== 0 && ledger.staleSource.errorContainsStale
    && ledger.staleSource.indexBeforeSha256 === ledger.staleSource.indexAfterSha256)
  save()
  checkSciFactSource()
  for (const [index, item] of sciQueries.entries()) {
    const order = index % 2 ? ['sqlite', 'baseline'] : ['baseline', 'sqlite']
    const row = { id: item.id, querySha256: sha(item.query), order, arms: {}, complete: false }
    ledger.sciFactRows.push(row)
    save()
    for (const arm of order) {
      ledger.attemptedSciFact.push(`${item.id}:${arm}`)
      save()
      const result = runArm(arm, { vault: path.join(prepared, 'vault'), dbFile: db, query: item.query })
      row.arms[arm] = publicRecord(result)
      save()
      if (result.exitCode !== 0) throw new Error('SciFact arm failed: ' + item.id + ':' + arm)
      if (arm === 'baseline') row.baselineReport = result.report
      else row.sqliteReport = result.report
    }
    if (row.arms.baseline.outputSha256 !== row.arms.sqlite.outputSha256) {
      row.difference = summarizeDifference(row.baselineReport, row.sqliteReport)
      delete row.baselineReport
      delete row.sqliteReport
      save()
      throw new Error('SciFact managed mismatch: ' + item.id)
    }
    delete row.baselineReport
    delete row.sqliteReport
    row.complete = true
    save()
    if ((index + 1) % 5 === 0) console.log(JSON.stringify({ sciFactPairsCompleted: index + 1, total: 30 }))
  }
  checkSciFactSource()
  if (sha(fs.readFileSync(db)) !== ledger.indexSha256) throw new Error('Index drift')
  for (const [name, digest] of Object.entries(codeHashes)) {
    if (sha(fs.readFileSync(new URL('../' + name, import.meta.url))) !== digest) throw new Error('Code drift: ' + name)
  }
  ledger.complete = true
  save()
} catch (error) {
  ledger.stopReason = error.message
  save()
  throw error
}
