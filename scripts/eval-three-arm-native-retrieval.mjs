#!/usr/bin/env node
// Frozen, offline retrieval diagnostic. No answer model is called.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { prepareCase, hash } from './lib/longmemeval.mjs'
import {
  THREE_ARM_IDS, assertAttemptAccounting, buildAttemptPlan, collectAllPages,
  safeRelativeMarkdownPath, scoreEvidence, verifyOriginalBodies,
} from './lib/three-arm-native-retrieval.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const input = option('--input'), manifestOut = option('--manifest-out'), out = option('--out')
const limit = Number(option('--limit') ?? 14)
if (!input || !manifestOut || !out || !Number.isInteger(limit) || limit < 1 || limit > 14) {
  throw new Error('Use --input <pinned cleaned-S dataset> --manifest-out </private/tmp pre-run manifest> --out </private/tmp report> [--limit 1..14]')
}

const frozenDatasetSha256 = 'd6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442'
const frozenIds = Object.freeze([
  '09ba9854_abs', 'a96c20ee_abs', '50635ada', '945e3d21', '67e0d0f2', 'gpt4_d84a3211', 'a40e080f',
  'c7cf7dfd', '07b6f563', 'caf03d32', 'd52b4f67', '29f2956b', 'gpt4_6ed717ea', 'gpt4_cd90e484',
])
const pilotFile = path.join(root, 'eval/longmemeval/pilot.json')
const cli = path.join(root, 'scripts/brain-sync.mjs')
const baseline = path.join(root, 'scripts/native_file_baseline.py')
const basicRoot = path.join(root, 'tmp/competitors/basic-memory')
const bm = path.join(basicRoot, 'venv/bin/bm')
const python = resolveOnPath('python3')
const rg = resolveOnPath('rg')
const scriptFiles = [
  'scripts/eval-three-arm-native-retrieval.mjs', 'scripts/lib/three-arm-native-retrieval.mjs',
  'scripts/lib/longmemeval.mjs', 'scripts/brain-sync.mjs', 'scripts/native_file_baseline.py',
  'src/memory-recall.mjs', 'src/retrieval.mjs', 'src/graph-navigation.mjs', 'src/adaptive-recall.mjs',
  'src/brain-sync.mjs', 'eval/longmemeval/pilot.json',
]
const privateTmp = fs.realpathSync('/private/tmp')
function privateOutputPath(raw) {
  const absolute = path.resolve(raw)
  if (!absolute.startsWith(`${privateTmp}${path.sep}`)) throw new Error(`Sensitive report files must be under ${privateTmp}`)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  const realParent = fs.realpathSync(path.dirname(absolute))
  if (realParent !== privateTmp && !realParent.startsWith(`${privateTmp}${path.sep}`)) throw new Error('Output path resolves outside private temporary storage')
  return path.join(realParent, path.basename(absolute))
}
const manifestPath = privateOutputPath(manifestOut), outPath = privateOutputPath(out), checkpoint = `${outPath}.checkpoint.json`
if (manifestPath === outPath || manifestPath === checkpoint || outPath === checkpoint
  || fs.existsSync(manifestPath) || fs.existsSync(outPath) || fs.existsSync(checkpoint)) {
  throw new Error('Refusing existing or overlapping manifest/report/checkpoint paths')
}

function resolveOnPath(name) {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    const candidate = path.resolve(dir || '.', name)
    try { if (fs.statSync(candidate).isFile() && (fs.statSync(candidate).mode & 0o111)) return candidate } catch {}
  }
  throw new Error(`Executable not found on PATH: ${name}`)
}
function measured(executable, commandArgs, { cwd = root, env = process.env, timeout = 120000 } = {}) {
  const start = performance.now()
  const child = spawnSync(executable, commandArgs, { cwd, env, encoding: null, shell: false, timeout, maxBuffer: 64 * 1024 * 1024 })
  const wallMs = performance.now() - start
  const stdout = child.stdout ?? Buffer.alloc(0), stderr = child.stderr ?? Buffer.alloc(0)
  const invocation = {
    executable, argv: commandArgs, status: child.status, signal: child.signal,
    error: child.error?.message ?? null, wallMs, stdoutBytes: stdout.length,
    stdoutBase64: stdout.toString('base64'), stderrBytes: stderr.length, stderrBase64: stderr.toString('base64'),
  }
  return { invocation, stdout, stderr, ok: !child.error && child.status === 0 }
}
function requiredRun(executable, commandArgs, options) {
  const run = measured(executable, commandArgs, options)
  if (!run.ok) {
    const error = new Error(`${path.basename(executable)} exited with ${run.invocation.status ?? run.invocation.error ?? 'unknown status'}`)
    error.invocation = run.invocation
    throw error
  }
  return run
}
function readVersion(executable, commandArgs, options) {
  const run = requiredRun(executable, commandArgs, options)
  const text = Buffer.concat([run.stdout, run.stderr]).toString('utf8').trim()
  return { text, invocation: run.invocation }
}
function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n')
  fs.renameSync(tmp, file)
}
function hashCorpus(corpus, expected) {
  let values
  try { values = verifyOriginalBodies(corpus, expected) }
  catch (error) { throw new IntegrityError(error.message) }
  return { hashes: values, aggregateSha256: hash(JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)))) }
}
function parseJson(buffer, label) {
  try { return JSON.parse(buffer.toString('utf8')) } catch (error) { throw new Error(`${label} returned invalid JSON: ${error.message}`) }
}
function validRankedPaths(paths, allowed, arm) {
  const seen = new Set()
  for (const raw of paths) {
    let sourcePath
    try { sourcePath = safeRelativeMarkdownPath(raw) } catch { throw new IntegrityError(`Invalid path from ${arm}: ${String(raw)}`) }
    if (!allowed.has(sourcePath)) throw new IntegrityError(`Unexpected path from ${arm}: ${sourcePath}`)
    if (seen.has(sourcePath)) throw new IntegrityError(`Duplicate path from ${arm}: ${sourcePath}`)
    seen.add(sourcePath)
  }
  return paths
}
class IntegrityError extends Error { constructor(message) { super(message); this.fatalIntegrity = true } }

const pilotBytes = fs.readFileSync(pilotFile)
const pilot = JSON.parse(pilotBytes)
const datasetBytes = fs.readFileSync(input)
if (hash(datasetBytes) !== frozenDatasetSha256 || pilot.sourceSha256 !== frozenDatasetSha256
  || JSON.stringify(pilot.selectedIds) !== JSON.stringify(frozenIds)) throw new Error('Pinned cleaned-S dataset hash or fourteen pilot IDs mismatch')
if (!fs.existsSync(bm)) throw new Error(`Pinned Basic Memory CLI missing: ${bm}`)
const dataset = JSON.parse(datasetBytes)
const cases = new Map(dataset.map((item) => [item.question_id, item]))
if (new Set(dataset.map((item) => item.question_id)).size !== dataset.length || frozenIds.some((id) => !cases.has(id))) {
  throw new Error('Dataset IDs are duplicate or a frozen pilot ID is missing')
}
const selectedIds = frozenIds.slice(0, limit)
const planned = buildAttemptPlan(selectedIds, 3)
const basicVersion = readVersion(bm, ['--version'])
if (!/0\.23\.2/u.test(basicVersion.text)) throw new Error(`Basic Memory version mismatch: ${basicVersion.text}`)
const rgVersion = readVersion(rg, ['--version'])
const pythonVersion = readVersion(python, ['--version'])
const cacheRoot = path.join(basicRoot, 'huggingface-cache')
const fastembedCacheRoot = path.join(privateTmp, 'graphmory-basic-fastembed-cache')
function cacheInventory(dir) {
  const entries = []
  const walk = (current) => {
    if (!fs.existsSync(current)) return
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = path.join(current, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) walk(target)
      else if (entry.isFile()) { const stat = fs.statSync(target); entries.push([path.relative(dir, target), stat.size, hash(fs.readFileSync(target))]) }
    }
  }
  walk(dir)
  return { present: fs.existsSync(dir), fileCount: entries.length, bytes: entries.reduce((sum, row) => sum + row[1], 0), inventorySha256: hash(JSON.stringify(entries)) }
}
const hashes = Object.fromEntries(scriptFiles.map((relative) => [relative, hash(fs.readFileSync(path.join(root, relative)))]))
const planManifest = {
  protocol: 'longmemeval-three-arm-native-retrieval-v1', frozenBeforeEvaluation: true,
  createdAt: new Date().toISOString(), runId: `${new Date().toISOString().replace(/[:.]/gu, '-')}-${process.pid}`,
  datasetSha256: hash(datasetBytes), expectedDatasetSha256: frozenDatasetSha256,
  pilotManifestSha256: hash(pilotBytes), selectedIds, fullFrozenIds: frozenIds,
  idsManifestFile: 'eval/longmemeval/pilot.json', limit, arms: THREE_ARM_IDS, repeats: 3, plannedAttempts: planned,
  treatment: {
    query: 'exact original question only', graphmory: 'recall-loop --agent --k 10',
    basicMemory: '0.23.2 native reindex --search --embeddings; tool search-notes --hybrid --page-size 12',
    nativeFile: 'native_file_baseline.py search; ripgrep literal-token-v1; page size 10; stable snapshot; all pages',
    renderedNotes: 'same chronological original Markdown bodies; isolated Graphmory, Basic Memory, and ordinary-file copies',
    noModels: true, goldSentToTools: false, repeats: 3,
  },
  scriptHashes: hashes,
  executables: {
    node: { path: process.execPath, version: process.version }, python: { path: python, version: pythonVersion.text },
    ripgrep: { path: rg, version: rgVersion.text }, basicMemory: { path: bm, version: basicVersion.text, versionInvocation: basicVersion.invocation },
  },
  embeddingCache: { path: fastembedCacheRoot, ...cacheInventory(fastembedCacheRoot), offline: true,
    huggingFacePath: cacheRoot, huggingFaceInventory: cacheInventory(cacheRoot) },
  environment: { platform: process.platform, arch: process.arch, node: process.version, pid: process.pid },
}
if (new Set([manifestPath, outPath, checkpoint]).size !== 3) throw new Error('Manifest and output paths must be distinct')
atomicWrite(manifestPath, planManifest)

const report = {
  protocol: planManifest.protocol, manifestPath, manifestSha256: hash(fs.readFileSync(manifestPath)),
  datasetSha256: planManifest.datasetSha256, selectedIds, arms: THREE_ARM_IDS, repeats: 3,
  attemptPlan: planned, attempts: [], cases: [], status: 'running', stopReason: null,
  limitations: ['Exposed development cases only; retrieval and delivery diagnostic, not answer-quality evaluation',
    'No answer model or personal vault is used; abstention cases count for operational accounting only',
    'Graphmory and Basic Memory return bounded candidate lists; only native-file search enumerates its full candidate set'],
}
const saveCheckpoint = () => atomicWrite(checkpoint, report)
saveCheckpoint()
const runDir = path.join(privateTmp, 'graphmory-three-arm-native-retrieval/runs', planManifest.runId)
const homeBase = path.join(runDir, 'home')
fs.mkdirSync(homeBase, { recursive: true })
const future = [...planned]
let stop = false
for (const id of selectedIds) {
  const item = cases.get(id)
  const prepared = prepareCase(item)
  const sourceHashes = Object.fromEntries(prepared.documents.map((doc) => [doc.path, hash(Buffer.from(doc.markdown, 'utf8'))]))
  const allowed = new Set(prepared.documents.map((doc) => doc.path))
  const key = createHash('sha256').update(id).digest('hex').slice(0, 16)
  const caseRoot = path.join(runDir, key)
  const graphNotes = path.join(caseRoot, 'graph-notes')
  const nativeNotes = path.join(caseRoot, 'basic-notes')
  const fileNotes = path.join(caseRoot, 'file-notes')
  const basicState = path.join(caseRoot, 'basic-state')
  const caseRow = {
    id, category: prepared.labels.category, answerable: !prepared.labels.abstention,
    querySha256: hash(prepared.query.text), sessionCount: prepared.documents.length,
    evidenceGroupCount: prepared.labels.abstention ? null : prepared.labels.evidence.length,
    sourceBodyHashes: sourceHashes, expectedCorpusAggregateSha256: hash(JSON.stringify(Object.entries(sourceHashes).sort(([a], [b]) => a.localeCompare(b)))),
    nativeIndex: null, sourceHashChecks: [], setupFailure: null, integrityFailure: null,
  }
  report.cases.push(caseRow)
  const caseAttempts = planned.filter((attempt) => attempt.caseId === id)
  if (stop) {
    report.attempts.push(...caseAttempts.map((attempt) => ({ ...attempt, status: 'not-run', failure: report.stopReason })))
    saveCheckpoint()
    continue
  }
  let basicEnv = null
  try {
    if (fs.existsSync(caseRoot)) throw new Error(`Case directory exists: ${caseRoot}`)
    for (const directory of [graphNotes, nativeNotes, fileNotes, basicState, path.join(homeBase, key)]) fs.mkdirSync(directory, { recursive: true })
    for (const doc of prepared.documents) for (const vault of [graphNotes, nativeNotes, fileNotes]) {
      const target = path.join(vault, doc.path)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, Buffer.from(doc.markdown, 'utf8'))
    }
    const beforeStarted = performance.now()
    const graphBefore = hashCorpus(graphNotes, sourceHashes)
    const basicBefore = hashCorpus(nativeNotes, sourceHashes)
    const fileBefore = hashCorpus(fileNotes, sourceHashes)
    caseRow.sourceHashChecks.push({ phase: 'before-index-and-search', elapsedSeconds: (performance.now() - beforeStarted) / 1000,
      graphAggregateSha256: graphBefore.aggregateSha256, basicOriginalAggregateSha256: basicBefore.aggregateSha256,
      fileAggregateSha256: fileBefore.aggregateSha256 })
    const isolatedHome = path.join(homeBase, key)
    basicEnv = {
      ...process.env, HOME: isolatedHome, XDG_CONFIG_HOME: path.join(isolatedHome, '.config'),
      HF_HOME: cacheRoot, HF_XET_CACHE: path.join(cacheRoot, 'xet'), FASTEMBED_CACHE_PATH: fastembedCacheRoot,
      HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1',
      BASIC_MEMORY_CONFIG_DIR: basicState, BASIC_MEMORY_HOME: nativeNotes, BASIC_MEMORY_AUTO_UPDATE: 'false',
      BASIC_MEMORY_SEMANTIC_SEARCH_ENABLED: 'true', BASIC_MEMORY_DEFAULT_SEARCH_TYPE: 'hybrid', BASIC_MEMORY_RERANKER_ENABLED: 'false',
    }
    const add = measured(bm, ['project', 'add', 'pilot', nativeNotes, '--local', '--default'], { env: basicEnv })
    const reindex = measured(bm, ['reindex', '--search', '--embeddings', '--project', 'pilot'], { env: basicEnv })
    caseRow.nativeIndex = { projectAdd: add.invocation, reindex: reindex.invocation, embeddedEntities: null, skippedEntities: null,
      embeddingErrors: null, observedNotes: null, indexedNotes: null, model: null, indexedBodyHashes: {}, changedIndexedBodies: {} }
    let indexFailure = null
    if (!add.ok || !reindex.ok) indexFailure = `Basic Memory ingestion command failed (project-add=${add.invocation.status}, reindex=${reindex.invocation.status})`
    else {
      const text = reindex.stdout.toString('utf8')
      const indexMatch = text.match(/project index: (\d+) observed, (\d+) indexed/u)
      const vector = text.match(/Embeddings complete\s*\(index=([^,]+),\s*model=([^)]*)\):\s*(\d+)\s+entities\s+embedded,\s*(\d+)\s+skipped,\s*(\d+)\s+errors/u)
      if (indexMatch) { caseRow.nativeIndex.observedNotes = Number(indexMatch[1]); caseRow.nativeIndex.indexedNotes = Number(indexMatch[2]) }
      if (vector) {
        caseRow.nativeIndex.indexName = vector[1]; caseRow.nativeIndex.model = vector[2]
        caseRow.nativeIndex.embeddedEntities = Number(vector[3]); caseRow.nativeIndex.skippedEntities = Number(vector[4]); caseRow.nativeIndex.embeddingErrors = Number(vector[5])
      }
      if (!indexMatch || !vector || Number(indexMatch[1]) !== prepared.documents.length || Number(indexMatch[2]) !== prepared.documents.length
        || Number(vector[3]) !== prepared.documents.length || Number(vector[4]) !== 0 || Number(vector[5]) !== 0) {
        indexFailure = 'Native Basic Memory index incomplete: every note must be indexed and embedded, with zero skips and errors'
      }
    }
    const indexedHashes = {}
    for (const doc of prepared.documents) {
      const digest = hash(fs.readFileSync(path.join(nativeNotes, doc.path)))
      indexedHashes[doc.path] = digest
      if (digest !== sourceHashes[doc.path]) caseRow.nativeIndex.changedIndexedBodies[doc.path] = { originalSha256: sourceHashes[doc.path], indexedSha256: digest }
    }
    caseRow.nativeIndex.indexedBodyHashes = indexedHashes
    if (indexFailure) caseRow.nativeIndex.failure = indexFailure
  } catch (error) {
    caseRow.setupFailure = error.message
    caseRow.integrityFailure = error.fatalIntegrity ? error.message : null
    stop = true
    report.stopReason = `Case setup stopped: ${error.message}`
  }

  if (!caseRow.setupFailure && !caseRow.integrityFailure) {
    for (const identity of caseAttempts) {
      const attempt = { ...identity, status: 'running', querySha256: caseRow.querySha256, result: null, failure: null }
      report.attempts.push(attempt)
      if (stop) {
        attempt.status = 'not-run'; attempt.failure = report.stopReason; saveCheckpoint(); continue
      }
      const now = Date.now()
      const processRecords = []
      try {
        let paths, metrics = {}
        if (identity.arm === 'graphmory-recall-loop') {
          const run = measured(process.execPath, [cli, 'recall-loop', '--vault', graphNotes, '--query', prepared.query.text, '--k', '10', '--agent'], { timeout: 60000 })
          processRecords.push(run.invocation)
          if (!run.ok) throw Object.assign(new Error(`Graphmory CLI failed: ${run.invocation.status ?? run.invocation.error}`), { invocation: run.invocation })
          const json = parseJson(run.stdout, identity.arm)
          if (!Array.isArray(json.results)) throw new Error('Graphmory result shape is not recognized')
          paths = validRankedPaths(json.results.map((entry) => entry.path), allowed, identity.arm)
          metrics = { searchWallMs: run.invocation.wallMs, processCount: 1, stdoutBytes: run.invocation.stdoutBytes,
            exactStdoutBase64: run.invocation.stdoutBase64 }
        } else if (identity.arm === 'basic-memory-hybrid') {
          const run = measured(bm, ['tool', 'search-notes', prepared.query.text, '--project', 'pilot', '--local', '--page-size', '12', '--json', '--hybrid'], { env: basicEnv })
          processRecords.push(run.invocation)
          if (!run.ok) throw Object.assign(new Error(`Basic Memory search failed: ${run.invocation.status ?? run.invocation.error}`), { invocation: run.invocation })
          const json = parseJson(run.stdout, identity.arm)
          const values = Array.isArray(json) ? json : ['results', 'items', 'notes', 'data'].map((key) => json?.[key]).find(Array.isArray)
          if (!values) throw new Error('Basic Memory result shape is not recognized')
          paths = validRankedPaths(values.map((entry) => entry.file_path), allowed, identity.arm)
          metrics = { searchWallMs: run.invocation.wallMs, processCount: 1, stdoutBytes: run.invocation.stdoutBytes,
            exactStdoutBase64: run.invocation.stdoutBase64 }
          if (caseRow.nativeIndex?.failure) throw new Error(caseRow.nativeIndex.failure)
        } else {
          const pageRuns = []
          const all = await collectAllPages(async ({ offset, pageSize, expectedSnapshotId }) => {
            const argv = [baseline, 'search', '--corpus', fileNotes, '--query', prepared.query.text,
              '--offset', String(offset), '--page-size', String(pageSize), '--capture-native-stdout']
            if (expectedSnapshotId) argv.push('--expected-snapshot', expectedSnapshotId)
            const run = measured(python, argv, { timeout: 120000 })
            pageRuns.push(run)
            processRecords.push(run.invocation)
            const json = parseJson(run.stdout, 'native-file helper')
            if (!run.ok || json.error) {
              const error = new Error(`Native-file page failed at offset ${offset}: ${json.error?.message ?? run.invocation.status}`)
              error.nativeCalls = json.nativeCalls ?? []
              if (['snapshot-changed', 'unsafe-candidate-path', 'duplicate-candidate-path', 'invalid-offset', 'pagination-no-progress']
                .includes(json.error?.code)) error.integrityFailure = true
              throw error
            }
            return json
          }, allowed, 10)
          paths = all.candidatePaths
          const first = pageRuns[0]?.invocation
          const tailRuns = pageRuns.slice(1).map((run) => run.invocation)
          const helperCalls = all.pages.flatMap((page) => page.nativeCalls)
          metrics = {
            candidateCount: all.candidateCount, snapshotId: all.snapshotId, pageCount: all.pages.length,
            firstPage: first ? { wallMs: first.wallMs, stdoutBytes: first.stdoutBytes, exactStdoutBase64: first.stdoutBase64,
              nativeSeconds: all.pages[0].nativeSeconds, ripgrepCalls: all.pages[0].nativeCalls.length,
              ripgrepStdoutBytes: all.pages[0].nativeCalls.reduce((sum, call) => sum + Number(call.stdoutBytes ?? 0), 0) } : null,
            continuationAudit: { pageCount: Math.max(0, all.pages.length - 1), wallMs: tailRuns.reduce((sum, run) => sum + run.wallMs, 0),
              helperStdoutBytes: tailRuns.reduce((sum, run) => sum + run.stdoutBytes, 0),
              nativeSeconds: all.pages.slice(1).reduce((sum, page) => sum + page.nativeSeconds, 0),
              ripgrepCalls: all.pages.slice(1).reduce((sum, page) => sum + page.nativeCalls.length, 0),
              ripgrepStdoutBytes: all.pages.slice(1).flatMap((page) => page.nativeCalls).reduce((sum, call) => sum + Number(call.stdoutBytes ?? 0), 0) },
            totalSearchWallMs: processRecords.reduce((sum, call) => sum + call.wallMs, 0),
            helperNativeSeconds: all.pages.reduce((sum, page) => sum + page.nativeSeconds, 0),
            helperProcessCount: processRecords.length, ripgrepProcessCount: helperCalls.length,
            helperStdoutBytes: processRecords.reduce((sum, call) => sum + call.stdoutBytes, 0),
            ripgrepStdoutBytes: helperCalls.reduce((sum, call) => sum + Number(call.stdoutBytes ?? 0), 0),
            pageNativeCalls: helperCalls,
            exactPageStdoutBase64: processRecords.map((call) => call.stdoutBase64),
          }
        }
        const score = scoreEvidence(paths, prepared.labels.evidence, !prepared.labels.abstention)
        const common = {
          candidateCount: paths.length, pageCount: identity.arm === 'native-file-search' ? metrics.pageCount : 1,
          candidatePaths: paths, searchWallMs: metrics.searchWallMs ?? metrics.totalSearchWallMs,
          searchProcessCount: metrics.processCount ?? metrics.helperProcessCount,
          sourcePathAudit: { duplicatePaths: 0, unexpectedPaths: 0, missingPaths: 0 },
          completeEvidenceAt3: score.completeAt3, recallAt3: score.recallAt3,
          completeEvidenceAt10: score.completeAt10, recallAt10: score.recallAt10,
          firstMatchingRankByEvidenceGroup: score.firstMatchRanks,
        }
        if (identity.arm === 'native-file-search') {
          common.snapshotId = metrics.snapshotId
          common.completeEvidenceAllCandidates = score.completeAll
          common.recallAllCandidates = score.recallAll
          common.evidenceReachableInAllCandidates = score.evidenceReachable
          common.firstPage = metrics.firstPage
          common.continuationAudit = metrics.continuationAudit
          common.totalSearchWallMs = metrics.totalSearchWallMs
          common.helperNativeSeconds = metrics.helperNativeSeconds
          common.helperProcessCount = metrics.helperProcessCount
          common.ripgrepProcessCount = metrics.ripgrepProcessCount
          common.helperStdoutBytes = metrics.helperStdoutBytes
          common.ripgrepStdoutBytes = metrics.ripgrepStdoutBytes
          common.pageNativeCalls = metrics.pageNativeCalls
          common.exactPageStdoutBase64 = metrics.exactPageStdoutBase64
        } else {
          common.completeEvidenceInReturnedSet = score.completeAll
          common.recallInReturnedSet = score.recallAll
          common.evidenceReachableInReturnedSet = score.evidenceReachable
          common.processCount = metrics.processCount
          common.stdoutBytes = metrics.stdoutBytes
          common.exactStdoutBase64 = metrics.exactStdoutBase64
        }
        attempt.result = common
        attempt.processRecords = processRecords
        attempt.status = 'success'
      } catch (error) {
        attempt.status = 'failed'
        attempt.failure = { message: error.message, nativeCalls: error.nativeCalls ?? null, invocation: error.invocation ?? null }
        attempt.processRecords = processRecords
        if (error.fatalIntegrity || error.integrityFailure) {
          stop = true
          report.stopReason = `Integrity stop: ${error.message}`
          caseRow.integrityFailure = error.message
        }
      }
      attempt.startedAtEpochMs = now
      attempt.finishedAtEpochMs = Date.now()
      saveCheckpoint()
    }
  } else {
    report.attempts.push(...caseAttempts.map((attempt) => ({ ...attempt, status: 'not-run', failure: caseRow.setupFailure })))
  }
  try {
    const afterStarted = performance.now()
    const graphAfter = hashCorpus(graphNotes, sourceHashes)
    const fileAfter = hashCorpus(fileNotes, sourceHashes)
    const postIndexHashes = caseRow.nativeIndex?.indexedBodyHashes
    const basicIndexed = postIndexHashes && Object.keys(postIndexHashes).length
      ? hashCorpus(nativeNotes, postIndexHashes).hashes
      : null
    if (!basicIndexed && !caseRow.setupFailure) throw new IntegrityError('Missing Basic Memory post-index body hashes')
    caseRow.sourceHashChecks.push({ phase: 'after-case', elapsedSeconds: (performance.now() - afterStarted) / 1000,
      graphAggregateSha256: graphAfter.aggregateSha256, fileAggregateSha256: fileAfter.aggregateSha256,
      basicIndexedBodyHashes: basicIndexed })
  } catch (error) {
    caseRow.integrityFailure = error.message
    stop = true
    report.stopReason = `Source integrity stop: ${error.message}`
  }
  saveCheckpoint()
}

if (report.attempts.length < planned.length) {
  const recorded = new Set(report.attempts.map((attempt) => JSON.stringify([attempt.caseId, attempt.repeat, attempt.arm, attempt.sequence])))
  for (const attempt of planned) {
    const identity = JSON.stringify([attempt.caseId, attempt.repeat, attempt.arm, attempt.sequence])
    if (!recorded.has(identity)) report.attempts.push({ ...attempt, status: 'not-run', failure: report.stopReason ?? 'Stopped before attempt' })
  }
}
report.attempts.sort((a, b) => selectedIds.indexOf(a.caseId) - selectedIds.indexOf(b.caseId)
  || a.repeat - b.repeat || a.sequence - b.sequence)
assertAttemptAccounting(planned, report.attempts)
const failures = report.attempts.filter((attempt) => attempt.status !== 'success')
const integrityFailures = report.cases.filter((item) => item.integrityFailure)
const setupFailures = report.cases.filter((item) => item.setupFailure || item.nativeIndex?.failure)
report.status = failures.length || setupFailures.length || integrityFailures.length ? 'failed' : 'complete'
report.failedAttemptCount = failures.length
report.setupFailedCaseCount = setupFailures.length
report.integrityFailedCaseCount = integrityFailures.length
report.failureCount = failures.length + setupFailures.length + integrityFailures.length
report.plannedAccountingComplete = report.attempts.length === planned.length
report.completedAt = new Date().toISOString()
if (failures.length && !report.stopReason) report.stopReason = 'One or more planned CLI attempts failed; all remaining attempts were retained.'
atomicWrite(outPath, report)
if (report.status === 'complete') fs.rmSync(checkpoint, { force: true })
console.log(JSON.stringify({ status: report.status, cases: report.cases.length, plannedAttempts: planned.length,
  recordedAttempts: report.attempts.length, failures: report.failureCount, report: outPath, manifest: manifestPath }))
if (report.status !== 'complete') process.exitCode = 1
