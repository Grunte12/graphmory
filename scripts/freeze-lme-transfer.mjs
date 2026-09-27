#!/usr/bin/env node
// Freeze source-disjoint questions absent from existing evaluation JSON before scoring.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hash, selectSourceDisjointCases, validateCase } from './lib/longmemeval.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const input = option('--input')
const out = option('--out')
const seed = option('--seed') ?? 'graphmory-transfer-2026-09-28-v1'
if (!input || !out || !seed || fs.existsSync(out))
  throw new Error('Usage: --input <cleaned-S dataset> --out <new manifest path> [--seed value]; output must not exist')
const inputBytes = fs.readFileSync(input)
const items = JSON.parse(inputBytes)
for (const item of items) validateCase(item)
const ids = new Set(items.map(item => item.question_id))
const byId = new Map(items.map(item => [item.question_id, item]))
if (ids.size !== items.length) throw new Error('Duplicate dataset question ID')
const family = id => id.replace(/_abs$/u, '')
const seen = new Set()
const seenIds = new Set()
const excludedFiles = []

function jsonFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? jsonFiles(file) : entry.name.endsWith('.json') ? [file] : []
  })
}
function findIds(value, found) {
  if (typeof value === 'string') { if (ids.has(value)) found.add(value); return }
  if (Array.isArray(value)) { for (const item of value) findIds(item, found); return }
  if (value && typeof value === 'object') for (const item of Object.values(value)) findIds(item, found)
}
for (const file of jsonFiles(path.join(root, 'eval')).sort()) {
  const bytes = fs.readFileSync(file)
  const found = new Set()
  let parsed = true
  try { findIds(JSON.parse(bytes), found) }
  catch {
    // Some legacy .json-named eval fixtures are plain text. Exclude any exact
    // dataset IDs they mention rather than silently treating them as unseen.
    parsed = false
    const text = bytes.toString('utf8')
    for (const id of ids) if (text.includes(id)) found.add(id)
  }
  if (!found.size) continue
  for (const id of found) { seen.add(family(id)); seenIds.add(id) }
  excludedFiles.push({ path: path.relative(root, file), sha256: hash(bytes), matchedIds: found.size, parsed })
}
const remaining = items.filter(item => !seen.has(family(item.question_id)))
const priorSessions = new Set([...seenIds].flatMap(id => byId.get(id)?.haystack_session_ids ?? []))
const sourceDisjoint = remaining.filter(item => item.haystack_session_ids.every(id => !priorSessions.has(id)))
if (!sourceDisjoint.length)
  throw new Error(`No source-disjoint transfer cases: ${seen.size} previously seen question families cover ${priorSessions.size} source sessions. Use a different corpus or a pre-frozen conversation-level split.`)
const { selected, unavailableCategories } = selectSourceDisjointCases(sourceDisjoint, 2, seed)
if (!selected.length) throw new Error('No pairwise source-disjoint category pairs remain')
const manifest = {
  purpose: 'Prospectively frozen source-disjoint transfer slice; public data, unseen in prior local evaluation JSON at freeze time',
  sourceSha256: hash(inputBytes), selectionSeed: seed, perCategory: 2,
  excludedPreviouslySeenFamilies: seen.size, excludedPriorSessions: priorSessions.size,
  excludedFiles, unavailableCategories,
  selectedIds: selected.map(item => item.question_id),
}
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ sourceSha256: manifest.sourceSha256, excludedPreviouslySeenFamilies: seen.size,
  excludedFiles: excludedFiles.length, selectedCases: selected.length,
  selectedIdsSha256: hash(JSON.stringify(manifest.selectedIds)) }))
