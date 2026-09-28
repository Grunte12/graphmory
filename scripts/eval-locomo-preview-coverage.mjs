#!/usr/bin/env node
// Development-only diagnostic: can a short preview expose gold dialog turns?
import fs from 'node:fs'
import { digest, prepareConversation } from './lib/locomo.mjs'
import { curatorEvidencePreview } from '../src/decision-recall.mjs'
import { parseMarkdown, splitMarkdownSections, tokenize } from '../src/retrieval.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const input = option('--input'), out = option('--out')
if (!input || !out || fs.existsSync(out)) throw new Error('Usage: --input <pinned LoCoMo JSON> --out <new report>')
const bytes = fs.readFileSync(input)
if (digest(bytes) !== '79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4')
  throw new Error('Pinned LoCoMo dataset mismatch')
const baseline = JSON.parse(fs.readFileSync(new URL('../eval/locomo/development-v1.json', import.meta.url)))
const dev = new Set(baseline.development)
const ranked = new Map(baseline.runs.filter(row => row.arm === 'fusion').map(row => [row.id, row.rankedPaths]))
const stop = new Set(['what', 'which', 'where', 'when', 'who', 'how', 'does', 'did', 'was', 'were', 'the', 'and', 'for', 'with', 'are', 'has', 'have', 'had', 'from', 'that', 'this', 'all', 'to', 'is'])
function candidatePreview(doc, query, limit, speakerBoost) {
  const terms = new Set(tokenize(query).filter(term => term.length >= 3 && !stop.has(term)))
  const sections = splitMarkdownSections(doc).filter(section => section.title.includes(' > '))
  return sections.map((section, index) => {
    const body = new Set(section.fields?.body ?? tokenize(section.markdown))
    const heading = new Set(tokenize(section.title.split(' > ').at(-1)))
    const bodyMatches = [...terms].filter(term => body.has(term)).length
    const headingMatches = [...terms].filter(term => heading.has(term)).length
    return { section, index, score: bodyMatches * 2 + (speakerBoost ? headingMatches : 0) }
  }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit)
    .map(({ section }) => ({ heading: section.title, text: section.markdown.slice(0, 350),
      ...(section.markdown.length > 350 ? { truncated: true } : {}) }))
}
const modes = ['current', 'no-anchor-3', 'speaker-3', 'speaker-5', 'coverage-opt-in']
const rows = []
for (const item of JSON.parse(bytes)) {
  if (!dev.has(item.sample_id)) continue
  const prepared = prepareConversation(item)
  const docs = new Map(prepared.documents.map(raw => [raw.path, parseMarkdown(raw.path, raw.markdown)]))
  for (const [index, question] of prepared.questions.entries()) {
    if (question.category === 5 || question.unresolved.length || !question.evidence.length) continue
    const paths = ranked.get(question.id)
    if (!paths) throw new Error(`Missing frozen ranking: ${question.id}`)
    const goldTurns = item.qa[index].evidence
    const variants = {}
    for (const mode of modes) {
      const previews = paths.slice(0, 10).map(p => {
        const doc = docs.get(p)
        if (!doc) throw new Error(`Missing frozen path: ${p}`)
        return mode === 'current' ? curatorEvidencePreview(doc, question.query)
          : mode === 'coverage-opt-in' ? curatorEvidencePreview(doc, question.query, { coverageMode: true })
          : candidatePreview(doc, question.query, mode === 'speaker-5' ? 5 : 3, mode !== 'no-anchor-3')
      })
      const seen = new Set(previews.flat().flatMap(part => goldTurns.filter(id => part.heading.includes(`(${id})`))))
      variants[mode] = { visibleGoldTurns: seen.size, previewBytes: Buffer.byteLength(JSON.stringify(previews)),
        complete: seen.size === goldTurns.length }
    }
    rows.push({ id: question.id, category: question.category, goldTurns: goldTurns.length,
      goldNotesAt10: question.evidence.filter(p => paths.slice(0, 10).includes(p)).length,
      goldNotes: question.evidence.length, variants })
  }
}
const summary = Object.fromEntries(modes.map(mode => {
  const hit = rows.map(row => row.variants[mode])
  return [mode, { cases: rows.length, completeGoldTurnsAt10: hit.filter(x => x.complete).length,
    meanGoldTurnRecallAt10: hit.reduce((sum, x, index) => sum + x.visibleGoldTurns / rows[index].goldTurns, 0) / rows.length,
    medianPreviewBytes: median(hit.map(x => x.previewBytes)) }]
}))
const report = { protocol: 'locomo-development-preview-gold-turn-diagnostic-v1', datasetSha256: digest(bytes),
  developmentConversations: baseline.development, holdoutNotRendered: baseline.holdoutNotEvaluated,
  rankingSha256: digest(fs.readFileSync(new URL('../eval/locomo/development-v1.json', import.meta.url))),
  scorer: 'Gold dialog ID present in preview heading; no answer model or semantic support check',
  variants: modes, summary, rows,
  limitations: ['Development only; gold turn ID visibility is an opportunity metric, not answer correctness',
    'Previews generated for all top-10 notes before byte-budget pagination; compare delivery separately',
    'Simple lexical candidate rules are experimental and may miss paraphrases or introduce irrelevant text'] }
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
function median(values) { return values.sort((a, b) => a - b)[Math.floor(values.length / 2)] }
