import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { buildCurationRecommendations } from "../src/curation-recommendations.mjs"

test("stress retrieval benchmark reports misses, pollution, cost, and latency", () => {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mph-stress-")), "report.json")
  const result = spawnSync(
    process.execPath,
    ["scripts/eval-retrieval-stress.mjs", "--notes", "40", "--json", output],
    { cwd: path.resolve("."), encoding: "utf8" },
  )

  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(fs.readFileSync(output, "utf8"))
  assert.equal(report.notes, 40)
  assert.equal(report.queries, 50)
  for (const method of ["lexical", "bm25", "bm25-sections"]) {
    const summary = report.methods[method].summary
    assert.equal(typeof summary.misses, "number")
    assert.equal(typeof summary.pollutedQueries, "number")
    assert.equal(typeof summary.currentMemoryAccuracy, "number")
    assert.ok(summary.estimatedContextTokens >= 0)
    assert.ok(summary.averageQueryMs >= 0)
  }
  assert.ok(report.methods.lexical.summary.pollutedQueries > 0, "fixture should expose lifecycle pollution")
  assert.ok(report.methods.lexical.summary.currentMemoryAccuracy < report.methods.lexical.summary.hitAtK)
  assert.equal(report.methods["governed-lexical"].summary.pollutedQueries, 0)
  assert.ok(
    report.methods["governed-lexical"].summary.recallAtK >= report.methods.lexical.summary.recallAtK,
    "governed retrieval should not reduce lexical recall",
  )
})

test("vault retrieval eval supports grouped acceptable evidence", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mph-vault-eval-"))
  const vault = path.join(root, "vault")
  fs.mkdirSync(vault, { recursive: true })
  fs.writeFileSync(path.join(vault, "Primary Policy.md"), "# Primary Policy\nUse governed recall for agent memory.\n")
  fs.writeFileSync(path.join(vault, "Policy Summary.md"), "# Policy Summary\nUse governed recall for agent memory.\n")
  fs.writeFileSync(path.join(vault, "Workflow.md"), "# Workflow\nApply memory patches after verification.\n")
  const queries = path.join(root, "queries.json")
  fs.writeFileSync(queries, JSON.stringify([
    {
      id: "grouped-policy",
      query: "governed recall agent memory",
      relevant_groups: [["Primary Policy.md", "Policy Summary.md"], ["Workflow.md"]],
    },
  ]))
  const output = path.join(root, "report.json")
  const result = spawnSync(
    process.execPath,
    ["scripts/eval-vault-retrieval.mjs", "--vault", vault, "--queries", queries, "--json", output],
    { cwd: path.resolve("."), encoding: "utf8" },
  )

  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(fs.readFileSync(output, "utf8"))
  const run = report.methods["governed-bm25-sections"].runs[0]
  assert.equal(run.goldMode, "groups")
  assert.equal(run.metrics.hit, 1)
})

test("curation recommender turns retrieval misses into bounded actions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mph-curation-reco-"))
  const report = path.join(root, "report.json")
  const queries = path.join(root, "queries.json")
  const output = path.join(root, "recommendations.json")
  fs.writeFileSync(report, JSON.stringify({
    k: 3,
    methods: {
      "governed-bm25f-sections": {
        runs: [
          {
            id: "miss-1",
            category: "routing",
            metrics: { hit: 0, reciprocalRank: 0.2 },
            retrieved: ["Memory/Summary.md"],
          },
        ],
      },
    },
  }))
  fs.writeFileSync(queries, JSON.stringify([
    {
      id: "miss-1",
      category: "routing",
      query: "Who owns premium interface verification?",
      relevant: ["Memory/UI Ownership.md"],
      scope: "Memory",
    },
  ]))
  const result = spawnSync(
    process.execPath,
    ["scripts/recommend-curation.mjs", "--report", report, "--queries", queries, "--json", output],
    { cwd: path.resolve("."), encoding: "utf8" },
  )

  assert.equal(result.status, 0, result.stderr)
  const recommendations = JSON.parse(fs.readFileSync(output, "utf8"))
  assert.equal(recommendations.misses, 1)
  assert.equal(recommendations.byKind["buried-gold"], 1)
  assert.equal(recommendations.bySeverity.medium, 1)
  assert.equal(recommendations.recommendations[0].kind, "buried-gold")
  assert.match(recommendations.recommendations[0].actions.join("\n"), /aliases\/frontmatter/)
})

test("curation recommender classifies common worst-case miss shapes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mph-curation-shapes-"))
  const report = path.join(root, "report.json")
  const queries = path.join(root, "queries.json")
  const output = path.join(root, "recommendations.json")
  fs.writeFileSync(report, JSON.stringify({
    k: 3,
    methods: {
      "governed-bm25f-sections": {
        runs: [
          {
            id: "missing-scope",
            category: "routing",
            metrics: { hit: 0, reciprocalRank: 0.25 },
            retrieved: ["Global/Summary.md"],
          },
          {
            id: "no-candidates",
            category: "semantic",
            metrics: { hit: 0, reciprocalRank: 0 },
            retrieved: [],
          },
          {
            id: "vocabulary-gap",
            category: "semantic",
            metrics: { hit: 0, reciprocalRank: 0 },
            retrieved: ["Memory/Adjacent.md"],
          },
        ],
      },
    },
  }))
  fs.writeFileSync(queries, JSON.stringify([
    {
      id: "missing-scope",
      category: "routing",
      query: "Which decision owns visual verification?",
      relevant: ["Memory/UI Ownership.md"],
    },
    {
      id: "no-candidates",
      category: "semantic",
      query: "Which memory covers quantum tomato deployment?",
      relevant_groups: [["Memory/No Match.md"]],
      scope: "Memory",
    },
    {
      id: "vocabulary-gap",
      category: "semantic",
      query: "Who handles aesthetic acceptance?",
      relevant: ["Memory/UI Ownership.md"],
      scope: "Memory",
    },
  ]))
  const result = spawnSync(
    process.execPath,
    ["scripts/recommend-curation.mjs", "--report", report, "--queries", queries, "--json", output],
    { cwd: path.resolve("."), encoding: "utf8" },
  )

  assert.equal(result.status, 0, result.stderr)
  const recommendations = JSON.parse(fs.readFileSync(output, "utf8"))
  assert.deepEqual(recommendations.byKind, {
    "missing-scope": 1,
    "no-candidates": 1,
    "gold-ambiguity-or-vocabulary": 1,
  })
  assert.deepEqual(recommendations.bySeverity, { high: 2, medium: 1 })
})

test("curation recommender emits review-only structured patch candidates", () => {
  const report = {
    k: 3,
    methods: {
      "governed-bm25f-sections": {
        runs: [{
          id: "buried",
          retrieved: ["03 Reference/Agent Engineering/Hub.md", "noise.md"],
          metrics: { hit: 0, reciprocalRank: 0.2 },
        }],
      },
    },
  }
  const queries = [{
    id: "buried",
    category: "semantic",
    scope: "03 Reference/Agent Engineering",
    query: "persistent cognitive context lifecycle",
    relevant: ["03 Reference/Agent Engineering/Memory Lifecycle.md"],
  }]

  const result = buildCurationRecommendations(report, queries)
  const candidates = result.recommendations[0].patchCandidates
  assert.equal(candidates.some((item) => item.type === "alias-patch-candidate"), true)
  assert.equal(candidates.some((item) => item.type === "moc-link-candidate"), true)
  assert.equal(candidates.some((item) => item.type === "grouped-gold-review"), true)
  assert.equal(candidates.every((item) => item.requiresHumanReview && !item.autoApplicable), true)
})
