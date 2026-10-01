import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { managedRecall } from "../src/decision-recall.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"
import { cachedDocumentWindowVectors, rankSemanticVectorLane } from "../src/semantic-recall.mjs"
import { loadVaultDocuments } from "../src/memory-recall.mjs"
import { parseMarkdown } from "../src/retrieval.mjs"
import { captureSummaryDependencies } from "../src/summary-memory.mjs"

test("normal hybrid fuses semantic and authored multi-hop graph paths with safe pagination", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-hybrid-")), vault = path.join(root, "vault")
  fs.mkdirSync(vault)
  const notes = {
    "Seed.md": "# Database recovery\n[[Bridge]]\n",
    "Bridge.md": "# Control plane\n[[Answer]]\n",
    "Answer.md": "# Safety owner\nTaylor authorizes production changes.\n",
    "Semantic.md": "# Continuity\nRestore service after an interruption.\n",
    "Old.md": "---\nstatus: superseded\n---\n# Database recovery\n",
  }
  for (const [id, markdown] of Object.entries(notes)) fs.writeFileSync(path.join(vault, id), markdown)
  try {
    const semanticLaneImpl = async (_, __, { documents }) => ({ method: "semantic-vector", model: "injected-test-only",
      results: documents.filter(document => document.id === "Semantic.md" || document.id === "Old.md") })
    const first = await managedRecall(vault, "database recovery", DEFAULT_RUNTIME_CONFIG, { k: 1, stateRoot: path.join(root, "state"), semanticLaneImpl })
    assert.deepEqual(first.candidateLanes, ["bm25", "bm25f-focused-sections", "semantic-vector", "graph"])
    const found = [...first.results]
    let page = first
    while (page.hasMore) {
      page = await managedRecall(vault, "database recovery", DEFAULT_RUNTIME_CONFIG, { k: 1, offset: page.nextOffset, stateRoot: path.join(root, "state"), semanticLaneImpl })
      found.push(...page.results)
    }
    assert.ok(found.some(item => item.path === "Semantic.md"))
    assert.ok(found.some(item => item.path === "Answer.md" && item.graphTrail.join(" → ") === "Seed.md → Bridge.md → Answer.md"))
    assert.ok(!found.some(item => item.path === "Old.md"))
    assert.equal(new Set(found.map(item => item.path)).size, found.length)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test("missing semantic backend is explicitly blocked and lexical mode is deliberate", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-hybrid-missing-"))
  try {
    fs.writeFileSync(path.join(root, "Note.md"), "# Recovery\n")
    const missing = async () => { throw new Error("OPTIONAL_DEPENDENCY_MISSING") }
    const blocked = await managedRecall(root, "recovery", DEFAULT_RUNTIME_CONFIG, { semanticLaneImpl: missing })
    assert.equal(blocked.code, "SEMANTIC_UNAVAILABLE")
    assert.deepEqual(blocked.results, [])
    assert.ok((await managedRecall(root, "recovery", DEFAULT_RUNTIME_CONFIG, { retrievalMode: "lexical", semanticLaneImpl: missing })).results.length)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test("embedding windows cover long-note tails, reuse cache, invalidate tail changes and remove obsolete notes", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-hybrid-window-")), vault = path.join(root, "vault"), cache = path.join(root, "cache")
  fs.mkdirSync(vault)
  try {
    let embedded = 0
    const embed = async texts => {
      const input = Array.isArray(texts) ? texts : [texts]
      if (Array.isArray(texts)) embedded += input.length
      return { tolist: () => input.map(text => text.includes("tail-secret") ? [1, 0] : [0, 1]) }
    }
    const long = parseMarkdown("Long.md", "# Long\n" + "filler ".repeat(3000) + "tail-secret")
    const opts = { vault, model: "test-only", modelCache: cache }
    const lane = await rankSemanticVectorLane(vault, "tail-secret", { ...opts, documents: [long], embedImpl: embed })
    assert.equal(lane.results[0].id, "Long.md")
    const count = embedded
    assert.ok(count > 1)
    await cachedDocumentWindowVectors([long], embed, opts)
    assert.equal(embedded, count)
    await cachedDocumentWindowVectors([parseMarkdown("Long.md", long.markdown.replace("tail-secret", "changed-tail"))], embed, opts)
    assert.ok(embedded > count)
    await cachedDocumentWindowVectors([], embed, opts)
    const file = fs.readdirSync(path.join(cache, "graphmory-vectors"))[0]
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(cache, "graphmory-vectors", file))).vectors, {})
    await assert.rejects(cachedDocumentWindowVectors([long], embed, { ...opts, modelCache: vault }), /INSIDE_VAULT/)
    let modelInvoked = false
    await assert.rejects(rankSemanticVectorLane(vault, "tail-secret", { documents: [long], modelCache: vault,
      embedImpl: async () => { modelInvoked = true; throw new Error("Must not start") } }), /INSIDE_VAULT/)
    assert.equal(modelInvoked, false)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test("scoped recall checks summary dependencies outside scope, then excludes changed summaries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-summary-scope-"))
  try {
    fs.mkdirSync(path.join(root, "Project"))
    fs.mkdirSync(path.join(root, "Evidence"))
    fs.writeFileSync(path.join(root, "Project", "Unrelated.MD"), "# Unrelated\nPreserve uppercase Markdown paths.\n")
    const source = "# Source\nOwner is Taylor.\n"
    fs.writeFileSync(path.join(root, "Evidence", "Source.md"), source)
    const deps = captureSummaryDependencies([parseMarkdown("Evidence/Source.md", source)], ["Evidence/Source.md"])
    fs.writeFileSync(path.join(root, "Project", "Summary.md"), `---\nmemory_kind: summary\nsummary_sources:\n  - ${JSON.stringify(deps[0])}\n---\n# Ownership\nTaylor is owner.\n`)
    assert.notEqual(loadVaultDocuments(root, { scope: "Project" }).find(document => document.id === "Project/Summary.md").metadata.status, "stale")
    fs.appendFileSync(path.join(root, "Evidence", "Source.md"), "Owner changed.\n")
    assert.equal(loadVaultDocuments(root, { scope: "Project" }).find(document => document.id === "Project/Summary.md").metadata.status, "stale")
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test("summary dependency loading applies raw-path status and case-insensitive summary kind", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-summary-raw-dependency-"))
  try {
    fs.mkdirSync(path.join(root, "00 Inbox"))
    fs.mkdirSync(path.join(root, "Project"))
    const source = "# Captured note\nAn unreviewed raw capture.\n"
    fs.writeFileSync(path.join(root, "00 Inbox", "Capture.md"), source)
    const dependency = captureSummaryDependencies([parseMarkdown("00 Inbox/Capture.md", source)], ["00 Inbox/Capture.md"])
    fs.writeFileSync(path.join(root, "Project", "Summary.md"), `---\nmemory_kind: Summary\nsummary_sources:\n  - ${JSON.stringify(dependency[0])}\n---\n# Summary\nA derived claim.\n`)

    const summary = loadVaultDocuments(root, { scope: "Project" }).find(document => document.id === "Project/Summary.md")
    assert.equal(summary.metadata.status, "stale")
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})
