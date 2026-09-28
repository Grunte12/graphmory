#!/usr/bin/env node
// Reuse exposed development histories; never render sealed conversations.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { digest, prepareConversation } from './lib/locomo.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const input = option('--input'), out = option('--out')
if (!input || !out || fs.existsSync(out)) throw new Error('Need pinned input and new output directory')
const root = fileURLToPath(new URL('../', import.meta.url))
const bytes = fs.readFileSync(input)
const datasetSha256 = '79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4'
if (digest(bytes) !== datasetSha256) throw new Error('Dataset drift')
const ids = ['conv-42:62', 'conv-50:14', 'conv-43:185']
const development = new Set(JSON.parse(fs.readFileSync(path.join(root, 'eval/locomo/development-v1.json'))).development)
const items = JSON.parse(bytes)
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const cases = [], labels = [], originals = {}
for (const id of ids) {
  const [conversation, index] = id.split(':')
  if (!development.has(conversation)) throw new Error('Holdout access refused')
  const item = items.find(row => row.sample_id === conversation)
  const prepared = prepareConversation(item), question = prepared.questions[Number(index)]
  const vault = path.resolve(out, 'vaults', conversation)
  fs.mkdirSync(vault, { recursive: true })
  const sources = {}
  for (const doc of prepared.documents) {
    fs.writeFileSync(path.join(vault, doc.path), doc.markdown, { mode: 0o600 })
    sources[doc.path] = digest(doc.markdown)
  }
  originals[id] = sources
  cases.push({ id, question: question.query, vault, sources })
  labels.push({ id, category: question.category, answer: item.qa[Number(index)].answer,
    goldPaths: question.evidence, goldTurnIds: item.qa[Number(index)].evidence })
}
const payload = JSON.stringify(cases, null, 2) + '\n', gold = JSON.stringify(labels, null, 2) + '\n'
fs.writeFileSync(path.join(out, 'reader-input.json'), payload, { mode: 0o600 })
fs.writeFileSync(path.join(out, 'labels.json'), gold, { mode: 0o600 })
const sourceFiles = ['scripts/prepare-evidence-state-ab.mjs', 'scripts/run-evidence-state-ab.py',
  'scripts/run-curator-paging-pilot.py', 'scripts/curator_evidence_state.py', 'scripts/lib/locomo.mjs',
  'scripts/brain-sync.mjs', 'src/retrieval.mjs', 'src/memory-recall.mjs', 'src/decision-recall.mjs', 'src/source-read.mjs']
const manifest = {
  protocol: 'curator-mechanical-evidence-state-development-ab-v1', frozenBeforeGeneration: true,
  datasetSha256, selectedIds: ids, readerInputSha256: digest(payload), labelsSha256: digest(gold), originals,
  sourceHashes: Object.fromEntries(sourceFiles.map(name => [name, digest(fs.readFileSync(path.join(root, name)))])),
  configuration: { curator: 'gpt-5.6-luna', lead: 'gpt-5.6-sol', reasoning: 'low', mode: 'auto',
    maxRounds: 10, maxInputBytes: 300000, structuredCitations: true, persistentCurator: false, compactFollowup: false },
  executionOrder: ids.flatMap((id, caseIndex) => (caseIndex % 2 ? [true, false] : [false, true]).map(evidenceState => ({ id, caseIndex, evidenceState }))),
  primaryDiagnostic: 'Complete source-supported enumeration with no factual or abstention regression; author review is not independent acceptance',
  promotion: 'No production promotion from three exposed single-generation pairs; reject evidence-state as demonstrated improvement if count remains incomplete or either control regresses',
  metrics: ['raw pinned QA F1', 'completion including failures', 'gold originals read', 'answer/brief/citation audit', 'coverage snapshots', 'gross/cached/noncached tokens', 'whole workflow wall time', 'model calls', 'source tool bytes'],
  failures: 'No replacement, preserve failed calls and remaining unattempted slots on host limit',
  limitations: ['Exposed development histories, not holdout', 'One generation per arm; cache states uncontrolled',
    'Native Graphmory only in this intervention; no competitor superiority', 'Added counters plus explanation tested together, not causal isolation', 'No calibrated independent semantic support judgment'],
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ ids, labelsSeparate: true, holdoutRendered: false }))
