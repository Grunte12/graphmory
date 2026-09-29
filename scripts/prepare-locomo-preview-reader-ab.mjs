#!/usr/bin/env node
// Freeze a stratified, counterbalanced development reader diagnostic before generation.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { digest, prepareConversation } from './lib/locomo.mjs'
const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const input = option('--input'), out = option('--out')
if (!input || !out || fs.existsSync(out)) throw new Error('Usage: --input <pinned dataset> --out <new directory>')
const bytes = fs.readFileSync(input)
const expected = '79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4'
if (digest(bytes) !== expected) throw new Error('Dataset mismatch')
const split = JSON.parse(fs.readFileSync(path.join(root, 'eval/locomo/development-v1.json')))
const dev = new Set(split.development)
const seed = 'graphmory-locomo-preview-reader-ab-v1-2026-09-28'
// Already attempted reader questions; preview-only diagnostics do not make these independent.
const excluded = new Set(['conv-43:21', 'conv-50:140', 'conv-42:11', 'conv-50:196'])
const available = JSON.parse(bytes).filter(item => dev.has(item.sample_id)).flatMap(item => {
  const prepared = prepareConversation(item)
  return prepared.questions.map((question, index) => ({ item, prepared, question, index }))
})
const selected = [], used = new Set()
for (const category of [1, 2, 3, 4, 5]) {
  const candidates = available.filter(row => row.question.category === category && !excluded.has(row.question.id)
    && (category === 5 || (!row.question.unresolved.length && row.question.evidence.length)))
    .sort((a, b) => digest(seed + a.question.id).localeCompare(digest(seed + b.question.id)))
  const choice = candidates.find(row => !used.has(row.item.sample_id))
  if (!choice) throw new Error(`No distinct eligible development conversation for category ${category}`)
  selected.push(choice); used.add(choice.item.sample_id)
}
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const cases = [], labels = []
for (const row of selected) {
  const vault = path.join(out, 'vaults', row.item.sample_id)
  fs.mkdirSync(vault, { recursive: true })
  const sources = {}
  for (const doc of row.prepared.documents) {
    fs.writeFileSync(path.join(vault, doc.path), doc.markdown, { mode: 0o600 })
    sources[doc.path] = digest(doc.markdown)
  }
  cases.push({ id: row.question.id, question: row.question.query, vault, sources })
  labels.push({ id: row.question.id, category: row.question.category,
    // Upstream category 5 omits answer; the pinned scorer ignores it and uses a phrase check.
    answer: row.item.qa[row.index].answer ?? '', goldPaths: row.question.evidence,
    goldTurnIds: row.item.qa[row.index].evidence })
}
const payload = JSON.stringify(cases, null, 2) + '\n', gold = JSON.stringify(labels, null, 2) + '\n'
fs.writeFileSync(path.join(out, 'reader-input.json'), payload, { mode: 0o600 })
fs.writeFileSync(path.join(out, 'labels.json'), gold, { mode: 0o600 })
const sourceFiles = ['scripts/prepare-locomo-preview-reader-ab.mjs', 'scripts/run-curator-paging-pilot.py',
  'scripts/lib/locomo.mjs', 'scripts/brain-sync.mjs', 'src/decision-recall.mjs', 'src/retrieval.mjs', 'src/memory-recall.mjs']
const manifest = { protocol: 'locomo-preview-reader-development-ab-v1', datasetSha256: expected, selectionSeed: seed,
  selectedIds: cases.map(row => row.id), categories: labels.map(row => row.category),
  executionOrder: cases.flatMap((row, index) => (index % 2 ? ['coverage', 'current'] : ['current', 'coverage'])
    .map(arm => ({ id: row.id, caseIndex: index, arm }))),
  configuration: { mode: 'auto', curator: 'gpt-5.6-luna', lead: 'gpt-5.6-sol', reasoning: 'low', maxRounds: 10,
    maxInputBytes: 300000, structuredCitations: true, persistentCurator: false, compactFollowup: false },
  readerInputSha256: digest(payload), labelsSha256: digest(gold),
  sourceHashes: Object.fromEntries(sourceFiles.map(file => [file, digest(fs.readFileSync(path.join(root, file)))])),
  holdoutNotRendered: split.holdoutNotEvaluated,
  analysis: { officialScorer: 'locomo-pinned-function-bodies-raw-qa-v1',
    operationalFailures: 'Keep all ten planned attempts; failed/no-answer trials score zero for all-attempt aggregate and report failure separately',
    supportRubric: 'For each answer: all requested reference facts covered, no unsupported claim, correct speaker/scope/time/negation, traceable delivered sources; abstain when evidence missing. Independent blinded adjudication required before primary acceptance.',
    efficiency: 'Curator plus Lead time and native usage; observed cache separated; no causal efficiency claim from five nonreplicated pairs',
    promotion: 'Not sufficient for promotion; preserve paired regressions and freeze final protocol before opening holdout' },
  limitations: ['Five exposed development questions; one per category and distinct conversation, no powered inference',
    'Same host but cache cannot be reset; order alternates, remains imperfect with odd pair count',
    'Category 4 may require general knowledge beyond retrieved history; preserve mismatch rather than exclude after seeing outcomes',
    'Category 5 official phrase score is not semantic abstention correctness'] }
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 })
console.log(JSON.stringify({ ids: manifest.selectedIds, categories: manifest.categories, plannedTrials: 10, holdoutRendered: false }))
