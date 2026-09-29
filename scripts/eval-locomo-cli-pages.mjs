#!/usr/bin/env node
// Actual CLI calls on public, already exposed development conversations. No model calls.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { prepareConversation, digest } from './lib/locomo.mjs'
import { DEFAULT_RUNTIME_CONFIG } from '../src/runtime-config.mjs'

const args = process.argv.slice(2), option = flag => args[args.indexOf(flag) + 1]
for (const flag of ['--input', '--out']) if (!args.includes(flag)) throw new Error(`Missing ${flag}`)
const out = path.resolve(option('--out'))
if (fs.existsSync(out)) throw new Error('Preserve existing results')
const bytes = fs.readFileSync(option('--input'))
if (digest(bytes) !== '79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4') throw new Error('Pinned source hash mismatch')
const development = JSON.parse(fs.readFileSync(new URL('../eval/locomo/development-v1.json', import.meta.url))).development
const items = JSON.parse(bytes).filter(item => development.includes(item.sample_id))
const all = items.flatMap(item => prepareConversation(item).questions.map(question => ({ item, question })))
const selected = ['conv-43:21', 'conv-50:140'].map(id => all.find(entry => entry.question.id === id))
for (const category of [1, 2, 3, 4]) {
  const candidates = all.filter(entry => entry.question.category === category && !entry.question.unresolved.length && entry.question.evidence.length && !selected.includes(entry))
    .sort((a, b) => digest('cli-pages-v1:' + a.question.id).localeCompare(digest('cli-pages-v1:' + b.question.id)))
  selected.push(candidates[0])
}
if (selected.some(entry => !entry)) throw new Error('Missing predeclared eligible cases')
const cli = new URL('./brain-sync.mjs', import.meta.url).pathname
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-cli-pages-'))
const arms = ['paths', 'auto', 'auto-matched', 'bundle']
const report = { protocol: 'locomo-actual-cli-pagination-development-v2', sourceSha256: digest(bytes),
  sampling: 'Two known failure cases plus one hash-selected eligible case in each category 1–4; exposed development only',
  expected: selected.flatMap(({ question }) => arms.map(arm => ({ id: question.id, arm }))),
  runtimeHashes: Object.fromEntries(['scripts/eval-locomo-cli-pages.mjs', 'scripts/brain-sync.mjs', 'src/decision-recall.mjs', 'src/memory-recall.mjs', 'src/retrieval.mjs'].map(file => [file, digest(fs.readFileSync(new URL('../' + file, import.meta.url)))])),
  rows: [], runComplete: false,
  limitations: ['Exhaustion controller is deterministic, not autonomous curator behavior', 'Full source paths/hashes are verified; preview text sufficiency and answer quality are not scored', 'CLI elapsed times include process startup and are single-pass observations, not latency acceptance', 'No negative QA, semantic model, independent competitor or final holdout in this run'] }
const save = () => fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
save()
try {
  for (const { item, question } of selected) {
    const prepared = prepareConversation(item), vault = path.join(temp, 'vault')
    fs.mkdirSync(vault, { recursive: true })
    for (const file of fs.readdirSync(vault)) fs.unlinkSync(path.join(vault, file))
    for (const doc of prepared.documents) fs.writeFileSync(path.join(vault, doc.path), doc.markdown)
    const config = path.join(temp, 'runtime.json')
    fs.writeFileSync(config, JSON.stringify(DEFAULT_RUNTIME_CONFIG))
    for (const arm of arms) {
      const row = { id: question.id, category: question.category, arm, pages: [], delivered: [], firstCompletePage: null, failure: null }
      report.rows.push(row)
      let offset = 0, total = null
      const seen = new Set(), start = performance.now()
      try {
        for (;;) {
          const command = [cli, 'recall-managed', '--vault', vault, '--config', config, '--query', question.query, '--agent', '--offset', String(offset),
            ...(arm === 'bundle' ? ['--bundle'] : arm !== 'paths' ? ['--auto'] : []), ...(arm === 'auto-matched' ? ['--matched-previews'] : [])]
          const child = spawnSync(process.execPath, command, { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 })
          if (child.status !== 0) throw new Error('CLI command failed')
          const page = JSON.parse(child.stdout)
          if (page.offset !== offset || !Array.isArray(page.results) || !Number.isInteger(page.totalCandidates)) throw new Error('Invalid page contract')
          if (total !== null && total !== page.totalCandidates) throw new Error('Candidate count changed')
          total = page.totalCandidates
          for (const result of page.results) {
            if (seen.has(result.path)) throw new Error('Duplicate delivered path')
            const doc = prepared.documents.find(doc => doc.path === result.path)
            if (!doc || digest(fs.readFileSync(path.join(vault, result.path))) !== digest(doc.markdown)) throw new Error('Unknown or mutated source')
            seen.add(result.path)
            row.delivered.push({ path: result.path, sha256: digest(doc.markdown) })
          }
          row.pages.push({ offset, nextOffset: page.nextOffset, hasMore: page.hasMore, totalCandidates: total,
            paths: page.results.map(result => result.path), bytes: Buffer.byteLength(child.stdout),
            goldTurnPreviewHits: [...new Set(page.results.flatMap(result => (result.evidencePreview ?? []).flatMap(preview =>
              item.qa[Number(question.id.slice(question.id.lastIndexOf(':') + 1))].evidence.filter(id => (preview.heading ?? '').includes(`(${id})`)))))],
            sourceReadRequired: page.results.filter(result => result.sourceReadRequired).map(result => result.path),
            previewOmitted: page.results.filter(result => result.previewOmitted).map(result => result.path) })
          if (row.firstCompletePage === null && question.evidence.every(name => seen.has(name))) row.firstCompletePage = row.pages.length
          if (!page.hasMore) {
            if (page.nextOffset !== null || seen.size !== total) throw new Error('Premature or inconsistent exhaustion')
            break
          }
          if (!page.results.length || page.nextOffset !== offset + page.results.length || page.nextOffset <= offset) throw new Error('Non-progressing continuation')
          offset = page.nextOffset
          if (row.pages.length > prepared.documents.length + 1) throw new Error('Page loop failed to terminate')
        }
        row.completeAtExhaustion = question.evidence.every(name => seen.has(name))
        if (!row.completeAtExhaustion) throw new Error('Reachable gold evidence lost')
      } catch (error) { row.failure = error.message }
      row.elapsedMs = Number((performance.now() - start).toFixed(2))
      save()
      if (row.failure) throw new Error(`${question.id}/${arm}: ${row.failure}`)
    }
  }
  report.runComplete = report.rows.length === report.expected.length && report.rows.every(row => !row.failure)
  save()
  console.log(JSON.stringify({ complete: report.runComplete, trials: report.rows.length, firstPageComplete: report.rows.filter(row => row.firstCompletePage === 1).length }))
} finally {
  // Only this script's synthetic staging directory; immutable report is outside it.
  fs.rmSync(temp, { recursive: true, force: true })
}
