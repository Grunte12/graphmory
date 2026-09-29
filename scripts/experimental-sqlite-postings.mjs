#!/usr/bin/env node
// Node 24-only experimental posting store. Not part of the packaged runtime.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { DatabaseSync } from 'node:sqlite'
import { loadVaultDocuments } from '../src/memory-recall.mjs'
import { rank, splitMarkdownSections } from '../src/retrieval.mjs'

const MODEL = 'existing-focused-section-bm25f'
const FIELDS = ['path', 'title', 'metadata', 'headings', 'body']
const WEIGHTS = [1.5, 4, 3, 2.5, 1]
const QUERY_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'before', 'by', 'for', 'from', 'how', 'in', 'is', 'it',
  'of', 'on', 'or', 'should', 'that', 'the', 'this', 'to', 'was', 'what', 'when', 'where', 'which', 'who', 'with',
])
const sha = data => createHash('sha256').update(data).digest('hex')
const args = process.argv.slice(2)
const mode = args[0]
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
function required(name) {
  const value = option(name)
  if (!value || value.startsWith('--')) throw new Error('Missing ' + name)
  return value
}
function codeHashes() {
  return Object.fromEntries(['src/retrieval.mjs', 'src/memory-recall.mjs', 'scripts/experimental-sqlite-postings.mjs']
    .map(name => [name, sha(fs.readFileSync(new URL('../' + name, import.meta.url)))]))
}
function preparedInputs(prepared, limit) {
  const bytes = fs.readFileSync(path.join(prepared, 'manifest.json'))
  const manifest = JSON.parse(bytes)
  if (!Number.isInteger(limit) || limit < 1 || limit > manifest.corpusCount) throw new Error('Invalid corpus limit')
  const vault = path.join(prepared, 'vault')
  const documents = loadVaultDocuments(vault, { maxFiles: manifest.corpusCount + 1 }).slice(0, limit)
  if (documents.length !== limit) throw new Error('Incomplete corpus')
  const sourceHashes = {}
  for (const document of documents) {
    const digest = sha(fs.readFileSync(path.join(vault, document.id)))
    if (digest !== manifest.vaultSourceHashes[document.id]) throw new Error('Source drift: ' + document.id)
    sourceHashes[document.id] = digest
  }
  return { manifest, manifestSha256: sha(bytes), vault, documents, sourceHashes }
}
function queryTokens(query) {
  const tokens = String(query).toLocaleLowerCase('en').match(/[\p{L}\p{M}\p{N}_-]+/gu)
    ?.filter(token => token.length > 1) ?? []
  const expanded = tokens.flatMap(token => {
    const parts = token.split(/[-_]/u).filter(part => part.length > 1)
    return parts.length > 1 ? [token, ...parts] : [token]
  }).flatMap(token => token.length > 3 && token.endsWith('s')
      && !token.endsWith('ss') && !token.endsWith('us') && !token.endsWith('is')
    ? [token, token.slice(0, -1)] : [token])
  return [...new Set(expanded.filter(token => !QUERY_STOPWORDS.has(token)))]
}
function frequencies(tokens) {
  const counts = new Map()
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)
  return counts
}
function createDb(dbFile, prepared, limit) {
  if (fs.existsSync(dbFile)) throw new Error('Preserve prior experimental DB')
  const started = performance.now()
  const input = preparedInputs(prepared, limit)
  fs.mkdirSync(path.dirname(dbFile), { recursive: true })
  const db = new DatabaseSync(dbFile)
  db.exec(`CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE sections (doc_key INTEGER PRIMARY KEY, id TEXT NOT NULL, chunk_id TEXT NOT NULL,
      path_len INTEGER NOT NULL, title_len INTEGER NOT NULL, metadata_len INTEGER NOT NULL,
      headings_len INTEGER NOT NULL, body_len INTEGER NOT NULL);
    CREATE TABLE postings (token TEXT NOT NULL, doc_key INTEGER NOT NULL,
      path_tf INTEGER NOT NULL, title_tf INTEGER NOT NULL, metadata_tf INTEGER NOT NULL,
      headings_tf INTEGER NOT NULL, body_tf INTEGER NOT NULL,
      PRIMARY KEY(token, doc_key)) WITHOUT ROWID;`)
  const putSection = db.prepare(`INSERT INTO sections VALUES (?,?,?,?,?,?,?,?)`)
  const putPosting = db.prepare(`INSERT INTO postings VALUES (?,?,?,?,?,?,?)`)
  const putMeta = db.prepare('INSERT INTO meta VALUES (?,?)')
  const sections = input.documents.flatMap(splitMarkdownSections)
  const sums = Object.fromEntries(FIELDS.map(field => [field, 0]))
  db.exec('BEGIN IMMEDIATE')
  try {
    for (const [docKey, section] of sections.entries()) {
      const lengths = FIELDS.map(field => section.fields?.[field]?.length ?? 0)
      putSection.run(docKey, section.id, section.chunkId, ...lengths)
      const counts = FIELDS.map(field => frequencies(section.fields?.[field] ?? []))
      FIELDS.forEach((field, index) => { sums[field] += lengths[index] })
      const tokens = new Set(counts.flatMap(group => [...group.keys()]))
      for (const token of tokens) putPosting.run(token, docKey, ...counts.map(group => group.get(token) ?? 0))
    }
    const averages = Object.fromEntries(FIELDS.map(field => [field, sums[field] / Math.max(sections.length, 1)]))
    const metadata = { protocol: 'sqlite-postings-prototype-v1', model: MODEL, limit,
      sectionCount: sections.length, sourceHashes: input.sourceHashes,
      archiveSha256: input.manifest.archiveSha256, preparedManifestSha256: input.manifestSha256,
      codeHashes: codeHashes(), averages }
    putMeta.run('experiment', JSON.stringify(metadata))
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); db.close(); throw error }
  db.close()
  return { buildMs: performance.now() - started, dbBytes: fs.statSync(dbFile).size, sectionCount: sections.length }
}
function openDb(file) {
  const db = new DatabaseSync(file, { readOnly: true })
  const metadata = JSON.parse(db.prepare("SELECT value FROM meta WHERE key = 'experiment'").get().value)
  if (metadata.protocol !== 'sqlite-postings-prototype-v1' || metadata.model !== MODEL) throw new Error('Unknown index')
  assert.deepEqual(metadata.codeHashes, codeHashes(), 'Implementation drift')
  return { db, metadata }
}
function rankIndex(db, metadata, query) {
  const tokens = queryTokens(query)
  const rows = db.prepare(`SELECT p.doc_key, s.id, s.chunk_id,
    s.path_len,s.title_len,s.metadata_len,s.headings_len,s.body_len,
    p.path_tf,p.title_tf,p.metadata_tf,p.headings_tf,p.body_tf
    FROM postings p JOIN sections s ON s.doc_key = p.doc_key
    WHERE p.token = ? ORDER BY p.doc_key`)
  const byToken = new Map()
  const candidates = new Map()
  for (const token of tokens) {
    const hits = rows.all(token)
    byToken.set(token, new Map(hits.map(hit => [hit.doc_key, hit])))
    for (const hit of hits) if (!candidates.has(hit.doc_key)) candidates.set(hit.doc_key, hit)
  }
  const terms = tokens.flatMap(token => {
    const containing = byToken.get(token).size
    return containing ? [{ token, idf: Math.log(1 + (metadata.sectionCount - containing + 0.5) / (containing + 0.5)) }] : []
  })
  const scores = [...candidates.values()].map(section => {
    const normalizations = FIELDS.map(field => 1 - 0.75
      + 0.75 * (section[`${field}_len`] / Math.max(metadata.averages[field], 1)))
    let score = 0
    for (const { token, idf } of terms) {
      // The original scorer sums fields in this fixed order for each query term.
      const posting = byToken.get(token).get(section.doc_key)
      let weightedFrequency = 0
      for (const [index, field] of FIELDS.entries()) {
        const frequency = posting?.[`${field}_tf`] ?? 0
        if (frequency) weightedFrequency += WEIGHTS[index] * (frequency / normalizations[index])
      }
      score += idf * ((weightedFrequency * 2.2) / (weightedFrequency + 1.2))
    }
    return { id: section.id, chunkId: section.chunk_id, docKey: section.doc_key, score }
  }).filter(section => section.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  const seen = new Set()
  return scores.filter(section => {
    if (seen.has(section.id)) return false
    seen.add(section.id)
    return true
  }).map(({ id, chunkId, score }) => ({ id, chunkId, score }))
}
function printQueryResult(result) {
  console.log(JSON.stringify(result))
  if (process.env.GRAPHMORY_EXPERIMENT_METRICS === '1') {
    console.error(JSON.stringify({ rssBytes: process.memoryUsage().rss, maxRssRaw: process.resourceUsage().maxRSS }))
  }
}

if (mode === 'build') {
  const result = createDb(path.resolve(required('--db')), path.resolve(required('--prepared')),
    Number(required('--limit')))
  console.log(JSON.stringify(result))
} else if (mode === 'query') {
  const dbFile = path.resolve(required('--db'))
  const query = required('--query')
  const { db, metadata } = openDb(dbFile)
  const result = rankIndex(db, metadata, query)
  db.close()
  const pageRequested = args.includes('--offset') || args.includes('--k')
  if (pageRequested && (!args.includes('--offset') || !args.includes('--k'))) throw new Error('Supply both --offset and --k')
  const offset = pageRequested ? Number(required('--offset')) : 0
  const k = pageRequested ? Number(required('--k')) : result.length
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(k) || (pageRequested && k < 1))
    throw new Error('Invalid page')
  printQueryResult(pageRequested ? result.slice(offset, offset + k) : result)
} else if (mode === 'baseline-query') {
  const prepared = path.resolve(required('--prepared'))
  const limit = Number(required('--limit'))
  const query = required('--query')
  const manifest = JSON.parse(fs.readFileSync(path.join(prepared, 'manifest.json')))
  if (![500, manifest.corpusCount].includes(limit)) throw new Error('Invalid corpus limit')
  const documents = loadVaultDocuments(path.join(prepared, 'vault'), { maxFiles: manifest.corpusCount + 1 }).slice(0, limit)
  const result = rank(documents, query, 'bm25f-focused-sections')
    .map(({ id, chunkId, score }) => ({ id, chunkId, score }))
  printQueryResult(result)
} else {
  throw new Error('Use build, query, or baseline-query')
}
