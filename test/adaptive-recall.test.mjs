import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { buildNoteGraph, linkedNeighbors } from "../src/graph-navigation.mjs"
import { graphNavigationIntent, recallVaultAdaptive } from "../src/adaptive-recall.mjs"
import { loadVaultDocuments } from "../src/memory-recall.mjs"

function makeVault() {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-graph-loop-"))
  fs.mkdirSync(path.join(vault, "alpha"))
  fs.mkdirSync(path.join(vault, "beta"))
  fs.writeFileSync(path.join(vault, "Atlas.md"), "---\nstatus: active\n---\n# Atlas architecture\n\nThe Atlas design starts here. See [[Branch]] and [[Cycle]].\n")
  fs.writeFileSync(path.join(vault, "Branch.md"), "---\nstatus: active\n---\n# Branch\n\nA supporting branch points to [[Leaf]].\n")
  fs.writeFileSync(path.join(vault, "Leaf.md"), "---\nstatus: active\n---\n# Leaf\n\nThis is the second-hop evidence.\n")
  fs.writeFileSync(path.join(vault, "Cycle.md"), "---\nstatus: active\n---\n# Cycle\n\nThis points back to [[Atlas]].\n")
  fs.writeFileSync(path.join(vault, "Stale.md"), "---\nstatus: stale\n---\n# Stale\n\nThis outdated note links [[Atlas]].\n")
  fs.writeFileSync(path.join(vault, "alpha", "Same.md"), "# Alpha same\n\n[[Atlas]]\n")
  fs.writeFileSync(path.join(vault, "alpha", "Guide.md"), "# Guide\n\nThe nearby [[Same]] note is the intended target.\n")
  fs.writeFileSync(path.join(vault, "beta", "Same.md"), "# Beta same\n\n[[Atlas]]\n")
  fs.writeFileSync(path.join(vault, "Ambiguous.md"), "# Ambiguous\n\n[[Same]]\n")
  return vault
}

test("graph resolves exact links but skips ambiguous aliases and stale nodes", () => {
  const vault = makeVault()
  try {
    const graph = buildNoteGraph(loadVaultDocuments(vault))
    assert.deepEqual(linkedNeighbors(graph, "Ambiguous.md", "outgoing"), [])
    assert.deepEqual(linkedNeighbors(graph, "alpha/Guide.md", "outgoing").map((item) => item.path), ["alpha/Same.md"])
    const scopedGraph = buildNoteGraph(loadVaultDocuments(vault), { scope: "Ambiguous.md,alpha" })
    assert.deepEqual(linkedNeighbors(scopedGraph, "Ambiguous.md", "outgoing"), [])
    assert.deepEqual(linkedNeighbors(graph, "Atlas.md", "outgoing").map((item) => item.path), ["Branch.md", "Cycle.md"])
    assert.equal(linkedNeighbors(graph, "Atlas.md", "backlinks").some((item) => item.path === "Stale.md"), false)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("partial assessment traverses two hops and terminates on cycles", async () => {
  const vault = makeVault()
  try {
    const report = await recallVaultAdaptive(vault, "Atlas architecture", {
      maxCandidates: 12, maxRounds: 2, assessEvidence: async ({ round }) => ({
        status: "partial", direction: "outgoing", ...(round === 0 ? { seedPaths: ["Atlas.md"] } : {}),
      }),
    })
    assert.equal(report.rounds, 2)
    assert.ok(report.candidatePool.includes("Leaf.md"))
    assert.equal(report.candidatePool.includes("Stale.md"), false)
    assert.equal(new Set(report.candidatePool).size, report.candidatePool.length)
    assert.equal(report.decisionCalls, 2)
    assert.equal(report.nextAction, "lead-review")
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("explicit relation query triggers navigation; ordinary query keeps lexical baseline", async () => {
  const vault = makeVault()
  try {
    assert.equal(graphNavigationIntent("What other notes are linked to Atlas?")?.excludeSeed, true)
    assert.equal(graphNavigationIntent("What other project owns this feature?"), null)
    assert.equal(graphNavigationIntent("Which guide connects to this note through their shared index?")?.direction, "both")
    assert.equal(graphNavigationIntent("How does BM25 index terms?"), null)
    const ordinary = await recallVaultAdaptive(vault, "Atlas architecture", { graphPolicy: "auto" })
    assert.equal(ordinary.rounds, 0)
    assert.deepEqual(ordinary.results.map((item) => item.path), ordinary.baseline)
    const related = await recallVaultAdaptive(vault, "What other notes are linked to Atlas architecture?", { graphPolicy: "auto" })
    assert.ok(related.rounds > 0)
    assert.equal(related.results.some((item) => item.path === "Atlas.md"), false)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("malformed assessor decision fails instead of claiming enough evidence", async () => {
  const vault = makeVault()
  try {
    await assert.rejects(recallVaultAdaptive(vault, "Atlas architecture", { assessEvidence: async () => ({ status: "yes" }) }), /Invalid evidence assessment/u)
    await assert.rejects(recallVaultAdaptive(vault, "Atlas architecture", { assessEvidence: async () => ({ status: "partial", seedPaths: ["not-in-frontier.md"] }) }), /Invalid seed paths/u)
    await assert.rejects(recallVaultAdaptive(vault, "Atlas architecture", { assessEvidence: async () => ({ status: "enough", evidenceIds: ["not-assessed.md"] }) }), /must cite assessed evidence/u)
    await assert.rejects(recallVaultAdaptive(vault, "Atlas architecture", { assessorTimeoutMs: 5, assessEvidence: async () => new Promise(() => {}) }), /timed out/u)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("forced traversal ranks actual neighbors and no-neighbor queries retain lexical hit", async () => {
  const vault = makeVault()
  try {
    const forced = await recallVaultAdaptive(vault, "Atlas architecture", { graphPolicy: "force" })
    assert.ok(forced.rounds > 0)
    assert.ok(forced.results.some((item) => item.depth > 0))
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
  const solo = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-solo-"))
  try {
    fs.writeFileSync(path.join(solo, "Solo.md"), "# Solo\n\nSolo is the only note.\n")
    const report = await recallVaultAdaptive(solo, "What other notes are linked to Solo?", { graphPolicy: "auto" })
    assert.deepEqual(report.results.map((item) => item.path), ["Solo.md"])
  } finally { fs.rmSync(solo, { recursive: true, force: true }) }
})

test("navigation index can bridge two hops without occupying an evidence slot", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-route-index-"))
  try {
    fs.writeFileSync(path.join(vault, "Seed.md"), "# Zephyr architecture\n[[Index]]\n")
    fs.writeFileSync(path.join(vault, "Index.md"), "---\ncanonical_memory: false\n---\n# Index\n[[Answer]]\n")
    fs.writeFileSync(path.join(vault, "Answer.md"), "# Evidence\nThe Zephyr design uses a bounded route.\n")
    const result = await recallVaultAdaptive(vault, "Zephyr architecture", { graphPolicy: "force", maxRounds: 2 })
    assert.ok(result.expansionSources.some((item) => item.path === "Index.md"))
    assert.ok(result.expansionSources.some((item) => item.path === "Answer.md"))
    assert.ok(result.candidatePool.includes("Answer.md"))
    assert.equal(result.candidatePool.includes("Index.md"), false)
    assert.equal(result.results.some((item) => item.path === "Index.md"), false)
    const navigationOnly = await recallVaultAdaptive(vault, "Index", { assessEvidence: async ({ candidates }) => {
      const index = candidates.find((item) => item.path === "Index.md")
      assert.equal(index.role, "navigation")
      return { status: "enough", evidenceIds: [index.path] }
    } })
    assert.ok(navigationOnly.rounds > 0)
    assert.notEqual(navigationOnly.stopReason, "assessor-enough")
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("assessor sees bounded evidence and an unknown query never claims sufficiency", async () => {
  const vault = makeVault()
  try {
    let seen = 0
    const assessed = await recallVaultAdaptive(vault, "Atlas architecture", { assessEvidence: async ({ candidates }) => {
      seen++
      assert.ok(candidates.length <= 6)
      assert.ok(candidates.every((item) => item.excerpt.length <= 800 && /^[a-f0-9]{64}$/u.test(item.excerptHash)))
      return { status: "enough", evidenceIds: [candidates[0].path] }
    } })
    assert.equal(seen, 1)
    assert.equal(assessed.rounds, 0)
    assert.equal(assessed.stopReason, "assessor-enough")
    assert.equal(assessed.evidenceStatus, "unverified")
    assert.equal(assessed.assessedEvidence.length > 0, true)
    const unknown = await recallVaultAdaptive(vault, "What other notes explain quantum banana?", { graphPolicy: "auto" })
    assert.equal(unknown.evidenceStatus, "unverified")
    assert.notEqual(unknown.stopReason, "assessor-enough")
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})
