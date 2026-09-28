#!/usr/bin/env node
// Freeze one answerable and one adversarial development case for a live workflow check.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { digest, prepareConversation } from './lib/locomo.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const input = option('--input'), out = option('--out')
if (!input || !out || fs.existsSync(out)) throw new Error('Usage: --input <pinned LoCoMo JSON> --out <new directory>')
const bytes = fs.readFileSync(input)
const expected = '79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4'
if (digest(bytes) !== expected) throw new Error('Pinned LoCoMo dataset hash mismatch')
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'eval/locomo/development-v1.json'), 'utf8'))
const development = new Set(baseline.development)
const items = JSON.parse(bytes)
const seed = 'graphmory-locomo-live-development-2026-09-28-v1'
const excluded = new Set(['conv-43:21', 'conv-50:140'])
const available = items.filter(item => development.has(item.sample_id)).flatMap(item => {
  const prepared = prepareConversation(item)
  return prepared.questions.map((question, index) => ({ item, prepared, question, index }))
})
const selected = [], usedConversations = new Set()
for (const category of [1, 5]) {
  const candidates = available.filter(row => row.question.category === category &&
    !excluded.has(row.question.id) && (category === 5 || (!row.question.unresolved.length && row.question.evidence.length)))
    .sort((a, b) => digest(seed + a.question.id).localeCompare(digest(seed + b.question.id)))
  const choice = candidates.find(row => !usedConversations.has(row.item.sample_id))
  if (!choice) throw new Error(`No eligible development question for category ${category}`)
  selected.push(choice)
  usedConversations.add(choice.item.sample_id)
}
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const cases = [], labels = []
for (const row of selected) {
  const vault = path.join(out, 'vaults', row.item.sample_id)
  fs.mkdirSync(vault, { recursive: true })
  const sources = {}
  for (const doc of row.prepared.documents) {
    const file = path.join(vault, doc.path)
    fs.writeFileSync(file, doc.markdown, { mode: 0o600 })
    sources[doc.path] = digest(doc.markdown)
  }
  cases.push({ id: row.question.id, question: row.question.query, vault, sources })
  labels.push({ id: row.question.id, category: row.question.category,
    answer: row.item.qa[row.index].answer, goldPaths: row.question.evidence,
    goldTurnIds: row.item.qa[row.index].evidence })
}
const payload = JSON.stringify(cases, null, 2) + '\n'
const gold = JSON.stringify(labels, null, 2) + '\n'
fs.writeFileSync(path.join(out, 'reader-input.json'), payload, { mode: 0o600 })
fs.writeFileSync(path.join(out, 'labels.json'), gold, { mode: 0o600 })
const sourceFiles = ['scripts/prepare-locomo-live-development.mjs', 'scripts/run-curator-paging-pilot.py',
  'scripts/lib/locomo.mjs', 'src/retrieval.mjs', 'src/memory-recall.mjs', 'src/brain-sync.mjs']
const manifest = { protocol: 'locomo-live-development-v1', datasetSha256: expected,
  selectionSeed: seed, selectedIds: cases.map(row => row.id), categories: [1, 5],
  readerInputSha256: digest(payload), labelsSha256: digest(gold),
  sourceHashes: Object.fromEntries(sourceFiles.map(file => [file, digest(fs.readFileSync(path.join(root, file)))])),
  note: 'Two previously untried reader questions from distinct development conversations; category-5 score is a weak phrase check. No holdout conversation rendered.' }
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 })
console.log(JSON.stringify({ selectedIds: manifest.selectedIds, readerInputSha256: manifest.readerInputSha256,
  labelsSeparate: true, holdoutRendered: false }))
