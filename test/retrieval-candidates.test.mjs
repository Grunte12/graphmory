import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { parseMarkdown } from "../src/retrieval.mjs"
import { buildNoteGraph } from "../src/graph-navigation.mjs"
import { personalizedPageRank, applyRetrievalCandidates, mmrOrder } from "../src/retrieval-candidates.mjs"
import { rankGraphLane } from "../src/hybrid-recall.mjs"
import { managedRecall } from "../src/decision-recall.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"
const document = (id, body, metadata = "") => parseMarkdown(id, `${metadata}# ${id}\n${body}\n`)
const results = ["A.md", "B.md", "C.md"].map((id, i) => ({ id, fusedScore: 1 - i * 0.02 }))
const docs = [document("A.md", "release approval unit alpha"), document("B.md", "release approval unit alpha"), document("C.md", "database backup owner gamma")]

test("experimental stages off preserve identical ranked results; invalid constants are rejected", () => {
  const baseline = applyRetrievalCandidates(results, "release", docs)
  assert.equal(baseline.results, results); assert.equal(baseline.reranked, false)
  for (const options of [{ mmrLambda: 2 }, { pprDamping: NaN }, { rerankMargin: -1 }, { abstainFloor: -1 }, { graphExpansion: "unknown" }]) {
    assert.throws(() => applyRetrievalCandidates(results, "release", docs, options), /INVALID_PIPELINE/)
  }
})

test("MMR keeps strongest evidence and moves redundant token-overlap notes behind complementary evidence", () => {
  const ranked = mmrOrder(results, docs, 0.7)
  assert.equal(ranked[0].id, "A.md"); assert.equal(ranked[1].id, "C.md")
  assert.deepEqual(new Set(ranked.map(r => r.id)), new Set(results.map(r => r.id)))
  assert.deepEqual(mmrOrder(results, docs, 1).map(r => r.id), results.map(r => r.id))
})

test("margin-gated rerank runs after fusion only when scores are uncertain, context starts with strongest", () => {
  const near = applyRetrievalCandidates(results, "release approval", docs, { rerankMargin: 0.1, mmr: true, contextOrder: "strongest-first" })
  assert.equal(near.reranked, true); assert.ok(near.results.every(r => Number.isFinite(r.rerankScore)))
  assert.equal(near.results[0].id, "A.md")
  const clear = applyRetrievalCandidates([{ id: "A.md", fusedScore: 1 }, { id: "B.md", fusedScore: 0.2 }], "release", docs, { rerankMargin: 0.1 })
  assert.equal(clear.reranked, false)
})

test("deterministic abstain floor gates before later stages and does not hide an accepted top candidate", () => {
  assert.equal(applyRetrievalCandidates(results, "release", docs, { abstainFloor: 1.1, mmr: true }).abstained, true)
  assert.equal(applyRetrievalCandidates(results, "release", docs, { abstainFloor: 1 }).results.length, 3)
  assert.deepEqual(applyRetrievalCandidates([], "release", [], { abstainFloor: 0.01 }).results, [])
})

test("bounded PPR is deterministic, honors three hops, and filters lifecycle without using graph connectivity as truth", () => {
  const chain = Array.from({ length: 6 }, (_, i) => document(`${i}.md`, i < 5 ? `[[${i + 1}.md]]` : "end"))
  chain.push(document("old.md", "[[0.md]]", "---\nstatus: superseded\n---\n"))
  const graph = buildNoteGraph(chain), seeds = [{ id: "0.md", fusedScore: 0.03 }]
  const a = personalizedPageRank(graph, seeds), b = personalizedPageRank(graph, seeds)
  assert.deepEqual(a, b); assert.equal(a.visited, 4); assert.equal(a.limited, true)
  assert.deepEqual(new Set(a.results.map(r => r.id)), new Set(["1.md", "2.md", "3.md"]))
  assert.ok(a.results.every(r => r.graphTrail.length <= 4 && r.score > 0))
  assert.equal(a.results.some(r => r.id === "old.md"), false)
  assert.equal(personalizedPageRank(graph, []).results.length, 0)
})

test("PPR caps seeds at eight and traversal at 512 visited nodes", () => {
  const documents = Array.from({ length: 700 }, (_, i) => document(`${i}.md`, "synthetic"))
  const byId = new Map(documents.map(d => [d.id, d]))
  const outgoing = new Map(documents.map(d => [d.id, new Set()])), incoming = new Map(documents.map(d => [d.id, new Set()]))
  for (let i = 1; i < 700; i++) { outgoing.get("0.md").add(`${i}.md`); incoming.get(`${i}.md`).add("0.md") }
  const graph = { byId, outgoing, incoming, edgeDetails: new Map() }
  const capped = personalizedPageRank(graph, [{ id: "0.md", fusedScore: 1 }])
  assert.equal(capped.visited, 512); assert.equal(capped.limited, true)
  const seedCapped = personalizedPageRank({ ...graph, outgoing: new Map(), incoming: new Map() }, documents.slice(0, 20).map(d => ({ id: d.id, fusedScore: 1 })))
  assert.equal(seedCapped.visited, 8)
})

test("managed/CLI candidate flags remain opt-in and gated abstention returns no candidates", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-candidates-")), vault = path.join(root, "vault")
  fs.mkdirSync(vault)
  t.after(() => fs.rmSync(root, { force: true, recursive: true }))
  fs.writeFileSync(path.join(vault, "A.md"), "# Release approval\nRelease approval policy. [[B.md]]\n")
  fs.writeFileSync(path.join(vault, "B.md"), "# Evidence\nIndependent approvers inspect originals.\n")
  const config = { ...DEFAULT_RUNTIME_CONFIG, retrievalMode: "lexical" }
  const base = await managedRecall(vault, "release approval", config, { stateRoot: path.join(root, "state") })
  const explicit = await managedRecall(vault, "release approval", config, { stateRoot: path.join(root, "state"), pipeline: {} })
  assert.deepEqual(base, explicit)
  const abstain = await managedRecall(vault, "release approval", config, { stateRoot: path.join(root, "state"), pipeline: { abstainFloor: 1 } })
  assert.equal(abstain.results.length, 0); assert.equal(abstain.decisionGate, "abstain-floor"); assert.equal(abstain.status, "abstain"); assert.equal(abstain.needsExpansion, false)
  const documents = [document("A.md", "release [[B.md]]"), document("B.md", "independent")]
  assert.equal(rankGraphLane(documents, "release", null, { graphExpansion: "ppr" }).method, "graph-ppr")
  fs.writeFileSync(path.join(root, "config.json"), JSON.stringify(config))
  const cli = spawnSync(process.execPath, ["scripts/brain-sync.mjs", "recall-managed", "--vault", vault, "--query", "release approval", "--json", "--abstain-floor", "1", "--state-root", path.join(root, "state")],
    { encoding: "utf8", env: { ...process.env, GRAPHMORY_CONFIG_PATH: path.join(root, "config.json") } })
  assert.equal(cli.status, 0, cli.stderr); assert.equal(JSON.parse(cli.stdout).decisionGate, "abstain-floor")
  const agent = spawnSync(process.execPath, ["scripts/brain-sync.mjs", "recall-managed", "--vault", vault, "--query", "release approval", "--agent", "--abstain-floor", "1", "--state-root", path.join(root, "state")],
    { encoding: "utf8", env: { ...process.env, GRAPHMORY_CONFIG_PATH: path.join(root, "config.json") } })
  assert.equal(agent.status, 0, agent.stderr); assert.equal(JSON.parse(agent.stdout).status, "abstain")
})
