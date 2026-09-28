import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

test('three-arm scorer refuses pending, duplicate and reordered slots before creating scores', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-three-arm-accounting-'))
  try {
    const prepared = path.join(scratch, 'prepared'), runs = path.join(scratch, 'runs')
    fs.mkdirSync(prepared); fs.mkdirSync(runs)
    const manifest = JSON.stringify({ protocol: 'prefetch-three-arm-development-v1',
      plannedTrials: 3, cases: [], executionOrder: [{}, {}, {}] })
    fs.writeFileSync(path.join(prepared, 'manifest.json'), manifest)
    for (const [name, attempts, error] of [
      ['pending', [{ index: 0 }], 'Pending slots'],
      ['duplicate', [{ index: 0 }, { index: 1 }, { index: 1 }], 'Duplicate attempt'],
      ['reordered', [{ index: 0 }, { index: 2 }, { index: 1 }], 'Unknown or unordered slot'],
    ]) {
      fs.writeFileSync(path.join(runs, 'ledger.json'), JSON.stringify({
        manifestSha256: createHash('sha256').update(manifest).digest('hex'), indexBuilds: [], attempts, stopped: null,
      }))
      const output = path.join(scratch, name)
      const child = spawnSync('python3', ['scripts/summarize-prefetch-three-arm.py', '--prepared', prepared,
        '--runs', runs, '--scorer-source', 'unused', '--out', output], { encoding: 'utf8' })
      assert.notEqual(child.status, 0)
      assert.ok(child.stderr.includes(error), child.stderr)
      assert.equal(fs.existsSync(output), false)
    }
  } finally { fs.rmSync(scratch, { recursive: true, force: true }) }
})
