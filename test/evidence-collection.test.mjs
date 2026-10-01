import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createEvidenceCollection, collectEvidencePage, recordEvidenceSpan, summarizeEvidenceCollection } from '../src/evidence-collection.mjs'

function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-collection-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  for (const [relative, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true })
    fs.writeFileSync(path.join(root, relative), text)
  }
  return { root, state: () => createEvidenceCollection({ vaultRoot: root, paths: Object.keys(files), scopeLabel: 'test history' }) }
}

test('all originals survive multi-page UTF-8 transport within exact JSON byte budget', t => {
  const files = { 'first.md': '# Evidence\n' + 'ไทย 🧠 "quoted"\n'.repeat(250), 'later.md': '# Later\nOwner: Ada' }
  const { state } = fixture(t, files), collection = state(), delivered = new Map()
  let pages = 0, more = true
  while (more) {
    const page = collectEvidencePage(collection, { maxBytes: 750 })
    assert.ok(Buffer.byteLength(JSON.stringify(page)) <= 750)
    assert.equal(page.semanticCompleteness, 'unverified')
    for (const fragment of page.fragments) {
      const original = Buffer.from(files[fragment.path])
      assert.equal(fragment.startLine, original.subarray(0, fragment.byteStart).toString('utf8').split('\n').length)
      assert.equal(fragment.endLine, original.subarray(0, fragment.byteEnd).toString('utf8').split('\n').length)
      assert.equal(fragment.startsMidLine, fragment.byteStart > 0 && original[fragment.byteStart - 1] !== 10)
      assert.equal(fragment.endsMidLine, fragment.byteEnd < original.length && fragment.byteEnd > 0 && original[fragment.byteEnd - 1] !== 10)
      assert.equal(fragment.byteStart, Buffer.byteLength(delivered.get(fragment.path) ?? ''))
      delivered.set(fragment.path, (delivered.get(fragment.path) ?? '') + fragment.text)
      assert.ok(!fragment.text.includes('\uFFFD'))
      assert.equal(fragment.byteEnd, Buffer.byteLength(delivered.get(fragment.path)))
    }
    more = page.hasMore; pages += 1
    assert.ok(pages < 1000)
  }
  assert.ok(pages > 3)
  assert.deepEqual(Object.fromEntries(delivered), files)
  assert.equal(summarizeEvidenceCollection(collection).deliveryComplete, true)
})

test('pending page and verified quote never imply fact support or exhaustive semantic completeness', t => {
  const { state } = fixture(t, { 'a.md': '# Note\nAda owns the release.', 'z.md': 'x'.repeat(3000) })
  const collection = state()
  assert.throws(() => recordEvidenceSpan(collection, { path: 'a.md', sourceSha256: collection.sources[0].sha256,
    startLine: 2, endLine: 2, quote: 'Ada owns the release.', fact: 'Ada owns the release.' }), /delivery/u)
  collectEvidencePage(collection, { maxBytes: 750 })
  const input = { path: 'a.md', sourceSha256: collection.sources[0].sha256, startLine: 2, endLine: 2,
    quote: 'Ada owns the release.', fact: 'Ada is a doctor.' }
  const result = recordEvidenceSpan(collection, input)
  assert.equal(result.spanVerified, true)
  assert.equal(result.entailment, 'unverified')
  recordEvidenceSpan(collection, input)
  assert.equal(collection.ledger.length, 1)
  assert.equal(summarizeEvidenceCollection(collection).deliveryComplete, false)
  assert.throws(() => recordEvidenceSpan(collection, { ...input, quote: 'invented' }), /match/u)
  assert.throws(() => recordEvidenceSpan(collection, { ...input, sourceSha256: '0'.repeat(64) }), /Invalid/u)
})

test('source mutation or deletion rejects further delivery and summaries', t => {
  const { root, state } = fixture(t, { 'a.md': 'first', 'b.md': 'later' })
  const collection = state()
  fs.writeFileSync(path.join(root, 'b.md'), 'changed')
  assert.throws(() => collectEvidencePage(collection), /changed/u)
  assert.throws(() => summarizeEvidenceCollection(collection), /changed/u)
  assert.equal(collection.index, 0)
  fs.unlinkSync(path.join(root, 'a.md'))
  assert.throws(() => collectEvidencePage(collection))
})

test('unsafe paths, symlinks and duplicate scopes cannot enter collection', t => {
  const { root } = fixture(t, { 'a.md': 'original' })
  const create = paths => createEvidenceCollection({ vaultRoot: root, paths, scopeLabel: 'history' })
  for (const unsafe of ['../a.md', '/a.md', 'folder/../a.md', 'a\\b.md', './a.md']) assert.throws(() => create([unsafe]))
  fs.symlinkSync(path.join(root, 'a.md'), path.join(root, 'link.md'))
  assert.throws(() => create(['link.md']), /Unsafe/u)
  assert.throws(() => create(['a.md', 'a.md']))
  assert.throws(() => create([]))
})

test('tiny budgets cannot silently advance the collection; empty originals still deliver', t => {
  const { state } = fixture(t, { 'empty.md': '', 'a.md': '🧠' })
  const collection = state()
  assert.throws(() => collectEvidencePage(collection, { maxBytes: 256 }))
  assert.equal(collection.index, 0)
  const page = collectEvidencePage(collection, { maxBytes: 1000 })
  assert.equal(page.deliveryComplete, true)
  assert.equal(page.fragments.length, 2)
  assert.equal(page.fragments[0].text, '')
})

test('existing read-notes CLI resumes private collection state and refuses changed originals', t => {
  const { root } = fixture(t, { 'a.md': 'ไทย\n'.repeat(600), 'later.md': 'Owner: Ada' })
  const stateFile = path.join(root, 'collection.json')
  const cli = fileURLToPath(new URL('../scripts/brain-sync.mjs', import.meta.url))
  const args = [cli, 'read-notes', '--vault', root, '--paths', '["a.md","later.md"]',
    '--collect-state', stateFile, '--bundle-bytes', '750']
  const run = () => spawnSync(process.execPath, args, { encoding: 'utf8' })
  const first = run()
  assert.equal(first.status, 0, first.stderr)
  assert.equal(JSON.parse(first.stdout).hasMore, true)
  assert.ok(Buffer.byteLength(first.stdout) <= 751)
  // Windows stat mode does not represent NTFS access controls. Content,
  // continuation and changed-source refusal below still run on every host.
  if (process.platform !== 'win32') assert.equal(fs.statSync(stateFile).mode & 0o777, 0o600)
  let more = true, pages = 1
  while (more) {
    const result = run()
    assert.equal(result.status, 0, result.stderr)
    more = JSON.parse(result.stdout).hasMore
    assert.ok(++pages < 100)
  }
  const frozen = fs.readFileSync(stateFile, 'utf8')
  fs.writeFileSync(path.join(root, 'later.md'), 'changed')
  assert.notEqual(run().status, 0)
  assert.equal(fs.readFileSync(stateFile, 'utf8'), frozen)
})
