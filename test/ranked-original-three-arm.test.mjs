import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const pythonTest = fileURLToPath(new URL('./ranked_original_three_arm_test.py', import.meta.url))

test('ranked three-arm runner continues only after authorized, verified resource stops', () => {
  const child = spawnSync('python3', [pythonTest], { encoding: 'utf8', timeout: 15000 })
  assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`)
})
