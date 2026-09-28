import { createHash } from 'node:crypto'

const dimensions = ['sourceSupport', 'complete', 'citationCoverage', 'supportedComplete']
const verdicts = ['yes', 'no', 'unclear']

export function scoreSupportCalibration(packetBytes, labels, review) {
  const packet = JSON.parse(packetBytes)
  if (!['support-judge-calibration-v1', 'support-judge-calibration-v2'].includes(packet.protocol) ||
      [labels, review].some(item => item.protocol !== packet.protocol))
    throw new Error('Calibration protocol mismatch')
  if (createHash('sha256').update(packetBytes).digest('hex') !== labels.packetSha256)
    throw new Error('Calibration packet changed')
  if (!Array.isArray(packet.cases) || !Array.isArray(labels.labels) || !Array.isArray(review.reviews))
    throw new Error('Missing calibration records')
  const ids = new Set(packet.cases.map(item => item.blindId))
  if (!ids.size || ids.size !== packet.cases.length) throw new Error('Invalid packet identities')
  for (const rows of [labels.labels, review.reviews]) {
    if (rows.length !== ids.size || new Set(rows.map(item => item.blindId)).size !== ids.size ||
        rows.some(item => !ids.has(item.blindId))) throw new Error('Missing, duplicate or unknown calibration identity')
  }
  for (const row of labels.labels) {
    if (dimensions.some(key => !['yes', 'no'].includes(row.expected?.[key])) ||
        typeof row.rationale !== 'string' || !row.rationale.trim()) throw new Error('Invalid calibration label')
    if ((row.expected.supportedComplete === 'yes') !== dimensions.slice(0, 3).every(key => row.expected[key] === 'yes'))
      throw new Error('Inconsistent primary label')
  }
  for (const row of review.reviews) {
    if (dimensions.some(key => !verdicts.includes(row[key])) ||
        typeof row.rationale !== 'string' || !row.rationale.trim()) throw new Error('Invalid review verdict')
    const allYes = dimensions.slice(0, 3).every(key => row[key] === 'yes')
    if ((row.supportedComplete === 'yes') !== allYes) throw new Error('Inconsistent primary verdict')
  }
  const byId = new Map(review.reviews.map(item => [item.blindId, item]))
  const confusion = { yes: { yes: 0, no: 0, unclear: 0 }, no: { yes: 0, no: 0, unclear: 0 } }
  const correct = Object.fromEntries(dimensions.map(key => [key, 0]))
  const disagreements = []
  for (const label of labels.labels) {
    const observed = byId.get(label.blindId)
    for (const key of dimensions) correct[key] += Number(label.expected[key] === observed[key])
    confusion[label.expected.supportedComplete][observed.supportedComplete]++
    if (dimensions.some(key => label.expected[key] !== observed[key]))
      disagreements.push({ blindId: label.blindId, family: label.family,
        expected: label.expected, observed: Object.fromEntries(dimensions.map(key => [key, observed[key]])) })
  }
  const n = ids.size, tp = confusion.yes.yes, fp = confusion.no.yes
  const fn = confusion.yes.no + confusion.yes.unclear
  const negative = Object.values(confusion.no).reduce((a, b) => a + b, 0)
  const ratio = (a, b) => b ? a / b : null
  const precision = ratio(tp, tp + fp), recall = ratio(tp, tp + fn)
  const f1 = ratio(2 * tp, 2 * tp + fp + fn)
  const agreement = correct.supportedComplete / n
  const gate = labels.gate
  if (!gate || !Number.isFinite(gate.minimumExactPrimaryAgreement) || gate.minimumExactPrimaryAgreement < 0 ||
      gate.minimumExactPrimaryAgreement > 1 || !Number.isSafeInteger(gate.maximumFalseAcceptances) || gate.maximumFalseAcceptances < 0)
    throw new Error('Invalid frozen calibration gate')
  const dimensionAgreement = Object.fromEntries(dimensions.map(key => [key, correct[key] / n]))
  const minimumDimension = packet.protocol === 'support-judge-calibration-v2' ? gate.minimumDimensionAgreement : 0
  if (!Number.isFinite(minimumDimension) || minimumDimension < 0 || minimumDimension > 1)
    throw new Error('Invalid frozen dimension gate')
  return { protocol: packet.protocol, cases: n, exactPrimaryAgreement: agreement,
    dimensionAgreement,
    confusion, positivePrecision: precision, positiveRecall: recall, positiveF1: f1,
    falseAcceptances: fp, falseAcceptanceRate: ratio(fp, negative),
    unclearPrimary: confusion.yes.unclear + confusion.no.unclear,
    passesSanityGate: agreement >= gate.minimumExactPrimaryAgreement && fp <= gate.maximumFalseAcceptances &&
      Object.values(dimensionAgreement).every(value => value >= minimumDimension),
    disagreements, limitation: 'Author-constructed synthetic calibration only; not independent semantic acceptance.' }
}
