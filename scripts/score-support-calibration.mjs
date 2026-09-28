#!/usr/bin/env node
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { scoreSupportCalibration } from './lib/support-calibration.mjs'
const args = process.argv.slice(2)
const get = key => args.includes(key) ? args[args.indexOf(key) + 1] : null
const packet = get('--packet'), labels = get('--labels'), review = get('--review'), out = get('--out')
const manifest = get('--manifest')
if (!packet || !labels || !review) throw new Error('Need --packet, --labels and --review')
if (args.includes('--manifest') && !manifest) throw new Error('Need a path after --manifest')

const packetBytes = fs.readFileSync(packet)
const labelsBytes = fs.readFileSync(labels)
const labelsData = JSON.parse(labelsBytes)

if (manifest) {
  const frozen = JSON.parse(fs.readFileSync(manifest))
  const packetData = JSON.parse(packetBytes)
  if (!frozen || typeof frozen !== 'object' || Array.isArray(frozen))
    throw new Error('Invalid calibration manifest')
  if (frozen.protocol !== packetData.protocol || frozen.protocol !== labelsData.protocol)
    throw new Error('Calibration manifest protocol mismatch')
  if (!Number.isSafeInteger(frozen.plannedCases) || frozen.plannedCases < 1 ||
      !Array.isArray(packetData.cases) || !Array.isArray(labelsData.labels) ||
      frozen.plannedCases !== packetData.cases.length || frozen.plannedCases !== labelsData.labels.length)
    throw new Error('Calibration manifest planned case count mismatch')
  if (!frozen.hashes || typeof frozen.hashes !== 'object' || Array.isArray(frozen.hashes))
    throw new Error('Calibration manifest missing required hashes')

  for (const [sourcePath, sourceBytes] of [[packet, packetBytes], [labels, labelsBytes]]) {
    const fileName = path.basename(sourcePath)
    const expected = frozen.hashes[fileName]
    if (typeof expected !== 'string' || !/^[a-f\d]{64}$/i.test(expected))
      throw new Error(`Calibration manifest missing required hash: ${fileName}`)
    const actual = createHash('sha256').update(sourceBytes).digest('hex')
    if (actual !== expected.toLowerCase())
      throw new Error(`Calibration source hash mismatch: ${fileName}`)
  }
}

const result = scoreSupportCalibration(packetBytes, labelsData, JSON.parse(fs.readFileSync(review)))
const bytes = JSON.stringify(result, null, 2) + '\n'
if (out) fs.writeFileSync(out, bytes)
console.log(JSON.stringify(result))
