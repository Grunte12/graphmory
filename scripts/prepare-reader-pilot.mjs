#!/usr/bin/env node
// Development-only: labels stay outside the reader workspace.
import fs from 'node:fs'
import path from 'node:path'
import { prepareConversation, digest } from './lib/locomo.mjs'
import { parseMarkdown, governedRank } from '../src/retrieval.mjs'
import { fuseRankedLanes } from '../src/memory-recall.mjs'

const args = process.argv.slice(2)
const option = (flag) => args[args.indexOf(flag) + 1]
for (const flag of ['--input', '--out']) if (!args.includes(flag)) throw new Error(`Missing ${flag}`)
const out = path.resolve(option('--out'))
if (fs.existsSync(out)) throw new Error('Preserve existing experiments; select a new output directory')
const bytes = fs.readFileSync(option('--input'))
if (digest(bytes) !== '79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4') throw new Error('Pinned dataset hash mismatch')
const baseline = JSON.parse(fs.readFileSync(new URL('../eval/locomo/development-v1.json', import.meta.url)))
const items = JSON.parse(bytes)
// Purposeful known-failure sample, not random, representative, or fresh holdout.
const ids = ['conv-43:21', 'conv-50:140']
const cases = [], labels = [], paging = []
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
for (const id of ids) {
  const separator = id.lastIndexOf(':')
  const sample = id.slice(0, separator), index = Number(id.slice(separator + 1))
  if (!baseline.development.includes(sample)) throw new Error('Case must belong to exposed development split')
  const item = items.find((value) => value.sample_id === sample)
  if (!item) throw new Error('Missing conversation')
  const prepared = prepareConversation(item), q = prepared.questions[index]
  if (!q || q.unresolved.length || !q.evidence.length || q.category === 5) throw new Error('Not an eligible answerable pilot case')
  const docs = prepared.documents.map((doc) => parseMarkdown(doc.path, doc.markdown))
  const lanes = ['bm25', 'bm25f-focused-sections'].map((method) => ({ method, results: governedRank(docs, q.query, method).results }))
  const ranking = fuseRankedLanes(lanes).map((doc) => doc.id)
  const render = (paths) => paths.map((name) => {
    const doc = prepared.documents.find((value) => value.path === name)
    return { path: name, sha256: digest(doc.markdown), markdown: doc.markdown }
  })
  cases.push({ id, question: q.query, oracle: render(q.evidence), predicted: render(ranking.slice(0, 10)) })
  const vault = path.join(out, 'vaults', sample)
  fs.mkdirSync(vault, { recursive: true })
  for (const doc of prepared.documents) fs.writeFileSync(path.join(vault, doc.path), doc.markdown, { mode: 0o600 })
  paging.push({ id, question: q.query, vault, sources: Object.fromEntries(prepared.documents.map(doc => [doc.path, digest(doc.markdown)])) })
  labels.push({ id, category: q.category, answer: item.qa[index].answer, evidence: item.qa[index].evidence,
    goldPaths: q.evidence, goldRanks: q.evidence.map((name) => ranking.indexOf(name) + 1) })
}
const payload = JSON.stringify(cases, null, 2) + '\n'
fs.writeFileSync(path.join(out, 'reader-input.json'), payload, { mode: 0o600 })
fs.writeFileSync(path.join(out, 'labels.json'), JSON.stringify(labels, null, 2) + '\n', { mode: 0o600 })
fs.writeFileSync(path.join(out, 'paging-input.json'), JSON.stringify(paging, null, 2) + '\n', { mode: 0o600 })
const files = ['scripts/prepare-reader-pilot.mjs', 'scripts/run-reader-pilot.py', 'scripts/lib/locomo.mjs', 'src/retrieval.mjs', 'src/memory-recall.mjs']
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ protocol: 'reader-attribution-development-v1', datasetSha256: digest(bytes),
  readerInputSha256: digest(payload), ids, sampling: 'Two previously observed development retrieval failures; no holdout inspected',
  sourceHashes: Object.fromEntries(files.map((file) => [file, digest(fs.readFileSync(new URL('../' + file, import.meta.url)))])),
  limitations: ['Top-10 is a deliberately restricted diagnostic arm, not product retrieval policy', 'Oracle session selection uses gold evidence, but session prose contains no QA answers', 'No official answer score or calibrated semantic judge is produced by this builder'] }, null, 2) + '\n', { mode: 0o600 })
console.log(JSON.stringify({ output: out, cases: cases.length, labelsSeparated: true }))
