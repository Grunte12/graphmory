import test from "node:test"
import assert from "node:assert/strict"
import {
  bm25fRank,
  bm25Rank,
  governedRank,
  isRetrievable,
  lexicalRank,
  parseMarkdown,
  rank,
  scoreRun,
  scoreRunGroups,
  splitMarkdownSections,
  tokenize,
} from "../src/retrieval.mjs"

const documents = [
  parseMarkdown("alpha", "# Alpha\nUse provenance for durable claims."),
  parseMarkdown("beta", "# Beta\nKeep routine transcripts out of memory."),
  parseMarkdown("gamma", "# Gamma\nProvenance paths support every stored claim."),
]
test("tokenizes words and compound identifiers", () => {
  assert.deepEqual(tokenize("Brain Brief and root-cause"), ["brain", "brief", "and", "root-cause", "root", "cause"])
})

test("BM25F conservatively matches regular English plurals", () => {
  const note = parseMarkdown("quality.md", "# Option Quality Flag\n\nA crossed market is unreliable.")
  assert.equal(rank([note], "options quality flags", "bm25f-sections")[0].id, note.id)
})

test("lexical retrieval drops zero-score documents", () => {
  assert.deepEqual(lexicalRank(documents, "transcripts").map((item) => item.id), ["beta"])
})

test("BM25 ranks repeated relevant evidence first", () => {
  assert.equal(bm25Rank(documents, "provenance claim")[0].id, "gamma")
})

test("scores recall and reciprocal rank at k", () => {
  const results = bm25Rank(documents, "provenance claim")
  const metrics = scoreRun(results, ["gamma"], 2)
  assert.equal(metrics.hit, 1)
  assert.equal(metrics.recall, 1)
  assert.equal(metrics.reciprocalRank, 1)
})

test("BM25F gives structured title matches more weight than repeated body noise", () => {
  const sectioned = [
    parseMarkdown("noise.md", "# General Notes\n\nrollback rollback rollback rollback"),
    parseMarkdown("rollback.md", "# Rollback Procedure\n\nRestore the previous release."),
  ].flatMap(splitMarkdownSections)
  assert.equal(bm25fRank(sectioned, "rollback procedure")[0].id, "rollback.md")
  assert.equal(rank([
    parseMarkdown("noise.md", "# General Notes\n\nrollback rollback rollback rollback"),
    parseMarkdown("rollback.md", "# Rollback Procedure\n\nRestore the previous release."),
  ], "rollback procedure", "bm25f-sections")[0].id, "rollback.md")
})

test("scores grouped relevance without double-counting alternatives", () => {
  const results = [
    { id: "policy-alt", characters: 10 },
    { id: "policy-main", characters: 20 },
    { id: "workflow", characters: 30 },
  ]
  const metrics = scoreRunGroups(results, [["policy-main", "policy-alt"], ["workflow"]], 3)
  assert.equal(metrics.hit, 1)
  assert.equal(metrics.recall, 1)
  assert.equal(metrics.reciprocalRank, 1)
  assert.equal(metrics.contextCharacters, 60)
})

test("section retrieval returns one best section per parent note", () => {
  const sectioned = [
    parseMarkdown(
      "policy",
      "# Policy\n\n## Old Decision\nUse browser screenshots.\n\n## Current Decision\nUse Playwright evidence.",
    ),
    parseMarkdown("other", "# Other\nUse backend tests."),
  ]
  const results = rank(sectioned, "current Playwright", "bm25-sections")
  assert.equal(results[0].id, "policy")
  assert.match(results[0].title, /Current Decision/)
  assert.equal(results.filter((item) => item.id === "policy").length, 1)
})

test("section retrieval preserves path and frontmatter aliases", () => {
  const aliased = parseMarkdown(
    "policies/deployment-recovery.md",
    "---\naliases: restore cloud service\nstatus: current\n---\n# Operations\n\n## Procedure\nUse the verified rollback.",
  )
  assert.equal(rank([aliased], "restore cloud service", "bm25-sections")[0].id, aliased.id)
  assert.equal(rank([aliased], "deployment recovery", "bm25-sections")[0].id, aliased.id)
})

test("section retrieval indexes Obsidian YAML list aliases", () => {
  const aliased = parseMarkdown(
    "memory/context.md",
    "---\naliases:\n  - active context operations\n  - finite attention budget\ntags: [context-engineering, retrieval]\nstatus: current\n---\n# Context Policy\n\nKeep evidence bounded.",
  )
  assert.deepEqual(aliased.metadata.aliases, ["active context operations", "finite attention budget"])
  assert.deepEqual(aliased.metadata.tags, ["context-engineering", "retrieval"])
  assert.equal(rank([aliased], "finite attention budget", "bm25f-sections")[0].id, aliased.id)
})

test("governed retrieval excludes stale and raw memory", () => {
  const current = parseMarkdown("current", "---\nstatus: current\naliases: shared brain\n---\n# Sync Policy\n\nUse reviewed fast-forward synchronization.")
  const stale = parseMarkdown("stale", "---\nstatus: stale\n---\n# Old Sync\n\nshared brain shared brain automatic merge")
  const raw = parseMarkdown("raw", "---\nstatus: raw\n---\n# Capture\n\nshared brain terminal dump")

  assert.equal(isRetrievable(current), true)
  assert.equal(isRetrievable(stale), false)
  assert.equal(isRetrievable(raw), false)
  const result = governedRank([stale, raw, current], "shared brain", "bm25")
  assert.deepEqual(result.results.map((item) => item.id), ["current"])
  assert.equal(result.excluded, 2)
})

test("governed retrieval follows one bounded wikilink hop", () => {
  const policy = parseMarkdown("policy.md", "---\nstatus: current\n---\n# Policy\n\nUse safe sync. See [[conflict]].")
  const conflict = parseMarkdown("conflict.md", "---\nstatus: current\n---\n# Conflict\n\nPreserve competing evidence.")
  const result = governedRank([policy, conflict], "safe sync", "bm25")
  assert.deepEqual(result.results.map((item) => item.id), ["policy.md", "conflict.md"])
  assert.equal(result.results[1].retrievalSource, "wikilink:policy.md")
  const sectionResult = governedRank([policy, conflict], "safe sync", "bm25-sections")
  assert.deepEqual(sectionResult.results.map((item) => item.id), ["policy.md", "conflict.md"])
})

test("governed retrieval can rerank an already-matching linked note", () => {
  const hub = parseMarkdown("hub", "# Recovery Hub\n\nrollback procedure [[canonical]]")
  const noise = parseMarkdown("noise", "# Rollback Procedure\n\nrollback rollback procedure")
  const canonical = parseMarkdown("canonical", "# Canonical Restore\n\nprocedure with verified provenance")
  const results = governedRank([hub, noise, canonical], "rollback procedure", "bm25f-sections").results
  const linked = results.find((item) => item.id === "canonical")
  assert.match(linked.retrievalSource, /wikilink/)
  assert.ok(linked.score > rank([hub, noise, canonical], "rollback procedure", "bm25f-sections").find((item) => item.id === "canonical").score)
})
