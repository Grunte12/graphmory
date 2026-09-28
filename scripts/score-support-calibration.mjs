#!/usr/bin/env node
import fs from 'node:fs'
import { scoreSupportCalibration } from './lib/support-calibration.mjs'
const args = process.argv.slice(2)
const get = key => args.includes(key) ? args[args.indexOf(key) + 1] : null
const packet = get('--packet'), labels = get('--labels'), review = get('--review'), out = get('--out')
if (!packet || !labels || !review) throw new Error('Need --packet, --labels and --review')
const result = scoreSupportCalibration(fs.readFileSync(packet), JSON.parse(fs.readFileSync(labels)), JSON.parse(fs.readFileSync(review)))
const bytes = JSON.stringify(result, null, 2) + '\n'
if (out) fs.writeFileSync(out, bytes)
console.log(JSON.stringify(result))
