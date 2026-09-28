import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('packing preflight publishes source-free coverage and preserves prior results', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-pack-record-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const vault = path.join(root, 'vault')
  fs.mkdirSync(vault)
  const text = '# Synthetic fixture\nPrivate-marker-with-quotes " and ไทย 🧠.\n'
  fs.writeFileSync(path.join(vault, 'fact.md'), text)
  const input = path.join(root, 'reader.json')
  const item = { id: 'synthetic', question: 'Which fact?', vault,
    sources: { 'fact.md': createHash('sha256').update(text).digest('hex') } }
  fs.writeFileSync(input, JSON.stringify([item]))
  const out = path.join(root, 'record.json')
  const run = () => spawnSync('python3', [fileURLToPath(new URL('../scripts/preflight-collection-packing.py', import.meta.url)),
    '--input', input, '--out', out], { encoding: 'utf8', timeout: 30000 })
  const first = run()
  assert.equal(first.status, 0, first.stderr)
  const raw = fs.readFileSync(out, 'utf8')
  const record = JSON.parse(raw)
  assert.deepEqual(record.arms.map(a => a.transportGate), [true, true])
  for (const arm of record.arms) {
    assert.equal(arm.coverage[0].mappedBytes, Buffer.byteLength(text))
    assert.equal(arm.callbacks.length, 1)
    assert.ok(arm.callbacks[0].promptBytes <= 300000)
  }
  assert.ok(!raw.includes('Private-marker-with-quotes'))
  assert.ok(!raw.includes(root))
  assert.notEqual(run().status, 0)
  assert.equal(fs.readFileSync(out, 'utf8'), raw)
  fs.unlinkSync(out)
  fs.appendFileSync(path.join(vault, 'fact.md'), 'drift\n')
  assert.notEqual(run().status, 0)
  assert.equal(fs.existsSync(out), false)
})
