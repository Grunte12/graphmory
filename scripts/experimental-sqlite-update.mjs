#!/usr/bin/env node
// Synthetic-development mutation screen for the Node 24 SQLite posting prototype.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { loadVaultDocuments } from '../src/memory-recall.mjs'
import { splitMarkdownSections } from '../src/retrieval.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
for (const name of ['--db', '--before', '--after']) {
  if (!option(name) || option(name).startsWith('--')) throw new Error('Missing ' + name)
}
const dbFile = path.resolve(option('--db'))
const before = path.resolve(option('--before'))
const after = path.resolve(option('--after'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const FIELDS = ['path', 'title', 'metadata', 'headings', 'body']

function snapshot(root) {
  const documents = loadVaultDocuments(root, { maxFiles: 1000 })
  const hashes = Object.fromEntries(documents.map(doc => [doc.id, sha(fs.readFileSync(path.join(root, doc.id)))]))
  return { documents, hashes }
}

const beforeState = snapshot(before)
const afterState = snapshot(after)
const beforeDbSha256 = sha(fs.readFileSync(dbFile))
const db = new DatabaseSync(dbFile)
let changed = []
try {
  const metadata = JSON.parse(db.prepare("SELECT value FROM meta WHERE key = 'experiment'").get().value)
  if (metadata.protocol !== 'sqlite-postings-prototype-v1') throw new Error('Wrong index protocol')
  assert.deepEqual(metadata.sourceHashes, beforeState.hashes, 'Stale prior source snapshot')
  if (metadata.limit !== beforeState.documents.length) throw new Error('Prior note-count mismatch')
  const priorNames = new Set(Object.keys(beforeState.hashes))
  const nextNames = new Set(Object.keys(afterState.hashes))
  const deleted = [...priorNames].filter(id => !nextNames.has(id))
  const added = [...nextNames].filter(id => !priorNames.has(id))
  const edited = [...nextNames].filter(id => priorNames.has(id)
    && beforeState.hashes[id] !== afterState.hashes[id])
  changed = [...deleted.map(id => ({ type: 'delete', id })),
    ...added.map(id => ({ type: 'add', id })), ...edited.map(id => ({ type: 'edit', id }))]
  const dropPostings = db.prepare('DELETE FROM postings WHERE doc_key IN (SELECT doc_key FROM sections WHERE id = ?)')
  const dropSections = db.prepare('DELETE FROM sections WHERE id = ?')
  const addSection = db.prepare('INSERT INTO sections VALUES (?,?,?,?,?,?,?,?)')
  const addPosting = db.prepare('INSERT INTO postings VALUES (?,?,?,?,?,?,?)')
  const updateMeta = db.prepare("UPDATE meta SET value = ? WHERE key = 'experiment'")
  const afterById = new Map(afterState.documents.map(doc => [doc.id, doc]))
  db.exec('BEGIN IMMEDIATE')
  try {
    for (const { id } of changed) {
      dropPostings.run(id)
      dropSections.run(id)
    }
    let nextKey = Number(db.prepare('SELECT COALESCE(MAX(doc_key), -1) + 1 AS next_key FROM sections').get().next_key)
    for (const { id, type } of changed) {
      if (type === 'delete') continue
      const document = afterById.get(id)
      for (const section of splitMarkdownSections(document)) {
        const counts = FIELDS.map(field => {
          const values = new Map()
          for (const token of section.fields?.[field] ?? []) values.set(token, (values.get(token) ?? 0) + 1)
          return values
        })
        addSection.run(nextKey, section.id, section.chunkId,
          ...FIELDS.map(field => section.fields?.[field]?.length ?? 0))
        const tokens = new Set(counts.flatMap(values => [...values.keys()]))
        for (const token of tokens) addPosting.run(token, nextKey, ...counts.map(values => values.get(token) ?? 0))
        nextKey += 1
      }
    }
    const totals = db.prepare(`SELECT COUNT(*) AS n, ${FIELDS.map(field => `SUM(${field}_len) AS ${field}_sum`).join(', ')} FROM sections`).get()
    metadata.sectionCount = Number(totals.n)
    metadata.limit = afterState.documents.length
    metadata.sourceHashes = afterState.hashes
    metadata.averages = Object.fromEntries(FIELDS.map(field => [field,
      Number(totals[`${field}_sum`] ?? 0) / Math.max(metadata.sectionCount, 1)]))
    updateMeta.run(JSON.stringify(metadata))
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
} finally {
  db.close()
}
console.log(JSON.stringify({ changed, beforeDbSha256,
  afterDbSha256: sha(fs.readFileSync(dbFile)),
  beforeSourceHashes: beforeState.hashes, afterSourceHashes: afterState.hashes }))
