#!/usr/bin/env node
// Physical synthetic vault + actual local inference. Candidate access is not QA accuracy.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { spawnSync } from 'node:child_process'
import { managedRecall } from '../src/decision-recall.mjs'
import { DEFAULT_RUNTIME_CONFIG as HYBRID_RUNTIME_CONFIG } from '../src/runtime-config.mjs'
// Freeze this historical semantic-expansion experiment's lexical baseline.
const DEFAULT_RUNTIME_CONFIG = { ...HYBRID_RUNTIME_CONFIG, retrievalMode: 'lexical' }

const args = process.argv.slice(2)
const option = name => args[args.indexOf(name) + 1]
for (const name of ['--out', '--model-cache']) {
  if (!args.includes(name) || !option(name) || option(name).startsWith('--')) throw new Error('Missing ' + name)
}
const out = path.resolve(option('--out'))
const modelCache = path.resolve(option('--model-cache'))
if (fs.existsSync(out)) throw new Error('Preserve prior experiment outputs')
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const vault = path.join(out, 'vault')
const sources = {}
const add = (name, text) => { sources[name] = text }
for (let i = 1; i <= 18; i++) add(`projects/note-${String(i).padStart(2, '0')}.md`,
  `---\nstatus: current\ncanonical_memory: true\n---\n# Archive item ${i}\n\nThe team keeps durable recollections in plain text. Entry ${i} records a different observation.\n`)
add('projects/stale.md', '---\nstatus: stale\n---\n# Recollections\nOld recollections.')
add('projects/raw.md', '---\nstatus: raw\n---\n# Recollections\nUnreviewed recollections.')
add('projects/navigation.md', '---\ncanonical_memory: false\n---\n# Index\nRecollections directory.')
add('projects/historical.md', '---\nstatus: superseded\n---\n# Earlier recollections\nEarlier policy.')
add('elsewhere/outside.md', '# Recollections\nUnrelated workspace.')
const sha = value => createHash('sha256').update(value).digest('hex')
for (const [name, text] of Object.entries(sources)) {
  const file = path.join(vault, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}
const queries = ['How are long-lived memories preserved?', 'List all durable recollections and their observations.']
const modes = [{ name: 'normal', options: {} }, { name: 'byte-budget', options: { bundleBytes: 2000 } },
  { name: 'adaptive', options: { adaptiveBundle: true } }]
const expected = Object.keys(sources).filter(name => /^projects\/note-/u.test(name)).sort()
const ledger = { kind: 'synthetic candidate access; not answer quality', complete: false, stopReason: null,
  model: 'Xenova/bge-small-en-v1.5', queries, expectedPaths: expected,
  codeHashes: Object.fromEntries(['src/decision-recall.mjs', 'src/semantic-recall.mjs', 'src/memory-recall.mjs',
    'src/retrieval.mjs', 'scripts/brain-sync.mjs', 'scripts/eval-curator-semantic-integration.mjs']
    .map(name => [name, sha(fs.readFileSync(new URL('../' + name, import.meta.url)))])),
  sourceHashes: Object.fromEntries(Object.entries(sources).map(([name, text]) => [name, sha(text)])),
  planned: [...queries.flatMap((query, index) => modes.map(mode => `${index}:${mode.name}`)), 'cli:0', 'cli:3'], attempts: [] }
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(ledger, null, 2) + '\n')
save()
try {
  for (const [index, query] of queries.entries()) {
    let reference
    for (const mode of modes) {
      const attempt = { id: `${index}:${mode.name}`, pages: [], paths: [], passed: false }
      ledger.attempts.push(attempt)
      save()
      let offset = 0
      while (true) {
        const start = performance.now()
        const report = await managedRecall(vault, query, DEFAULT_RUNTIME_CONFIG, {
          ...mode.options, scope: 'projects', k: 3, offset, semanticExpansion: true, modelCache,
        })
        attempt.pages.push({ offset, milliseconds: performance.now() - start, totalCandidates: report.totalCandidates,
          hasMore: report.hasMore, nextOffset: report.nextOffset, expanded: report.expanded,
          paths: report.results.map(row => row.path) })
        attempt.paths.push(...report.results.map(row => row.path))
        save()
        assert.equal(report.scanLimitReached, false)
        assert.equal(report.expanded, true)
        if (!report.hasMore) break
        assert.ok(Number.isInteger(report.nextOffset) && report.nextOffset > offset, 'Pagination must progress')
        offset = report.nextOffset
        assert.ok(attempt.pages.length <= expected.length + 1, 'No pagination cycles')
      }
      assert.deepEqual([...attempt.paths].sort(), expected)
      assert.equal(new Set(attempt.paths).size, expected.length)
      if (reference) assert.deepEqual(attempt.paths, reference, 'Page transport cannot reorder candidate pool')
      else reference = attempt.paths
      attempt.passed = true
      save()
    }
  }
  const configFile = path.join(out, 'runtime.json')
  fs.writeFileSync(configFile, JSON.stringify(DEFAULT_RUNTIME_CONFIG))
  const cli = new URL('./brain-sync.mjs', import.meta.url)
  for (const offset of [0, 3]) {
    const attempt = { id: `cli:${offset}`, passed: false }
    ledger.attempts.push(attempt)
    save()
    const start = performance.now()
    const run = spawnSync(process.execPath, [cli.pathname, 'recall-managed', '--vault', vault,
      '--query', queries[0], '--scope', 'projects', '--k', '3', '--offset', String(offset),
      '--semantic-expansion', '--model-cache', modelCache, '--config', configFile, '--agent'],
    { encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 })
    attempt.milliseconds = performance.now() - start
    attempt.exitCode = run.status
    attempt.outputBytes = Buffer.byteLength(run.stdout ?? '')
    if (run.error) throw run.error
    assert.equal(run.status, 0, run.stderr)
    assert.equal(run.stdout.trim().split('\n').length, 1, 'Agent output must be one JSON line')
    const report = JSON.parse(run.stdout)
    assert.equal(report.expanded, true)
    assert.equal(report.semanticModel, ledger.model)
    assert.ok(report.candidateLanes)
    const reference = ledger.attempts.find(row => row.id === '0:normal').paths
    assert.deepEqual(report.results.map(row => row.path), reference.slice(offset, offset + 3))
    assert.equal(report.totalCandidates, expected.length)
    attempt.passed = true
    save()
  }
  for (const [name, digest] of Object.entries(ledger.sourceHashes)) assert.equal(sha(fs.readFileSync(path.join(vault, name))), digest)
  for (const [name, digest] of Object.entries(ledger.codeHashes)) assert.equal(sha(fs.readFileSync(new URL('../' + name, import.meta.url))), digest, 'Implementation drift: ' + name)
  ledger.processResourceUsage = process.resourceUsage()
  ledger.finalProcessMemoryBytes = process.memoryUsage()
  ledger.complete = true
  save()
  console.log(JSON.stringify({ complete: true, attempts: ledger.attempts.length, sourceCount: Object.keys(sources).length, report: path.join(out, 'report.json') }))
} catch (error) {
  ledger.stopReason = error.message
  save()
  throw error
}
