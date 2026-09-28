#!/usr/bin/env node
// Freeze three previously exposed development histories, keeping gold separate.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { digest, prepareConversation } from './lib/locomo.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const input = option('--input'), out = option('--out')
if (!input || !out || fs.existsSync(out)) throw new Error('Need pinned input and new directory')
const root = fileURLToPath(new URL('../', import.meta.url))
const bytes = fs.readFileSync(input)
const sourceSha256 = '79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4'
if (digest(bytes) !== sourceSha256) throw new Error('Pinned corpus drift')
const development = new Set(JSON.parse(fs.readFileSync(path.join(root, 'eval/locomo/development-v1.json'))).development)
const eligibility = JSON.parse(fs.readFileSync(path.join(root, 'eval/reader-pilot/prefetch-eligibility-results-2026-09-28.json')))
const selectedIds = ['conv-26:40', 'conv-47:8', 'conv-50:18']
const cases = [], labelHashes = []
const corpus = JSON.parse(bytes)
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
for (const [caseIndex, id] of selectedIds.entries()) {
  const [conversation, rawIndex] = id.split(':')
  if (!development.has(conversation)) throw new Error('Holdout selection refused')
  const eligibilityRow = eligibility.rows.find(row => row.id === id)
  if (!eligibilityRow || eligibilityRow.prefetchStatus !== 'ready' || eligibilityRow.category !== 1 || eligibilityRow.goldPaths !== 2 || eligibilityRow.goldPathsPrefetched !== 2 || eligibilityRow.unresolvedGoldTurns) throw new Error('Eligibility/selection mismatch')
  const item = corpus.find(row => row.sample_id === conversation)
  const prepared = prepareConversation(item), question = prepared.questions[Number(rawIndex)]
  const vault = path.resolve(out, String(caseIndex), 'vault')
  fs.mkdirSync(vault, { recursive: true })
  const sources = {}
  for (const document of prepared.documents) {
    fs.writeFileSync(path.join(vault, document.path), document.markdown, { mode: 0o600 })
    sources[document.path] = digest(document.markdown)
  }
  const reader = JSON.stringify([{ id, question: question.query, vault, sources }], null, 2) + '\n'
  const labels = JSON.stringify([{ id, answer: item.qa[Number(rawIndex)].answer, category: question.category,
    goldPaths: question.evidence, goldTurnIds: item.qa[Number(rawIndex)].evidence }], null, 2) + '\n'
  const folder = path.join(out, String(caseIndex))
  fs.writeFileSync(path.join(folder, 'reader-input.json'), reader, { mode: 0o600 })
  fs.writeFileSync(path.join(folder, 'labels.json'), labels, { mode: 0o600 })
  cases.push({ id, caseIndex, readerSha256: digest(reader), labelsSha256: digest(labels), originalHashes: sources, noteCount: prepared.documents.length })
  labelHashes.push(digest(labels))
}
const sourceFiles = ['scripts/prepare-prefetch-three-arm.mjs', 'scripts/run-prefetch-three-arm.py',
  'scripts/summarize-prefetch-three-arm.py', 'scripts/prepare-basic-memory-live-index.py',
  'scripts/run-curator-paging-pilot.py', 'scripts/brain-sync.mjs', 'src/decision-recall.mjs',
  'src/memory-recall.mjs', 'src/retrieval.mjs', 'src/source-read.mjs', 'scripts/lib/locomo.mjs']
const order = [
  ['basic', 'graph', 'prefetch'],
  ['prefetch', 'basic', 'graph'],
  ['graph', 'prefetch', 'basic'],
]
const manifest = {
  protocol: 'prefetch-three-arm-development-v1', frozenBeforeGeneration: true,
  datasetSha256: sourceSha256, baselineCommit: '779e907',
  selection: 'First two-gold category-1 prefetch-ready questions in distinct conv-26, conv-47 and conv-50 development histories; IDs fixed before generation. Previously exposed source families, never independent holdout.',
  selectedIds, cases, plannedTrials: 9,
  executionOrder: order.flatMap((tools, caseIndex) => tools.map(tool => ({ caseIndex, id: selectedIds[caseIndex], tool }))),
  configuration: { curator: 'gpt-5.6-luna', lead: 'gpt-5.6-sol', reasoning: 'low',
    mode: 'auto', maxRounds: 10, maxInputBytes: 300000, structuredCitations: true,
    persistentCurator: false, compactFollowup: false },
  nativeBasicMemory: '0.23.2 hybrid, local BGE-small index, same original Markdown corpus, index built once per case before generation',
  sourceHashes: Object.fromEntries(sourceFiles.map(name => [name, digest(fs.readFileSync(path.join(root, name)))])),
  metrics: ['all-attempt completion and failures', 'pinned raw QA F1', 'gold original reads',
    'answer and citation support author audit', 'whole-workflow seconds', 'native CLI/host bytes',
    'gross/cached/noncached input and output tokens', 'index time reported separately'],
  failurePolicy: 'No substitute or retry. Failed index blocks the three arms for its case, with other cases continuing. Host usage limit stops further unattempted slots.',
  decision: 'No production promotion from three exposed single-run cases. Compare per-case support/efficiency and identify regressions; require independent blind support review, repeated variance and sealed holdout for a superiority claim.',
  limitations: ['Three previously exposed development source families, not independent holdout',
    'One generation per arm, cache/order effects uncontrolled', 'Native search payloads and normalization differ',
    'Author source review does not satisfy independent support gate', 'Subscription billing and p95 latency unavailable'],
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 })
console.log(JSON.stringify({ selectedIds, plannedTrials: 9, labelsSeparate: true, holdoutRendered: false }))
