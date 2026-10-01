// Optional Node 24 SQLite postings cache for the existing focused BM25F ranker.
// This module is dynamically imported only after the caller checks node:sqlite support.
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { persistentIndexLocation } from './index-capability.mjs'
import { rank, splitMarkdownSections } from './retrieval.mjs'

const PROTOCOL = 'graphmory-persistent-postings-v1'
const MODEL = 'bm25f-focused-sections'
const FIELDS = ['path', 'title', 'metadata', 'headings', 'body']
const WEIGHTS = [1.5, 4, 3, 2.5, 1]
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'before', 'by', 'for', 'from', 'how', 'in', 'is', 'it',
  'of', 'on', 'or', 'should', 'that', 'the', 'this', 'to', 'was', 'what', 'when', 'where', 'which', 'who', 'with',
])
const WORD = /[\p{L}\p{M}\p{N}_-]+/gu
const sleepCell = new Int32Array(new SharedArrayBuffer(4))

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sourceHash = (document) => sha256(Buffer.from(String(document.markdown ?? ''), 'utf8'))
const documentKey = (id, ordinal) => `${id}\0${ordinal}`

function sourceHashesFor(documents) {
  const hashes = Object.create(null)
  for (const document of documents) {
    if (typeof document?.id !== 'string' || !document.id || Object.hasOwn(hashes, document.id)) {
      throw new Error('INDEX_INVALID_DOCUMENT_SET')
    }
    hashes[document.id] = sourceHash(document)
  }
  return hashes
}

function sameRecord(left, right) {
  const leftKeys = Object.keys(left ?? {}).sort()
  const rightKeys = Object.keys(right ?? {}).sort()
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && left[key] === right[key])
}

function currentRankerFingerprint() {
  const retrieval = fs.readFileSync(new URL('./retrieval.mjs', import.meta.url))
  const implementation = fs.readFileSync(new URL(import.meta.url))
  return sha256(Buffer.concat([retrieval, Buffer.from('\0'), implementation]))
}

function tokenizeFocusedQuery(query) {
  const tokens = String(query).toLocaleLowerCase('en').match(WORD)?.filter((token) => token.length > 1) ?? []
  const expanded = tokens.flatMap((token) => {
    const parts = token.split(/[-_]/u).filter((part) => part.length > 1)
    return parts.length > 1 ? [token, ...parts] : [token]
  }).flatMap((token) => token.length <= 3 || !token.endsWith('s') || token.endsWith('ss')
    || token.endsWith('us') || token.endsWith('is') ? [token] : [token, token.slice(0, -1)])
  return [...new Set(expanded.filter((token) => !STOPWORDS.has(token)))]
}

function ensurePrivateDirectory(vault, scope, cacheDirectory) {
  // Check before mkdir so an in-vault cache path is rejected without changing the vault.
  let dbFile = persistentIndexLocation(vault, scope, cacheDirectory)
  const requestedCache = path.resolve(cacheDirectory)
  fs.mkdirSync(requestedCache, { recursive: true, mode: 0o700 })
  dbFile = persistentIndexLocation(vault, scope, requestedCache)
  const directory = path.dirname(dbFile)
  if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) throw new Error('INDEX_UNSAFE_DIRECTORY')
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  fs.chmodSync(directory, 0o700)
  // Resolve once more after directory creation to catch a graphmory symlink into the vault.
  dbFile = persistentIndexLocation(vault, scope, requestedCache)
  if (path.dirname(dbFile) !== directory) throw new Error('INDEX_CACHE_PATH_CHANGED')
  return { dbFile, directory }
}

function secureDatabaseFiles(dbFile) {
  for (const file of [dbFile, `${dbFile}-journal`, `${dbFile}-wal`, `${dbFile}-shm`]) {
    try {
      const stat = fs.lstatSync(file)
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('INDEX_UNSAFE_FILE')
      fs.chmodSync(file, 0o600)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
}

function acquireLock(directory) {
  const lockFile = path.join(directory, '.index.lock')
  const deadline = Date.now() + 250
  while (true) {
    try {
      const fd = fs.openSync(lockFile, 'wx', 0o600)
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: Date.now() }))
      fs.fchmodSync(fd, 0o600)
      return () => {
        try { fs.closeSync(fd) } catch {}
        try { fs.unlinkSync(lockFile) } catch (error) { if (error.code !== 'ENOENT') throw error }
      }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      if (Date.now() >= deadline) throw new Error('INDEX_BUSY: cache update lock is held')
      removeDeadLock(lockFile)
      Atomics.wait(sleepCell, 0, 0, 40)
    }
  }
}

function removeDeadLock(lockFile) {
  try {
    const stat = fs.statSync(lockFile)
    if (Date.now() - stat.mtimeMs < 30_000) return
    let pid = 0
    try { pid = Number(JSON.parse(fs.readFileSync(lockFile, 'utf8')).pid) } catch {}
    if (Number.isInteger(pid) && pid > 0) {
      try { process.kill(pid, 0); return } catch (error) { if (error.code !== 'ESRCH') return }
    }
    fs.unlinkSync(lockFile)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

function isBusy(error) {
  return /(?:SQLITE_BUSY|database is locked|database is busy|INDEX_BUSY)/iu.test(String(error?.message ?? error))
}

function metadataFor({ vaultPath, scope, sourceHashes, rankerFingerprint }) {
  return {
    protocol: PROTOCOL,
    model: MODEL,
    vaultPath,
    scope,
    sourceHashes,
    rankerFingerprint,
  }
}

function validateMetadata(metadata, expected) {
  return metadata?.protocol === PROTOCOL
    && metadata.model === MODEL
    && metadata.vaultPath === expected.vaultPath
    && metadata.scope === expected.scope
    && metadata.rankerFingerprint === expected.rankerFingerprint
    && sameRecord(metadata.sourceHashes, expected.sourceHashes)
}

function createSchema(db) {
  db.exec(`CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE sections (
      doc_key INTEGER PRIMARY KEY,
      id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      chunk_id TEXT NOT NULL,
      path_len INTEGER NOT NULL,
      title_len INTEGER NOT NULL,
      metadata_len INTEGER NOT NULL,
      headings_len INTEGER NOT NULL,
      body_len INTEGER NOT NULL,
      UNIQUE(id, ordinal)
    );
    CREATE INDEX sections_by_id ON sections(id, ordinal);
    CREATE TABLE postings (
      token TEXT NOT NULL,
      doc_key INTEGER NOT NULL,
      path_tf INTEGER NOT NULL,
      title_tf INTEGER NOT NULL,
      metadata_tf INTEGER NOT NULL,
      headings_tf INTEGER NOT NULL,
      body_tf INTEGER NOT NULL,
      PRIMARY KEY(token, doc_key)
    ) WITHOUT ROWID;`)
}

function frequencyMap(tokens) {
  const counts = new Map()
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)
  return counts
}

function insertDocument(db, document, sectionList, nextKey) {
  const putSection = db.prepare('INSERT INTO sections VALUES (?,?,?,?,?,?,?,?,?)')
  const putPosting = db.prepare('INSERT INTO postings VALUES (?,?,?,?,?,?,?)')
  let key = nextKey
  for (const [ordinal, section] of sectionList.entries()) {
    const lengths = FIELDS.map((field) => section.fields?.[field]?.length ?? 0)
    putSection.run(key, document.id, ordinal, section.chunkId, ...lengths)
    const counts = FIELDS.map((field) => frequencyMap(section.fields?.[field] ?? []))
    const tokens = new Set(counts.flatMap((group) => [...group.keys()]))
    for (const token of tokens) putPosting.run(token, key, ...counts.map((group) => group.get(token) ?? 0))
    key += 1
  }
  return key
}

function writeMetadata(db, metadata) {
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
    .run('index', JSON.stringify(metadata))
}

function buildAtomic(dbFile, documents, sectionsById, metadata) {
  const temporary = `${dbFile}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`
  const fd = fs.openSync(temporary, 'wx', 0o600)
  fs.closeSync(fd)
  let db
  try {
    db = new DatabaseSync(temporary)
    createSchema(db)
    db.exec('BEGIN IMMEDIATE')
    try {
      let nextKey = 0
      for (const document of documents) {
        nextKey = insertDocument(db, document, sectionsById.get(document.id), nextKey)
      }
      writeMetadata(db, metadata)
      db.exec('COMMIT')
    } catch (error) {
      try { db.exec('ROLLBACK') } catch {}
      throw error
    }
    db.close()
    db = undefined
    secureDatabaseFiles(temporary)
    fs.renameSync(temporary, dbFile)
    secureDatabaseFiles(dbFile)
  } catch (error) {
    try { db?.close() } catch {}
    try { fs.unlinkSync(temporary) } catch (cleanupError) { if (cleanupError.code !== 'ENOENT') throw cleanupError }
    throw error
  }
}

function readMetadata(db) {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'index'").get()
  return row ? JSON.parse(row.value) : null
}

function incrementalUpdate(dbFile, documents, sectionsById, metadata) {
  const db = new DatabaseSync(dbFile)
  try {
    const previous = readMetadata(db)
    if (!previous || previous.protocol !== PROTOCOL || previous.model !== MODEL
      || previous.vaultPath !== metadata.vaultPath || previous.scope !== metadata.scope
      || previous.rankerFingerprint !== metadata.rankerFingerprint
      || !previous.sourceHashes || typeof previous.sourceHashes !== 'object') {
      return false
    }
    const oldHashes = previous.sourceHashes
    const nextHashes = metadata.sourceHashes
    const deleted = Object.keys(oldHashes).filter((id) => !Object.hasOwn(nextHashes, id))
    const added = Object.keys(nextHashes).filter((id) => !Object.hasOwn(oldHashes, id))
    const changed = Object.keys(nextHashes).filter((id) => Object.hasOwn(oldHashes, id)
      && oldHashes[id] !== nextHashes[id])
    if (!deleted.length && !added.length && !changed.length) return true

    const nextById = new Map(documents.map((document) => [document.id, document]))
    const dropPostings = db.prepare('DELETE FROM postings WHERE doc_key IN (SELECT doc_key FROM sections WHERE id = ?)')
    const dropSections = db.prepare('DELETE FROM sections WHERE id = ?')
    db.exec('BEGIN IMMEDIATE')
    let inTransaction = true
    try {
      for (const id of [...deleted, ...changed]) {
        dropPostings.run(id)
        dropSections.run(id)
      }
      let nextKey = Number(db.prepare('SELECT COALESCE(MAX(doc_key), -1) + 1 AS next_key FROM sections').get().next_key)
      for (const id of [...added, ...changed]) {
        nextKey = insertDocument(db, nextById.get(id), sectionsById.get(id), nextKey)
      }
      writeMetadata(db, metadata)
      db.exec('COMMIT')
      inTransaction = false
    } catch (error) {
      if (inTransaction) {
        try { db.exec('ROLLBACK') } catch {}
      }
      throw error
    }
    return true
  } finally {
    db.close()
    secureDatabaseFiles(dbFile)
  }
}

function ensureIndex(dbFile, documents, sectionsById, expected, beforeWrite) {
  const metadata = metadataFor(expected)
  let fileExists = false
  try {
    const stat = fs.lstatSync(dbFile)
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('INDEX_UNSAFE_FILE')
    fileExists = true
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (!fileExists) {
    beforeWrite?.()
    buildAtomic(dbFile, documents, sectionsById, metadata)
    return
  }

  try {
    beforeWrite?.()
    if (incrementalUpdate(dbFile, documents, sectionsById, metadata)) return
  } catch (error) {
    if (isBusy(error) || !/(?:not a database|database disk image is malformed|no such table|JSON)/iu.test(String(error.message))) throw error
    // A malformed or obsolete database is replaced from the current loaded Markdown.
  }
  beforeWrite?.()
  buildAtomic(dbFile, documents, sectionsById, metadata)
}

function rankFromIndex(dbFile, documents, sectionsById, expected, query) {
  const db = new DatabaseSync(dbFile, { readOnly: true })
  try {
    const metadata = readMetadata(db)
    if (!validateMetadata(metadata, expected)) throw new Error('INDEX_STALE: source snapshot changed')

    const orderById = new Map(documents.map((document, index) => [document.id, index]))
    const sectionRows = db.prepare('SELECT * FROM sections').all().filter(row => orderById.has(row.id))
    const sums = Object.fromEntries(FIELDS.map((field) => [field, 0]))
    for (const section of sectionRows) {
      for (const field of FIELDS) sums[field] += section[`${field}_len`]
    }
    const averages = Object.fromEntries(FIELDS.map((field) => [field,
      sums[field] / Math.max(sectionRows.length, 1)]))
    const queryTokens = tokenizeFocusedQuery(query)
    const rows = db.prepare(`SELECT s.doc_key, s.id, s.ordinal, s.path_len, s.title_len,
      s.metadata_len, s.headings_len, s.body_len,
      p.path_tf, p.title_tf, p.metadata_tf, p.headings_tf, p.body_tf
      FROM postings p JOIN sections s ON s.doc_key = p.doc_key WHERE p.token = ?`)
    const byToken = new Map()
    const candidates = new Map()
    for (const token of queryTokens) {
      const hits = rows.all(token).filter((hit) => orderById.has(hit.id))
        .sort((left, right) => orderById.get(left.id) - orderById.get(right.id) || left.ordinal - right.ordinal)
      byToken.set(token, new Map(hits.map((hit) => [hit.doc_key, hit])))
      for (const hit of hits) if (!candidates.has(hit.doc_key)) candidates.set(hit.doc_key, hit)
    }
    const terms = queryTokens.flatMap((token) => {
      const containing = byToken.get(token).size
      return containing ? [{ token,
        idf: Math.log(1 + (sectionRows.length - containing + 0.5) / (containing + 0.5)) }] : []
    })
    const scored = [...candidates.values()]
      .sort((left, right) => orderById.get(left.id) - orderById.get(right.id) || left.ordinal - right.ordinal)
      .map((row) => {
      const normalizations = FIELDS.map((field) => 1 - 0.75
        + 0.75 * (row[`${field}_len`] / Math.max(averages[field], 1)))
      let score = 0
      for (const { token, idf } of terms) {
        const posting = byToken.get(token).get(row.doc_key)
        let weightedFrequency = 0
        for (const [index, field] of FIELDS.entries()) {
          const frequency = posting?.[`${field}_tf`] ?? 0
          if (frequency) weightedFrequency += WEIGHTS[index] * (frequency / normalizations[index])
        }
        score += idf * ((weightedFrequency * 2.2) / (weightedFrequency + 1.2))
      }
      const section = sectionsById.get(row.id)[row.ordinal]
      if (!section || section.chunkId === undefined) throw new Error('INDEX_SECTION_MISMATCH')
      return { ...section, score }
    }).filter((section) => section.score > 0)
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    const seen = new Set()
    return scored.filter((section) => {
      if (seen.has(section.id)) return false
      seen.add(section.id)
      return true
    })
  } finally {
    db.close()
  }
}

/**
 * Build or transactionally refresh the opt-in persistent cache from Markdown
 * already loaded by the caller. The returned scorer is synchronous like rank().
 */
export function createPersistentRanker(vault, scope, cacheDirectory, vaultDocuments, { beforeWrite } = {}) {
  if (!Array.isArray(vaultDocuments)) throw new Error('INDEX_INVALID_DOCUMENT_SET')
  const canonicalVault = fs.realpathSync(vault)
  const normalizedScope = String(scope ?? '')
  const { dbFile, directory } = ensurePrivateDirectory(canonicalVault, normalizedScope, cacheDirectory)
  const sourceHashes = sourceHashesFor(vaultDocuments)
  const documentsById = new Map(vaultDocuments.map(document => [document.id, document]))
  const parsedSections = new Map()
  const sectionsById = { get(id) {
    if (!parsedSections.has(id)) parsedSections.set(id, splitMarkdownSections(documentsById.get(id)))
    return parsedSections.get(id)
  } }
  const expected = {
    vaultPath: canonicalVault,
    scope: normalizedScope,
    sourceHashes,
    rankerFingerprint: currentRankerFingerprint(),
  }
  const unlock = acquireLock(directory)
  try {
    ensureIndex(dbFile, vaultDocuments, sectionsById, expected, beforeWrite)
  } finally {
    unlock()
  }

  return (documents, query, method) => {
    if (method !== MODEL) return rank(documents, query, method)
    if (!Array.isArray(documents)) throw new Error('INDEX_INVALID_DOCUMENT_SET')
    const actualHashes = sourceHashesFor(documents)
    for (const [id, hash] of Object.entries(actualHashes)) {
      if (sourceHashes[id] !== hash) throw new Error('INDEX_STALE: rank input changed')
    }
    return rankFromIndex(dbFile, documents, sectionsById, expected, query)
  }
}
