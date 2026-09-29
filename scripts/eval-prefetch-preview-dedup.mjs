#!/usr/bin/env node
// Development-only screen of duplicate preview removal; full originals stay exact.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { digest, prepareConversation } from './lib/locomo.mjs'
import { managedRecall } from '../src/decision-recall.mjs'
import { DEFAULT_RUNTIME_CONFIG } from '../src/runtime-config.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const input = option('--input'), manifestPath = option('--manifest'), out = option('--out')
if (!input || !manifestPath || !out || fs.existsSync(out)) throw new Error('Need pinned corpus, frozen manifest and new output')
const manifestBytes = fs.readFileSync(manifestPath), manifest = JSON.parse(manifestBytes)
if (manifest.protocol !== 'prefetch-preview-dedup-development-v1') throw new Error('Unknown protocol')
for (const [file, hash] of Object.entries(manifest.sourceHashes)) {
  if (digest(fs.readFileSync(new URL('../' + file, import.meta.url))) !== hash) throw new Error(`Source drift: ${file}`)
}
const corpusBytes = fs.readFileSync(input)
if (digest(corpusBytes) !== manifest.datasetSha256) throw new Error('Corpus drift')
const development = new Set(manifest.development)
const items = JSON.parse(corpusBytes)
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-prefetch-dedup-'))
const cliConfig = path.join(scratch, 'runtime-config.json')
fs.writeFileSync(cliConfig, JSON.stringify(DEFAULT_RUNTIME_CONFIG), { mode: 0o600 })
const rows = []
try {
  for (const item of items) {
    if (!development.has(item.sample_id)) continue
    const prepared = prepareConversation(item)
    const vault = path.join(scratch, item.sample_id)
    fs.mkdirSync(vault)
    for (const doc of prepared.documents) fs.writeFileSync(path.join(vault, doc.path), doc.markdown)
    for (const question of prepared.questions) {
      const options = { adaptiveBundle: true, prefetchWideOriginals: true }
      const baseline = await managedRecall(vault, question.query, DEFAULT_RUNTIME_CONFIG, options)
      const compact = await managedRecall(vault, question.query, DEFAULT_RUNTIME_CONFIG, { ...options, compactPrefetch: true })
      const ready = baseline.prefetch?.status === 'ready'
      if (compact.prefetch?.status !== baseline.prefetch?.status) throw new Error(`Status drift: ${question.id}`)
      if (baseline.offset !== compact.offset || baseline.nextOffset !== compact.nextOffset || baseline.hasMore !== compact.hasMore ||
          baseline.totalCandidates !== compact.totalCandidates || baseline.adaptiveMode !== compact.adaptiveMode ||
          baseline.scanLimitReached !== compact.scanLimitReached) throw new Error(`Pagination drift: ${question.id}`)
      const baselinePaths = baseline.results.map(row => row.path), compactPaths = compact.results.map(row => row.path)
      if (JSON.stringify(baselinePaths) !== JSON.stringify(compactPaths)) throw new Error(`Path order drift: ${question.id}`)
      let cliBaselineBytes = null, cliCompactBytes = null
      if (ready) {
        if (compact.prefetch.presentation !== 'originals-only' || baseline.originalSources?.length !== baseline.results.length ||
            JSON.stringify(compact.originalSources) !== JSON.stringify(baseline.originalSources)) throw new Error(`Original drift: ${question.id}`)
        for (const source of compact.originalSources) {
          const original = prepared.documents.find(doc => doc.path === source.path)
          if (!original || source.markdown !== original.markdown || source.sha256 !== digest(original.markdown)) throw new Error(`Source bytes drift: ${question.id}`)
        }
        if (compact.results.some(row => 'evidencePreview' in row || 'sourceReadRequired' in row || 'previewOmitted' in row))
          throw new Error(`Redundant preview remains: ${question.id}`)
        for (const row of baseline.results) {
          const compactRow = compact.results.find(candidate => candidate.path === row.path)
          if (JSON.stringify(compactRow) !== JSON.stringify(Object.fromEntries(Object.entries(row)
              .filter(([key]) => !['evidencePreview', 'sourceReadRequired', 'previewOmitted'].includes(key)))))
            throw new Error(`Candidate metadata drift: ${question.id}`)
        }
        const common = ['scripts/brain-sync.mjs', 'recall-managed', '--config', cliConfig, '--vault', vault, '--query', question.query,
          '--agent', '--auto', '--prefetch-wide-originals']
        const call = extra => {
          const child = spawnSync(process.execPath, [...common, ...extra], { encoding: 'utf8', maxBuffer: 2_000_000 })
          if (child.status !== 0) throw new Error(`CLI failed: ${question.id}: ${child.stderr.slice(0, 160)}`)
          return { bytes: Buffer.byteLength(child.stdout), payload: JSON.parse(child.stdout) }
        }
        const cliBaseline = call([]), cliCompact = call(['--compact-prefetch'])
        if (JSON.stringify(cliBaseline.payload.originalSources) !== JSON.stringify(cliCompact.payload.originalSources) ||
            JSON.stringify(cliCompact.payload.results.map(row => row.path)) !== JSON.stringify(baselinePaths))
          throw new Error(`CLI source/path drift: ${question.id}`)
        cliBaselineBytes = cliBaseline.bytes; cliCompactBytes = cliCompact.bytes
      } else if (JSON.stringify(compact) !== JSON.stringify(baseline)) {
        throw new Error(`Skipped response drift: ${question.id}`)
      }
      rows.push({ id: question.id, ready, skipReason: ready ? null : baseline.prefetch.reason,
        candidates: baseline.results.length, originalBytes: ready ? baseline.originalSources.reduce((sum, source) => sum + source.bytes, 0) : null,
        baselineResponseBytes: Buffer.byteLength(JSON.stringify(baseline)), compactResponseBytes: Buffer.byteLength(JSON.stringify(compact)),
        cliBaselineBytes, cliCompactBytes })
    }
  }
  if (rows.length !== manifest.expectedQuestions || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Question accounting drift')
  const ready = rows.filter(row => row.ready)
  if (ready.length !== manifest.expectedReady) throw new Error('Ready population drift')
  const median = values => { const sorted = [...values].sort((a, b) => a - b); return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2 }
  const summary = { cases: rows.length, ready: ready.length, skipped: rows.length - ready.length,
    medianResponseByteReduction: median(ready.map(row => 1 - row.compactResponseBytes / row.baselineResponseBytes)),
    medianCliByteReduction: median(ready.map(row => 1 - row.cliCompactBytes / row.cliBaselineBytes)),
    allOriginalsExact: true, pathOrderParity: true, paginationParity: true, skippedResponseParity: true }
  fs.writeFileSync(out, JSON.stringify({ protocol: manifest.protocol, manifestSha256: digest(manifestBytes),
    datasetSha256: digest(corpusBytes), summary, rows, holdoutNotRendered: manifest.holdoutNotRendered }, null, 2) + '\n')
  console.log(JSON.stringify(summary))
} finally { fs.rmSync(scratch, { recursive: true, force: true }) }
