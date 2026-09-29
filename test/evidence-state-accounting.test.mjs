import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

test('coverage A/B refuses pending, duplicate and unordered trials before loading labels or emitting scores', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-coverage-accounting-'))
  try {
    const prepared = path.join(scratch, 'prepared'), runs = path.join(scratch, 'runs')
    fs.mkdirSync(prepared); fs.mkdirSync(runs)
    const manifest = JSON.stringify({ executionOrder: [{}, {}, {}, {}] })
    fs.writeFileSync(path.join(prepared, 'manifest.json'), manifest)
    for (const [name, indices, error] of [
      ['pending', [0], 'Pending trials'], ['duplicate', [0, 1, 1, 3], 'Duplicate attempt'],
      ['unordered', [0, 2, 1, 3], 'Unknown or unordered'],
    ]) {
      fs.writeFileSync(path.join(runs, 'ledger.json'), JSON.stringify({
        manifestSha256: createHash('sha256').update(manifest).digest('hex'),
        attempts: indices.map(index => ({ index })), stopped: null,
      }))
      const output = path.join(scratch, name)
      const child = spawnSync('python3', ['scripts/summarize-evidence-state-ab.py', '--prepared', prepared,
        '--runs', runs, '--scorer-source', 'unused', '--out', output], { encoding: 'utf8' })
      assert.notEqual(child.status, 0)
      assert.ok(child.stderr.includes(error), child.stderr)
      assert.equal(fs.existsSync(output), false)
    }
  } finally { fs.rmSync(scratch, { recursive: true, force: true }) }
})
