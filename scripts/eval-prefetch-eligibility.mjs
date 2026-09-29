#!/usr/bin/env node
// Development-only, actual managedRecall eligibility and source parity screen.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { digest, prepareConversation } from './lib/locomo.mjs'
import { managedRecall } from '../src/decision-recall.mjs'
import { DEFAULT_RUNTIME_CONFIG } from '../src/runtime-config.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const input = option('--input'), manifestPath = option('--manifest'), out = option('--out')
if (!input || !manifestPath || !out || fs.existsSync(out)) throw new Error('Need pinned input, frozen manifest, and a new result path')
const manifestBytes = fs.readFileSync(manifestPath), manifest = JSON.parse(manifestBytes)
if (manifest.protocol !== 'prefetch-development-eligibility-v1') throw new Error('Unknown protocol')
for (const [file, hash] of Object.entries(manifest.sourceHashes)) {
  if (digest(fs.readFileSync(new URL('../' + file, import.meta.url))) !== hash) throw new Error(`Source drift: ${file}`)
}
const corpusBytes = fs.readFileSync(input)
if (digest(corpusBytes) !== manifest.datasetSha256) throw new Error('Corpus drift')
const items = JSON.parse(corpusBytes), development = new Set(manifest.development)
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-prefetch-eligibility-'))
const rows = []
try {
  for (const item of items) {
    if (!development.has(item.sample_id)) continue
    const prepared = prepareConversation(item)
    const vault = path.join(scratch, item.sample_id)
    fs.mkdirSync(vault)
    for (const doc of prepared.documents) fs.writeFileSync(path.join(vault, doc.path), doc.markdown)
    for (const question of prepared.questions) {
      const baseline = await managedRecall(vault, question.query, DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true })
      const candidate = await managedRecall(vault, question.query, DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true, prefetchWideOriginals: true })
      const same = JSON.stringify(baseline.results) === JSON.stringify(candidate.results)
        && baseline.adaptiveMode === candidate.adaptiveMode && baseline.hasMore === candidate.hasMore
        && baseline.nextOffset === candidate.nextOffset && baseline.totalCandidates === candidate.totalCandidates
      if (!same) throw new Error(`Candidate changed ranking/page delivery: ${question.id}`)
      const ready = candidate.prefetch?.status === 'ready'
      const originals = candidate.originalSources ?? []
      if (ready !== Boolean(originals.length)) throw new Error(`Prefetch state/payload mismatch: ${question.id}`)
      if (ready) {
        if (candidate.hasMore || candidate.adaptiveMode !== 'wide' || originals.length !== candidate.results.length) throw new Error(`Invalid ready page: ${question.id}`)
        for (let i = 0; i < originals.length; i++) {
          const actual = originals[i], source = prepared.documents.find(doc => doc.path === actual.path)
          if (actual.path !== candidate.results[i].path || !source || actual.markdown !== source.markdown || actual.sha256 !== digest(source.markdown))
            throw new Error(`Source content/order changed: ${question.id}`)
        }
      }
      const goldPaths = [...new Set(question.evidence)]
      rows.push({ id: question.id, category: question.category, unresolvedGoldTurns: question.unresolved.length,
        adaptiveMode: candidate.adaptiveMode, prefetchStatus: candidate.prefetch.status,
        ...(ready ? {} : { skipReason: candidate.prefetch.reason }),
        candidates: candidate.results.length, totalCandidates: candidate.totalCandidates,
        hasMore: candidate.hasMore, scanLimitReached: candidate.scanLimitReached,
        originalBytes: ready ? originals.reduce((sum, source) => sum + source.bytes, 0) : null,
        baselineResponseBytes: Buffer.byteLength(JSON.stringify(baseline)),
        candidateResponseBytes: Buffer.byteLength(JSON.stringify(candidate)),
        goldPaths: goldPaths.length,
        goldPathsOnFirstPage: goldPaths.filter(name => candidate.results.some(result => result.path === name)).length,
        goldPathsPrefetched: ready ? goldPaths.filter(name => originals.some(source => source.path === name)).length : 0,
        rankAndPageParity: same })
    }
  }
  if (rows.length !== manifest.expectedQuestions || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Case count/identity drift')
  const counts = new Map()
  for (const row of rows) counts.set(row.prefetchStatus === 'ready' ? 'ready' : row.skipReason, (counts.get(row.prefetchStatus === 'ready' ? 'ready' : row.skipReason) ?? 0) + 1)
  const eligible = rows.filter(row => row.prefetchStatus === 'ready')
  const answerable = eligible.filter(row => row.category !== 5 && !row.unresolvedGoldTurns && row.goldPaths)
  const complete = answerable.filter(row => row.goldPathsPrefetched === row.goldPaths).length
  const sortedBytes = eligible.map(row => row.candidateResponseBytes).sort((a, b) => a - b)
  const summary = { cases: rows.length, byEligibility: Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))),
    readyRate: eligible.length / rows.length, answerableReady: answerable.length,
    answerableCompleteGoldPaths: complete, answerableMissingGoldPaths: answerable.length - complete,
    readyMedianResponseBytes: sortedBytes.length ? sortedBytes[Math.floor(sortedBytes.length / 2)] : null,
    readyMaxResponseBytes: sortedBytes.at(-1) ?? null,
    rankAndPageParity: rows.every(row => row.rankAndPageParity),
    exactReadyOriginalParity: true }
  fs.writeFileSync(out, JSON.stringify({ protocol: manifest.protocol, manifestSha256: digest(manifestBytes),
    datasetSha256: digest(corpusBytes), summary, rows,
    holdoutNotRendered: manifest.holdoutNotRendered, limitations: manifest.limitations }, null, 2) + '\n')
  console.log(JSON.stringify(summary))
} finally { fs.rmSync(scratch, { recursive: true, force: true }) }
