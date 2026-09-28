import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { digest } from '../scripts/lib/locomo.mjs'
import { AUDIT_PROTOCOL, referenceCount, validateCountLabelReview } from '../scripts/lib/count-label-audit.mjs'

const manifest = { protocol: AUDIT_PROTOCOL, caseId: 'conv-1:2', referenceCount: 2,
  sessions: [{ path: 'session_1.md', turnIds: ['D1:1', 'D1:2'] }, { path: 'session_2.md', turnIds: ['D2:1'] }] }
const events = [
  { eventId: 'first', turnIds: ['D1:1'], classification: 'counted', rationale: 'Distinct visit' },
  { eventId: 'second', turnIds: ['D2:1'], classification: 'counted', rationale: 'Later visit' },
]
const review = { protocol: AUDIT_PROTOCOL, caseId: 'conv-1:2', status: 'valid',
  reviewedSessions: ['session_1.md', 'session_2.md'], events, rationale: 'All turns checked.' }

test('count references normalize digits and words without changing official QA scores', () => {
  assert.equal(referenceCount('2 times'), 2)
  assert.equal(referenceCount('Twice'), 2)
  assert.equal(referenceCount('two'), 2)
  assert.equal(referenceCount('once or twice'), null)
  assert.equal(referenceCount('2 or 3'), null)
  assert.equal(referenceCount('2.5'), null)
  assert.equal(referenceCount('Twice.'), 2)
})

test('valid count label requires complete session coverage and supported event identity', () => {
  assert.equal(validateCountLabelReview(manifest, review).eligibleForStrictCountEval, true)
  assert.throws(() => validateCountLabelReview(manifest, { ...review, reviewedSessions: ['session_1.md'] }), /unreviewed session/)
  assert.throws(() => validateCountLabelReview(manifest, { ...review, reviewedSessions: ['session_1.md'], events: [events[0]] }), /full-session review/)
  assert.throws(() => validateCountLabelReview(manifest, { ...review, events: [...events, {
    eventId: 'third', turnIds: ['D9:1'], classification: 'counted', rationale: 'Unknown' }] }), /Invalid event evidence/)
  assert.throws(() => validateCountLabelReview(manifest, { ...review, events: [...events, {
    eventId: 'candidate', turnIds: ['D1:2'], classification: 'candidate', rationale: 'Might be another visit' }] }), /resolved events/)
})

test('clear undercount is invalid even before remaining sessions are reviewed', () => {
  const extra = { eventId: 'childhood', turnIds: ['D1:2'], classification: 'counted', rationale: 'Earlier distinct visit' }
  const extended = { ...manifest, sessions: [...manifest.sessions, { path: 'session_3.md', turnIds: ['D3:1'] }] }
  const result = validateCountLabelReview(extended, { ...review, status: 'invalid',
    events: [...events, extra], rationale: 'Three visits exceed reference two.' })
  assert.equal(result.eligibleForStrictCountEval, false)
  assert.equal(result.countedEvents, 3)
  assert.throws(() => validateCountLabelReview(manifest, { ...review, status: 'invalid' }), /undercount/)
})

test('CLI audit refuses changed source bytes and a review bound to another manifest', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-label-integrity-'))
  try {
    const markdown = '# Memory\n## Ada (D1:1)\nFirst visit.\n'
    const localManifest = { ...manifest, referenceCount: 1,
      sessions: [{ path: 'session_1.md', sha256: digest(markdown), turnIds: ['D1:1'] }] }
    const bytes = JSON.stringify(localManifest)
    fs.writeFileSync(path.join(folder, 'manifest.json'), bytes)
    fs.writeFileSync(path.join(folder, 'session_1.md'), markdown)
    const localReview = { ...review, manifestSha256: digest(bytes), events: [events[0]], reviewedSessions: ['session_1.md'] }
    const reviewPath = path.join(folder, 'review.json')
    fs.writeFileSync(reviewPath, JSON.stringify(localReview))
    const run = () => spawnSync(process.execPath, ['scripts/validate-count-label-audit.mjs',
      '--packet', folder, '--review', reviewPath], { encoding: 'utf8' })
    assert.equal(run().status, 0)
    fs.writeFileSync(path.join(folder, 'session_1.md'), markdown + 'Second visit.\n')
    assert.notEqual(run().status, 0)
    assert.match(run().stderr, /Source session changed/)
    fs.writeFileSync(path.join(folder, 'session_1.md'), markdown)
    fs.writeFileSync(reviewPath, JSON.stringify({ ...localReview, manifestSha256: 'wrong' }))
    assert.match(run().stderr, /another manifest/)
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
})
