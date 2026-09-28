#!/usr/bin/env node
// Produce complete-history review packets outside the repository; never certify semantics.
import fs from 'node:fs'
import path from 'node:path'
import { digest, prepareConversation } from './lib/locomo.mjs'
import { AUDIT_PROTOCOL, referenceCount } from './lib/count-label-audit.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const input = option('--input'), out = option('--out'), ids = option('--ids')?.split(',').map(id => id.trim())
if (!input || !out || !ids?.length || ids.some(id => !/^conv-\d+:\d+$/u.test(id)) || new Set(ids).size !== ids.length || fs.existsSync(out))
  throw new Error('Need pinned corpus, comma-separated unique IDs and new output directory')
const corpusBytes = fs.readFileSync(input)
const datasetSha256 = '79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4'
if (digest(corpusBytes) !== datasetSha256) throw new Error('Pinned corpus drift')
const development = new Set(JSON.parse(fs.readFileSync(new URL('../eval/locomo/development-v1.json', import.meta.url))).development)
const corpus = JSON.parse(corpusBytes), selected = []
for (const id of ids) {
  const [sampleId, rawIndex] = id.split(':')
  if (!development.has(sampleId)) throw new Error('Sealed history refused: ' + id)
  const item = corpus.find(row => row.sample_id === sampleId), index = Number(rawIndex)
  if (!item?.qa[index]) throw new Error('Unknown question: ' + id)
  const count = referenceCount(item.qa[index].answer)
  if (!Number.isInteger(count)) throw new Error('Reference is not a simple count: ' + id)
  selected.push({ id, item, index, count })
}
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
for (const { id, item, index, count } of selected) {
  const prepared = prepareConversation(item), folder = path.resolve(out, id.replace(':', '-'))
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 })
  const sessions = []
  for (const doc of prepared.documents) {
    fs.writeFileSync(path.join(folder, doc.path), doc.markdown, { mode: 0o600 })
    const sourceKey = doc.path.slice(0, -3)
    sessions.push({ path: doc.path, sha256: digest(doc.markdown), turnIds: item.conversation[sourceKey].map(turn => turn.dia_id) })
  }
  const question = item.qa[index]
  const manifest = { protocol: AUDIT_PROTOCOL, caseId: id, datasetSha256, query: question.question,
    upstreamAnswer: question.answer, referenceCount: count, annotatedTurnIds: question.evidence,
    sessions, instructions: 'Review every session before marking valid. Group repeated mentions of one event. Record possible counterexamples. A partial review can disprove an undercount but cannot certify validity.' }
  const manifestBytes = JSON.stringify(manifest, null, 2) + '\n'
  fs.writeFileSync(path.join(folder, 'manifest.json'), manifestBytes, { mode: 0o600 })
  const template = { protocol: AUDIT_PROTOCOL, caseId: id, manifestSha256: digest(manifestBytes), status: 'provisional',
    reviewedSessions: [], events: [], rationale: 'Review all sessions and record distinct events before changing status.' }
  fs.writeFileSync(path.join(folder, 'review-template.json'), JSON.stringify(template, null, 2) + '\n', { mode: 0o600 })
  console.log(JSON.stringify({ id, sessions: sessions.length, turns: sessions.reduce((sum, row) => sum + row.turnIds.length, 0),
    referenceCount: count, manifestSha256: digest(manifestBytes) }))
}
