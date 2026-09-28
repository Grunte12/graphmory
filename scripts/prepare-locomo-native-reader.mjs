#!/usr/bin/env node
// Freeze exposed development cases for matched native Curator/Lead tools.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { digest, prepareConversation } from "./lib/locomo.mjs"
const root = fileURLToPath(new URL("../", import.meta.url))
const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const input = option("--input"), out = option("--out")
if (!input || !out || fs.existsSync(out)) throw new Error("Use --input <pinned dataset> --out <new directory>")
const bytes = fs.readFileSync(input), expected = "79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4"
if (digest(bytes) !== expected) throw new Error("Dataset mismatch")
const split = JSON.parse(fs.readFileSync(path.join(root, "eval/locomo/development-v1.json")))
const dev = new Set(split.development), excluded = new Set()
for (const name of fs.readdirSync(path.join(root, "eval/reader-pilot"))) {
  if (!name.endsWith(".json")) continue
  const report = JSON.parse(fs.readFileSync(path.join(root, "eval/reader-pilot", name)))
  if (typeof report.id === "string" && report.modelCalls?.length) excluded.add(report.id)
  if (report.rows) for (const row of report.rows) if (row.modelCalls?.length) excluded.add(row.id)
}
const seed = "graphmory-native-locomo-development-v1-2026-09-28"
const available = JSON.parse(bytes).filter(item => dev.has(item.sample_id)).flatMap(item => {
  const prepared = prepareConversation(item)
  return prepared.questions.map((question, index) => ({ item, prepared, question, index }))
})
const chosen = [], used = new Set()
for (const category of [1, 2, 5]) {
  const candidates = available.filter(row => row.question.category === category && !excluded.has(row.question.id)
    && (category === 5 || (!row.question.unresolved.length && row.question.evidence.length)))
    .sort((a, b) => digest(seed + a.question.id).localeCompare(digest(seed + b.question.id)))
  const row = candidates.find(row => !used.has(row.item.sample_id))
  if (!row) throw new Error("Missing eligible conversation")
  chosen.push(row); used.add(row.item.sample_id)
}
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const cases = []
for (const [index, row] of chosen.entries()) {
  const folder = path.resolve(out, String(index)), vault = path.join(folder, "vault")
  fs.mkdirSync(vault, { recursive: true })
  const sources = {}
  for (const doc of row.prepared.documents) {
    fs.writeFileSync(path.join(vault, doc.path), doc.markdown, { mode: 0o600 })
    sources[doc.path] = digest(doc.markdown)
  }
  const reader = [{ id: row.question.id, question: row.question.query, vault, sources }]
  const payload = JSON.stringify(reader, null, 2) + "\n"
  const label = { id: row.question.id, category: row.question.category, answer: row.item.qa[row.index].answer ?? "",
    goldPaths: row.question.evidence, goldTurnIds: row.item.qa[row.index].evidence }
  const gold = JSON.stringify([label], null, 2) + "\n"
  fs.writeFileSync(path.join(folder, "reader-input.json"), payload, { mode: 0o600 })
  fs.writeFileSync(path.join(folder, "labels.json"), gold, { mode: 0o600 })
  cases.push({ id: row.question.id, category: row.question.category, folder: String(index),
    inputSha256: digest(payload), labelsSha256: digest(gold), sourceCount: row.prepared.documents.length,
    armOrder: index % 2 ? ["graphmory", "basic"] : ["basic", "graphmory"] })
}
const files = ["scripts/prepare-locomo-native-reader.mjs", "scripts/lib/locomo.mjs", "scripts/run-curator-paging-pilot.py",
  "scripts/prepare-basic-memory-live-index.py", "scripts/brain-sync.mjs", "src/decision-recall.mjs", "src/memory-recall.mjs", "src/retrieval.mjs", "src/source-read.mjs"]
const manifest = { protocol: "locomo-matched-native-reader-development-v1", frozenBeforeGeneration: true,
  datasetSha256: expected, selectionSeed: seed, excludedPreviouslyGeneratedIds: [...excluded].filter(id => id.startsWith("conv-")).sort(),
  cases, plannedTrials: 6, configuration: { curator: "gpt-5.6-luna", lead: "gpt-5.6-sol", reasoning: "low", mode: "auto",
    maxRounds: 10, maxInputBytes: 300000, structuredCitations: true, persistentCurator: false },
  sourceHashes: Object.fromEntries(files.map(name => [name, digest(fs.readFileSync(path.join(root, name)))])),
  comparator: "Basic Memory 0.23.2 native search-notes --hybrid and read-note; native bge-small-en-v1.5 embeddings and FTS index verified before each case",
  scorerSha256: "8e3be5d57ff2ff9ec5cd05939592f468c5f3f1fd95d13e431932bdf6bf0fd6fd",
  metrics: ["all-attempt workflow completion", "raw pinned QA score", "source support/completeness author review separately", "gold-original reads", "citations", "host gross/cached/output usage", "whole workflow seconds", "native tool bytes and ingestion seconds"],
  failures: "Preserve all six planned trials; empty prediction for no emitted answer, separately zero operational-adjusted scores for failed workflows. Never replace a failed case.",
  holdoutNotRendered: split.holdoutNotEvaluated,
  limitations: ["Exposed development conversations, three questions; no powered noninferiority or superiority claim",
    "New question IDs do not create source-disjoint holdout because development histories were previously evaluated",
    "Native normalization, outputs and cache states differ; do not infer causal monetary cost savings",
    "Pinned raw QA wrapper is not full official benchmark; support review is unblinded and uncalibrated"] }
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
console.log(JSON.stringify({ cases, plannedTrials: 6, holdoutRendered: false }))
