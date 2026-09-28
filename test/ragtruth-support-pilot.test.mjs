import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  prepareRagTruthSupportPilot,
  scoreRagTruthSupportPilot,
  verifyRagTruthPilotManifest
} from '../scripts/lib/ragtruth-support-pilot.mjs'

const tasks = ['QA', 'Summary', 'Data2txt']
const strata = ['no-spans', 'has-spans']

function makeCorpus(root, change = () => {}) {
  fs.mkdirSync(root, { recursive: true })
  const responses = [], sources = []
  for (const taskType of tasks) {
    for (const stratum of strata) {
      for (let index = 0; index < 4; index++) {
        const sourceId = `${taskType}-${stratum}-${index}`
        const prompt = `${taskType} request for ${sourceId}. The supplied fact is 7.`
        const response = stratum === 'no-spans' ? 'The supplied value is 7.' : 'The supplied value is 99.'
        const spanStart = response.indexOf('99')
        const labels = stratum === 'no-spans' ? [] : [{
          start: spanStart,
          end: spanStart + 2,
          text: '99',
          label_type: 'Evident Baseless Info',
          meta: null,
          due_to_null: false,
          implicit_true: index === 0
        }]
        const record = {
          id: `response-${sourceId}`,
          source_id: sourceId,
          model: 'synthetic-only',
          temperature: 0,
          quality: 'good',
          response,
          labels,
          split: 'train'
        }
        change(record, taskType, stratum, index)
        responses.push(record)
        sources.push({
          source_id: sourceId,
          prompt,
          source: `synthetic-source:${taskType}`,
          source_info: taskType === 'Summary' ? 'synthetic source document' : { question: 'Synthetic?', passages: 'Fact: 7.' },
          task_type: taskType
        })
      }
    }
  }
  responses.push({ split: 'train', quality: 'truncated', id: 'excluded', source_id: 'excluded', response: 17, labels: {} })
  // The metadata scanner must ignore every non-split field on test rows.
  responses.push({ response: 17, labels: { malformedForTraining: true }, quality: 17, split: 'test' })
  const responsesPath = path.join(root, 'response.jsonl')
  const sourceInfoPath = path.join(root, 'source_info.jsonl')
  fs.writeFileSync(responsesPath, responses.map(row => JSON.stringify(row)).join('\n') + '\n')
  fs.writeFileSync(sourceInfoPath, sources.map(row => JSON.stringify(row)).join('\n') + '\n')
  return { responsesPath, sourceInfoPath, sources }
}

async function prepare(root, paths = makeCorpus(root)) {
  const output = path.join(root, 'artifacts')
  fs.mkdirSync(output, { recursive: true })
  const result = await prepareRagTruthSupportPilot({
    ...paths,
    packetPath: path.join(output, 'packet.json'),
    labelsPath: path.join(output, 'labels.json'),
    manifestPath: path.join(output, 'manifest.json'),
    privateRoot: root
  })
  return { ...result, paths, output }
}

function perfectReview(labels) {
  return {
    protocol: labels.protocol,
    reviews: labels.labels.map(row => ({
      blindId: row.blindId,
      sourceSupport: row.expectedSourceSupport,
      rationale: 'Synthetic fixture verdict tied to the supplied prompt.'
    }))
  }
}

test('preparer freezes 24 balanced, distinct source groups and keeps the reviewer packet blind', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-ragtruth-pilot-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const first = await prepare(root)
  const packetBytes = fs.readFileSync(first.packetPath)
  const labelsBytes = fs.readFileSync(first.labelsPath)
  const manifestBytes = fs.readFileSync(first.manifestPath)
  const packet = JSON.parse(packetBytes)
  const labels = JSON.parse(labelsBytes)
  const manifest = JSON.parse(manifestBytes)

  assert.equal(packet.cases.length, 24)
  assert.equal(labels.labels.length, 24)
  assert.equal(new Set(labels.labels.map(row => row.sourceId)).size, 24)
  assert.equal(labels.labels.filter(row => row.expectedSourceSupport === 'yes').length, 12)
  assert.equal(labels.labels.filter(row => row.expectedSourceSupport === 'no').length, 12)
  assert.equal(manifest.accounting.inputResponseRows, 26)
  assert.deepEqual(manifest.accounting.splitCounts, { train: 25, test: 1 })
  assert.deepEqual(manifest.accounting.trainQualityCounts, { good: 24, truncated: 1 })
  assert.equal(manifest.accounting.matchedGoodTrainSourceInfoRows, 24)
  assert.equal(manifest.accounting.selectedUniqueSourceIds, 24)
  assert.equal(manifest.accounting.selectedImplicitTrueSpans, 3)
  for (const taskType of tasks) for (const stratum of strata) {
    assert.equal(manifest.accounting.taskStrata[taskType][stratum].selected, 4)
  }
  for (const item of packet.cases) {
    assert.deepEqual(Object.keys(item).sort(), ['blindId', 'prompt', 'response', 'taskType'])
    assert.ok(item.prompt.includes('The supplied fact is 7.'))
  }
  assert.equal(JSON.stringify(packet).includes('sourceId'), false)
  assert.equal(JSON.stringify(packet).includes('expectedSourceSupport'), false)
  const labelOrder = labels.labels.map(row => row.blindId).join(',')
  assert.notEqual(packet.cases.map(row => row.blindId).join(','), labelOrder)
  verifyRagTruthPilotManifest(manifestBytes, packetBytes, labelsBytes,
    first.packetPath, first.labelsPath, root)

  const secondRoot = path.join(root, 'second-output')
  fs.mkdirSync(secondRoot)
  await prepareRagTruthSupportPilot({
    ...first.paths,
    packetPath: path.join(secondRoot, 'packet.json'),
    labelsPath: path.join(secondRoot, 'labels.json'),
    manifestPath: path.join(secondRoot, 'manifest.json'),
    privateRoot: root
  })
  assert.deepEqual(fs.readFileSync(path.join(secondRoot, 'packet.json')), packetBytes)
  assert.deepEqual(fs.readFileSync(path.join(secondRoot, 'labels.json')), labelsBytes)
  assert.deepEqual(fs.readFileSync(path.join(secondRoot, 'manifest.json')), manifestBytes)
})

test('preparer fails closed on missing joins, unknown annotation labels and bad offsets', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-ragtruth-invalid-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  const missingJoin = makeCorpus(path.join(root, 'missing-join'))
  const sourceRows = fs.readFileSync(missingJoin.sourceInfoPath, 'utf8').trimEnd().split('\n')
  fs.writeFileSync(missingJoin.sourceInfoPath, sourceRows.slice(1).join('\n') + '\n')
  await assert.rejects(prepare(path.join(root, 'missing-join'), missingJoin), /Missing source-info join/)

  const unknownLabel = makeCorpus(path.join(root, 'unknown-label'), record => {
    if (record.labels.length) record.labels[0].label_type = 'Unreviewed Label'
  })
  await assert.rejects(prepare(path.join(root, 'unknown-label'), unknownLabel), /Invalid human annotation span/)

  const badOffset = makeCorpus(path.join(root, 'bad-offset'), record => {
    if (record.labels.length) record.labels[0].start++
  })
  await assert.rejects(prepare(path.join(root, 'bad-offset'), badOffset), /offset\/text mismatch/)
})

test('support-only scorer counts unclear as nonagreement and enforces false acceptance gate', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-ragtruth-score-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const frozen = await prepare(root)
  const packetBytes = fs.readFileSync(frozen.packetPath)
  const labels = JSON.parse(fs.readFileSync(frozen.labelsPath))
  const perfect = perfectReview(labels)
  const accepted = scoreRagTruthSupportPilot(packetBytes, labels, perfect)
  assert.equal(accepted.exactSourceSupportAgreement, 1)
  assert.equal(accepted.positivePrecision, 1)
  assert.equal(accepted.falseAcceptances, 0)
  assert.equal(accepted.passesPilotGate, true)
  assert.deepEqual(Object.keys(accepted.byTask), tasks)

  const unclear = structuredClone(perfect)
  const positive = labels.labels.find(row => row.expectedSourceSupport === 'yes')
  unclear.reviews.find(row => row.blindId === positive.blindId).sourceSupport = 'unclear'
  const unclearScore = scoreRagTruthSupportPilot(packetBytes, labels, unclear)
  assert.equal(unclearScore.unclear, 1)
  assert.equal(unclearScore.exactSourceSupportAgreement, 23 / 24)
  assert.equal(unclearScore.passesPilotGate, true)

  const falseAccept = structuredClone(perfect)
  const negative = labels.labels.find(row => row.expectedSourceSupport === 'no')
  falseAccept.reviews.find(row => row.blindId === negative.blindId).sourceSupport = 'yes'
  const failed = scoreRagTruthSupportPilot(packetBytes, labels, falseAccept)
  assert.equal(failed.falseAcceptances, 1)
  assert.equal(failed.falseAcceptanceDenominator, 12)
  assert.equal(failed.exactSourceSupportAgreement, 23 / 24)
  assert.equal(failed.passesPilotGate, false)
  assert.throws(() => scoreRagTruthSupportPilot(packetBytes, labels, {
    ...perfect,
    reviews: perfect.reviews.map(row => ({ ...row, complete: 'yes' }))
  }), /support-only/)
})

test('manifest rejects packet, labels and raw source drift before scoring', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-ragtruth-manifest-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const frozen = await prepare(root)
  const packetBytes = fs.readFileSync(frozen.packetPath)
  const labelsBytes = fs.readFileSync(frozen.labelsPath)
  const manifestBytes = fs.readFileSync(frozen.manifestPath)
  assert.equal(verifyRagTruthPilotManifest(manifestBytes, packetBytes, labelsBytes,
    frozen.packetPath, frozen.labelsPath, root).plannedCases, 24)

  assert.throws(() => verifyRagTruthPilotManifest(manifestBytes,
    Buffer.concat([packetBytes, Buffer.from(' ')]), labelsBytes, frozen.packetPath, frozen.labelsPath, root), /hash mismatch/)
  assert.throws(() => verifyRagTruthPilotManifest(manifestBytes, packetBytes,
    Buffer.concat([labelsBytes, Buffer.from(' ')]), frozen.packetPath, frozen.labelsPath, root), /hash mismatch/)
  fs.appendFileSync(frozen.paths.responsesPath, ' ')
  assert.throws(() => verifyRagTruthPilotManifest(manifestBytes, packetBytes, labelsBytes,
    frozen.packetPath, frozen.labelsPath, root), /source-file hash mismatch/)
})
