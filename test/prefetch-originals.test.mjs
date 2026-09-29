import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { managedRecall } from '../src/decision-recall.mjs'
import { DEFAULT_RUNTIME_CONFIG } from '../src/runtime-config.mjs'
import { readSourceNotes } from '../src/source-read.mjs'

test('prefetch keeps complete canonical scoped originals and CLI parity; defaults and narrow pages stay selective', async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-prefetch-'))
  try {
    fs.mkdirSync(path.join(vault, 'project'))
    fs.writeFileSync(path.join(vault, 'project', 'one.md'), '# Memory\n## Ada\nAda owns the engine.\n## Bob\nBob does NOT own it.\n')
    fs.writeFileSync(path.join(vault, 'outside.md'), '# Memory\nOutside scoped facts.')
    fs.writeFileSync(path.join(vault, 'project', 'raw.md'), '---\nstatus: raw\n---\n# Memory\nDo not expose this raw capture.')
    const options = { adaptiveBundle: true, scope: 'project' }
    const normal = await managedRecall(vault, 'List all memory evidence', DEFAULT_RUNTIME_CONFIG, options)
    assert.equal(normal.prefetch, undefined)
    assert.equal(normal.originalSources, undefined)
    const eager = await managedRecall(vault, 'List all memory evidence', DEFAULT_RUNTIME_CONFIG, { ...options, prefetchWideOriginals: true })
    assert.equal(eager.prefetch.status, 'ready')
    assert.deepEqual(eager.results, normal.results)
    assert.deepEqual(eager.originalSources, readSourceNotes(vault, ['project/one.md']).sources)
    const compact = await managedRecall(vault, 'List all memory evidence', DEFAULT_RUNTIME_CONFIG,
      { ...options, prefetchWideOriginals: true, compactPrefetch: true })
    assert.equal(compact.prefetch.presentation, 'originals-only')
    assert.deepEqual(compact.originalSources, eager.originalSources)
    assert.deepEqual(compact.results.map(row => row.path), eager.results.map(row => row.path))
    assert.ok(eager.results.some(row => row.evidencePreview))
    assert.ok(compact.results.every(row => !('evidencePreview' in row) && !('sourceReadRequired' in row)))
    const cli = spawnSync(process.execPath, ['scripts/brain-sync.mjs', 'recall-managed', '--vault', vault,
      '--query', 'List all memory evidence', '--scope', 'project', '--auto', '--agent', '--prefetch-wide-originals'], { encoding: 'utf8' })
    assert.equal(cli.status, 0, cli.stderr)
    assert.deepEqual(JSON.parse(cli.stdout).originalSources, eager.originalSources)
    const narrow = await managedRecall(vault, 'Who owns the engine?', DEFAULT_RUNTIME_CONFIG, { ...options, prefetchWideOriginals: true })
    assert.equal(narrow.prefetch.status, 'skipped')
    assert.equal(narrow.originalSources, undefined)
    const compactNarrow = await managedRecall(vault, 'Who owns the engine?', DEFAULT_RUNTIME_CONFIG,
      { ...options, prefetchWideOriginals: true, compactPrefetch: true })
    assert.deepEqual(compactNarrow, narrow)
    await assert.rejects(managedRecall(vault, 'memory', DEFAULT_RUNTIME_CONFIG,
      { adaptiveBundle: true, compactPrefetch: true }), /requires original prefetch/)
    await assert.rejects(managedRecall(vault, 'memory', DEFAULT_RUNTIME_CONFIG, { prefetchWideOriginals: true }), /requires curator adaptiveBundle/)
    await assert.rejects(managedRecall(vault, 'memory', { ...DEFAULT_RUNTIME_CONFIG, workflow: 'local-rerank' }, { adaptiveBundle: true, prefetchWideOriginals: true }), /requires curator adaptiveBundle/)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test('prefetch refuses paginated pools and continuation pages without dropping candidates', async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-prefetch-paging-'))
  try {
    for (let i = 0; i < 100; i++) fs.writeFileSync(path.join(vault, `${i}.md`), '# Memory\n## Record\n' + 'Project evidence. '.repeat(100))
    const first = await managedRecall(vault, 'List all memory evidence', DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true, prefetchWideOriginals: true })
    assert.equal(first.hasMore, true)
    assert.deepEqual(first.prefetch, { status: 'skipped', reason: 'more-candidates' })
    assert.equal(first.originalSources, undefined)
    const next = await managedRecall(vault, 'List all memory evidence', DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true, prefetchWideOriginals: true, offset: first.nextOffset })
    assert.deepEqual(next.prefetch, { status: 'skipped', reason: 'continuation-page' })
    assert.equal(next.originalSources, undefined)
    const large = '# Memory\n' + 'Project evidence. '.repeat(16000)
    const oversizedVault = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-prefetch-oversized-'))
    try {
      fs.writeFileSync(path.join(oversizedVault, 'large.md'), large)
      const oversized = await managedRecall(oversizedVault, 'List all memory evidence', DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true, prefetchWideOriginals: true })
      assert.deepEqual(oversized.prefetch, { status: 'skipped', reason: 'original-byte-budget' })
      assert.equal(oversized.originalSources, undefined)
      assert.deepEqual(oversized.results.map(row => row.path), ['large.md'])
      assert.equal(readSourceNotes(oversizedVault, ['large.md']).sources[0].markdown, large)
    } finally { fs.rmSync(oversizedVault, { recursive: true, force: true }) }
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test('prefetch refuses an original changed between ranking snapshot and full-source delivery', async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-prefetch-race-'))
  const file = path.join(vault, 'one.md')
  const originalRead = fs.readFileSync
  try {
    fs.writeFileSync(file, '# Memory\nProject evidence is approved.\n')
    fs.readFileSync = function (target, options) {
      if (target === file && options === undefined) fs.writeFileSync(file, '# Memory\nProject evidence is NOT approved.\n')
      return originalRead.apply(this, arguments)
    }
    await assert.rejects(managedRecall(vault, 'List all memory evidence', DEFAULT_RUNTIME_CONFIG,
      { adaptiveBundle: true, prefetchWideOriginals: true }), /Source changed during recall prefetch/)
  } finally { fs.readFileSync = originalRead; fs.rmSync(vault, { recursive: true, force: true }) }
})
