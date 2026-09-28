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
