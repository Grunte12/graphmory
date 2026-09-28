#!/usr/bin/env node
// Freeze two source-checked development cases before any model generation.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { digest, prepareConversation } from './lib/locomo.mjs'
import { DEFAULT_RUNTIME_CONFIG } from '../src/runtime-config.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const input = option('--input'), out = option('--out')
if (!input || !out || fs.existsSync(out)) throw new Error('Need pinned input and new output directory')
const root = fileURLToPath(new URL('../', import.meta.url))
const bytes = fs.readFileSync(input)
const datasetSha256 = '79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4'
if (digest(bytes) !== datasetSha256) throw new Error('Pinned corpus drift')
const selectedIds = ['conv-42:49', 'conv-50:47']
const development = new Set(JSON.parse(fs.readFileSync(path.join(root, 'eval/locomo/development-v1.json'))).development)
const eligibility = JSON.parse(fs.readFileSync(path.join(root, 'eval/reader-pilot/prefetch-eligibility-results-2026-09-28.json')))
const corpus = JSON.parse(bytes), cases = []
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const config = JSON.stringify(DEFAULT_RUNTIME_CONFIG, null, 2) + '\n'
fs.writeFileSync(path.join(out, 'runtime-config.json'), config, { mode: 0o600 })
for (const [caseIndex, id] of selectedIds.entries()) {
  const [conversation, rawIndex] = id.split(':')
  if (!development.has(conversation)) throw new Error('Holdout conversation refused')
  const eligible = eligibility.rows.find(row => row.id === id)
  if (!eligible || eligible.prefetchStatus !== 'ready' || eligible.category !== 1 || eligible.goldPaths !== 2 || eligible.goldPathsPrefetched !== 2 || eligible.unresolvedGoldTurns)
    throw new Error('Frozen eligibility mismatch: ' + id)
  const item = corpus.find(row => row.sample_id === conversation)
  const prepared = prepareConversation(item), qa = item.qa[Number(rawIndex)], question = prepared.questions[Number(rawIndex)]
  const folder = path.resolve(out, String(caseIndex)), vault = path.join(folder, 'vault')
  fs.mkdirSync(vault, { recursive: true, mode: 0o700 })
  const sources = {}
  for (const doc of prepared.documents) {
    fs.writeFileSync(path.join(vault, doc.path), doc.markdown, { mode: 0o600 })
    sources[doc.path] = digest(doc.markdown)
  }
  const reader = JSON.stringify([{ id, question: question.query, vault, sources }], null, 2) + '\n'
  const labels = JSON.stringify([{ id, answer: qa.answer, category: qa.category,
    goldPaths: question.evidence, goldTurnIds: qa.evidence }], null, 2) + '\n'
  fs.writeFileSync(path.join(folder, 'reader-input.json'), reader, { mode: 0o600 })
  fs.writeFileSync(path.join(folder, 'labels.json'), labels, { mode: 0o600 })
  cases.push({ id, caseIndex, readerSha256: digest(reader), labelsSha256: digest(labels),
    noteCount: prepared.documents.length, originalHashes: sources })
}
const sourceFiles = ['scripts/prepare-prefetch-compact-live-ab.mjs', 'scripts/run-prefetch-compact-live-ab.py',
  'scripts/run-curator-paging-pilot.py', 'scripts/brain-sync.mjs', 'scripts/lib/locomo.mjs',
  'src/decision-recall.mjs', 'src/memory-recall.mjs', 'src/retrieval.mjs', 'src/source-read.mjs', 'src/runtime-config.mjs']
const manifest = { protocol: 'prefetch-compact-live-development-ab-v1', frozenBeforeGeneration: true,
  baselineCommit: '297d7e5', datasetSha256, selectedIds, cases,
  executionOrder: [
    { caseIndex: 0, id: selectedIds[0], arm: 'full' }, { caseIndex: 0, id: selectedIds[0], arm: 'compact' },
    { caseIndex: 1, id: selectedIds[1], arm: 'compact' }, { caseIndex: 1, id: selectedIds[1], arm: 'full' },
  ], plannedTrials: 4, configSha256: digest(config),
  configuration: { curator: 'gpt-5.6-luna', lead: 'gpt-5.6-sol', reasoning: 'low', mode: 'auto',
    maxRounds: 10, maxInputBytes: 300000, structuredCitations: true, persistentCurator: false },
  sourceHashes: Object.fromEntries(sourceFiles.map(file => [file, digest(fs.readFileSync(path.join(root, file)))])),
  scorerSourceSha256: '8e3be5d57ff2ff9ec5cd05939592f468c5f3f1fd95d13e431932bdf6bf0fd6fd',
  metrics: ['all-attempt completion', 'supported-complete source review', 'official raw QA F1',
    'exact source/citation paths', 'gross/cached input and output tokens', 'whole workflow seconds', 'CLI bytes'],
  decision: 'A source-checked, exposed two-case paired diagnostic only; no default promotion, noninferiority or cost claim from single runs',
  failurePolicy: 'No substitution or automatic retry; preserve failed slots and remaining unattempted slots',
  holdoutNotRendered: ['conv-41', 'conv-44', 'conv-49'] }
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 })
console.log(JSON.stringify({ selectedIds, plannedTrials: 4, manifestSha256: digest(fs.readFileSync(path.join(out, 'manifest.json'))) }))
