#!/usr/bin/env node
// Small real-embedding integration screen, not a public benchmark or host-agent eval.
import fs from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"
import { createHash } from "node:crypto"
import { managedRecall } from "../src/decision-recall.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"

const args = process.argv.slice(2)
const option = key => args[args.indexOf(key) + 1]
if (!args.includes("--out") || !args.includes("--model-cache")) throw new Error("--out <new directory> and --model-cache <existing local models> required")
const out = path.resolve(option("--out")), cache = path.resolve(option("--model-cache"))
if (fs.existsSync(out)) throw new Error("Preserve prior experiment outputs: choose a new --out")
fs.mkdirSync(out, { recursive: true })
const vault = path.join(out, "vault"), stateRoot = path.join(out, "state")
fs.mkdirSync(vault)
const notes = {
  "Recovery.md": "# Continuity protocol\nTo bring a crashed service back online, restore the database from a snapshot and replay its transaction log.\n",
  "Credentials.md": "# Access hygiene\nRotate passwords immediately when credentials have been exposed to an unauthorized party.\n",
  "Deployment.md": "# Production changes\nA separate reviewer must authorize every deployment before release.\n",
  "Ownership.md": "# Authority\nTaylor owns release approval.\n",
  "Project Map.md": "---\ncanonical_memory: false\n---\n# HelioForge\n[[Deployment]]\n",
  "Long.md": "# Integration journal\n" + "The garden grows vegetables and flowers. ".repeat(500) + "\n## Capacity policy\nWhen storage is exhausted, delete temporary build artifacts before creating additional database replicas.\n",
  "Old.md": "---\nstatus: superseded\n---\n# Continuity protocol\nTo recover, erase the database permanently.\n",
}
notes["Deployment.md"] += "[[Ownership]]\n"
const distractors = ["Bread dough rises overnight.", "Mountains have hiking trails.", "Saturn has rings.", "A violin has four strings.", "Water evaporates in sunlight.", "A bicycle has two wheels.", "Plants need soil and light.", "Chess uses an eight by eight board.", "Coffee beans are roasted.", "Whales live in the ocean.", "Artists mix colors.", "Rain fills reservoirs."]
distractors.forEach((text, index) => { notes[`Other-${index}.md`] = `# Reference ${index}\n${text}\n` })
for (const [id, text] of Object.entries(notes)) fs.writeFileSync(path.join(vault, id), text)
const cases = [
  { id: "exact", query: "snapshot transaction log", gold: ["Recovery.md"] },
  { id: "paraphrase-recovery", query: "How do we recover after an outage?", gold: ["Recovery.md"] },
  { id: "paraphrase-access", query: "What should we do after a secret leaks?", gold: ["Credentials.md"] },
  { id: "paraphrase-release", query: "Can an engineer ship without another person checking?", gold: ["Deployment.md"] },
  { id: "long-tail", query: "What can we remove when the disk is full?", gold: ["Long.md"] },
  { id: "multi-hop", query: "HelioForge", gold: ["Deployment.md", "Ownership.md"] },
]
const report = { kind: "synthetic-real-embedding-integration-screen", model: "Xenova/bge-small-en-v1.5", dtype: "fp32",
  cases, notes: Object.keys(notes).length, results: [], complete: false,
  sourceHashes: Object.fromEntries(Object.entries(notes).map(([id, text]) => [id, createHash("sha256").update(text).digest("hex")])),
  runtimeHashes: Object.fromEntries(["decision-recall", "semantic-recall", "hybrid-recall", "memory-recall", "summary-memory", "runtime-config", "retrieval"].map(name =>
    [name, createHash("sha256").update(fs.readFileSync(new URL(`../src/${name}.mjs`, import.meta.url))).digest("hex")])),
  limits: ["Small authored fixture, not independent holdout", "No host Curator or answer model", "Timing includes initialization; first hybrid query is cold", "No competitor comparison", "Similarity floor 0.3 is a candidate heuristic, not relevance probability"] }
const save = () => fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2))
save()
try {
  // Cache is provided by the caller; do not download weights during this experiment.
  const transformers = await import("@huggingface/transformers")
  transformers.env.allowRemoteModels = false
  for (const mode of ["lexical", "hybrid"]) {
    for (const c of cases) {
      const started = performance.now()
      const page = await managedRecall(vault, c.query, DEFAULT_RUNTIME_CONFIG, { retrievalMode: mode, modelCache: cache, stateRoot, k: 10 })
      if (page.status === "BLOCKED") throw new Error(`${page.code}: ${page.reason}`)
      const paths = page.results.map(result => result.path)
      const firstHit = paths.findIndex(p => c.gold.includes(p))
      report.results.push({ mode, case: c.id, milliseconds: performance.now() - started,
        paths, trails: page.results.filter(result => result.graphTrail).map(result => ({ path: result.path, trail: result.graphTrail })),
        recallAt5: c.gold.filter(p => paths.slice(0, 5).includes(p)).length / c.gold.length,
        precisionAt5: paths.slice(0, 5).filter(p => c.gold.includes(p)).length / 5,
        reciprocalRank: firstHit < 0 ? 0 : 1 / (firstHit + 1), totalCandidates: page.totalCandidates,
        historicalExcluded: !paths.includes("Old.md"), candidateLanes: page.candidateLanes ?? ["bm25", "bm25f-focused-sections"] })
      save()
    }
  }
  report.complete = true
  report.aggregate = Object.fromEntries(["lexical", "hybrid"].map(mode => {
    const rows = report.results.filter(row => row.mode === mode)
    return [mode, { recallAt5: rows.reduce((sum, row) => sum + row.recallAt5, 0) / rows.length,
      mrrAt10: rows.reduce((sum, row) => sum + row.reciprocalRank, 0) / rows.length,
      precisionAt5: rows.reduce((sum, row) => sum + row.precisionAt5, 0) / rows.length,
      historicalExcluded: rows.every(row => row.historicalExcluded) }]
  }))
  save()
  console.log(JSON.stringify(report.aggregate))
} catch (error) {
  report.error = String(error.message)
  save()
  process.exitCode = 1
  console.error(report.error)
}
