import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const helper = path.join(repo, 'scripts/native_file_baseline.py')
const rgAvailable = spawnSync('rg', ['--version'], { encoding: 'utf8', shell: false }).status === 0

function invoke(args) {
  return spawnSync('python3', [helper, ...args], { cwd: repo, encoding: 'utf8', shell: false, timeout: 15000 })
}

function result(args) {
  const child = invoke(args)
  assert.equal(child.error, undefined, child.error?.message)
  assert.ok(child.stdout, child.stderr)
  return { child, body: JSON.parse(child.stdout) }
}

function fixture() {
  const temp = mkdtempSync(path.join(tmpdir(), 'native-file-baseline-'))
  const corpus = path.join(temp, 'corpus')
  mkdirSync(corpus)
  return { temp, corpus }
}

test('ripgrep literal search orders and paginates every candidate with snapshot protection', { skip: !rgAvailable && 'ripgrep is unavailable' }, () => {
  const { temp, corpus } = fixture()
  try {
    mkdirSync(path.join(corpus, '.hidden'))
    mkdirSync(path.join(corpus, 'nested'))
    writeFileSync(path.join(corpus, '.gitignore'), 'ignored.md\n')
    writeFileSync(path.join(corpus, 'z.md'), 'ORCHID nebula\n')
    writeFileSync(path.join(corpus, 'a.md'), 'orchid\n')
    writeFileSync(path.join(corpus, 'nested/c.md'), 'nebula\n')
    writeFileSync(path.join(corpus, '.hidden/quiet.md'), 'orchid\n')
    writeFileSync(path.join(corpus, 'ignored.md'), 'orchid\n')
    writeFileSync(path.join(corpus, 'prefix.md'), 'orchidarium\n')
    writeFileSync(path.join(corpus, 'not-markdown.txt'), 'orchid\n')

    const first = result(['search', '--corpus', corpus, '--query', 'ORCHID nebula orchid', '--page-size', '2', '--capture-native-stdout'])
    assert.equal(first.child.status, 0, first.child.stderr)
    assert.equal(first.body.tokens.join(','), 'orchid,nebula')
    assert.equal(first.body.candidateCount, 5)
    assert.deepEqual(first.body.results.map(row => row.path), ['.hidden/quiet.md', 'a.md'])
    assert.equal(first.body.offset, 0)
    assert.equal(first.body.nextOffset, 2)
    assert.equal(first.body.hasMore, true)
    assert.match(first.body.ripgrep.version, /^ripgrep /)
    assert.equal(first.body.nativeCalls.length, 2)
    const searchCall = first.body.nativeCalls.find(call => call.purpose === 'literal-token-search')
    assert.ok(searchCall.stdoutBytes > 0)
    assert.ok(Buffer.from(searchCall.stdoutBase64, 'base64').toString('utf8').includes('z.md'))
    assert.equal(first.body.policy.stopwords, 'none')

    const all = [...first.body.results.map(row => row.path)]
    let cursor = first.body.nextOffset
    while (cursor !== null) {
      const page = result(['search', '--corpus', corpus, '--query', 'ORCHID nebula orchid', '--offset', String(cursor),
        '--page-size', '2', '--expected-snapshot', first.body.snapshotId])
      assert.equal(page.child.status, 0, page.child.stderr)
      all.push(...page.body.results.map(row => row.path))
      if (page.body.hasMore) {
        assert.ok(page.body.nextOffset > cursor)
        cursor = page.body.nextOffset
      } else {
        assert.equal(page.body.nextOffset, null)
        cursor = null
      }
    }
    assert.deepEqual(all, ['.hidden/quiet.md', 'a.md', 'ignored.md', 'nested/c.md', 'z.md'])
    assert.equal(new Set(all).size, all.length)

    writeFileSync(path.join(corpus, 'new-match.md'), 'orchid\n')
    const stale = result(['search', '--corpus', corpus, '--query', 'ORCHID nebula orchid', '--offset', '2',
      '--expected-snapshot', first.body.snapshotId])
    assert.equal(stale.child.status, 2)
    assert.equal(stale.body.error.code, 'snapshot-changed')

    const injectionMarker = path.join(temp, 'should-not-exist')
    const hostile = result(['search', '--corpus', corpus, '--query', `--help; touch ${injectionMarker}`])
    assert.equal(hostile.child.status, 0, hostile.child.stderr)
    assert.equal(existsSync(injectionMarker), false)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

test('search rejects invalid offsets and enforces the subprocess timeout bound', { skip: !rgAvailable && 'ripgrep is unavailable' }, () => {
  const { temp, corpus } = fixture()
  try {
    writeFileSync(path.join(corpus, 'one.md'), 'copper\n')
    for (const [args, code] of [
      [['--offset', '-1'], 'invalid-offset'],
      [['--offset', '2'], 'invalid-offset'],
      [['--page-size', '0'], 'invalid-page-size'],
      [['--timeout-seconds', '120.01'], 'invalid-timeout'],
    ]) {
      const checked = result(['search', '--corpus', corpus, '--query', 'copper', ...args])
      assert.equal(checked.child.status, 2)
      assert.equal(checked.body.error.code, code)
    }
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

test('original reads preserve full bytes, hash them, and reject traversal and symlink escapes', { skip: !rgAvailable && 'ripgrep is unavailable' }, () => {
  const { temp, corpus } = fixture()
  try {
    mkdirSync(path.join(corpus, 'nested'))
    const raw = Buffer.from('# Exact source\r\n\r\nKeep final bytes.\n')
    writeFileSync(path.join(corpus, 'nested/source.md'), raw)
    const expected = createHash('sha256').update(raw).digest('hex')
    const loaded = result(['read', '--corpus', corpus, '--path', 'nested/source.md', '--expected-sha256', expected])
    assert.equal(loaded.child.status, 0, loaded.child.stderr)
    assert.equal(loaded.body.path, 'nested/source.md')
    assert.equal(loaded.body.content, raw.toString('utf8'))
    assert.equal(loaded.body.byteLength, raw.byteLength)
    assert.equal(loaded.body.sha256, expected)
    assert.deepEqual(readFileSync(path.join(corpus, 'nested/source.md')), raw)

    const outside = path.join(temp, 'outside.md')
    writeFileSync(outside, 'outside the corpus\n')
    symlinkSync(outside, path.join(corpus, 'escape.md'))
    symlinkSync(path.dirname(outside), path.join(corpus, 'escape-dir'))
    for (const invalidPath of ['../outside.md', outside, 'escape.md', 'escape-dir/outside.md', 'nested/source.txt']) {
      const blocked = result(['read', '--corpus', corpus, '--path', invalidPath])
      assert.equal(blocked.child.status, 2, invalidPath)
      assert.ok(['invalid-original-path', 'unsafe-original-path'].includes(blocked.body.error.code), invalidPath)
    }
    const badHash = result(['read', '--corpus', corpus, '--path', 'nested/source.md', '--expected-sha256', '0'.repeat(64)])
    assert.equal(badHash.child.status, 2)
    assert.equal(badHash.body.error.code, 'original-hash-mismatch')
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})
