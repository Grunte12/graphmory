#!/usr/bin/env node
// Development-only matched-host CLI retrieval diagnostic. No answer model is called.
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
const input = option('--input'), out = option('--out')
const limit = Number(option('--limit') ?? 14)
if (!input || !out || fs.existsSync(out) || !Number.isInteger(limit) || limit < 1 || limit > 14)
  throw new Error('Use --input <pinned LongMemEval> --out <new report> [--limit 1..14]')
const base = path.join(root, 'tmp/competitors/basic-memory')
const bm = path.join(base, 'venv/bin/bm')
const cli = path.join(root, 'scripts/brain-sync.mjs')
const manifestFile = path.join(root, 'eval/longmemeval/pilot.json')
const manifestBytes = fs.readFileSync(manifestFile)
const manifest = JSON.parse(manifestBytes)
const datasetBytes = fs.readFileSync(input)
if (hash(datasetBytes) !== manifest.sourceSha256) throw new Error('Dataset hash mismatch')
if (!fs.existsSync(bm)) throw new Error('Pinned Basic Memory CLI missing')
const version = execFileSync(bm, ['--version'], { encoding: 'utf8' }).trim()
if (!/0\.23\.2/u.test(version)) throw new Error('Basic Memory version mismatch: ' + version)
const cases = new Map(JSON.parse(datasetBytes).map(row => [row.question_id, row]))
const selected = manifest.selectedIds.slice(0, limit)
if (new Set(selected).size !== selected.length || selected.some(id => !cases.has(id))) throw new Error('Invalid frozen IDs')
const report = { protocol: 'longmemeval-development-matched-cli-retrieval-v1', datasetSha256: hash(datasetBytes),
  idsManifestSha256: hash(manifestBytes), selectedIds: selected, queryFormat: 'question-only',
  arms: ['basic-memory-hybrid', 'graphmory-recall-loop'], repeats: 3, version,
  graphmoryCliSha256: hash(fs.readFileSync(cli)), basicEvaluatorSha256: hash(fs.readFileSync(new URL(import.meta.url))),
  environment: { platform: process.platform, arch: process.arch, node: process.version, pid: process.pid },
  rows: [], limitations: ['Exposed development cases only; no answer model, citation or abstention judgment',
    'Native Basic Memory ingestion may rewrite Markdown and builds an embedding index; Graphmory scans original Markdown on each CLI call',
    'Both run on one host with alternating query order per case, but arm process startup and stdout formats differ',
    'Elapsed wall time includes CLI process startup and output; output bytes are not tokens or monetary cost',
    'Only @3/@10 first-page evidence, not prior @12 or whole Curator/Lead workflow'] }
const checkpoint = out + '.checkpoint'
function save() { fs.writeFileSync(checkpoint, JSON.stringify(report, null, 2) + '\n') }
function native(args, env, timeout = 120000) { return execFileSync(bm, args, { cwd: root, env, encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore','pipe','pipe'] }) }
function parseNative(text) {
  const parsed = JSON.parse(text)
  const values = Array.isArray(parsed) ? parsed : ['results','items','notes','data'].map(key => parsed?.[key]).find(Array.isArray)
  if (!values) throw new Error('Unknown Basic Memory result shape')
  const paths = values.map(row => row.file_path)
  if (paths.some(p => typeof p !== 'string') || new Set(paths).size !== paths.length) throw new Error('Unmapped/duplicate native paths')
  return paths
}
function measurement(fn) {
  const started = performance.now()
  const stdout = fn()
  return { elapsedMs: performance.now() - started, outputBytes: Buffer.byteLength(stdout), stdout }
}
for (const [index, id] of selected.entries()) {
  const item = cases.get(id), prepared = prepareCase(item), query = prepared.query.text
  const key = createHash('sha256').update(id).digest('hex').slice(0, 16)
  const caseRoot = path.join(base, 'matched-cases', key)
  const nativeNotes = path.join(caseRoot, 'native-notes')
  const graphNotes = path.join(caseRoot, 'graph-notes')
  const home = path.join(caseRoot, 'home'), state = path.join(caseRoot, 'state')
  if (fs.existsSync(caseRoot)) throw new Error('Case directory exists: ' + caseRoot)
  const row = { id, category: prepared.labels.category, querySha256: hash(query),
    sourceBodyHashes: Object.fromEntries(prepared.documents.map(doc => [doc.path, hash(doc.markdown)])),
    sourceBodyAggregateSha256: hash(Buffer.concat(prepared.documents.map(doc => Buffer.from(doc.markdown)))),
    sessionCount: prepared.documents.length, answerable: !prepared.labels.abstention, armOrder: index % 2
      ? ['graphmory-recall-loop','basic-memory-hybrid'] : ['basic-memory-hybrid','graphmory-recall-loop'],
    arms: {}, failure: null }
  try {
    for (const dir of [nativeNotes, graphNotes, home]) fs.mkdirSync(dir, { recursive: true })
    for (const doc of prepared.documents) for (const vault of [nativeNotes, graphNotes]) {
      const target = path.join(vault, doc.path)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, doc.markdown)
    }
    const env = { ...process.env, XDG_CONFIG_HOME: path.join(home, '.config'),
      HF_HOME: path.join(base, 'huggingface-cache'), HF_XET_CACHE: path.join(base, 'huggingface-cache', 'xet'),
      BASIC_MEMORY_CONFIG_DIR: state, BASIC_MEMORY_HOME: nativeNotes, BASIC_MEMORY_AUTO_UPDATE: 'false',
      BASIC_MEMORY_SEMANTIC_SEARCH_ENABLED: 'true', BASIC_MEMORY_DEFAULT_SEARCH_TYPE: 'hybrid', BASIC_MEMORY_RERANKER_ENABLED: 'false' }
    const ingested = measurement(() => {
      native(['project','add','pilot',nativeNotes,'--local','--default'], env)
      return native(['reindex','--search','--embeddings','--project','pilot'], env)
    })
    const indexMatch = ingested.stdout.match(/project index: (\d+) observed, (\d+) indexed/u)
    const vector = ingested.stdout.match(/Embeddings complete \(index=([^,]+),\s*model=([^)]*)\):\s*(\d+) entities embedded,\s*(\d+)\s*skipped,\s*(\d+) errors/u)
    if (!indexMatch || Number(indexMatch[1]) !== prepared.documents.length || Number(indexMatch[2]) !== prepared.documents.length ||
      !vector || Number(vector[3]) < 1 || Number(vector[5]) !== 0) throw new Error('Native index incomplete')
    row.nativeIndex = { elapsedMs: ingested.elapsedMs, index: vector[1], model: vector[2],
      embeddedEntities: Number(vector[3]), embeddingErrors: Number(vector[5]),
      changedOriginals: prepared.documents.filter(doc => fs.readFileSync(path.join(nativeNotes, doc.path), 'utf8') !== doc.markdown).length }
    const valid = new Set(prepared.documents.map(doc => doc.path))
    const armRuns = { 'basic-memory-hybrid': [], 'graphmory-recall-loop': [] }
    const order = [...row.armOrder, ...row.armOrder, ...row.armOrder]
    for (const arm of order) {
      const run = arm === 'basic-memory-hybrid'
        ? measurement(() => native(['tool','search-notes',query,'--project','pilot','--local','--page-size','12','--json','--hybrid'], env))
        : measurement(() => execFileSync(process.execPath, [cli,'recall-loop','--vault',graphNotes,'--query',query,'--k','10','--agent'],
          { cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore','pipe','pipe'] }))
      const paths = arm === 'basic-memory-hybrid' ? parseNative(run.stdout) : JSON.parse(run.stdout).results.map(x => x.path)
      if (paths.some(p => !valid.has(p)) || new Set(paths).size !== paths.length) throw new Error('Invalid result paths')
      armRuns[arm].push({ elapsedMs: run.elapsedMs, outputBytes: run.outputBytes, selectedSessionPaths: paths.slice(0, 10) })
    }
    for (const arm of report.arms) {
      const repeats = armRuns[arm], ranked = repeats.at(-1).selectedSessionPaths
      const hit = k => prepared.labels.evidence.filter(group => group.some(p => ranked.slice(0, k).includes(p))).length
      row.arms[arm] = { repeats, ranked, completeAt3: prepared.labels.abstention ? null : hit(3) === prepared.labels.evidence.length,
        completeAt10: prepared.labels.abstention ? null : hit(10) === prepared.labels.evidence.length,
        recallAt3: prepared.labels.abstention ? null : hit(3) / prepared.labels.evidence.length,
        recallAt10: prepared.labels.abstention ? null : hit(10) / prepared.labels.evidence.length }
    }
    for (const doc of prepared.documents) if (hash(fs.readFileSync(path.join(graphNotes, doc.path))) !== row.sourceBodyHashes[doc.path])
      throw new Error('Graphmory original mutated')
    console.log(`${id}: ${prepared.documents.length} notes; index ${Math.round(row.nativeIndex.elapsedMs)}ms; queries complete`)
  } catch (error) {
    row.failure = error.message
    console.error(`${id}: FAILED ${error.message}`)
  } finally {
    report.rows.push(row)
    save()
    fs.rmSync(caseRoot, { recursive: true, force: true })
  }
}
if (report.rows.length !== selected.length || report.rows.some(row => row.failure)) throw new Error('Matched CLI experiment has failed cases; preserve checkpoint')
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
fs.rmSync(checkpoint)
console.log(JSON.stringify({ cases: report.rows.length, failed: 0 }))
