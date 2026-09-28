// Node 24 development-only BM25F scorer over Graphmory's already eligible notes.
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { splitMarkdownSections } from '../src/retrieval.mjs'

const FIELDS = ['path', 'title', 'metadata', 'headings', 'body']
const WEIGHTS = [1.5, 4, 3, 2.5, 1]
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'before', 'by', 'for', 'from', 'how', 'in', 'is', 'it',
  'of', 'on', 'or', 'should', 'that', 'the', 'this', 'to', 'was', 'what', 'when', 'where', 'which', 'who', 'with',
])
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
function queryTokens(query) {
  const tokens = String(query).toLocaleLowerCase('en').match(/[\p{L}\p{M}\p{N}_-]+/gu)
    ?.filter(token => token.length > 1) ?? []
  return [...new Set(tokens.flatMap(token => {
    const parts = token.split(/[-_]/u).filter(part => part.length > 1)
    return parts.length > 1 ? [token, ...parts] : [token]
  }).flatMap(token => token.length > 3 && token.endsWith('s')
      && !token.endsWith('ss') && !token.endsWith('us') && !token.endsWith('is')
    ? [token, token.slice(0, -1)] : [token]).filter(token => !STOPWORDS.has(token)))]
}

export function rankEligibleSqlite(dbFile, eligibleDocuments, query) {
  const db = new DatabaseSync(dbFile, { readOnly: true })
  try {
    const metadata = JSON.parse(db.prepare("SELECT value FROM meta WHERE key = 'experiment'").get().value)
    if (metadata.protocol !== 'sqlite-postings-prototype-v1') throw new Error('Wrong SQLite index protocol')
    for (const [name, digest] of Object.entries(metadata.codeHashes)) {
      if (sha(fs.readFileSync(new URL('../' + name, import.meta.url))) !== digest) throw new Error('Index implementation drift: ' + name)
    }
    const byId = new Map(eligibleDocuments.map(doc => [doc.id, doc]))
    for (const doc of eligibleDocuments) {
      if (metadata.sourceHashes[doc.id] !== sha(Buffer.from(doc.markdown, 'utf8')))
        throw new Error('Stale SQLite index source: ' + doc.id)
    }
    const sections = db.prepare(`SELECT doc_key,id,chunk_id,
      path_len,title_len,metadata_len,headings_len,body_len FROM sections ORDER BY doc_key`).all()
      .filter(row => byId.has(row.id))
    const sectionKeys = new Set(sections.map(row => row.doc_key))
    const sectionByKey = new Map(sections.map(row => [row.doc_key, row]))
    const sums = Object.fromEntries(FIELDS.map(field => [field, 0]))
    for (const section of sections) for (const field of FIELDS) sums[field] += section[`${field}_len`]
    const averages = Object.fromEntries(FIELDS.map(field => [field,
      sums[field] / Math.max(sections.length, 1)]))
    const tokens = queryTokens(query)
    const rows = db.prepare(`SELECT doc_key,path_tf,title_tf,metadata_tf,headings_tf,body_tf
      FROM postings WHERE token = ? ORDER BY doc_key`)
    const byToken = new Map()
    const candidates = new Map()
    for (const token of tokens) {
      const hits = rows.all(token).filter(row => sectionKeys.has(row.doc_key))
      byToken.set(token, new Map(hits.map(hit => [hit.doc_key, hit])))
      for (const hit of hits) if (!candidates.has(hit.doc_key)) candidates.set(hit.doc_key, sectionByKey.get(hit.doc_key))
    }
    const terms = tokens.flatMap(token => {
      const containing = byToken.get(token).size
      return containing ? [{ token,
        idf: Math.log(1 + (sections.length - containing + 0.5) / (containing + 0.5)) }] : []
    })
    const scored = [...candidates.values()].map(section => {
      const normalizations = FIELDS.map(field => 1 - 0.75
        + 0.75 * (section[`${field}_len`] / Math.max(averages[field], 1)))
      let score = 0
      for (const { token, idf } of terms) {
        const posting = byToken.get(token).get(section.doc_key)
        let weightedFrequency = 0
        for (const [index, field] of FIELDS.entries()) {
          const frequency = posting?.[`${field}_tf`] ?? 0
          if (frequency) weightedFrequency += WEIGHTS[index] * (frequency / normalizations[index])
        }
        score += idf * ((weightedFrequency * 2.2) / (weightedFrequency + 1.2))
      }
      const document = byId.get(section.id)
      const currentSection = splitMarkdownSections(document)
        .find(item => item.chunkId === section.chunk_id)
      if (!currentSection) throw new Error('Indexed section missing from current Markdown: ' + section.chunk_id)
      return { ...currentSection, score }
    }).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    const seen = new Set()
    return scored.filter(item => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  } finally {
    db.close()
  }
}
