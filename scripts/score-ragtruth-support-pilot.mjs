#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { scoreRagTruthSupportPilot, verifyRagTruthPilotManifest } from './lib/ragtruth-support-pilot.mjs'

function privateFile(filePath, { output = false } = {}) {
  const root = fs.realpathSync('/private/tmp')
  const absolute = path.resolve(filePath)
  let actual
  if (output) {
    const parent = fs.realpathSync(path.dirname(absolute))
    if (fs.existsSync(absolute) && fs.lstatSync(absolute).isSymbolicLink())
      throw new Error(`Refusing symbolic-link score path: ${absolute}`)
    actual = path.join(parent, path.basename(absolute))
  } else actual = fs.realpathSync(absolute)
  const relative = path.relative(root, actual)
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new Error('RAGTruth pilot artifacts must stay below /private/tmp')
  return actual
}

function parseArgs(args) {
  const allowed = new Set(['--packet', '--labels', '--review', '--manifest', '--out'])
  const options = new Map()
  for (let index = 0; index < args.length; index++) {
    const key = args[index]
    if (!allowed.has(key) || options.has(key)) throw new Error(`Unknown or duplicate option: ${key}`)
    const value = args[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Need a path after ${key}`)
    options.set(key, value)
    index++
  }
  for (const key of allowed) if (!options.has(key)) throw new Error(`Need ${key}`)
  return options
}

const args = parseArgs(process.argv.slice(2))
const packetPath = privateFile(args.get('--packet'))
const labelsPath = privateFile(args.get('--labels'))
const reviewPath = privateFile(args.get('--review'))
const manifestPath = privateFile(args.get('--manifest'))
const outPath = privateFile(args.get('--out'), { output: true })
const packetBytes = fs.readFileSync(packetPath)
const labelsBytes = fs.readFileSync(labelsPath)
const manifestBytes = fs.readFileSync(manifestPath)
verifyRagTruthPilotManifest(manifestBytes, packetBytes, labelsBytes, packetPath, labelsPath)
const result = scoreRagTruthSupportPilot(packetBytes, JSON.parse(labelsBytes), JSON.parse(fs.readFileSync(reviewPath)))
const bytes = `${JSON.stringify(result, null, 2)}\n`
const staging = `${outPath}.tmp-${process.pid}`
fs.writeFileSync(staging, bytes, { flag: 'wx', mode: 0o600 })
fs.renameSync(staging, outPath)
console.log(JSON.stringify(result))
