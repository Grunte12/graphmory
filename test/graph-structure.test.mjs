import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { parseMarkdown } from "../src/retrieval.mjs"
import { buildNoteGraph, linkedNeighbors, summarizeNoteGraph } from "../src/graph-navigation.mjs"
import { recallVaultAdaptive } from "../src/adaptive-recall.mjs"

const docs = (entries) => Object.entries(entries).map(([id, text]) => parseMarkdown(id, text))

test("typed directed edges preserve relations and Markdown links resolve relative to source", () => {
  const graph = buildNoteGraph(docs({
    "project/Start.md": '---\ndepends_on:\n  - "[[project/Bridge]]"\npart_of: project/Index.md\n---\n# Start\n[Evidence](../Evidence%20note.md#proof)\n[wrong](https://example.com/remote.md)\n[broken](bad%ZZ.md)\n',
    "project/Bridge.md": '# Bridge', "project/Index.md": '# Index', "Evidence note.md": '# Evidence',
  }))
  const outgoing = linkedNeighbors(graph, "project/Start.md", "outgoing")
  assert.equal(outgoing.length, 3)
  assert.deepEqual(outgoing.find((n) => n.path === "project/Bridge.md").relations, ["depends_on"])
  assert.deepEqual(linkedNeighbors(graph, "project/Bridge.md", "backlinks")[0].relations, ["depends_on"])
})

test("code examples/comments cannot add false edges; ambiguous, stale and scoped targets stay excluded", () => {
  const documents = docs({
    "Start.md": '# Start\n```md\n[[Ghost]]\n```\n~~~md\n[[Ghost]]\n~~~\n`[[Ghost]]`\n<!-- [[Ghost]] -->\n[[Same]] [[Stale]] [[real/Target]]',
    "Ghost.md": '# Ghost', "a/Same.md": '# Same', "b/Same.md": '# Same',
    "Stale.md": '---\nstatus: stale\n---\n# Stale', "real/Target.md": '# Target',
  })
  assert.deepEqual(linkedNeighbors(buildNoteGraph(documents), "Start.md").map((n) => n.path), ["real/Target.md"])
  assert.deepEqual(linkedNeighbors(buildNoteGraph(documents, { scope: 'Start.md' }), "Start.md"), [])
  assert.equal(summarizeNoteGraph(documents).issueCounts.ambiguous, 1)
})

test("audit output and extraction stay bounded for noisy notes", () => {
  const report = summarizeNoteGraph(docs({ "Hub.md": `# Hub\n${Array.from({ length: 100 }, (_, i) => `[[Missing${i}]]`).join(' ')}` }))
  assert.equal(report.issues.length, 20)
  assert.equal(report.issueCounts.unresolved, 64)
  assert.equal(report.graphLimitReached, true)
})

test("query-aware frontier finds a late branch and preserves its two-hop trail", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-structure-"))
  try {
    const entries = {
      "Start.md": '# Zephyr\n[[A]] [[B]] [[C]] [[D]] [[ZBridge]]',
      "A.md": '# Apple', "B.md": '# Banana', "C.md": '# Cherry', "D.md": '# Date',
      "ZBridge.md": '---\ndepends_on: Answer.md\n---\n# Infrastructure routing',
      "Answer.md": '# Answer\nThe validated endpoint is port 4321.',
    }
    for (const [id, content] of Object.entries(entries)) fs.writeFileSync(path.join(vault, id), content)
    const result = await recallVaultAdaptive(vault, "Zephyr", { perRound: 1, facets: ["infrastructure"], assessEvidence: async ({ round }) => ({
      status: "partial", direction: "outgoing", ...(round === 0 ? { seedPaths: ["Start.md"] } : {}),
    }) })
    assert.ok(result.candidatePool.includes("Answer.md"), JSON.stringify(result))
    const answer = result.results.find((item) => item.path === "Answer.md")
    assert.equal(answer.trail.length, 2)
    assert.equal(answer.trail[1].source, "ZBridge.md")
    assert.deepEqual(answer.trail[1].relations, ["depends_on"])
    assert.equal(result.decisionCalls, 2)
    assert.ok(result.uniqueCandidates <= 12)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})


test("protocol-relative external URLs cannot become local graph edges", () => {
  const graph = buildNoteGraph(docs({ "Start.md": '# Start\n[remote](//host/Target.md)', "host/Target.md": '# Target' }))
  assert.equal(graph.edges, 0)
})

test("backlink trail retains the asserted edge direction", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-backlink-"))
  try {
    fs.writeFileSync(path.join(vault, "Seed.md"), '# Zephyr architecture\nPrimary note.')
    fs.writeFileSync(path.join(vault, "Evidence.md"), '---\nevidence_for: Seed.md\n---\n# Evidence\nA measured result.')
    const report = await recallVaultAdaptive(vault, "Zephyr architecture", { graphPolicy: "force" })
    const linked = report.results.find((item) => item.path === "Evidence.md")
    assert.equal(linked.parent, "Seed.md")
    assert.deepEqual(linked.trail[0], { source: "Evidence.md", target: "Seed.md", via: "backlink", relations: ["evidence_for"] })
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})
