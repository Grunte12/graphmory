#!/usr/bin/env node
// Synthetic eval of the Curator stop rule over the real MCP engine (lexical lane, no model, no network).
// Relevance is decided by an oracle that knows the gold notes; this measures whether the stop rule plus the
// server's paging budget reach evidence that sits below page 1. It does not measure answer quality.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createMemoryEngine, MAX_RECALL_PAGES } from "../src/mcp-engine.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"
import { validateBrainBrief } from "../src/contracts.mjs"

const config = { ...DEFAULT_RUNTIME_CONFIG, retrievalMode: "lexical" }
const QUERY = "release approval policy"
const PAGE = 10
const FILLER = "lorem"

/** Notes ranked by how many times the query phrase appears; equal length keeps the BM25 order monotonic. */
function buildVault(root, { total, gold, allRelevant = false }) {
  const vault = path.join(root, "vault")
  fs.mkdirSync(vault, { recursive: true })
  const goldPaths = []
  for (let rank = 1; rank <= total; rank++) {
    const repeats = total - rank + 1
    const isGold = allRelevant || gold.includes(rank)
    const name = `${isGold ? "Evidence" : "Distractor"} ${String(rank).padStart(3, "0")}.md`
    const body = `${`${QUERY}. `.repeat(repeats)}${`${FILLER} `.repeat((total - repeats) * 3)}`
    fs.writeFileSync(path.join(vault, name), `# Note ${String(rank).padStart(3, "0")}\n\n${body}\n`)
    if (isGold) goldPaths.push(name)
  }
  return { vault, goldPaths }
}

/** The Curator stop rule from docs/guides/mcp-recall.md, with a relevance oracle in place of the model. */
async function curate(engine, isRelevant, { extraEmptyPages = 0 } = {}) {
  const found = new Map()
  let cursor, pagesRead = 0, emptyRun = 0, stopReason
  for (;;) {
    const page = await engine.recall({ query: QUERY, ...(cursor ? { cursor } : {}) })
    pagesRead += 1
    const relevant = page.candidates.filter((candidate) => isRelevant(candidate.path))
    for (const candidate of relevant) found.set(candidate.path, candidate.hash)
    emptyRun = relevant.length ? 0 : emptyRun + 1
    if (page.budgetReached) { stopReason = "budget"; break }
    if (!page.nextCursor) { stopReason = page.scanLimitReached ? "scan-limit" : "nothing-relevant-left"; break }
    if (emptyRun > extraEmptyPages) { stopReason = "nothing-relevant-left"; break }
    cursor = page.nextCursor
  }
  return { found, pagesRead, stopReason }
}

function brief(result) {
  const entries = [...result.found].map(([path, hash]) => ({ summary: `Supports the release approval policy (${path})`, path, hash }))
  return { outcome: entries.length ? "answered" : "no-evidence", stop_reason: result.stopReason, pages_read: result.pagesRead,
    relevant_memory: entries, constraints: [], watchouts: [], note_paths: entries.map((entry) => entry.path), direct_read_paths: [] }
}

const cases = [
  { id: "deep-multi-hop", total: 40, gold: [3, 13, 24], expect: { stop: "nothing-relevant-left", minPages: 3, needsDepth: true }, extraEmptyPages: 1,
    note: "needed notes at ranks 3, 13, 24" },
  { id: "shallow", total: 40, gold: [1, 2, 4], expect: { stop: "nothing-relevant-left", maxPages: 2 }, note: "needed notes all on page 1" },
  { id: "no-evidence", total: 40, gold: [], expect: { stop: "nothing-relevant-left", maxPages: 1, outcome: "no-evidence" }, note: "nothing relevant anywhere" },
  { id: "multi-part-gap", total: 40, gold: [2, 23], expect: { stop: "nothing-relevant-left", needsDepth: true }, extraEmptyPages: 1,
    note: "second part sits after one empty page" },
  { id: "budget", total: 120, gold: [], allRelevant: true, expect: { stop: "budget", pages: MAX_RECALL_PAGES }, note: "every note relevant: server cuts at the budget" },
]

const rows = []
let failed = false
for (const spec of cases) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-deep-paging-"))
  try {
    const { vault, goldPaths } = buildVault(root, spec)
    const engine = createMemoryEngine({ vault, stateRoot: path.join(root, "state"), config })
    const isRelevant = (candidate) => goldPaths.includes(candidate)
    // Precondition: the gold notes really sit where the case says (ranks are 1-based over the real ranking).
    const order = []
    for (let cursor; ;) {
      const page = await engine.recall({ query: QUERY, ...(cursor ? { cursor } : {}) })
      order.push(...page.candidates.map((candidate) => candidate.path))
      if (!page.nextCursor) break
      cursor = page.nextCursor
    }
    if (!spec.allRelevant) {
      const ranks = goldPaths.map((candidate) => order.indexOf(candidate) + 1)
      if (JSON.stringify(ranks) !== JSON.stringify(spec.gold)) throw new Error(`${spec.id}: gold ranks ${ranks} differ from ${spec.gold}`)
    }
    const adaptive = await curate(engine, isRelevant, { extraEmptyPages: spec.extraEmptyPages ?? 0 })
    // The replaced SKILL.md rule: page 1 plus one more page, whatever they contain.
    const onePageMore = { found: new Set(order.slice(0, PAGE * 2).filter(isRelevant)) }
    const outcome = brief(adaptive)
    const checks = {
      brief: validateBrainBrief(outcome).valid,
      stop: adaptive.stopReason === spec.expect.stop,
      pages: (spec.expect.pages === undefined || adaptive.pagesRead === spec.expect.pages) && (spec.expect.maxPages === undefined || adaptive.pagesRead <= spec.expect.maxPages)
        && (spec.expect.minPages === undefined || adaptive.pagesRead >= spec.expect.minPages),
      outcome: spec.expect.outcome === undefined || outcome.outcome === spec.expect.outcome,
      complete: spec.allRelevant || goldPaths.every((candidate) => adaptive.found.has(candidate)),
      depth: !spec.expect.needsDepth || onePageMore.found.size < goldPaths.length,
    }
    const pass = Object.values(checks).every(Boolean)
    failed ||= !pass
    rows.push({ id: spec.id, note: spec.note, pagesRead: adaptive.pagesRead, found: spec.allRelevant ? `${adaptive.found.size} notes` : `${adaptive.found.size}/${goldPaths.length}`,
      onePageMore: spec.allRelevant ? "-" : `${onePageMore.found.size}/${goldPaths.length}`, stop: adaptive.stopReason, pass, failedChecks: Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name) })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

console.log("# Deep paging eval (synthetic vault, lexical lane)\n")
console.log("| Case | Setup | Pages read | Found (stop rule) | Found (page once more) | stop_reason | Result |")
console.log("|---|---|---:|---:|---:|---|---|")
for (const row of rows) console.log(`| ${row.id} | ${row.note} | ${row.pagesRead} | ${row.found} | ${row.onePageMore} | ${row.stop} | ${row.pass ? "PASS" : `FAIL (${row.failedChecks.join(", ")})`} |`)
console.log("\nOracle relevance, synthetic notes. Shows reach and stopping behaviour only; it is not an answer-quality or speed result.")
if (failed) process.exit(1)
