#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { performance } from "node:perf_hooks"
import { governedRank, parseMarkdown, rank, scoreRun, summarizeRuns } from "../src/retrieval.mjs"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const size = Number.parseInt(option("--notes", "250"), 10)
const k = Number.parseInt(option("--k", "3"), 10)
const seed = Number.parseInt(option("--seed", "29"), 10)
const jsonOutput = option("--json", "")
// Decoy intent category is opt-in (default off) so the v0.5 gate (eval-v05-gate.mjs), which
// runs this script with its default flags, keeps its existing unchanged thresholds. Enable
// with --decoys to add active-status, higher-lexical-overlap decoy notes/queries.
const decoysEnabled = args.includes("--decoys")
if (!Number.isInteger(size) || size < 20 || !Number.isInteger(k) || k < 1 || !Number.isInteger(seed)) {
  console.error("Usage: node scripts/eval-retrieval-stress.mjs [--notes >=20] [--k >=1] [--seed integer] [--json path] [--decoys]")
  process.exit(2)
}

const core = [
  ["canonical-sync", "Portable Brain Synchronization", "shared brain, forked histories, assistant handoff", "Current verified policy: fetch remote memory, allow fast-forward-only pull, and ask a human before resolving divergent history. Related: [[canonical-conflict]]. Provenance: sync verification record."],
  ["canonical-secrets", "Credential Safety", "authentication material, long-lived knowledge", "Current verified policy: credentials and private tokens never belong in durable memory. Store only a secret reference and its rotation procedure."],
  ["canonical-ui", "Visible Interface Ownership", "aesthetic fidelity, adaptive layout", "Current verified policy: the interface specialist owns pixel appearance, interaction states, responsive behavior, and visual acceptance. Related: [[canonical-backend]]."],
  ["canonical-backend", "Service Data Ownership", "identity sessions, database integrity", "Current verified policy: the implementation specialist owns authentication, persistence, server APIs, migrations, and data correctness. Related: [[canonical-ui]]."],
  ["canonical-conflict", "Knowledge Conflict Lifecycle", "competing claims, uncertain knowledge", "Current verified policy: contradictory evidence becomes TENSION. Preserve both claims and provenance until a human chooses the accepted meaning. Related: [[canonical-sync]]."],
].map(([id, title, aliases, body]) => parseMarkdown(id, `---\nstatus: current\ncanonical: true\naliases: ${aliases}\n---\n# ${title}\n\n${body}`))

const pollutants = [
  parseMarkdown("stale-sync", "---\nstatus: stale\n---\n# Old Sync Advice\n\nAutomatically merge and rebase every remote memory update without asking anyone."),
  parseMarkdown("raw-sync-log", "---\nstatus: raw\n---\n# Sync Terminal Capture\n\npull pull merge rebase remote memory sync conflict conflict conflict"),
  parseMarkdown("stale-secrets", "---\nstatus: stale\n---\n# Old Credential Note\n\nPaste private tokens into durable memory so every agent can retrieve credentials."),
  parseMarkdown("raw-ui-chat", "---\nstatus: raw\n---\n# UI Chat Dump\n\npixels interface visual responsive hover visual visual visual acceptance"),
  parseMarkdown("stale-conflict", "---\nstatus: superseded\n---\n# Old Conflict Rule\n\nOverwrite contradictory memory with the newest claim and discard old provenance."),
]

// Decoy notes are correct-status (active/current, NOT filtered by lifecycle) but stuff query
// vocabulary far more densely than the canonical answer, so any recall win here is a genuine
// ranking win rather than a lifecycle-filtering win (unlike the stale/raw pollutants above).
const decoys = decoysEnabled ? [
  parseMarkdown("decoy-sync-notes", "---\nstatus: active\n---\n# Sync Meeting Notes Dump\n\nsync sync memory sync policy sync memory sync history sync notes sync memory sync dump sync policy sync memory."),
  parseMarkdown("decoy-secrets-notes", "---\nstatus: active\n---\n# Credential Notes Dump\n\ncredential credential secrets credential tokens credential secrets credential notes credential dump credential secrets credential tokens."),
  parseMarkdown("decoy-ui-notes", "---\nstatus: active\n---\n# Interface Notes Dump\n\ninterface interface visual interface responsive interface visual interface notes interface dump interface responsive interface visual."),
  parseMarkdown("decoy-backend-notes", "---\nstatus: active\n---\n# Backend Notes Dump\n\nauthentication authentication database authentication persistence authentication database authentication notes authentication dump authentication database."),
] : []
const decoyIds = new Set(decoys.map((item) => item.id))

let randomState = seed || 1
function random() {
  randomState ^= randomState << 13
  randomState ^= randomState >>> 17
  randomState ^= randomState << 5
  return (randomState >>> 0) / 4294967296
}
const noiseTerms = ["sync", "memory", "conflict", "tokens", "interface", "responsive", "authentication", "database", "provenance", "agent", "evidence", "policy"]
const filler = Array.from({ length: Math.max(0, size - core.length - pollutants.length - decoys.length) }, (_, index) => {
  const domain = index % 9
  const first = noiseTerms[Math.floor(random() * noiseTerms.length)]
  const second = noiseTerms[Math.floor(random() * noiseTerms.length)]
  return parseMarkdown(
    `noise-${String(index).padStart(4, "0")}`,
    `# Routine Note ${index}\n\nProject domain ${domain} records a temporary ${first} task summary, ${second} implementation status, review result, and generic agent workflow. This note is unrelated evidence ${index}.`,
  )
})

const documents = [...core, ...pollutants, ...decoys, ...filler]
const pollutantIds = new Set(pollutants.map((item) => item.id))
const baseQueries = [
  { id: "exact-sync", category: "exact", query: "What is the verified fast-forward-only memory sync policy?", relevant: ["canonical-sync"] },
  { id: "alias-sync", category: "alias", query: "How should two assistants reconcile a shared brain after their histories fork?", relevant: ["canonical-sync", "canonical-conflict"] },
  { id: "secret-paraphrase", category: "paraphrase", query: "Should long-lived knowledge contain authentication material?", relevant: ["canonical-secrets"] },
  { id: "ui-paraphrase", category: "paraphrase", query: "Who judges aesthetic fidelity and adaptive layout behavior?", relevant: ["canonical-ui"] },
  { id: "backend-alias", category: "alias", query: "Who handles identity sessions and database integrity?", relevant: ["canonical-backend"] },
  { id: "conflict-current", category: "stale-conflict", query: "What should happen when new evidence contradicts accepted memory?", relevant: ["canonical-conflict"] },
  { id: "sync-current", category: "stale-conflict", query: "Should remote memory conflicts be merged automatically?", relevant: ["canonical-sync", "canonical-conflict"] },
  { id: "secret-current", category: "stale-conflict", query: "Where should private tokens be stored for agent recall?", relevant: ["canonical-secrets"] },
  { id: "split-ownership", category: "multi-hop", query: "A responsive page is wrong and its API persists bad records. Which ownership memories apply?", relevant: ["canonical-ui", "canonical-backend"] },
  { id: "safe-handoff", category: "multi-hop", query: "How do agents share durable knowledge while preserving uncertain competing claims?", relevant: ["canonical-sync", "canonical-conflict"] },
  ...(decoysEnabled ? [
    { id: "decoy-sync-policy", category: "decoy", query: "What is the verified memory sync policy?", relevant: ["canonical-sync"] },
    { id: "decoy-secrets-policy", category: "decoy", query: "Should long-lived knowledge contain authentication material?", relevant: ["canonical-secrets"] },
    { id: "decoy-ui-policy", category: "decoy", query: "Who owns pixel appearance and visual acceptance for the interface?", relevant: ["canonical-ui"] },
    { id: "decoy-backend-policy", category: "decoy", query: "Who owns authentication and database correctness on the backend?", relevant: ["canonical-backend"] },
  ] : []),
]
const queryFrames = [
  (query) => query,
  (query) => `Recall the durable rule and answer: ${query}`,
  (query) => `Using current canonical memory only, ${query}`,
  (query) => `Ignore raw captures and stale advice. ${query}`,
  (query) => `Which stored decision resolves this question: ${query}`,
]
const queries = baseQueries.flatMap((item) => queryFrames.map((frame, index) => ({
  ...item,
  id: `${item.id}-v${index + 1}`,
  query: frame(item.query),
})))

const report = { notes: documents.length, queries: queries.length, k, seed, methods: {} }
for (const label of ["lexical", "bm25", "bm25-sections", "governed-lexical", "governed-bm25", "governed-bm25-sections", "governed-bm25f-sections"]) {
  const governed = label.startsWith("governed-")
  const method = label.replace(/^governed-/u, "")
  const runs = []
  const started = performance.now()
  for (const item of queries) {
    const retrieval = governed ? governedRank(documents, item.query, method) : null
    const results = retrieval?.results ?? rank(documents, item.query, method)
    const top = results.slice(0, k)
    runs.push({
      id: item.id,
      category: item.category,
      relevant: item.relevant,
      retrieved: top.map((result) => result.id),
      pollutants: top.filter((result) => pollutantIds.has(result.id)).map((result) => result.id),
      metrics: scoreRun(results, item.relevant, k),
    })
  }
  const elapsedMs = performance.now() - started
  const summary = summarizeRuns(runs)
  report.methods[label] = {
    summary: {
      ...summary,
      estimatedContextTokens: Math.ceil(summary.averageContextCharacters / 4),
      averageQueryMs: elapsedMs / queries.length,
      misses: runs.filter((run) => run.metrics.hit === 0).length,
      pollutedQueries: runs.filter((run) => run.pollutants.length > 0).length,
      currentMemoryAccuracy: runs.reduce((sum, run) => sum + (run.metrics.hit === 1 && run.pollutants.length === 0 ? 1 : 0), 0) / Math.max(runs.length, 1),
    },
    categories: Object.fromEntries(
      [...new Set(runs.map((run) => run.category))].map((category) => [
        category,
        summarizeRuns(runs.filter((run) => run.category === category)),
      ]),
    ),
    runs,
  }
}

const percent = (value) => `${(value * 100).toFixed(1)}%`
console.log(`Stress dataset: ${report.notes} notes, ${report.queries} queries, k=${k}, seed=${seed}`)
console.log("")
console.log("| Method | Hit@k | Current-memory acc. | Recall@k | MRR | Misses | Polluted queries | Est. context tokens | Avg query ms |")
console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|")
for (const [method, result] of Object.entries(report.methods)) {
  const value = result.summary
  console.log(`| ${method} | ${percent(value.hitAtK)} | ${percent(value.currentMemoryAccuracy)} | ${percent(value.recallAtK)} | ${value.mrr.toFixed(3)} | ${value.misses} | ${value.pollutedQueries} | ${value.estimatedContextTokens} | ${value.averageQueryMs.toFixed(2)} |`)
}

if (jsonOutput) {
  const outputPath = path.resolve(jsonOutput)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`\nJSON report: ${outputPath}`)
}
