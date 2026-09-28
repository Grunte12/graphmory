#!/usr/bin/env node
// Frozen development-only evidence-opportunity screen; no model or vault writes.
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { digest, prepareConversation } from './lib/locomo.mjs'
import { sourceSectionWindow } from './lib/source-section-window.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const input = option('--input'), manifestFile = option('--manifest'), out = option('--out')
if (!input || !manifestFile || !out || fs.existsSync(out)) throw new Error('Need input, frozen manifest and new output')
const root = fileURLToPath(new URL('../', import.meta.url))
const manifestBytes = fs.readFileSync(manifestFile), manifest = JSON.parse(manifestBytes)
if (manifest.protocol !== 'source-section-window-development-screen-v1') throw new Error('Unknown protocol')
for (const [name, expected] of Object.entries(manifest.sourceHashes)) {
  if (digest(fs.readFileSync(path.join(root, name))) !== expected) throw new Error('Frozen runtime drift')
}
const bytes = fs.readFileSync(input)
if (digest(bytes) !== manifest.datasetSha256) throw new Error('Dataset drift')
const rows = []
for (const item of JSON.parse(bytes)) {
  if (!manifest.development.includes(item.sample_id)) continue
  const prepared = prepareConversation(item)
  for (const [index, question] of prepared.questions.entries()) {
    if (question.category === 5 || question.unresolved.length || !question.evidence.length) continue
    const gold = [...new Set(item.qa[index].evidence)]
    if (!gold.every(id => prepared.documents.some(doc => doc.markdown.includes(`(${id})`)))) throw new Error('Full-source reference missing gold turn')
    const originalBytes = prepared.documents.reduce((sum, doc) => sum + Buffer.byteLength(doc.markdown), 0)
    const methods = {}
    for (const context of manifest.contextVariants) {
      let selectedBytes = 0, serializedBytes = 0, partialNotes = 0
      const visible = new Set()
      for (const doc of prepared.documents) {
        const selected = sourceSectionWindow(doc.markdown, question.query, context)
        if (selected.originalSha256 !== digest(doc.markdown)) throw new Error('Original hash drift')
        const lines = doc.markdown.match(/[^\n]*\n|[^\n]+$/gu) ?? []
        for (const range of selected.ranges) {
          if (range.markdown !== lines.slice(range.startLine - 1, range.endLine).join('')) throw new Error('Excerpt altered original bytes')
          // Benchmark turn headings audit opportunity only; selector never sees gold.
          for (const id of gold) if (range.markdown.includes(`(${id})`)) visible.add(id)
        }
        selectedBytes += selected.selectedBytes
        serializedBytes += Buffer.byteLength(JSON.stringify({ path: doc.path, ...selected }))
        partialNotes += Number(selected.sourceReadRequired)
      }
      methods[context] = { completeGoldTurns: visible.size === gold.length, visibleGoldTurns: visible.size,
        selectedBytes, serializedBytes, partialNotes }
    }
    rows.push({ id: question.id, category: question.category, goldTurns: gold.length, annotatedGoldEntries: item.qa[index].evidence.length, originalBytes,
      originalNotes: prepared.documents.length, methods })
  }
}
if (rows.length !== manifest.expectedCases || new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('Frozen case accounting mismatch')
const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 }
const summary = Object.fromEntries(manifest.contextVariants.map(context => {
  const values = rows.map(r => r.methods[context])
  const losses = rows.filter(r => !r.methods[context].completeGoldTurns)
  const medianFraction = median(rows.map(r => r.methods[context].selectedBytes / r.originalBytes))
  return [context, { cases: rows.length, completeGoldTurns: rows.length - losses.length,
    goldLossCases: losses.length, firstLossIds: losses.slice(0, 10).map(r => r.id),
    medianOriginalBytes: median(rows.map(r => r.originalBytes)), medianSelectedBytes: median(values.map(v => v.selectedBytes)),
    medianSerializedBytes: median(values.map(v => v.serializedBytes)), medianSelectedFraction: medianFraction,
    passesFrozenScreen: losses.length === 0 && medianFraction <= manifest.maximumMedianSelectedFraction }]
}))
fs.writeFileSync(out, JSON.stringify({ protocol: manifest.protocol, manifestSha256: digest(manifestBytes),
  datasetSha256: digest(bytes), summary, rows, holdoutNotRendered: manifest.holdoutNotRendered,
  limitations: manifest.limitations }, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
