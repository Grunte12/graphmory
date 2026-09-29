#!/usr/bin/env node
// Disposable synthetic vault: incremental SQLite parity against fresh build and current BM25F.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { loadVaultDocuments } from '../src/memory-recall.mjs'
import { rank } from '../src/retrieval.mjs'

const args = process.argv.slice(2)
const outFlag = args.indexOf('--out')
if (outFlag < 0 || !args[outFlag + 1] || args[outFlag + 1].startsWith('--')) throw new Error('Supply --out')
const out = path.resolve(args[outFlag + 1])
if (fs.existsSync(out)) throw new Error('Preserve prior evaluation output')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const prototype = new URL('./experimental-sqlite-postings.mjs', import.meta.url)
const updater = new URL('./experimental-sqlite-update.mjs', import.meta.url)
const queries = [
  'memory', 'violet rendezvous', 'rendezvous violet', 'taxonomy', 'project-03',
  'provenance', 'budget', 'superseded', 'section', 'graph', 'newfangled', 'no_matching_term_69491',
]
const steps = ['initial', 'add', 'edit', 'delete', 'rename', 'edit-renamed']
const codeNames = ['src/retrieval.mjs', 'src/memory-recall.mjs',
  'scripts/experimental-sqlite-postings.mjs', 'scripts/experimental-sqlite-update.mjs',
  'scripts/eval-sqlite-mutations.mjs']
const codeHashes = Object.fromEntries(codeNames.map(name => [name, sha(fs.readFileSync(new URL('../' + name, import.meta.url)))]))
const ledger = { protocol: 'sqlite-mutation-parity-development-v1', complete: false, stopReason: null,
  fixture: 'generic synthetic Markdown, no user vault content', steps, queries,
  planned: steps.flatMap(step => queries.map(query => `${step}:${query}`)), attempted: [],
  rows: [], codeHashes, environment: { platform: process.platform, arch: process.arch, node: process.version },
  limitations: ['Focused-section BM25F only; no managed fusion, graph, lifecycle filtering, semantic search or answers',
    'Synthetic vault and Node 24 experimental storage; no Node 20 product path',
    'Pagination is on the experimental raw index results, not recall-managed'] }
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(ledger, null, 2) + '\n')
save()
function run(file, argv, expectSuccess = true) {
  const child = spawnSync(process.execPath, [file.pathname, ...argv],
    { encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 })
  if (child.error) throw child.error
  if (expectSuccess && child.status !== 0) throw new Error(`${path.basename(file.pathname)} failed: ${child.stderr.slice(0, 700)}`)
  return child
}
function writeNote(vault, id, content) {
  const file = path.join(vault, id)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}
function note(number) {
  const name = String(number).padStart(2, '0')
  const first = number === 1 ? 'violet' : number === 3 ? 'budget' : 'graph'
  const second = number === 1 ? 'rendezvous' : number === 4 ? 'taxonomy' : 'provenance'
  const status = number === 11 ? 'superseded' : 'current'
  return `---\nstatus: ${status}\n---\n# Project ${name}\n## Overview\nmemory ${first} section.\n## Details\nmemory ${second} section.\n`
}
function prepare(stepIndex, previous) {
  const root = path.join(out, 'fixture', String(stepIndex))
  const vault = path.join(root, 'vault')
  fs.mkdirSync(vault, { recursive: true })
  if (previous) fs.cpSync(previous.vault, vault, { recursive: true })
  else for (let n = 1; n <= 12; n += 1) writeNote(vault, `Projects/Project-${String(n).padStart(2, '0')}.md`, note(n))
  if (stepIndex === 1) writeNote(vault, 'Projects/Project-13.md',
    '---\nstatus: current\n---\n# Project 13\n## Overview\nmemory violet section.\n## Details\nmemory rendezvous section.\n')
  if (stepIndex === 2) {
    const file = path.join(vault, 'Projects/Project-03.md')
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('status: current', 'status: superseded')
      .replace('memory budget section.', 'memory budget revised provenance section.'))
  }
  if (stepIndex === 3) fs.unlinkSync(path.join(vault, 'Projects/Project-08.md'))
  if (stepIndex === 4) {
    fs.mkdirSync(path.join(vault, 'Archive'), { recursive: true })
    fs.renameSync(path.join(vault, 'Projects/Project-05.md'), path.join(vault, 'Archive/Renamed-05.md'))
  }
  if (stepIndex === 5) {
    const file = path.join(vault, 'Archive/Renamed-05.md')
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('memory provenance section.',
      'memory provenance newfangled section.'))
  }
  const docs = loadVaultDocuments(vault, { maxFiles: 1000 })
  const vaultSourceHashes = Object.fromEntries(docs.map(doc => [doc.id, sha(fs.readFileSync(path.join(vault, doc.id)))]))
  const manifest = { corpusCount: docs.length, archiveSha256: 'synthetic-fixture-v1', vaultSourceHashes }
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  return { root, vault, docs, manifest, sourceSetSha256: sha(JSON.stringify(vaultSourceHashes)) }
}
function indexed(db, query, offset, k) {
  const argv = ['query', '--db', db, '--query', query]
  if (offset !== undefined) argv.push('--offset', String(offset), '--k', String(k))
  return JSON.parse(run(prototype, argv).stdout)
}
function checkPages(db, full) {
  const pages = []
  for (let offset = 0; offset <= full.length; offset += 3) {
    const page = indexed(db, 'memory', offset, 3)
    pages.push(...page)
    if (page.length < 3) break
  }
  assert.deepEqual(pages, full)
  assert.equal(new Set(pages.map(item => item.id)).size, pages.length)
  return pages.length
}

let previous = null
let previousIncrementalDb = null
try {
  for (const [stepIndex, step] of steps.entries()) {
    const state = prepare(stepIndex, previous)
    const freshDb = path.join(out, `${stepIndex}-fresh.db`)
    const built = JSON.parse(run(prototype,
      ['build', '--prepared', state.root, '--db', freshDb, '--limit', String(state.docs.length)]).stdout)
    const incrementalDb = path.join(out, `${stepIndex}-incremental.db`)
    let update = null
    if (previous) {
      fs.copyFileSync(previousIncrementalDb, incrementalDb)
      update = JSON.parse(run(updater,
        ['--db', incrementalDb, '--before', previous.vault, '--after', state.vault]).stdout)
    } else fs.copyFileSync(freshDb, incrementalDb)
    const stateRow = { step, sourceSetSha256: state.sourceSetSha256, noteCount: state.docs.length,
      sectionCount: built.sectionCount, freshDbSha256: sha(fs.readFileSync(freshDb)),
      incrementalDbSha256: sha(fs.readFileSync(incrementalDb)), update,
      queries: [], complete: false }
    ledger.rows.push(stateRow)
    save()
    for (const query of queries) {
      const marker = `${step}:${query}`
      ledger.attempted.push(marker)
      const expected = rank(state.docs, query, 'bm25f-focused-sections')
        .map(({ id, chunkId, score }) => ({ id, chunkId, score }))
      const fresh = indexed(freshDb, query)
      const incremental = indexed(incrementalDb, query)
      const row = { query, expectedSha256: sha(JSON.stringify(expected)),
        freshSha256: sha(JSON.stringify(fresh)), incrementalSha256: sha(JSON.stringify(incremental)),
        resultCount: expected.length, complete: false }
      stateRow.queries.push(row)
      save()
      assert.deepEqual(fresh, expected, `Fresh mismatch: ${marker}`)
      assert.deepEqual(incremental, expected, `Incremental mismatch: ${marker}`)
      if (query === 'memory') {
        assert.ok(expected.length >= 11, 'Broad query is not broad enough')
        row.paginatedFresh = checkPages(freshDb, expected)
        row.paginatedIncremental = checkPages(incrementalDb, expected)
      }
      row.complete = true
      save()
    }
    stateRow.complete = true
    save()
    previous = state
    previousIncrementalDb = incrementalDb
  }
  const rejectDb = path.join(out, 'stale-rejection.db')
  fs.copyFileSync(previousIncrementalDb, rejectDb)
  const beforeRejectSha256 = sha(fs.readFileSync(rejectDb))
  const badBefore = path.join(out, 'invalid-prior-vault')
  fs.cpSync(previous.vault, badBefore, { recursive: true })
  const file = path.join(badBefore, 'Projects/Project-02.md')
  fs.appendFileSync(file, '\nUnexpected prior-source mutation.\n')
  const rejected = run(updater, ['--db', rejectDb, '--before', badBefore, '--after', previous.vault], false)
  ledger.staleRejection = { exitCode: rejected.status, beforeDbSha256: beforeRejectSha256,
    afterDbSha256: sha(fs.readFileSync(rejectDb)), correctlyRejected: rejected.status !== 0
      && beforeRejectSha256 === sha(fs.readFileSync(rejectDb)) }
  assert.ok(ledger.staleRejection.correctlyRejected, 'Stale prior state must not change DB')
  for (const [name, digest] of Object.entries(codeHashes)) {
    if (sha(fs.readFileSync(new URL('../' + name, import.meta.url))) !== digest) throw new Error('Code drift: ' + name)
  }
  ledger.complete = true
  save()
  console.log(JSON.stringify({ complete: true, states: ledger.rows.length,
    exactQueries: ledger.attempted.length, paginatedStates: ledger.rows.length,
    staleRejected: true }))
} catch (error) {
  ledger.stopReason = error.message
  save()
  throw error
}
