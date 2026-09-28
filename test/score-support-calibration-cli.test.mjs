import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixture = name => path.join(root, 'eval/judge-calibration', name)
const cli = path.join(root, 'scripts/score-support-calibration.mjs')

test('calibration CLI binds optional manifests and preserves legacy v1 score bytes', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-calibration-cli-'))
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }))

  const run = ({ packet = fixture('packet-v1.json'), labels = fixture('labels-v1.json'),
    review = fixture('review-v1.json'), manifest, out }) => {
    const args = [cli, '--packet', packet, '--labels', labels, '--review', review]
    if (manifest) args.push('--manifest', manifest)
    if (out) args.push('--out', out)
    return spawnSync(process.execPath, args, { encoding: 'utf8' })
  }
  const writeManifest = (name, change) => {
    const manifest = JSON.parse(fs.readFileSync(fixture('manifest-v1.json'), 'utf8'))
    change?.(manifest)
    const file = path.join(temp, name)
    fs.writeFileSync(file, JSON.stringify(manifest))
    return file
  }

  const expected = fs.readFileSync(fixture('score-v1.json'), 'utf8')
  const legacyOut = path.join(temp, 'legacy-score.json')
  const legacy = run({ out: legacyOut })
  assert.equal(legacy.status, 0, legacy.stderr)
  assert.equal(fs.readFileSync(legacyOut, 'utf8'), expected)
  assert.equal(`${legacy.stdout.trim()}\n`, JSON.stringify(JSON.parse(expected)) + '\n')

  const validOut = path.join(temp, 'manifest-score.json')
  const valid = run({ manifest: fixture('manifest-v1.json'), out: validOut })
  assert.equal(valid.status, 0, valid.stderr)
  assert.equal(fs.readFileSync(validOut, 'utf8'), expected)

  const mismatchOut = path.join(temp, 'must-not-publish.json')
  const missingHash = writeManifest('missing-hash.json', manifest => {
    delete manifest.hashes['labels-v1.json']
  })
  const missing = run({ manifest: missingHash, out: mismatchOut })
  assert.notEqual(missing.status, 0)
  assert.match(missing.stderr, /missing required hash/)
  assert.equal(fs.existsSync(mismatchOut), false)

  const badProtocol = writeManifest('bad-protocol.json', manifest => {
    manifest.protocol = 'support-judge-calibration-v2'
  })
  const protocolResult = run({ manifest: badProtocol })
  assert.notEqual(protocolResult.status, 0)
  assert.match(protocolResult.stderr, /protocol mismatch/)

  const badPlan = writeManifest('bad-plan.json', manifest => {
    manifest.plannedCases = 19
  })
  const planResult = run({ manifest: badPlan })
  assert.notEqual(planResult.status, 0)
  assert.match(planResult.stderr, /planned case count mismatch/)

  const changedPacketDir = path.join(temp, 'changed-packet')
  fs.mkdirSync(changedPacketDir)
  const changedPacket = path.join(changedPacketDir, 'packet-v1.json')
  fs.writeFileSync(changedPacket, Buffer.concat([fs.readFileSync(fixture('packet-v1.json')), Buffer.from(' ')]))
  const packetResult = run({ packet: changedPacket, manifest: fixture('manifest-v1.json'), out: mismatchOut })
  assert.notEqual(packetResult.status, 0)
  assert.match(packetResult.stderr, /source hash mismatch: packet-v1\.json/)
  assert.equal(fs.existsSync(mismatchOut), false)

  const changedLabelsDir = path.join(temp, 'changed-labels')
  fs.mkdirSync(changedLabelsDir)
  const changedLabels = path.join(changedLabelsDir, 'labels-v1.json')
  const labelBytes = fs.readFileSync(fixture('labels-v1.json'))
  fs.writeFileSync(changedLabels, Buffer.concat([labelBytes, Buffer.from(' ')]))
  assert.notEqual(createHash('sha256').update(labelBytes).digest('hex'),
    createHash('sha256').update(fs.readFileSync(changedLabels)).digest('hex'))
  const labelsResult = run({ labels: changedLabels, manifest: fixture('manifest-v1.json'), out: mismatchOut })
  assert.notEqual(labelsResult.status, 0)
  assert.match(labelsResult.stderr, /source hash mismatch: labels-v1\.json/)
  assert.equal(fs.existsSync(mismatchOut), false)

  const emptyManifest = writeManifest('no-hashes.json', manifest => {
    delete manifest.hashes
  })
  const hashesResult = run({ manifest: emptyManifest })
  assert.notEqual(hashesResult.status, 0)
  assert.match(hashesResult.stderr, /missing required hashes/)

  const missingManifestPath = spawnSync(process.execPath,
    [cli, '--packet', fixture('packet-v1.json'), '--labels', fixture('labels-v1.json'),
      '--review', fixture('review-v1.json'), '--manifest'], { encoding: 'utf8' })
  assert.notEqual(missingManifestPath.status, 0)
  assert.match(missingManifestPath.stderr, /path after --manifest/)
})
