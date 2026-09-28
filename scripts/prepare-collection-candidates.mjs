#!/usr/bin/env node
// Candidate audit packets only. This never qualifies labels or launches models.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { digest, prepareConversation } from './lib/locomo.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
const option = key => args.includes(key) ? args[args.indexOf(key) + 1] : undefined
const input = option('--input'), out = option('--out'), summary = option('--summary')
if (!input || !out || !summary || fs.existsSync(out) || fs.existsSync(summary)) throw new Error('Use --input --out <new private directory> --summary <new source-free JSON>')
const privateRoot = fs.realpathSync('/private/tmp')
const output = path.resolve(out)
if (!output.startsWith(privateRoot + path.sep)) throw new Error('Audit packets must stay in private temporary storage')
fs.mkdirSync(path.dirname(output), { recursive: true })
if (!fs.realpathSync(path.dirname(output)).startsWith(privateRoot + path.sep)
  && fs.realpathSync(path.dirname(output)) !== privateRoot) throw new Error('Unsafe packet parent')
const raw = fs.readFileSync(input), sourceSha256 = digest(raw)
if (sourceSha256 !== '79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4') throw new Error('Pinned corpus drift')
const split = JSON.parse(fs.readFileSync(path.join(root, 'eval/locomo/development-v1.json')))
const corpus = JSON.parse(raw), groups = { aggregation: [], specific: [], abstention: [] }
const quota = { aggregation: 4, specific: 2, abstention: 2 }
for (const id of split.development) {
  const item = corpus.find(row => row.sample_id === id)
  const prepared = prepareConversation(item)
  for (const q of prepared.questions) {
    const kind = q.category === 1 && /^how many\b/iu.test(q.query) && q.evidence.length >= 2 ? 'aggregation'
      : q.category === 4 && q.evidence.length === 1 ? 'specific' : q.category === 5 ? 'abstention' : null
    if (!kind || groups[kind].length >= quota[kind] || q.unresolved.length) continue
    groups[kind].push({ id: q.id, kind, item, prepared, question: q,
      reference: item.qa[Number(q.id.split(':')[1])] })
  }
}
for (const key of Object.keys(quota)) if (groups[key].length !== quota[key]) throw new Error('Candidate quota unavailable')
fs.mkdirSync(output, { mode: 0o700 })
const selected = Object.values(groups).flat(), entries = []
for (const [index, candidate] of selected.entries()) {
  const directory = path.join(output, String(index)), vault = path.join(directory, 'vault')
  fs.mkdirSync(vault, { recursive: true, mode: 0o700 })
  const sources = {}
  for (const document of candidate.prepared.documents) {
    fs.writeFileSync(path.join(vault, document.path), document.markdown, { mode: 0o600 })
    sources[document.path] = digest(document.markdown)
  }
  const reader = JSON.stringify([{ id: candidate.id, question: candidate.question.query, vault, sources }], null, 2) + '\n'
  const label = JSON.stringify({ id: candidate.id, status: 'unreviewed', upstreamReference: candidate.reference,
    requirement: 'Review the entire declared history before qualifying any count or absence label. Do not infer correctness from annotated turns.' }, null, 2) + '\n'
  fs.writeFileSync(path.join(directory, 'reader-input.json'), reader, { mode: 0o600 })
  fs.writeFileSync(path.join(directory, 'label-audit-input.json'), label, { mode: 0o600 })
  entries.push({ id: candidate.id, kind: candidate.kind, category: candidate.question.category,
    questionSha256: digest(candidate.question.query), readerSha256: digest(reader), labelPacketSha256: digest(label),
    originalHashes: sources, noteCount: Object.keys(sources).length,
    captionInAnnotatedSession: candidate.question.captionInGoldSession,
    requiresTextOnlySourceAudit: true, labelStatus: 'unreviewed' })
}
const manifest = { protocol: 'collection-candidate-audit-v1', sourceSha256,
  selection: 'Development split order, then original QA order. First four category-1 How many questions with >=2 annotated source notes; first two single-note category-4 facts; first two category-5 questions. Reject unresolved evidence. Caption presence is recorded, not equated with needing image evidence; qualification requires original verbal text support. No answer outcomes consulted.',
  quotas: quota, selectedIds: entries.map(row => row.id), entries,
  labelsQualified: false, generationAllowed: false, plannedAnswerWorkflows: 0,
  plannedConditionalWorkflows: 24, holdoutRendered: false,
  stopRule: 'No replacement after generation. This inventory is only an audit candidate book, not an accepted generation manifest.' }
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 })
fs.mkdirSync(path.dirname(path.resolve(summary)), { recursive: true })
fs.writeFileSync(summary, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ candidates: entries.length, selectedIds: manifest.selectedIds, generationAllowed: false, holdoutRendered: false }))
