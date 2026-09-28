#!/usr/bin/env node
// Preserve original corpus IDs and actual managed lexical first-page ordering.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { loadVaultDocuments, recallVaultLoop } from '../src/memory-recall.mjs'
import { governedRank } from '../src/retrieval.mjs'

const args = process.argv.slice(2)
const option = name => args[args.indexOf(name) + 1]
if (!args.includes('--prepared') || !args.includes('--out')) throw new Error('Require --prepared and --out')
const prepared = path.resolve(option('--prepared'))
const out = path.resolve(option('--out'))
if (fs.existsSync(out)) throw new Error('Preserve prior run output; choose a new directory')
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const manifestBytes = fs.readFileSync(path.join(prepared, 'manifest.json'))
const manifest = JSON.parse(manifestBytes)
const queryBytes = fs.readFileSync(path.join(prepared, 'queries.json'))
if (digest(queryBytes) !== manifest.querySetSha256) throw new Error('Query input drift')
const mapping = JSON.parse(fs.readFileSync(path.join(prepared, 'mapping.json')))
const originalId = new Map(Object.entries(mapping).map(([id, note]) => [note, id]))
const vault = path.join(prepared, 'vault')
const documents = loadVaultDocuments(vault, { maxFiles: manifest.corpusCount + 1 })
if (documents.length !== manifest.corpusCount || originalId.size !== documents.length) throw new Error('Incomplete corpus')
for (const document of documents) {
  if (digest(fs.readFileSync(path.join(vault, document.id))) !== manifest.vaultSourceHashes[document.id]) throw new Error('Source drift')
}
// Gold labels deliberately do not enter the retrieval work list.
const queries = JSON.parse(queryBytes).map(({ id, query }) => ({ id, query }))
if (queries.length !== manifest.evaluatedQueries) throw new Error('Incomplete query book')
const arms = { bm25: {}, managedLexical: {} }
const timing = { bm25: [], managedLexical: [] }
const attempted = []
for (const query of queries) {
  let start = performance.now()
  const bm25 = governedRank(documents, query.query, 'bm25', { answerCandidatesOnly: true }).results
  timing.bm25.push(performance.now() - start)
  start = performance.now()
  const managed = recallVaultLoop(vault, query.query, {
    k: documents.length, allowLargePage: true, maxFiles: documents.length + 1,
    perMethodLimit: documents.length, shortlistLimit: 8, documents,
  }).results.map(item => ({ id: item.path }))
  timing.managedLexical.push(performance.now() - start)
  for (const [arm, ranking] of [['bm25', bm25], ['managedLexical', managed]]) {
    // Strict monotone scores encode the emitted order, avoiding evaluator tie changes.
    arms[arm][query.id] = Object.fromEntries(ranking.map((item, index) => [originalId.get(item.id), ranking.length - index]))
    if (Object.keys(arms[arm][query.id]).some(id => id === 'undefined')) throw new Error('Unmapped result ID')
  }
  attempted.push(query.id)
}
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
for (const [arm, run] of Object.entries(arms)) fs.writeFileSync(path.join(out, arm + '.json'), JSON.stringify(run) + '\n')
const summary = { corpusCount: documents.length, queries: queries.length, attempted,
  codeHashes: Object.fromEntries(['scripts/export-beir-lexical-runs.mjs', 'src/memory-recall.mjs', 'src/retrieval.mjs']
    .map(name => [name, digest(fs.readFileSync(new URL('../' + name, import.meta.url)))])),
  preparedManifestSha256: digest(manifestBytes), archiveSha256: manifest.archiveSha256,
  ranking: 'complete positive lexical rankings; monotone order scores; managed shortlist=8',
  timing: 'in-process warm sequential query ranking only; bm25 always first; excludes IO/model/original reads',
  rankingMilliseconds: timing }
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify({ queries: queries.length, corpus: documents.length, output: out }))
