#!/usr/bin/env node
// Paired actual managedRecall first-page delivery on LoCoMo development conversations.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { digest, prepareConversation } from './lib/locomo.mjs'
import { managedRecall } from '../src/decision-recall.mjs'
import { DEFAULT_RUNTIME_CONFIG } from '../src/runtime-config.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const input = option('--input'), out = option('--out')
if (!input || !out || fs.existsSync(out)) throw new Error('Usage: --input <pinned LoCoMo JSON> --out <new report>')
const bytes = fs.readFileSync(input)
if (digest(bytes) !== '79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4')
  throw new Error('Pinned LoCoMo dataset mismatch')
const baseline = JSON.parse(fs.readFileSync(new URL('../eval/locomo/development-v1.json', import.meta.url)))
const dev = new Set(baseline.development)
const items = JSON.parse(bytes)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-preview-delivery-'))
const rows = []
try {
  for (const item of items) {
    if (!dev.has(item.sample_id)) continue
    const prepared = prepareConversation(item)
    const vault = path.join(tmp, item.sample_id)
    fs.mkdirSync(vault)
    for (const doc of prepared.documents) fs.writeFileSync(path.join(vault, doc.path), doc.markdown)
    for (const [index, question] of prepared.questions.entries()) {
      if (question.category === 5 || question.unresolved.length || !question.evidence.length) continue
      const modes = {}
      for (const [arm, coveragePreviews] of [['current', false], ['coverage-opt-in', true]]) {
        const page = await managedRecall(vault, question.query, DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true, coveragePreviews })
        const visible = new Set(page.results.flatMap(result => (result.evidencePreview ?? []).flatMap(preview =>
          item.qa[index].evidence.filter(id => preview.heading.includes(`(${id})`)))))
        const full = new Set(page.results.flatMap(result => (result.evidencePreview ?? []).flatMap(preview =>
          preview.truncated ? [] : item.qa[index].evidence.filter(id => preview.heading.includes(`(${id})`)))))
        modes[arm] = { paths: page.results.map(result => result.path), totalCandidates: page.totalCandidates,
          adaptiveMode: page.adaptiveMode, hasMore: page.hasMore, nextOffset: page.nextOffset,
          visibleGoldTurns: visible.size, fullGoldTurns: full.size,
          goldNotesDelivered: question.evidence.filter(p => page.results.some(result => result.path === p)).length,
          responseBytes: Buffer.byteLength(JSON.stringify(page)) }
      }
      const a = modes.current, b = modes['coverage-opt-in']
      if (a.totalCandidates !== b.totalCandidates ||
        JSON.stringify(a.paths.slice(0, Math.min(a.paths.length, b.paths.length))) !== JSON.stringify(b.paths.slice(0, Math.min(a.paths.length, b.paths.length))))
        throw new Error(`Ranking changed: ${question.id}`)
      rows.push({ id: question.id, category: question.category, goldTurns: item.qa[index].evidence.length,
        goldNotes: question.evidence.length, modes })
    }
  }
  const summary = Object.fromEntries(['current', 'coverage-opt-in'].map(mode => {
    const values = rows.map(row => row.modes[mode])
    return [mode, { cases: rows.length,
      completeGoldTurnsFirstPage: rows.filter((row, i) => values[i].visibleGoldTurns === row.goldTurns).length,
      completeUntruncatedGoldTurnsFirstPage: rows.filter((row, i) => values[i].fullGoldTurns === row.goldTurns).length,
      meanGoldTurnRecallFirstPage: values.reduce((sum, v, i) => sum + v.visibleGoldTurns / rows[i].goldTurns, 0) / rows.length,
      completeGoldNotesFirstPage: rows.filter((row, i) => values[i].goldNotesDelivered === row.goldNotes).length,
      medianResponseBytes: median(values.map(v => v.responseBytes)), medianPageSize: median(values.map(v => v.paths.length)) }]
  }))
  const report = { protocol: 'locomo-development-actual-managed-first-page-v1', datasetSha256: digest(bytes),
    developmentConversations: baseline.development, holdoutNotRendered: baseline.holdoutNotEvaluated,
    method: 'Actual managedRecall --auto first page, current versus opt-in coverage previews; same original Markdown and query',
    summary, rows,
    limitations: ['Development evidence-opportunity diagnostic, not answer correctness or full-source reads',
      'Gold turn in heading does not guarantee its factual content is visible; untruncated count is separate',
      'In-process response bytes exclude CLI startup/host overhead; no model was called'] }
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(summary, null, 2))
} finally { fs.rmSync(tmp, { recursive: true, force: true }) }
function median(values) { return values.sort((a, b) => a - b)[Math.floor(values.length / 2)] }
