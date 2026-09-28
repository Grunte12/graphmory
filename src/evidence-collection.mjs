import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { readSourceNotes } from './source-read.mjs'

const protocol = 'graphmory-original-collection-v1'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8')

function source(root, relative) {
  if (typeof relative !== 'string' || !relative.endsWith('.md') || relative.includes('\\')
    || relative.includes('\0') || path.posix.isAbsolute(relative)
    || relative.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Expected a corpus-relative Markdown path')
  }
  let current = root
  for (const [index, part] of relative.split('/').entries()) {
    current = path.join(current, part)
    const stat = fs.lstatSync(current)
    if (stat.isSymbolicLink() || (index < relative.split('/').length - 1 ? !stat.isDirectory() : !stat.isFile())) {
      throw new Error('Unsafe original source path')
    }
  }
  const note = readSourceNotes(root, [relative]).sources[0]
  const data = Buffer.from(note.markdown, 'utf8')
  if (hash(data) !== note.sha256) throw new Error('Original must be valid UTF-8')
  return data
}

function manifestId(state) {
  return hash(JSON.stringify([protocol, state.vaultRoot, state.scopeLabel, state.sources]))
}

function validate(state) {
  if (!state || state.protocol !== protocol || !Array.isArray(state.sources)
    || !Array.isArray(state.ledger) || state.snapshotId !== manifestId(state)
    || !Number.isSafeInteger(state.index) || state.index < 0 || state.index > state.sources.length
    || !Number.isSafeInteger(state.offset) || state.offset < 0) throw new Error('Invalid collection state')
  if (fs.realpathSync(state.vaultRoot) !== state.vaultRoot) throw new Error('Collection root changed')
  if (new Set(state.sources.map(item => item.path)).size !== state.sources.length) throw new Error('Duplicate collection source')
  const originals = state.sources.map(item => {
    const data = source(state.vaultRoot, item.path)
    if (data.length !== item.bytes || hash(data) !== item.sha256) throw new Error(`Original source changed: ${item.path}`)
    return data
  })
  if (state.index === originals.length ? state.offset !== 0 : state.offset > originals[state.index].length) {
    throw new Error('Invalid collection offset')
  }
  if (state.index < originals.length && state.offset < originals[state.index].length
    && (originals[state.index][state.offset] & 0xc0) === 0x80) throw new Error('Offset splits UTF-8 character')
  return originals
}

/** Explicit paths define the scope. Delivery does not certify semantic relevance. */
export function createEvidenceCollection({ vaultRoot, paths, scopeLabel }) {
  if (!Array.isArray(paths) || !paths.length || new Set(paths).size !== paths.length
    || typeof scopeLabel !== 'string' || !scopeLabel.trim()) throw new Error('A nonempty explicit source scope is required')
  const root = fs.realpathSync(vaultRoot)
  const sources = paths.map(relative => {
    const data = source(root, relative)
    if (!Buffer.from(data.toString('utf8')).equals(data)) throw new Error('Original must be valid UTF-8')
    return { path: relative, sha256: hash(data), bytes: data.length }
  })
  const state = { protocol, vaultRoot: root, scopeLabel, sources, index: 0, offset: 0, ledger: [] }
  state.snapshotId = manifestId(state)
  return state
}

/** Budget covers the exact JSON response, not just original text. */
export function collectEvidencePage(state, { maxBytes = 16000 } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 256) throw new Error('Invalid page byte budget')
  const originals = validate(state)
  let index = state.index, offset = state.offset
  const fragments = []
  const response = () => ({ protocol, snapshotId: state.snapshotId, fragments,
    hasMore: index < originals.length, deliveryComplete: index === originals.length,
    semanticCompleteness: 'unverified' })
  if (bytes(response()) > maxBytes) throw new Error('Page budget cannot hold collection envelope')
  while (index < originals.length) {
    const item = state.sources[index], data = originals[index], start = offset
    const make = end => ({ path: item.path, sourceSha256: item.sha256, byteStart: start,
      byteEnd: end, totalBytes: data.length,
      startLine: data.subarray(0, start).toString('utf8').split('\n').length,
      endLine: data.subarray(0, end).toString('utf8').split('\n').length,
      startsMidLine: start > 0 && data[start - 1] !== 10,
      endsMidLine: end < data.length && end > 0 && data[end - 1] !== 10,
      text: data.subarray(start, end).toString('utf8'), sourceComplete: end === data.length })
    const fits = end => { fragments.push(make(end)); const fits = bytes(response()) <= maxBytes; fragments.pop(); return fits }
    let low = start, high = data.length
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      if (fits(middle)) low = middle
      else high = middle - 1
    }
    let end = low
    while (end > start && end < data.length && (data[end] & 0xc0) === 0x80) end -= 1
    if (end === start && data.length !== start) {
      if (!fragments.length) throw new Error('Page budget cannot hold one source character')
      break
    }
    fragments.push(make(end))
    if (end === data.length) { index += 1; offset = 0 }
    else { offset = end; break }
  }
  const result = response()
  if (bytes(result) > maxBytes) throw new Error('Page budget invariant failed')
  state.index = index; state.offset = offset
  return result
}

/** Exact text identity only; this does not establish that the quote entails the fact. */
export function recordEvidenceSpan(state, { path: relative, sourceSha256, startLine, endLine, quote, fact }) {
  const originals = validate(state)
  const index = state.sources.findIndex(item => item.path === relative)
  if (index < 0 || sourceSha256 !== state.sources[index].sha256
    || !Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) || startLine < 1 || endLine < startLine
    || typeof quote !== 'string' || !quote.length || typeof fact !== 'string' || !fact.trim()) throw new Error('Invalid evidence span')
  if (index >= state.index) throw new Error('Source delivery is not complete')
  const lines = originals[index].toString('utf8').split('\n')
  if (endLine > lines.length || lines.slice(startLine - 1, endLine).join('\n') !== quote) throw new Error('Quote does not match original lines')
  const entry = { path: relative, sourceSha256, startLine, endLine, quote, fact, spanVerified: true, entailment: 'unverified' }
  if (!state.ledger.some(item => JSON.stringify(item) === JSON.stringify(entry))) state.ledger.push(entry)
  return entry
}

export function summarizeEvidenceCollection(state) {
  validate(state)
  return { protocol, snapshotId: state.snapshotId, scopeLabel: state.scopeLabel,
    sources: state.sources.length, deliveredSources: state.index,
    unreadSources: state.sources.slice(state.index).map(item => item.path),
    deliveryComplete: state.index === state.sources.length, semanticCompleteness: 'unverified', ledgerEntries: state.ledger.length }
}
