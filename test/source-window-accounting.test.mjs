import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { digest } from '../scripts/lib/locomo.mjs'

test('source-window evaluator counts duplicated annotations as one distinct available evidence turn', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-source-window-accounting-'))
  try {
    const corpus = JSON.stringify([{ sample_id: 'fixture', conversation: {
      session_1_date_time: '1 January 2026', session_1: [{ speaker: 'Ada', dia_id: 'D1:1', text: 'I received one letter.' }],
    }, qa: [{ question: 'How many letters?', category: 1, answer: 'One', evidence: ['D1:1', 'D1:1'] }] }])
    const input = path.join(dir, 'corpus.json'), manifest = path.join(dir, 'manifest.json'), out = path.join(dir, 'results.json')
    fs.writeFileSync(input, corpus)
    fs.writeFileSync(manifest, JSON.stringify({ protocol: 'source-section-window-development-screen-v1',
      datasetSha256: digest(corpus), sourceHashes: {}, development: ['fixture'], expectedCases: 1,
      contextVariants: [0, 1, 2], maximumMedianSelectedFraction: 1, holdoutNotRendered: [], limitations: [],
    }))
    const child = spawnSync(process.execPath, ['scripts/eval-source-section-window.mjs', '--input', input, '--manifest', manifest, '--out', out], { encoding: 'utf8' })
    assert.equal(child.status, 0, child.stderr)
    const report = JSON.parse(fs.readFileSync(out))
    assert.equal(report.rows[0].goldTurns, 1)
    assert.equal(report.rows[0].annotatedGoldEntries, 2)
    for (const summary of Object.values(report.summary)) {
      assert.equal(summary.completeGoldTurns, 1)
      assert.equal(summary.goldLossCases, 0)
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
