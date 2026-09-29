#!/usr/bin/env node
import { prepareRagTruthSupportPilot } from './lib/ragtruth-support-pilot.mjs'

function parseArgs(args) {
  const allowed = new Set(['--responses', '--source-info', '--packet-out', '--labels-out', '--manifest-out'])
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
const result = await prepareRagTruthSupportPilot({
  responsesPath: args.get('--responses'),
  sourceInfoPath: args.get('--source-info'),
  packetPath: args.get('--packet-out'),
  labelsPath: args.get('--labels-out'),
  manifestPath: args.get('--manifest-out'),
  privateRoot: '/private/tmp'
})
console.log(JSON.stringify(result))
