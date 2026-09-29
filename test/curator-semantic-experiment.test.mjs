import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

test('real-inference experiment preserves failed attempt and never passes on missing semantic dependency', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-semantic-experiment-test-'))
  try {
    const out = path.join(directory, 'run')
    const args = ['scripts/eval-curator-semantic-integration.mjs', '--out', out, '--model-cache', path.join(directory, 'cache')]
    const result = spawnSync(process.execPath, args, { encoding: 'utf8',
      env: { ...process.env, MPH_TEST_SEMANTIC_MOCK_MISSING: '1' } })
    assert.notEqual(result.status, 0)
    const report = JSON.parse(fs.readFileSync(path.join(out, 'report.json')))
    assert.equal(report.complete, false)
    assert.match(report.stopReason, /OPTIONAL_DEPENDENCY_MISSING/u)
    assert.equal(report.planned.length, 8)
    assert.equal(report.attempts.length, 1)
    assert.equal(report.attempts[0].passed, false)
    assert.equal(report.attempts[0].pages.length, 0)
    assert.equal(Object.keys(report.sourceHashes).length, 23)
    const retry = spawnSync(process.execPath, args, { encoding: 'utf8' })
    assert.notEqual(retry.status, 0)
    assert.match(retry.stderr, /Preserve prior experiment outputs/u)
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
