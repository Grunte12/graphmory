#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { prepareCase, hash } from './lib/longmemeval.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const inputPath = option('--input') ?? path.join(root, 'tmp/datasets/longmemeval_s_cleaned.json')
const outPath = option('--out') ?? path.join(root, 'eval/competitor-pilot/native-results.json')
const limit = Number(option('--limit') ?? '14')
if (!Number.isInteger(limit) || limit < 1 || limit > 14) throw new Error('--limit must be 1..14')
const base = path.join(root, 'tmp/competitors/basic-memory')
const exe = path.join(base, 'venv/bin/bm')
if (!fs.existsSync(exe)) throw new Error(`Missing pinned Basic Memory CLI: ${exe}`)
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'eval/longmemeval/pilot.json'), 'utf8'))
const selectedIds = manifest.selectedIds.slice(0, limit)
const inputBytes = fs.readFileSync(inputPath)
if (hash(inputBytes) !== manifest.sourceSha256) throw new Error('Input dataset SHA-256 differs from frozen pilot manifest')
const all = JSON.parse(inputBytes)
const byId = new Map(all.map(item => [item.question_id, item]))
const rows = []

function run(args, env, cwd, maxBuffer = 8 * 1024 * 1024) {
  return execFileSync(exe, args, { env, cwd, encoding: 'utf8', maxBuffer, timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] })
}
function objectFromSearch(text) {
  const parsed = JSON.parse(text)
  if (Array.isArray(parsed)) return parsed
  for (const key of ['results', 'items', 'notes', 'data']) if (Array.isArray(parsed?.[key])) return parsed[key]
  throw new Error(`Unrecognized Basic Memory JSON shape: ${Object.keys(parsed ?? {}).join(',')}`)
}
function candidatePath(result) {
  const value = result?.file_path
  return typeof value === 'string' && /^sessions\/\d{4}-[a-f0-9]{12}\.md$/u.test(value) ? value : null
}

for (const id of selectedIds) {
  const item = byId.get(id)
  if (!item) throw new Error(`Pilot ID absent from dataset: ${id}`)
  const prepared = prepareCase(item)
  const key = createHash('sha256').update(id).digest('hex').slice(0, 16)
  const caseRoot = path.join(base, 'cases', key)
  const state = path.join(caseRoot, 'state')
  const home = path.join(caseRoot, 'home')
  const notes = path.join(caseRoot, 'notes')
  fs.rmSync(caseRoot, { recursive: true, force: true })
  fs.mkdirSync(notes, { recursive: true })
  fs.mkdirSync(home, { recursive: true })
  for (const doc of prepared.documents) {
    const file = path.join(notes, doc.path)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, doc.markdown)
  }
  const sourceHash = hash(Buffer.concat(prepared.documents.map(doc => Buffer.from(doc.markdown))))
  const env = { ...process.env, XDG_CONFIG_HOME: path.join(home, '.config'),
    BASIC_MEMORY_CONFIG_DIR: state, BASIC_MEMORY_HOME: notes,
    BASIC_MEMORY_AUTO_UPDATE: 'false', BASIC_MEMORY_SEMANTIC_SEARCH_ENABLED: 'false',
    BASIC_MEMORY_DEFAULT_SEARCH_TYPE: 'text', BASIC_MEMORY_RERANKER_ENABLED: 'false' }
  try {
    const ingestStart = performance.now()
    run(['project', 'add', 'pilot', notes, '--local', '--default'], env, root)
    const reindex = run(['reindex', '--search', '--project', 'pilot'], env, root)
    const indexMatch = reindex.match(/project index: (\d+) observed, (\d+) indexed/u)
    if (!indexMatch || Number(indexMatch[1]) !== prepared.documents.length || Number(indexMatch[2]) !== prepared.documents.length)
      throw new Error(`Reindex did not confirm all notes indexed: ${reindex.slice(-500)}`)
    const ingestMs = performance.now() - ingestStart
    const query = args.includes('--question-only') ? prepared.query.text : `${prepared.query.text}\nAs of: ${prepared.query.date}`
    const callSearch = q => run(['tool', 'search-notes', q, '--project', 'pilot', '--local', '--page-size', '12', '--json'], env, root)
    const firstText = prepared.documents[0].markdown.replace(/^#.*$/gmu, ' ').replace(/\b\d{4}-\d{2}-\d{2}\b/gu, ' ')
    const smokeQuery = firstText.match(/[A-Za-z][A-Za-z0-9'-]{7,}/u)?.[0]
    if (!smokeQuery) throw new Error('Cannot derive a known-item smoke term from first source note')
    const smokeResults = objectFromSearch(callSearch(smokeQuery))
    if (!smokeResults.some(result => result?.file_path === prepared.documents[0].path))
      throw new Error(`Known-item FTS smoke failed for ${prepared.documents[0].path}`)
    const repeats = []
    for (let repeat = 0; repeat < 3; repeat++) {
      const started = performance.now()
      const stdout = callSearch(query)
      const elapsedMs = performance.now() - started
      const entries = objectFromSearch(stdout)
      const seen = new Set(), paths = []
      let unmapped = 0, duplicateRows = 0
      for (const result of entries) {
        const candidate = candidatePath(result)
        if (!candidate) { unmapped++; continue }
        if (seen.has(candidate)) { duplicateRows++; continue }
        seen.add(candidate); paths.push(candidate)
      }
      repeats.push({ elapsedMs, outputBytes: Buffer.byteLength(stdout), rawRows: entries.length,
        uniqueSessions: paths.length, unmappedRows: unmapped, duplicateRows, selectedSessionPaths: paths.slice(0, 12) })
    }
    if (repeats.some(r => r.unmappedRows)) throw new Error('Unmapped native search rows');
    const ranked = repeats.at(-1).selectedSessionPaths
    const relevant = prepared.labels.evidence
    const hitCount = k => relevant.filter(group => group.some(p => ranked.slice(0, k).includes(p))).length
    const answerable = !prepared.labels.abstention
    const rewritten = prepared.documents.map(doc => {
      const current = fs.readFileSync(path.join(notes, doc.path), 'utf8')
      if (current === doc.markdown) return false
      // Native ingestion can normalize Markdown; record rather than misclassify it as an execution failure.
      return true
    })
    rows.push({ id, category: prepared.labels.category, sessions: prepared.documents.length,
      duplicateSessionIds: prepared.labels.duplicateSessionIds, evidenceCount: answerable ? relevant.length : null,
      recallAt3: answerable ? hitCount(3) / relevant.length : null,
      recallAt12: answerable ? hitCount(12) / relevant.length : null,
      completeAt3: answerable ? hitCount(3) === relevant.length : null,
      completeAt12: answerable ? hitCount(12) === relevant.length : null,
      candidates: ranked.length, indexedFiles: Number(indexMatch[2]), ingestMs, knownItemSmoke: 'passed',
      changedSourceFiles: rewritten.filter(Boolean).length, sourceBodyHash: sourceHash,
      ingestedHash: hash(Buffer.concat(prepared.documents.map(doc => fs.readFileSync(path.join(notes, doc.path))))),
      repeats, selectedSessionPaths: ranked })
    console.log(`${id}: indexed ${prepared.documents.length}; ${ranked.length} unique sessions; smoke passed`)
  } catch (error) {
    rows.push({ id, category: prepared.labels.category, sessions: prepared.documents.length, failure: error.message })
    console.error(`${id}: FAILED ${error.message}`)
  } finally {
    fs.rmSync(caseRoot, { recursive: true, force: true })
  }
}

const successfulRuns = rows.filter(row => !row.failure)
const answerableRuns = successfulRuns.filter(row => row.recallAt3 !== null)
const average = key => answerableRuns.length ? answerableRuns.reduce((sum, row) => sum + Number(row[key]), 0) / answerableRuns.length : null
const output = { suite: 'basic-memory-local-text-retrieval-pilot', competitor: 'Basic Memory', version: '0.23.2',
  environment: 'macOS arm64, Python 3.12.13, uv isolated venv; config/home per case',
  search: 'Native bm tool search-notes plain query with --page-size 12 --json; semantic search disabled (default_type=text); Query format recorded separately; no keyword extraction.',
  ingestionAdaptation: 'Same original Markdown inputs; native Basic Memory ingestion may add frontmatter and normalize formatting. Changed file counts and before/after hashes are recorded; post-ingest byte equality is not claimed.',
  install: { command: "uv pip install --python tmp/competitors/basic-memory/venv/bin/python --cache-dir tmp/competitors/uv-cache --prerelease=allow 'basic-memory==0.23.2'",
    venvBytes: sizeTree(path.join(base, 'venv')), cacheBytes: sizeTree(path.join(root, 'tmp/competitors/uv-cache')) },
  queryFormat: args.includes('--question-only') ? 'question-only' : 'question-plus-date',
  datasetSha256: hash(fs.readFileSync(inputPath)), selectedIds, cases: rows,
  summary: { metricDenominator: 'Successful answerable cases only; failed cases must be included separately before comparisons', cases: rows.length, failedCases: rows.filter(row => row.failure).length, answerable: answerableRuns.length,
    recallAt3: average('recallAt3'), recallAt12: average('recallAt12'),
    completeAt3: average('completeAt3'), completeAt12: average('completeAt12'),
    abstentionCases: successfulRuns.length - answerableRuns.length,
    abstentionWithCandidates: successfulRuns.filter(row => row.recallAt3 === null && row.candidates > 0).length,
    medianIngestMs: median(successfulRuns.map(row => row.ingestMs)),
    medianWarmSearchMs: median(successfulRuns.flatMap(row => row.repeats.slice(1).map(rep => rep.elapsedMs))),
    medianWarmOutputBytes: median(successfulRuns.flatMap(row => row.repeats.slice(1).map(rep => rep.outputBytes))) },
  limitations: ['Development pilot only; not answer-accuracy or full memory-system evaluation.',
    'Text-only native search, no Basic Memory semantic vectors or reranking; source sessions are separate Markdown notes.',
    'Search timing includes CLI startup and SQLite setup on each call; not directly comparable with in-process Graphmory timings.',
    'Candidates mapped only when Basic Memory result output exposes the generated session note path; unmapped results remain in candidateCount.'] }
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n')
console.log(JSON.stringify(output.summary, null, 2))

function sizeTree(folder) {
  if (!fs.existsSync(folder)) return 0
  let bytes = 0
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const child = path.join(folder, entry.name)
    bytes += entry.isDirectory() ? sizeTree(child) : fs.statSync(child).size
  }
  return bytes
}
function median(values) {
  if (!values.length) return null
  values.sort((a, b) => a - b)
  return values[Math.floor(values.length / 2)]
}
