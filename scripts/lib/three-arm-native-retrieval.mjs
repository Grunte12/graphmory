import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

export const THREE_ARM_IDS = Object.freeze([
  'graphmory-recall-loop',
  'basic-memory-hybrid',
  'native-file-search',
])

const digest = (value) => createHash('sha256').update(value).digest('hex')
const isSha256 = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value)
const integrityError = (message) => Object.assign(new Error(message), { integrityFailure: true })

export function safeRelativeMarkdownPath(raw) {
  if (typeof raw !== 'string' || !raw || raw.includes('\0') || raw.includes('\\') || raw.startsWith('/')
    || /^[A-Za-z]:/u.test(raw) || !raw.endsWith('.md')) {
    throw new Error(`Invalid corpus-relative Markdown path: ${String(raw)}`)
  }
  const parts = raw.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Invalid corpus-relative Markdown path: ${raw}`)
  }
  return raw
}

export function buildAttemptPlan(selectedIds, repeats = 3) {
  if (!Array.isArray(selectedIds) || !selectedIds.length || selectedIds.some((id) => typeof id !== 'string' || !id)
    || new Set(selectedIds).size !== selectedIds.length || !Number.isInteger(repeats) || repeats < 1) {
    throw new Error('Invalid frozen cases or repeat count')
  }
  const planned = []
  selectedIds.forEach((caseId, caseIndex) => {
    for (let repeat = 1; repeat <= repeats; repeat += 1) {
      const first = (caseIndex + repeat - 1) % THREE_ARM_IDS.length
      for (let sequence = 1; sequence <= THREE_ARM_IDS.length; sequence += 1) {
        planned.push({ caseId, repeat, arm: THREE_ARM_IDS[(first + sequence - 1) % THREE_ARM_IDS.length], sequence })
      }
    }
  })
  return planned
}

function pathCompare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

export async function collectAllPages(fetchPage, validPaths, pageSize = 10) {
  if (typeof fetchPage !== 'function' || !(validPaths instanceof Set || Array.isArray(validPaths))
    || !Number.isInteger(pageSize) || pageSize < 1) throw new Error('Invalid pagination inputs')
  const allowed = validPaths instanceof Set ? validPaths : new Set(validPaths)
  if ([...allowed].some((item) => typeof item !== 'string' || safeRelativeMarkdownPath(item) !== item)) {
    throw new Error('Allowed paths must be valid corpus-relative Markdown paths')
  }

  const candidatePaths = []
  const pages = []
  const seen = new Set()
  let offset = 0
  let expectedSnapshotId
  let expectedCandidateCount
  while (true) {
    const page = await fetchPage({ offset, pageSize, expectedSnapshotId })
    if (!page || !Number.isInteger(page.offset) || page.offset !== offset || !Array.isArray(page.results)
      || !Number.isInteger(page.candidateCount) || page.candidateCount < 0
      || typeof page.snapshotId !== 'string' || !/^[0-9a-f]{64}$/u.test(page.snapshotId)
      || typeof page.hasMore !== 'boolean') throw integrityError(`Invalid page response at offset ${offset}`)
    if (expectedSnapshotId === undefined) {
      expectedSnapshotId = page.snapshotId
      expectedCandidateCount = page.candidateCount
    } else if (page.snapshotId !== expectedSnapshotId || page.candidateCount !== expectedCandidateCount) {
      throw integrityError('Candidate snapshot changed between pages')
    }

    const currentPaths = page.results.map((item) => {
      let sourcePath
      try { sourcePath = safeRelativeMarkdownPath(item?.path) } catch {
        throw integrityError(`Invalid candidate path at offset ${offset}`)
      }
      if (!allowed.has(sourcePath)) throw integrityError(`Unexpected candidate path: ${sourcePath}`)
      if (seen.has(sourcePath)) throw integrityError(`Duplicate candidate path: ${sourcePath}`)
      seen.add(sourcePath)
      return sourcePath
    })
    if (currentPaths.some((sourcePath, index) => index > 0 && pathCompare(currentPaths[index - 1], sourcePath) > 0)) {
      throw integrityError('Candidate paths are not in stable ascending POSIX order')
    }
    if (candidatePaths.length && currentPaths.length && pathCompare(candidatePaths.at(-1), currentPaths[0]) > 0) {
      throw integrityError('Candidate path order changed across pages')
    }

    const nextOffset = offset + currentPaths.length
    if (nextOffset > expectedCandidateCount || (page.hasMore && (currentPaths.length === 0 || page.nextOffset !== nextOffset))
      || (!page.hasMore && (page.nextOffset !== null && page.nextOffset !== undefined || nextOffset !== expectedCandidateCount))) {
      throw integrityError(`Invalid or incomplete continuation at offset ${offset}`)
    }
    candidatePaths.push(...currentPaths)
    pages.push({
      offset,
      paths: currentPaths,
      nextOffset: page.nextOffset ?? null,
      hasMore: page.hasMore,
      nativeSeconds: Number(page.nativeSeconds ?? 0),
      nativeOutputBytes: Number(page.nativeOutputBytes ?? 0),
      nativeCalls: Array.isArray(page.nativeCalls) ? page.nativeCalls : [],
    })
    if (!page.hasMore) break
    offset = page.nextOffset
  }
  if (candidatePaths.length !== expectedCandidateCount) throw integrityError('Candidate pagination ended before the frozen count')
  return { candidatePaths, candidateCount: expectedCandidateCount, snapshotId: expectedSnapshotId, pages }
}

export function verifyOriginalBodies(corpusDir, expectedHashes) {
  const entries = expectedHashes instanceof Map ? [...expectedHashes] : Object.entries(expectedHashes ?? {})
  const root = fs.realpathSync(corpusDir)
  const markdownPaths = []
  const walk = (directory, relative = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      const child = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isSymbolicLink()) throw new Error(`Symlink found in original corpus: ${child}`)
      if (entry.isDirectory()) walk(absolute, child)
      else if (entry.isFile() && entry.name.endsWith('.md')) markdownPaths.push(child)
    }
  }
  walk(root)
  const expectedPaths = entries.map(([relativePath]) => safeRelativeMarkdownPath(relativePath)).sort()
  markdownPaths.sort()
  if (markdownPaths.length !== expectedPaths.length || markdownPaths.some((item, index) => item !== expectedPaths[index])) {
    throw new Error('Original corpus Markdown file set differs from the frozen source manifest')
  }
  const actualHashes = {}
  for (const [rawPath, expectedHash] of entries) {
    const relativePath = safeRelativeMarkdownPath(rawPath)
    if (!isSha256(expectedHash)) throw new Error(`Invalid expected source hash for ${relativePath}`)
    let current = root
    const parts = relativePath.split('/')
    for (let index = 0; index < parts.length; index += 1) {
      current = path.join(current, parts[index])
      const stat = fs.lstatSync(current)
      if (stat.isSymbolicLink() || (index < parts.length - 1 && !stat.isDirectory())
        || (index === parts.length - 1 && !stat.isFile())) throw new Error(`Unsafe original path: ${relativePath}`)
    }
    const actualHash = digest(fs.readFileSync(current))
    if (actualHash !== expectedHash) throw new Error(`Original body hash mismatch: ${relativePath}`)
    actualHashes[relativePath] = actualHash
  }
  return actualHashes
}

export function scoreEvidence(rankedPaths, evidenceGroups, answerable = true) {
  if (!Array.isArray(rankedPaths) || !Array.isArray(evidenceGroups)
    || rankedPaths.some((sourcePath) => safeRelativeMarkdownPath(sourcePath) !== sourcePath)
    || new Set(rankedPaths).size !== rankedPaths.length) throw new Error('Invalid ranked paths or evidence groups')
  if (!answerable) return {
    candidateCount: rankedPaths.length,
    completeAt3: null,
    completeAt10: null,
    completeAll: null,
    recallAt3: null,
    recallAt10: null,
    recallAll: null,
    firstMatchRanks: null,
    evidenceReachable: null,
  }
  if (!evidenceGroups.length || evidenceGroups.some((group) => !Array.isArray(group) || !group.length
    || group.some((sourcePath) => safeRelativeMarkdownPath(sourcePath) !== sourcePath))) {
    throw new Error('Answerable case requires valid evidence groups')
  }
  const firstMatchRanks = evidenceGroups.map((group) => {
    const alternatives = new Set(group)
    const index = rankedPaths.findIndex((sourcePath) => alternatives.has(sourcePath))
    return index < 0 ? null : index + 1
  })
  const recallAt = (limit) => firstMatchRanks.filter((rank) => rank !== null && (limit === Infinity || rank <= limit)).length / evidenceGroups.length
  const recallAt3 = recallAt(3)
  const recallAt10 = recallAt(10)
  const recallAll = recallAt(Infinity)
  return {
    candidateCount: rankedPaths.length,
    completeAt3: recallAt3 === 1,
    completeAt10: recallAt10 === 1,
    completeAll: recallAll === 1,
    recallAt3,
    recallAt10,
    recallAll,
    firstMatchRanks,
    evidenceReachable: recallAll === 1,
  }
}

function attemptKey(attempt) {
  if (!attempt || typeof attempt.caseId !== 'string' || !Number.isInteger(attempt.repeat)
    || typeof attempt.arm !== 'string' || !Number.isInteger(attempt.sequence)) throw new Error('Invalid planned or recorded attempt')
  return JSON.stringify([attempt.caseId, attempt.repeat, attempt.arm, attempt.sequence])
}

export function assertAttemptAccounting(planned, recorded) {
  if (!Array.isArray(planned) || !Array.isArray(recorded)) throw new Error('Attempt accounting needs arrays')
  const plannedKeys = planned.map(attemptKey)
  const recordedKeys = recorded.map(attemptKey)
  if (new Set(plannedKeys).size !== plannedKeys.length || new Set(recordedKeys).size !== recordedKeys.length
    || plannedKeys.length !== recordedKeys.length || plannedKeys.some((key, index) => key !== recordedKeys[index])) {
    throw new Error('Recorded attempts do not exactly match the frozen plan')
  }
  return true
}
