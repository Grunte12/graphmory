#!/usr/bin/env node
// Exposed development questions only; actual CLI delivery, no reader/model calls.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { hash, prepareCase } from './lib/longmemeval.mjs'
import { DEFAULT_RUNTIME_CONFIG } from '../src/runtime-config.mjs'

const args = process.argv.slice(2)
const value = flag => args[args.indexOf(flag) + 1]
for (const flag of ['--input', '--out']) if (!args.includes(flag)) throw new Error(`Missing ${flag}`)
const out = path.resolve(value('--out'))
if (fs.existsSync(out)) throw new Error('Preserve previous report; choose a new output')
const reference = JSON.parse(fs.readFileSync(new URL('../eval/longmemeval/development-v2.json', import.meta.url)))
const bytes = fs.readFileSync(value('--input'))
if (hash(bytes) !== reference.sourceSha256) throw new Error('Pinned dataset bytes differ from development report')
const items = JSON.parse(bytes)
const byId = new Map(items.map(item => [item.question_id, item]))
if (byId.size !== items.length) throw new Error('Duplicate source IDs')
const selected = []
const groups = new Map()
for (const run of reference.runs) {
  if (run.arm !== 'bm25') continue
  const list = groups.get(run.category) ?? []
  if (list.length < 2) list.push(run.id)
  groups.set(run.category, list)
}
for (const [category, ids] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  if (ids.length !== 2) throw new Error(`Insufficient development cases: ${category}`)
  for (const id of ids) {
    if (!reference.selectedIds.includes(id) || !byId.has(id)) throw new Error('Case is outside frozen development selection')
    selected.push({ category, item: byId.get(id) })
  }
}
const cli = new URL('./brain-sync.mjs', import.meta.url).pathname
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-lme-cli-delivery-'))
const arms = [['mixed-notes', 'auto'], ['mixed-notes', 'bundle'], ['conversations', 'auto'], ['conversations', 'bundle']]
const report = { protocol: 'longmemeval-actual-cli-delivery-development-v1', sourceSha256: hash(bytes),
  developmentArtifact: 'eval/longmemeval/development-v2.json',
  selection: 'First two already selected exposed development IDs from each category, including abstention; not a fresh or random holdout',
  selectedIds: selected.map(({ item }) => item.question_id),
  expected: selected.flatMap(({ item }) => arms.map(([profile, mode]) => ({ id: item.question_id, profile, mode }))),
  sourceHashes: Object.fromEntries(['scripts/eval-longmemeval-cli-delivery.mjs', 'scripts/brain-sync.mjs', 'scripts/lib/longmemeval.mjs', 'src/decision-recall.mjs', 'src/memory-recall.mjs'].map(file => [file, hash(fs.readFileSync(new URL('../' + file, import.meta.url)))])),
  rows: [], runComplete: false,
  limitations: ['Exhaustion is deterministic and does not demonstrate autonomous curator continuation',
    'Gold-session path reachability is not gold-turn delivery, source reading, answer quality or official LongMemEval score',
    'Response bytes are not model tokens; single-pass CLI times do not estimate p95 or end-to-end latency',
    'Abstention cases have no gold evidence, so candidate presence is not a false-answer score'] }
const save = () => fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
save()
try {
  for (const { category, item } of selected) {
    const prepared = prepareCase(item), vault = path.join(temp, item.question_id)
    for (const doc of prepared.documents) {
      const file = path.join(vault, doc.path)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, doc.markdown)
    }
    const expectedDocs = new Map(prepared.documents.map(doc => [doc.path, hash(doc.markdown)]))
    const goldGroups = prepared.labels.evidence
    const goldPaths = new Set(goldGroups.flat())
    const question = prepared.query.text // Date remains separate for any future reader; no benchmark-appended date in retrieval.
    for (const [profile, mode] of arms) {
      const config = path.join(temp, 'runtime.json')
      fs.writeFileSync(config, JSON.stringify({ ...DEFAULT_RUNTIME_CONFIG, retrievalProfile: profile }))
      const row = { id: item.question_id, category, profile, mode, sessions: prepared.documents.length,
        abstention: prepared.labels.abstention, requiredGroups: prepared.labels.abstention ? null : goldGroups.length,
        firstCompletePage: null, candidateCount: null, outputBytes: 0, pages: [], failure: null }
      report.rows.push(row)
      const seen = new Set()
      let offset = 0
      try {
        for (;;) {
          const child = spawnSync(process.execPath, [cli, 'recall-managed', '--vault', vault, '--config', config,
            '--query', question, '--agent', '--offset', String(offset), `--${mode}`], { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 })
          if (child.status !== 0) throw new Error('CLI failed')
          const page = JSON.parse(child.stdout)
          if (page.offset !== offset || !Number.isInteger(page.totalCandidates) || !Array.isArray(page.results)) throw new Error('Invalid page contract')
          if (row.candidateCount !== null && row.candidateCount !== page.totalCandidates) throw new Error('Candidate count changed during pagination')
          row.candidateCount = page.totalCandidates
          for (const result of page.results) {
            if (seen.has(result.path) || !expectedDocs.has(result.path)) throw new Error('Duplicate/unknown source path')
            if (hash(fs.readFileSync(path.join(vault, result.path))) !== expectedDocs.get(result.path)) throw new Error('Source hash changed')
            seen.add(result.path)
          }
          const pageBytes = Buffer.byteLength(child.stdout)
          const goldResults = page.results.filter(result => goldPaths.has(result.path))
          row.outputBytes += pageBytes
          row.pages.push({ offset, returned: page.results.length, nextOffset: page.nextOffset, hasMore: page.hasMore,
            bytes: pageBytes,
            sourceReadRequired: page.results.filter(result => result.sourceReadRequired).length,
            previewOmitted: page.results.filter(result => result.previewOmitted).length,
            goldPathsReturned: goldResults.length,
            goldPathsNeedRead: goldResults.filter(result => result.sourceReadRequired || result.previewOmitted || !result.evidencePreview?.length).length,
            goldPreviewBytes: goldResults.reduce((sum, result) => sum + Buffer.byteLength(JSON.stringify(result.evidencePreview ?? [])), 0),
            goldOriginalBytes: goldResults.reduce((sum, result) => sum + Buffer.byteLength(fs.readFileSync(path.join(vault, result.path))), 0) })
          if (!prepared.labels.abstention && row.firstCompletePage === null && goldGroups.every(group => group.some(name => seen.has(name)))) row.firstCompletePage = row.pages.length
          if (!page.hasMore) {
            if (page.nextOffset !== null || seen.size !== row.candidateCount) throw new Error('Premature or inconsistent exhaustion')
            break
          }
          if (!page.results.length || page.nextOffset !== offset + page.results.length || page.nextOffset <= offset) throw new Error('Non-progressing continuation')
          offset = page.nextOffset
          if (row.pages.length > prepared.documents.length + 1) throw new Error('Page loop failed to terminate')
        }
        if (!prepared.labels.abstention && row.firstCompletePage === null) throw new Error('Required source not reachable')
      } catch (error) {
        row.failure = error.message
      }
      save()
      if (row.failure) throw new Error(`${row.id}/${profile}/${mode}: ${row.failure}`)
    }
    fs.rmSync(vault, { recursive: true, force: true })
  }
  report.runComplete = report.rows.length === report.expected.length && report.rows.every(row => !row.failure)
  save()
  const summary = Object.fromEntries(arms.map(([profile, mode]) => {
    const rows = report.rows.filter(row => row.profile === profile && row.mode === mode)
    return [`${profile}/${mode}`, { trials: rows.length, answerable: rows.filter(row => !row.abstention).length,
      firstPageComplete: rows.filter(row => row.firstCompletePage === 1).length,
      completeAtExhaustion: rows.filter(row => !row.abstention && row.firstCompletePage !== null).length,
      totalPages: rows.reduce((sum, row) => sum + row.pages.length, 0),
      outputBytes: rows.reduce((sum, row) => sum + row.outputBytes, 0) }]
  }))
  console.log(JSON.stringify({ complete: report.runComplete, cases: selected.length, summary }))
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}
