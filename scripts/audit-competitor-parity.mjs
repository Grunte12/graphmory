#!/usr/bin/env node
// Recompute exposed retrieval metrics and source parity; no new model/search run.
import fs from 'node:fs'
import { hash, prepareCase } from './lib/longmemeval.mjs'
const args = process.argv.slice(2), opt = key => args[args.indexOf(key) + 1]
if (!args.includes('--input') || !args.includes('--out')) throw new Error('Use --input <pinned dataset> --out <new report>')
const out = opt('--out'); if (fs.existsSync(out)) throw new Error('Preserve previous audits')
const names = ['question-only-results.json', 'hybrid-indexed-fourteen-2026-09-28.json', 'graphmory-question-only.json']
const reports = names.map(name => JSON.parse(fs.readFileSync(new URL('../eval/competitor-pilot/' + name, import.meta.url))))
const bytes = fs.readFileSync(opt('--input')), digest = hash(bytes)
if (reports.some(r => (r.datasetSha256 ?? r.sourceSha256) !== digest || r.queryFormat !== 'question-only')) throw new Error('Dataset/query mismatch')
const ids = reports[0].selectedIds
if (new Set(ids).size !== ids.length || reports.some(r => JSON.stringify(r.selectedIds) !== JSON.stringify(ids))) throw new Error('Case order/coverage mismatch')
const all = new Map(JSON.parse(bytes).map(row => [row.question_id, row])), rows = []
const histories = new Map(), gold = new Map()
for (const id of ids) {
  const item = all.get(id), p = prepareCase(item), validPaths = new Set(p.documents.map(d => d.path))
  histories.set(id, new Set(item.haystack_session_ids)); gold.set(id, new Set(item.answer_session_ids))
  const sourceHash = hash(Buffer.concat(p.documents.map(d => Buffer.from(d.markdown))))
  for (let i = 0; i < reports.length; i++) {
    const candidates = i === 2 ? reports[i].runs.filter(r => r.id === id) : reports[i].cases.filter(r => r.id === id)
    const expectedArms = i === 2 ? reports[i].methods : [null]
    if (candidates.length !== expectedArms.length || candidates.some(r => !expectedArms.includes(r.arm ?? null)) || new Set(candidates.map(r => r.arm ?? null)).size !== expectedArms.length) throw new Error('Missing/duplicate arm')
    for (const r of candidates) {
      if (r.failure || r.sessions !== p.documents.length || r.category !== p.labels.category) throw new Error('Failure/input category mismatch')
      const paths = r.selectedSessionPaths
      if (!Array.isArray(paths) || new Set(paths).size !== paths.length || paths.some(v => !validPaths.has(v))) throw new Error('Invalid ranked paths')
      for (const k of [3, 12]) {
        const hits = p.labels.evidence.filter(group => group.some(v => paths.slice(0, k).includes(v))).length
        const recall = p.labels.abstention ? null : hits / p.labels.evidence.length
        const complete = p.labels.abstention ? null : hits === p.labels.evidence.length
        if (r['recallAt' + k] !== recall || r['completeAt' + k] !== complete) throw new Error('Metric drift: ' + id)
      }
      if (i < 2 && sourceHash !== r.sourceBodyHash) throw new Error('Original source mismatch')
      if (i === 1 && (!(r.embeddedEntities > 0) || r.embeddingErrors !== 0)) throw new Error('Missing semantic index')
      rows.push({ id, report: names[i], arm: r.arm ?? (i === 0 ? 'text' : 'hybrid'), metricsRecomputed: true,
        originalBodyHashVerified: i < 2, postIngestChangedFiles: r.changedSourceFiles ?? null,
        graphmoryPerCaseBodyHashRecorded: i === 2 ? false : null })
    }
  }
}
function components(sets) {
  const unseen = new Set(ids), groups = []
  while (unseen.size) { const start = unseen.values().next().value, group = [start]; unseen.delete(start)
    for (const id of group) for (const other of [...unseen]) if ([...sets.get(id)].some(v => sets.get(other).has(v))) { group.push(other); unseen.delete(other) }
    groups.push(group)
  }
  return groups
}
const result = { protocol: 'exposed-competitor-source-metric-audit-v1', datasetSha256: digest,
  auditorSha256: hash(fs.readFileSync(new URL(import.meta.url))),
  helperSha256: hash(fs.readFileSync(new URL('./lib/longmemeval.mjs', import.meta.url))),
  historicalGraphmoryHelperSha256: reports[2].implementationHashes['scripts/lib/longmemeval.mjs'],
  reportHashes: Object.fromEntries(names.map((name, i) => [name, hash(fs.readFileSync(new URL('../eval/competitor-pilot/' + name, import.meta.url)))])),
  rows, historyOverlapComponents: components(histories), goldSourceOverlapComponents: components(gold),
  limitations: ['Recomputes historical selected retrieval runs, not new independent trials',
    'Basic Memory original-input hashes verified; Graphmory recorded dataset/helper metadata but no per-case body hashes',
    'Native Basic Memory ingestion changes Markdown; equal original inputs do not mean equal indexed representation',
    'Shared distractors alone do not prove outcome dependence; overlap components are diagnostics, not a calibrated clustering rule',
    'Question-ID families alone do not establish independent histories; no new confidence intervals or superiority claim',
    'Query format is declared but no per-call query hash is recorded in these historical reports',
    'Timing harnesses and response formats differ; no matched end-to-end latency/cost or answer-quality verdict'] }
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ verifiedRows: rows.length, historyComponents: result.historyOverlapComponents.length, goldComponents: result.goldSourceOverlapComponents.length }))
