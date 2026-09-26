#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { hash, prepareCase, selectCases, validateCase, benchmarkDate } from './lib/longmemeval.mjs'
import { loadVaultDocuments, fuseRankedLanes } from '../src/memory-recall.mjs'
import { governedRank } from '../src/retrieval.mjs'
import { recallVaultAdaptive } from '../src/adaptive-recall.mjs'
const args = process.argv.slice(2)
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const input = option('--input'), out = option('--out'), revision = option('--revision')
if (!input || !out || !revision || !/^[a-f0-9]{40}$/u.test(revision)) throw new Error('Usage: --input <full-history JSON> --out <report.json> --revision <dataset commit SHA> [--per-category 2]')
if (/oracle/iu.test(path.basename(input))) throw new Error('Oracle data is not a realistic retrieval test')
const root = fileURLToPath(new URL('../', import.meta.url))
const implementationHashes = Object.fromEntries(['scripts/eval-longmemeval.mjs', 'scripts/lib/longmemeval.mjs',
  'src/retrieval.mjs', 'src/memory-recall.mjs', 'src/adaptive-recall.mjs', 'src/graph-navigation.mjs', 'src/brain-sync.mjs']
  .map(file => [file, hash(fs.readFileSync(path.join(root, file)))]))
const bytes = fs.readFileSync(input)
const items = JSON.parse(bytes)
const strictTime = args.includes("--strict-time")
const quarantined = [], eligible = []
for (const item of items) {
  try { validateCase(item, {strictTime}); eligible.push(item) }
  catch (error) { quarantined.push({id: item.question_id, reason: error.message}) }
}
const split = option('--split', 'all')
if (!['all','dev','acceptance'].includes(split)) throw new Error('Invalid split')
const pilot = JSON.parse(fs.readFileSync(path.join(root, 'eval/longmemeval/pilot.json'), 'utf8'))
const knownFamilies = new Set(pilot.selectedIds.map(id=>id.replace(/_abs$/u,'')))
const familySplit = id => {
  const family=id.replace(/_abs$/u,'')
  return knownFamilies.has(family) || parseInt(hash('graphmory-split-v2:'+family).slice(0,8),16)%2===0 ? 'dev' : 'acceptance'
}
const idsManifest = option('--ids-manifest') ? JSON.parse(fs.readFileSync(option('--ids-manifest'),'utf8')) : null
if (idsManifest && idsManifest.sourceSha256 !== hash(bytes)) throw new Error('Manifest dataset hash mismatch')
const selected = idsManifest ? idsManifest.selectedIds.map(id=> { const item=eligible.find(x=>x.question_id===id); if(!item) throw new Error('Missing selected ID'); return item }) : selectCases(eligible.filter(item=>split==='all'||familySplit(item.question_id)===split), Number(option('--per-category', '2')))
const methods = option('--arms', 'baseline,graph').split(',')
if (!methods.length || new Set(methods).size!==methods.length || methods.some(m=>!['baseline','graph','bm25','multigranularity'].includes(m))) throw new Error('Invalid arms')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-lme-'))
const runs = []
try {
  for (const [index, item] of selected.entries()) {
    const prepared = prepareCase(item)
    const vault = path.join(temp, String(index))
    for (const doc of prepared.documents) {
      const file = path.join(vault, doc.path)
      fs.mkdirSync(path.dirname(file), {recursive: true})
      fs.writeFileSync(file, doc.markdown)
    }
    const labels = prepared.labels
    // Date is available to both arms, but no answer, source IDs or category are passed.
    const query = args.includes('--question-only') ? prepared.query.text : `${prepared.query.text}\nAs of: ${prepared.query.date}`
    const arms = [...methods.slice(index % methods.length), ...methods.slice(0,index % methods.length)]
    for (const arm of arms) {
      const start = performance.now()
      let ranked, rounds = 0
      if (arm !== 'graph') {
        const documents = loadVaultDocuments(vault)
        const lanes = arm==='bm25' ? ['bm25'] : arm==='multigranularity' ? ['bm25','bm25f-focused-sections','bm25-sections'] : ['bm25','bm25f-focused-sections']
        ranked = fuseRankedLanes(lanes.map(method => ({method,
          results: governedRank(documents, query, method).results.slice(0, 12)}))).slice(0, 12).map(doc => doc.id)
      } else {
        const result = await recallVaultAdaptive(vault, query, {graphPolicy:'auto'})
        ranked = result.candidatePool
        rounds = result.rounds
      }
      const answerable = !labels.abstention
      const hits = k => labels.evidence.filter(group => group.some(p => ranked.slice(0,k).includes(p))).length
      runs.push({id: labels.id, category: labels.category, arm, sessions: prepared.documents.length, duplicateSessionIds: labels.duplicateSessionIds, rounds,
        evidenceCount: answerable ? labels.evidence.length : null,
        recallAt3: answerable ? hits(3)/labels.evidence.length : null,
        recallAt12: answerable ? hits(12)/labels.evidence.length : null,
        completeAt3: answerable ? hits(3) === labels.evidence.length : null,
        completeAt12: answerable ? hits(12) === labels.evidence.length : null,
        candidates: ranked.length, elapsedMs: performance.now()-start,
        selectedSessionPaths: ranked})
    }
    fs.rmSync(vault, {recursive:true, force:true})
  }
  const summary = {}
  for (const arm of methods) {
    const subset = runs.filter(r=>r.arm===arm), positive=subset.filter(r=>r.recallAt3!==null)
    const average = key => positive.length ? positive.reduce((s,r)=>s+Number(r[key]),0)/positive.length : null
    summary[arm] = {cases:subset.length,answerable:positive.length,recallAt3:average('recallAt3'),recallAt12:average('recallAt12'),
      completeAt3:average('completeAt3'),completeAt12:average('completeAt12'),
      abstentionCases:subset.length-positive.length,abstentionWithCandidates:subset.filter(r=>r.recallAt3===null&&r.candidates>0).length,
      graphActivated:subset.filter(r=>r.rounds>0).length}
  }
  const categories = {}
  for (const category of new Set(runs.map(r=>r.category))) {
    categories[category] = {}
    for (const arm of methods) {
      const cases = runs.filter(r=>r.category===category && r.arm===arm)
      categories[category][arm] = {cases:cases.length,completeAt3:cases.filter(r=>r.completeAt3===true).length,
        completeAt12:cases.filter(r=>r.completeAt12===true).length}
    }
  }
  const report={queryFormat:args.includes('--question-only')?'question-only':'question-plus-date',split,methods,implementationHashes,categories,suite:'longmemeval-session-retrieval-pilot',dataset:'xiaowu0162/longmemeval-cleaned',revision,
    sourceSha256:hash(bytes),temporalPolicy:strictTime?'exclude-cases-with-future-sessions':'preserve-upstream-history',
    futureSessionCases:items.filter(item=>item.haystack_dates.some(date=>benchmarkDate(date)>benchmarkDate(item.question_date))).map(item=>item.question_id),inputCases:items.length,validatedCases:eligible.length,quarantined,selectionSeed:'graphmory-lme-pilot-v1',selectedIds:selected.map(i=>i.question_id),
    adaptation:'Verbatim sessions rendered to Markdown; original timestamps; no summaries or generated links. Session-level retrieval only, not official answer accuracy.',
    limitations:['Full input labels remain in evaluator process only; not a security sandbox for future live agents.',
      'Public questions may overlap model training; this deterministic pilot has no model calls.',
      'Abstention candidates are diagnostic, not false-answer rate. Single-pass timings are not a latency benchmark.'],summary,runs}
  fs.writeFileSync(out, JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({inputCases:items.length,validatedCases:eligible.length,quarantinedCount:quarantined.length,summary},null,2))
} finally { fs.rmSync(temp,{recursive:true,force:true}) }
