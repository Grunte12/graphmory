#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { digest } from './lib/locomo.mjs'
import { validateCountLabelReview } from './lib/count-label-audit.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const packet = option('--packet'), reviewPath = option('--review')
if (!packet || !reviewPath) throw new Error('Need --packet <folder> --review <JSON file>')
const folder = path.resolve(packet), manifestBytes = fs.readFileSync(path.join(folder, 'manifest.json'))
const manifest = JSON.parse(manifestBytes), review = JSON.parse(fs.readFileSync(reviewPath))
if (review.manifestSha256 !== digest(manifestBytes)) throw new Error('Review bound to another manifest')
for (const session of manifest.sessions) {
  const file = path.resolve(folder, session.path)
  if (!file.startsWith(folder + path.sep) || digest(fs.readFileSync(file)) !== session.sha256)
    throw new Error('Source session changed: ' + session.path)
}
console.log(JSON.stringify(validateCountLabelReview(manifest, review)))
