#!/usr/bin/env node
// Materialize one exposed development case for the mediated Curator runner; labels stay separate.
import fs from 'node:fs'
import path from 'node:path'
import { hash, prepareCase } from './lib/longmemeval.mjs'

const args = process.argv.slice(2)
const value = flag => args[args.indexOf(flag) + 1]
for (const flag of ['--input', '--id', '--out']) if (!args.includes(flag)) throw new Error(`Missing ${flag}`)
const bytes = fs.readFileSync(value('--input'))
const manifest = JSON.parse(fs.readFileSync(new URL('../eval/longmemeval/development-v2.json', import.meta.url)))
if (hash(bytes) !== manifest.sourceSha256 || !manifest.selectedIds.includes(value('--id'))) throw new Error('Unpinned or unselected development case')
const items = JSON.parse(bytes)
const item = items.find(row => row.question_id === value('--id'))
if (!item || items.filter(row => row.question_id === value('--id')).length !== 1) throw new Error('Missing/duplicate case')
const prepared = prepareCase(item)
if (prepared.labels.category === 'temporal-reasoning') throw new Error('Temporal reader cases require query-date delivery; this pilot does not implement it')
const out = path.resolve(value('--out'))
if (fs.existsSync(out)) throw new Error('Preserve previous experiment; choose a new output')
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
try {
  const vault = path.join(out, 'vault')
  for (const doc of prepared.documents) {
    const file = path.join(vault, doc.path)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, doc.markdown, { mode: 0o600 })
  }
  const input = [{ id: prepared.labels.id, question: prepared.query.text, vault,
    sources: Object.fromEntries(prepared.documents.map(doc => [doc.path, hash(doc.markdown)])) }]
  fs.writeFileSync(path.join(out, 'reader-input.json'), JSON.stringify(input, null, 2) + '\n', { mode: 0o600 })
  fs.writeFileSync(path.join(out, 'labels.json'), JSON.stringify({ id: prepared.labels.id, answer: prepared.labels.answer,
    category: prepared.labels.category, goldPaths: prepared.labels.evidence }, null, 2) + '\n', { mode: 0o600 })
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ protocol: 'longmemeval-reader-development-v1',
    datasetSha256: hash(bytes), id: prepared.labels.id, sourceCount: prepared.documents.length,
    readerInputSha256: hash(fs.readFileSync(path.join(out, 'reader-input.json'))),
    sourceHashes: Object.fromEntries(['scripts/prepare-longmemeval-reader-pilot.mjs', 'scripts/lib/longmemeval.mjs',
      'scripts/run-curator-paging-pilot.py'].map(file => [file, hash(fs.readFileSync(new URL('../' + file, import.meta.url)))])),
    limitations: ['One exposed development case; labels are outside the reader input',
      'Temporal cases are rejected because the mediated reader input does not yet carry question date',
      'Session-level gold paths do not adjudicate answer semantics'] }, null, 2) + '\n', { mode: 0o600 })
  console.log(JSON.stringify({ id: prepared.labels.id, sessions: prepared.documents.length, out }))
} catch (error) {
  fs.rmSync(out, { recursive: true, force: true })
  throw error
}
