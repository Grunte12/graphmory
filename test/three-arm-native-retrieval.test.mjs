import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  THREE_ARM_IDS,
  assertAttemptAccounting,
  buildAttemptPlan,
  collectAllPages,
  safeRelativeMarkdownPath,
  verifyOriginalBodies,
} from '../scripts/lib/three-arm-native-retrieval.mjs'

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const snapshotA = 'a'.repeat(64)
const snapshotB = 'b'.repeat(64)

test('native file pagination follows every page under one snapshot and stable path order', async () => {
  const validPaths = new Set(['a.md', 'b.md', 'c.md', 'd.md', 'e.md'])
  const allPaths = [...validPaths]
  const requests = []
  const pageByOffset = new Map([
    [0, { offset: 0, nextOffset: 2, hasMore: true, results: [{ path: 'a.md' }, { path: 'b.md' }], candidateCount: 5, snapshotId: snapshotA, nativeSeconds: 0.01, nativeOutputBytes: 20, nativeCalls: [] }],
    [2, { offset: 2, nextOffset: 4, hasMore: true, results: [{ path: 'c.md' }, { path: 'd.md' }], candidateCount: 5, snapshotId: snapshotA, nativeSeconds: 0.02, nativeOutputBytes: 21, nativeCalls: [] }],
    [4, { offset: 4, nextOffset: null, hasMore: false, results: [{ path: 'e.md' }], candidateCount: 5, snapshotId: snapshotA, nativeSeconds: 0.03, nativeOutputBytes: 11, nativeCalls: [] }],
  ])

  const collected = await collectAllPages(request => {
    requests.push(request)
    return pageByOffset.get(request.offset)
  }, validPaths)

  assert.deepEqual(collected.candidatePaths, allPaths)
  assert.equal(collected.candidateCount, 5)
  assert.equal(collected.snapshotId, snapshotA)
  assert.deepEqual(requests.map(request => request.offset), [0, 2, 4])
  assert.deepEqual(requests.slice(1).map(request => request.expectedSnapshotId), [snapshotA, snapshotA])
  assert.equal(collected.pages.length, 3)
})

test('pagination rejects snapshot drift, missing candidates, and out-of-order paths', async () => {
  const validPaths = new Set(['a.md', 'b.md', 'c.md'])
  const page = (offset, snapshotId, paths, nextOffset, hasMore) => ({
    offset, nextOffset, hasMore, results: paths.map(path => ({ path })), candidateCount: 3, snapshotId,
    nativeSeconds: 0, nativeOutputBytes: 0, nativeCalls: [],
  })

  await assert.rejects(Promise.resolve().then(() => collectAllPages(
    ({ offset }) => offset === 0 ? page(0, snapshotA, ['a.md'], 1, true) : page(1, snapshotB, ['b.md', 'c.md'], null, false),
    validPaths,
  )))
  await assert.rejects(Promise.resolve().then(() => collectAllPages(
    () => page(0, snapshotA, ['a.md'], null, false),
    validPaths,
  )))
  await assert.rejects(Promise.resolve().then(() => collectAllPages(
    ({ offset }) => offset === 0 ? page(0, snapshotA, ['a.md', 'c.md'], 2, true) : page(2, snapshotA, ['b.md'], null, false),
    validPaths,
  )))
})

test('pagination invariants are tagged for runner integrity-stop handling', async () => {
  const validPaths = new Set(['a.md', 'b.md'])
  await assert.rejects(collectAllPages(
    () => ({ offset: 0, nextOffset: null, hasMore: false, results: [{ path: 'outside.md' }],
      candidateCount: 1, snapshotId: snapshotA }),
    validPaths,
  ), error => error.integrityFailure === true && /Unexpected candidate path/u.test(error.message))
})

test('source hash verification uses exact corpus bytes and leaves the fixture unchanged', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'three-arm-native-retrieval-'))
  try {
    const corpus = path.join(temp, 'corpus')
    mkdirSync(path.join(corpus, 'nested'), { recursive: true })
    const original = Buffer.from('# Exact body\r\n\r\nKeep trailing bytes.\n')
    const source = path.join(corpus, 'nested/source.md')
    writeFileSync(source, original)
    const expected = { 'nested/source.md': sha256(original) }

    const actual = verifyOriginalBodies(corpus, expected)

    assert.equal(actual['nested/source.md'], expected['nested/source.md'])
    assert.deepEqual(readFileSync(source), original)
    writeFileSync(source, Buffer.from('# changed\n'))
    assert.throws(() => verifyOriginalBodies(corpus, expected))
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

test('source verification rejects extra Markdown notes and symlinks', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'three-arm-corpus-inventory-'))
  try {
    const corpus = path.join(temp, 'corpus')
    mkdirSync(corpus)
    const source = path.join(corpus, 'source.md')
    const original = Buffer.from('# Original\n')
    writeFileSync(source, original)
    const expected = { 'source.md': sha256(original) }

    writeFileSync(path.join(corpus, 'extra.md'), '# Extra\n')
    assert.throws(() => verifyOriginalBodies(corpus, expected), /file set/u)
    rmSync(path.join(corpus, 'extra.md'))

    symlinkSync(source, path.join(corpus, 'linked.md'))
    assert.throws(() => verifyOriginalBodies(corpus, expected), /Symlink/u)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

test('candidate path validation accepts corpus-relative Markdown and refuses invalid or outside paths', () => {
  assert.equal(safeRelativeMarkdownPath('nested/source.md'), 'nested/source.md')
  for (const invalid of ['../outside.md', '/tmp/outside.md', 'nested/source.txt', '']) {
    assert.throws(() => safeRelativeMarkdownPath(invalid), invalid)
  }
})

test('attempt plan covers every arm for every case and repeat, retaining failed rows', () => {
  const planned = buildAttemptPlan(['synthetic-a', 'synthetic-b'], 3)
  assert.equal(THREE_ARM_IDS.length, 3)
  assert.equal(planned.length, 2 * 3 * THREE_ARM_IDS.length)

  for (const caseId of ['synthetic-a', 'synthetic-b']) {
    for (const repeat of [1, 2, 3]) {
      const attempt = planned.filter(row => row.caseId === caseId && row.repeat === repeat)
      assert.deepEqual(attempt.map(row => row.sequence), [1, 2, 3])
      assert.deepEqual(attempt.map(row => row.arm).sort(), [...THREE_ARM_IDS].sort())
    }
  }
  for (const caseId of ['synthetic-a', 'synthetic-b']) {
    const firstArms = [1, 2, 3].map(repeat => planned.find(row => row.caseId === caseId && row.repeat === repeat && row.sequence === 1).arm)
    assert.deepEqual(firstArms.sort(), [...THREE_ARM_IDS].sort())
  }

  const recorded = planned.map((row, index) => ({ ...row, status: index === 4 ? 'failed' : 'success', ...(index === 4 ? { error: 'synthetic failure' } : {}) }))
  assert.doesNotThrow(() => assertAttemptAccounting(planned, recorded))
  assert.throws(() => assertAttemptAccounting(planned, recorded.slice(1)))
  assert.throws(() => assertAttemptAccounting(planned, [...recorded, recorded[0]]))
})
