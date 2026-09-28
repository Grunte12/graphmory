#!/usr/bin/env node
// Generic graph parity plus read-only small-vault cost screen. No note content in report.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { loadVaultDocuments } from '../src/memory-recall.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
for (const name of ['--vault', '--out']) if (!option(name) || option(name).startsWith('--')) throw new Error('Missing ' + name)
const userVault = path.resolve(option('--vault'))
const out = path.resolve(option('--out'))
if (fs.existsSync(out)) throw new Error('Preserve prior evaluation output')
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const scratch = path.join(out, 'scratch')
fs.mkdirSync(scratch, { recursive: true, mode: 0o700 })
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const prototype = new URL('./experimental-sqlite-postings.mjs', import.meta.url)
const worker = new URL('./experimental-managed-sqlite-arm.mjs', import.meta.url)
const graphQueries = ['zephyr rollback routing', 'zephyr routing', 'policy', 'logs', 'answer',
  'handoff', 'cycle', 'ambiguous', 'same', 'memory graph', 'graph memory', 'no_matching_term_69491']
const genericQueries = ['memory', 'project', 'decision', 'workflow', 'graph', 'design',
  'setup', 'evaluation', 'latency', 'retrieval']
const contexts = [{ name: 'default', scope: '', historical: false },
  { name: 'historical', scope: '', historical: true },
  { name: 'projects', scope: 'Projects', historical: false }]
const codeNames = ['src/retrieval.mjs', 'src/memory-recall.mjs', 'src/decision-recall.mjs',
  'scripts/experimental-sqlite-postings.mjs', 'scripts/experimental-sqlite-eligible-ranker.mjs',
  'scripts/experimental-managed-sqlite-arm.mjs', 'scripts/eval-sqlite-graph-small.mjs']
const ledger = { protocol: 'sqlite-graph-small-vault-development-v1', complete: false,
  stopReason: null, graphPlanned: contexts.flatMap(context => graphQueries.map(query => `${context.name}:${query}`)),
  graphAttempted: [], graphRows: [], smallPlanned: genericQueries, smallAttempted: [], smallRows: [],
  codeHashes: Object.fromEntries(codeNames.map(name => [name, sha(fs.readFileSync(new URL('../' + name, import.meta.url)))])),
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  privacy: 'Read-only user vault; no source text or returned path is recorded; scratch symlink/index removed after run',
  limitations: ['Local generic queries are a cost screen, not real user question relevance labels',
    'Node 24 experimental index and warm/uncontrolled OS filesystem cache',
    'No Curator/Lead model, official answer benchmark, independent holdout or competitor'] }
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(ledger, null, 2) + '\n')
save()
function command(file, arguments_, { metrics = false } = {}) {
  const started = performance.now()
  const child = spawnSync(process.execPath, [file.pathname, ...arguments_], {
    encoding: 'utf8', timeout: 120000, maxBuffer: 128 * 1024 * 1024,
    env: metrics ? { ...process.env, GRAPHMORY_EXPERIMENT_METRICS: '1' } : process.env,
  })
  const wallMs = performance.now() - started
  if (child.error) throw child.error
  if (child.status !== 0) throw new Error(`${path.basename(file.pathname)} failed: ${child.stderr.slice(0, 450)}`)
  const record = { wallMs, stdoutBytes: Buffer.byteLength(child.stdout), outputSha256: sha(child.stdout) }
  if (metrics) {
    const resource = JSON.parse(child.stderr.trim().split('\n').at(-1))
    record.rssBytes = resource.rssBytes
    record.maxRssRaw = resource.maxRssRaw
  }
  return { record, output: JSON.parse(child.stdout) }
}
function runArm(arm, vault, db, query, context = {}) {
  const arguments_ = ['--arm', arm, '--vault', vault, '--db', db, '--query', query]
  if (context.scope) arguments_.push('--scope', context.scope)
  if (context.historical) arguments_.push('--include-superseded')
  return command(worker, arguments_, { metrics: true })
}
function sources(root) {
  const documents = loadVaultDocuments(root, { maxFiles: 5000 })
  const hashes = Object.fromEntries(documents.map(doc => [doc.id, sha(fs.readFileSync(path.join(root, doc.id)))]))
  return { documents, hashes, sourceSetSha256: sha(JSON.stringify(hashes)) }
}
function writeNote(vault, id, content) {
  const target = path.join(vault, id)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}
function prepare(root, vault, archiveSha256) {
  const snapshot = sources(vault)
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ corpusCount: snapshot.documents.length,
    archiveSha256, vaultSourceHashes: snapshot.hashes }) + '\n')
  const db = path.join(root, 'index.db')
  const built = command(prototype, ['build', '--prepared', root, '--db', db,
    '--limit', String(snapshot.documents.length)]).output
  return { db, snapshot, built, dbSha256: sha(fs.readFileSync(db)) }
}

try {
  const graphRoot = path.join(scratch, 'graph')
  const graphVault = path.join(graphRoot, 'vault')
  fs.mkdirSync(graphVault, { recursive: true })
  const graphNotes = {
    'Hub.md': '---\ncanonical_memory: false\n---\n# Zephyr routing hub\n## Route\nzephyr rollback routing [[Policy]] [[Evidence]] [[Bridge]].\n',
    'Policy.md': '# Safe policy\nUse guarded sync and preserve source history.\n',
    'Evidence.md': '# Evidence log\nOriginal log confirms the guarded operation.\n',
    'Bridge.md': '---\ncanonical_memory: false\n---\n# Handoff bridge\nSee [[Answer]] for the final instruction.\n',
    'Answer.md': '# Final instruction\nVerify the canonical record before acting.\n',
    'Cycle.md': '# Cycle note\nzephyr cyclic path to [[Hub]].\n',
    'Archive/Old.md': '---\nstatus: superseded\n---\n# Old plan\nLegacy routing to [[Hub]].\n',
    'Projects/Alpha/Same.md': '# Shared label\nAlpha variant.\n',
    'Projects/Beta/Same.md': '# Shared label\nBeta variant.\n',
    'Ambiguous.md': '# Ambiguous reference\nSee [[Same]] for details.\n',
    'Projects/Note.md': '# Graph memory\n## Decision\nProject graph memory.\n## Review\nSecond section on design.\n',
    'Projects/Other.md': '# Project reference\nDecision workflow and source notes.\n',
  }
  for (const [id, content] of Object.entries(graphNotes)) writeNote(graphVault, id, content)
  const graph = prepare(graphRoot, graphVault, 'generic-graph-fixture-v1')
  assert.equal(graph.snapshot.documents.length, 12)
  ledger.graph = { noteCount: 12, sourceSetSha256: graph.snapshot.sourceSetSha256,
    dbSha256: graph.dbSha256, buildMs: graph.built.buildMs, dbBytes: graph.built.dbBytes }
  save()
  for (const context of contexts) for (const query of graphQueries) {
    const marker = `${context.name}:${query}`
    const row = { marker, querySha256: sha(query), complete: false }
    ledger.graphAttempted.push(marker)
    ledger.graphRows.push(row)
    save()
    const baseline = runArm('baseline', graphVault, graph.db, query, context)
    const indexed = runArm('sqlite', graphVault, graph.db, query, context)
    row.baseline = baseline.record
    row.sqlite = indexed.record
    if (context.name === 'default' && query === 'zephyr rollback routing') {
      const paths = baseline.output.results.map(item => item.path)
      ledger.graph.linkedAnswerObserved = paths.includes('Policy.md') || paths.includes('Evidence.md')
      assert.ok(ledger.graph.linkedAnswerObserved, 'Graph fixture did not exercise navigation')
    }
    if (baseline.record.outputSha256 !== indexed.record.outputSha256)
      throw new Error('Graph managed response mismatch: ' + marker)
    row.complete = true
    save()
  }
  const privateRoot = path.join(scratch, 'private')
  fs.mkdirSync(privateRoot, { recursive: true, mode: 0o700 })
  fs.symlinkSync(userVault, path.join(privateRoot, 'vault'), 'dir')
  const small = prepare(privateRoot, path.join(privateRoot, 'vault'), 'local-readonly-vault-screen-v1')
  ledger.small = { noteCount: small.snapshot.documents.length,
    sourceSetSha256: small.snapshot.sourceSetSha256, dbSha256: small.dbSha256,
    buildMs: small.built.buildMs, dbBytes: small.built.dbBytes }
  save()
  for (const [index, query] of genericQueries.entries()) {
    const order = index % 2 ? ['sqlite', 'baseline'] : ['baseline', 'sqlite']
    const row = { queryId: index + 1, querySha256: sha(query), order, arms: {}, complete: false }
    ledger.smallAttempted.push(index + 1)
    ledger.smallRows.push(row)
    save()
    for (const arm of order) {
      const result = runArm(arm, userVault, small.db, query)
      row.arms[arm] = result.record
      save()
    }
    assert.equal(row.arms.baseline.outputSha256, row.arms.sqlite.outputSha256,
      'Small-vault managed response mismatch at generic query ' + (index + 1))
    row.complete = true
    save()
  }
  const after = sources(userVault)
  assert.equal(after.sourceSetSha256, small.snapshot.sourceSetSha256, 'User vault changed during read-only screen')
  assert.equal(sha(fs.readFileSync(small.db)), small.dbSha256, 'Temporary index drift')
  ledger.small.sourceSetAfterSha256 = after.sourceSetSha256
  for (const [name, digest] of Object.entries(ledger.codeHashes)) {
    if (sha(fs.readFileSync(new URL('../' + name, import.meta.url))) !== digest) throw new Error('Code drift: ' + name)
  }
  ledger.complete = true
  save()
  console.log(JSON.stringify({ complete: true, graphPairs: ledger.graphRows.length,
    smallPairs: ledger.smallRows.length, smallNotes: ledger.small.noteCount }))
} catch (error) {
  ledger.stopReason = error.message
  save()
  throw error
} finally {
  fs.rmSync(scratch, { recursive: true, force: true })
}
