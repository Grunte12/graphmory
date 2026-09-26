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
  sectionFocusRerank,
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

test("governed retrieval excludes deprecated memory", () => {
  const deprecated = parseMarkdown("deprecated", "---\nstatus: deprecated\n---\n# Retired Policy\n\nshared brain")
  const tension = parseMarkdown("tension", "---\nstatus: tension\n---\n# Open Decision\n\nshared brain")
  assert.equal(isRetrievable(deprecated), false)
  assert.equal(isRetrievable(tension), true)
  assert.deepEqual(governedRank([deprecated, tension], "shared brain", "bm25").results.map((item) => item.id), ["tension"])
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

test("section retrieval follows a link outside the winning section", () => {
  const hub = parseMarkdown("hub.md", "# Hub\n\n## Matching\nrollback safety protocol\n\n## Related\nSee [[evidence]].")
  const evidence = parseMarkdown("evidence.md", "# Evidence\n\nIndependent recovery record.")
  const results = governedRank([hub, evidence], "rollback safety protocol", "bm25f-sections").results
  assert.deepEqual(results.map((item) => item.id), ["hub.md", "evidence.md"])
  assert.equal(results[1].retrievalSource, "wikilink:hub.md")
})

test("governed retrieval resolves relative paths and aliases while skipping ambiguous short names", () => {
  const parent = parseMarkdown("folder/parent", "# Primary routing policy\n\nUse primary routing policy. See [[Child]], [[restore-guide]], [[Same]], and [[Shared]].")
  const child = parseMarkdown("folder/Child.md", "# Child\n\nSupporting detail.")
  const alias = parseMarkdown("Reference/Recovery.md", "---\naliases: restore-guide\n---\n# Recovery\n\nRecovery steps.")
  const sameA = parseMarkdown("A/Same.md", "# Same A\n\nFirst duplicate.")
  const sameB = parseMarkdown("B/Same.md", "# Same B\n\nSecond duplicate.")
  const staleShared = parseMarkdown("C/Shared.md", "---\nstatus: stale\n---\n# Shared stale\n\nOld target.")
  const currentShared = parseMarkdown("D/Shared.md", "# Shared current\n\nCurrent target.")

  const results = governedRank([parent, child, alias, sameA, sameB, staleShared, currentShared], "primary routing policy", "bm25")
  const paths = results.results.map((item) => item.id)

  assert.ok(paths.includes("folder/Child.md"), "relative link should resolve against the source directory")
  assert.ok(paths.includes("Reference/Recovery.md"), "unique frontmatter alias should resolve")
  assert.equal(paths.includes("A/Same.md") || paths.includes("B/Same.md"), false, "ambiguous basename should not select a target")
  assert.equal(paths.includes("D/Shared.md"), false, "a stale duplicate should keep a short name ambiguous")
})

test("governed retrieval preserves exact path case and skips extensionless path collisions", () => {
  const parent = parseMarkdown("Parent.md", "# Zephyr routing protocol\n\nUse Zephyr routing protocol. See [[Folder/Target.md]] and [[Legacy]].")
  const exact = parseMarkdown("Folder/Target.md", "# Exact target\n\nCase-sensitive target.")
  const caseVariant = parseMarkdown("folder/target.md", "# Case variant\n\nDifferent path.")
  const legacyWithoutExtension = parseMarkdown("Legacy", "# Legacy without extension\n\nFirst collision.")
  const legacyWithExtension = parseMarkdown("Legacy.md", "# Legacy with extension\n\nSecond collision.")

  const results = governedRank([parent, exact, caseVariant, legacyWithoutExtension, legacyWithExtension], "Zephyr routing protocol", "bm25")
  const paths = results.results.map((item) => item.id)
  assert.ok(paths.includes("Folder/Target.md"), "an exact mixed-case path should resolve to its matching note")
  assert.equal(paths.includes("folder/target.md"), false, "a case variant should not replace the exact target")
  assert.equal(paths.includes("Legacy") || paths.includes("Legacy.md"), false, "extensionless ID collisions should remain ambiguous")
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

test("sectionFocusRerank returns results with rerankApplied flag", () => {
  const docs = [
    parseMarkdown("alpha", "# Alpha\nUse provenance for durable claims.\n\n## Verification\nAlways check the source."),
  ]
  const results = [{ id: "alpha", title: "Alpha", score: 2.5 }]
  const reranked = sectionFocusRerank(results, "provenance claims", docs)
  assert.equal(reranked.length, 1)
  assert.ok("rerankApplied" in reranked[0])
  assert.ok("rerankSignals" in reranked[0])
  assert.ok(reranked[0].rerankApplied === true)
  assert.ok(typeof reranked[0].rerankSignals.sectionFocus === "number")
  assert.ok(typeof reranked[0].rerankSignals.boost === "number")
})

test("sectionFocusRerank boosts heading-matched documents over body-only matches", () => {
  const headingMatch = parseMarkdown("policy.md", "# Rollback Procedure\n\nUse the verified rollback.")
  const bodyOnly = parseMarkdown("notes.md", "# General Notes\n\nrollback procedure rollback procedure")
  const results = governedRank([headingMatch, bodyOnly], "rollback procedure", "bm25f-sections").results
  assert.equal(results.length, 2)
  const reranked = sectionFocusRerank(results, "rollback procedure", [headingMatch, bodyOnly])
  assert.equal(reranked[0].id, "policy.md")
  assert.ok(reranked[0].rerankSignals.headingMatches >= 1)
  assert.ok(reranked[0].score > reranked[1].score)
})

test("sectionFocusRerank applies boost from co-occurring query terms in one section", () => {
  const focused = parseMarkdown(
    "focused.md",
    "# Root Cause\n\nAnalyze the root cause of each failure. Apply bounded retrieval.",
  )
  const scattered = parseMarkdown(
    "scattered.md",
    "# General Notes\n\n## Root\nSome root analysis notes here.\n\n## Cause\nDifferent cause examples.\n\n## Apply\nApply the policy carefully.\n\n## Retrieval\nRetrieval methods vary.",
  )
  const results = rank([focused, scattered], "root cause retrieval apply", "bm25f-sections").slice(0, 2)
  const reranked = sectionFocusRerank(results, "root cause retrieval apply", [focused, scattered])
  const focusedResult = reranked.find((r) => r.id === "focused.md")
  assert.ok(focusedResult.rerankApplied)
  assert.ok(focusedResult.rerankSignals.coOccurrenceMatches >= 2)
})

test("sectionFocusRerank preserves order for empty or stopword-only queries", () => {
  const docs = [
    parseMarkdown("a", "# A\nSome content here."),
    parseMarkdown("b", "# B\nOther content there."),
  ]
  const results = [{ id: "a", title: "A", score: 1 }, { id: "b", title: "B", score: 2 }]
  const reranked = sectionFocusRerank(results, "a an the", docs)
  assert.equal(reranked.length, 2)
  assert.equal(reranked[0].rerankApplied, false)
})

test("sectionFocusRerank returns original results when documents are missing", () => {
  const results = [{ id: "unknown", title: "Missing", score: 1.5 }]
  const reranked = sectionFocusRerank(results, "test query", [])
  assert.equal(reranked.length, 1)
  assert.equal(reranked[0].rerankApplied, false)
})

test("sectionFocusRerank handles document with only one section", () => {
  const doc = parseMarkdown("flat.md", "# Content Policy\n\nAlways verify provenance before storing claims.")
  const results = [{ id: "flat.md", title: "Content Policy", score: 2 }]
  const reranked = sectionFocusRerank(results, "provenance claims", [doc])
  assert.equal(reranked.length, 1)
  assert.ok("rerankApplied" in reranked[0])
  assert.ok("rerankSignals" in reranked[0])
})
