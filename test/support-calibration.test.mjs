import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { scoreSupportCalibration } from '../scripts/lib/support-calibration.mjs'
const packet = fs.readFileSync(new URL('../eval/judge-calibration/packet-v1.json', import.meta.url))
const labels = JSON.parse(fs.readFileSync(new URL('../eval/judge-calibration/labels-v1.json', import.meta.url)))
const perfect = () => ({ protocol: labels.protocol,
  reviews: labels.labels.map(row => ({ blindId: row.blindId, ...row.expected, rationale: 'Constructed test verdict.' })) })

test('support calibration accounts for false acceptance, abstention and all frozen cases', () => {
  const result = scoreSupportCalibration(packet, labels, perfect())
  assert.equal(result.cases, 20)
  assert.equal(result.passesSanityGate, true)
  const mistaken = perfect(), negative = mistaken.reviews.find(row => row.sourceSupport === 'no')
  Object.assign(negative, { sourceSupport: 'yes', complete: 'yes', citationCoverage: 'yes', supportedComplete: 'yes' })
  const scored = scoreSupportCalibration(packet, labels, mistaken)
  assert.equal(scored.exactPrimaryAgreement, 0.95)
  assert.equal(scored.falseAcceptances, 1)
  assert.equal(scored.falseAcceptanceRate, 0.1)
  assert.equal(scored.passesSanityGate, false)
})

test('calibration preserves unclear verdicts and rejects missing/duplicate/unknown rows or source drift', () => {
  const unknown = perfect(), row = unknown.reviews.find(item => item.supportedComplete === 'yes')
  row.sourceSupport = row.supportedComplete = 'unclear'
  const scored = scoreSupportCalibration(packet, labels, unknown)
  assert.equal(scored.unclearPrimary, 1)
  assert.equal(scored.positiveRecall, 0.9)
  assert.equal(scored.exactPrimaryAgreement, 0.95)
  for (const change of [r => r.reviews.pop(), r => r.reviews[0] = r.reviews[1], r => r.reviews[0].blindId = 'unknown']) {
    const bad = perfect(); change(bad)
    assert.throws(() => scoreSupportCalibration(packet, labels, bad), /calibration identity/)
  }
  assert.throws(() => scoreSupportCalibration(Buffer.concat([packet, Buffer.from(' ')]), labels, perfect()), /packet changed/)
  const inconsistent = perfect(); inconsistent.reviews[0].supportedComplete = inconsistent.reviews[0].supportedComplete === 'yes' ? 'no' : 'yes'
  assert.throws(() => scoreSupportCalibration(packet, labels, inconsistent), /primary verdict/)
})

test('v2 requires every component gate even when primary accuracy is perfect; v1 replay unchanged', () => {
  const bytes = fs.readFileSync(new URL('../eval/judge-calibration/packet-v2.json', import.meta.url))
  const frozen = JSON.parse(fs.readFileSync(new URL('../eval/judge-calibration/labels-v2.json', import.meta.url)))
  const review = { protocol: frozen.protocol, reviews: frozen.labels.map(row => ({
    blindId: row.blindId, ...row.expected, rationale: 'Controlled component test.' })) }
  assert.equal(scoreSupportCalibration(bytes, frozen, review).passesSanityGate, true)
  for (const row of review.reviews.filter(row => row.sourceSupport === 'no').slice(0, 3)) row.citationCoverage = 'yes'
  const result = scoreSupportCalibration(bytes, frozen, review)
  assert.equal(result.exactPrimaryAgreement, 1)
  assert.equal(result.dimensionAgreement.citationCoverage, 21 / 24)
  assert.equal(result.passesSanityGate, false)
  assert.throws(() => scoreSupportCalibration(bytes, { ...frozen, gate: labels.gate }, review), /dimension gate/)
  assert.throws(() => scoreSupportCalibration(bytes, frozen, perfect()), /protocol mismatch/)
  const corrupted = structuredClone(frozen)
  corrupted.labels[0].expected.supportedComplete = corrupted.labels[0].expected.supportedComplete === 'yes' ? 'no' : 'yes'
  assert.throws(() => scoreSupportCalibration(bytes, corrupted, review), /primary label/)
  const v1Review = JSON.parse(fs.readFileSync(new URL('../eval/judge-calibration/review-v1.json', import.meta.url)))
  const v1Score = JSON.parse(fs.readFileSync(new URL('../eval/judge-calibration/score-v1.json', import.meta.url)))
  assert.deepEqual(scoreSupportCalibration(packet, labels, v1Review), v1Score)
})
