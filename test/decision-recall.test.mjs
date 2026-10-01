import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { spawnSync } from "node:child_process"
import { chooseAdaptiveMode, curatorEvidencePreview, managedRecall } from "../src/decision-recall.mjs"
import { loadVaultDocuments, recallVaultLoop } from "../src/memory-recall.mjs"
import { DEFAULT_RUNTIME_CONFIG as HYBRID_RUNTIME_CONFIG, loadRuntimeConfig, saveRuntimeConfig, validateRuntimeConfig, retrievalMethods } from "../src/runtime-config.mjs"
const DEFAULT_RUNTIME_CONFIG = { ...HYBRID_RUNTIME_CONFIG, retrievalMode: "lexical" }

test("omitted short sections require original reads even when displayed previews are not truncated", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-preview-coverage-"))
  try {
    fs.writeFileSync(path.join(vault, "travel.md"), "# Travel\n## Overview\nJohn travel plans.\n## A\nJohn travel plans in spring.\n## B\nJohn travel plans in summer.\n## C\nI was in Chicago.")
    const page = await managedRecall(vault, "John travel plans", DEFAULT_RUNTIME_CONFIG, { evidencePreview: true })
    const candidate = page.results.find(item => item.path === "travel.md")
    assert.ok(candidate.evidencePreview.every(section => !section.truncated))
    assert.ok(candidate.evidencePreview.every(section => !section.text.includes("Chicago")))
    assert.equal(candidate.sourceReadRequired, true)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("curator pages through all matching paths while an explicit smaller page still works", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-curator-depth-"))
  try {
    for (let index = 1; index <= 16; index++) {
      fs.writeFileSync(path.join(vault, `Note-${index}.md`), `# Project memory ${index}\n\nProject memory evidence for the query.`)
    }
    const broad = await managedRecall(vault, "project memory evidence", DEFAULT_RUNTIME_CONFIG)
    const narrow = await managedRecall(vault, "project memory evidence", DEFAULT_RUNTIME_CONFIG, { k: 3 })
    const second = await managedRecall(vault, "project memory evidence", DEFAULT_RUNTIME_CONFIG, { offset: broad.nextOffset })
    assert.equal(broad.workflow, "curator")
    assert.equal(broad.results.length, 10)
    assert.equal(narrow.results.length, 3)
    assert.equal(broad.totalCandidates, 16)
    assert.equal(broad.hasMore, true)
    assert.equal(broad.nextOffset, 10)
    const legacy = recallVaultLoop(vault, "project memory evidence", { k: 10, perMethodLimit: 8, documents: loadVaultDocuments(vault), methods: retrievalMethods(DEFAULT_RUNTIME_CONFIG.retrievalProfile) })
    assert.deepEqual(broad.results.slice(0, legacy.results.length).map((item) => item.path), legacy.results.map((item) => item.path))
    assert.equal(second.results.length, 6)
    assert.equal(second.hasMore, false)
    assert.equal(second.nextOffset, null)
    assert.equal(new Set([...broad.results, ...second.results].map((item) => item.path)).size, 16)
    assert.ok(broad.results.every((result) => !Object.hasOwn(result, "excerpt")))
    assert.equal((await managedRecall(vault, "unmatchedzzz", DEFAULT_RUNTIME_CONFIG)).totalCandidates, 0)
    assert.equal((await managedRecall(vault, "project memory evidence", DEFAULT_RUNTIME_CONFIG, { offset: 16 })).results.length, 0)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("Curator semantic candidates remain pageable through ordinary, byte and adaptive pages", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-curator-semantic-pages-"))
  try {
    const project = path.join(vault, "Project")
    fs.mkdirSync(project)
    const names = ["Amber", "Birch", "Cedar", "Dahlia", "Elm", "Flint", "Garnet", "Hazel", "Indigo", "Juniper", "Kelp", "Lilac", "Maple", "Nectar", "Olive", "Pebble", "Quartz", "Rowan"]
    for (const [index, name] of names.entries()) {
      fs.writeFileSync(path.join(project, `note-${String(index).padStart(2, "0")}.md`),
        `# ${name} reference record with a deliberately extended heading for byte-page coverage\n\nContent has no query terms.`)
    }
    let laneCalls = 0
    const semanticLaneImpl = async (_vault, _query, options) => {
      laneCalls += 1
      assert.equal(options.scope, "Project")
      assert.equal(options.answerCandidatesOnly, true)
      assert.equal(options.documents.length, 18)
      return {
        method: "semantic-vector",
        model: "injected-bge",
        results: [...options.documents].reverse().map((document, index) => ({
          id: document.id, score: 1000 - index,
        })),
      }
    }

    async function collect(options = {}) {
      let offset = 0
      const paths = []
      let pageCount = 0
      while (true) {
        const page = await managedRecall(vault, "zzqvnebrule", DEFAULT_RUNTIME_CONFIG, {
          ...options, offset, scope: "Project", semanticExpansion: true, semanticLaneImpl,
        })
        pageCount += 1
        assert.equal(page.expanded, true)
        assert.equal(page.semanticModel, "injected-bge")
        assert.deepEqual(page.candidateLanes, ["bm25", "bm25f-focused-sections", "semantic-vector"])
        assert.equal(page.totalCandidates, 18)
        assert.equal(page.scanLimitReached, false)
        assert.ok(page.results.length > 0)
        assert.ok(page.results.every((item) => !Object.hasOwn(item, "relevance")))
        paths.push(...page.results.map((item) => item.path))
        if (!page.hasMore) break
        assert.equal(page.nextOffset, offset + page.results.length)
        assert.ok(page.nextOffset > offset)
        offset = page.nextOffset
        assert.ok(pageCount < 20)
      }
      assert.equal(new Set(paths).size, 18)
      assert.deepEqual(paths, names.map((_, index) => `Project/note-${String(17 - index).padStart(2, "0")}.md`))
      return pageCount
    }

    assert.equal((await managedRecall(vault, "zzqvnebrule", DEFAULT_RUNTIME_CONFIG, { scope: "Project" })).totalCandidates, 0)
    const ordinaryPages = await collect()
    const bytePages = await collect({ bundleBytes: 2000 })
    const adaptivePages = await collect({ adaptiveBundle: true })
    assert.equal(ordinaryPages, 2)
    assert.ok(bytePages > 1)
    assert.equal(adaptivePages, 2)
    assert.equal(laneCalls, ordinaryPages + bytePages + adaptivePages)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("Curator sanitizes semantic lane IDs and uses authoritative note metadata", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-curator-semantic-filter-"))
  try {
    const project = path.join(vault, "Project")
    fs.mkdirSync(project)
    fs.writeFileSync(path.join(project, "current.md"), "# Real Current Title\n\nCurrent content.")
    fs.writeFileSync(path.join(project, "stale.md"), "---\nstatus: stale\n---\n# Stale\n\nOld content.")
    fs.writeFileSync(path.join(project, "navigation.md"), "---\ncanonical_memory: false\n---\n# Navigation\n\nIndex only.")
    fs.writeFileSync(path.join(project, "history.md"), "---\nstatus: superseded\n---\n# Superseded\n\nEarlier content.")
    fs.mkdirSync(path.join(vault, "00 inbox"))
    fs.writeFileSync(path.join(vault, "00 inbox", "raw.md"), "# Raw\n\nInbox content.")
    fs.writeFileSync(path.join(vault, "outside.md"), "# Outside\n\nOut of scope.")
    const semanticLaneImpl = async (_vault, _query, options) => ({
      method: "semantic-vector",
      model: "injected-bge",
      results: [
        { id: "Project/current.md", title: "Forged title", metadata: { status: "stale" } },
        { id: "Project/current.md", title: "duplicate" },
        { id: "Project/stale.md" },
        { id: "Project/navigation.md" },
        { id: "Project/history.md" },
        { id: "00 inbox/raw.md" },
        { id: "outside.md" },
        { id: "Project/unknown.md" },
      ],
    })

    const current = await managedRecall(vault, "semantic query", DEFAULT_RUNTIME_CONFIG, {
      scope: "Project", semanticExpansion: true, semanticLaneImpl,
    })
    assert.deepEqual(current.results.map((item) => item.path), ["Project/current.md"])
    assert.equal(current.totalCandidates, 1)
    assert.equal(current.results[0].title, "Real Current Title")
    assert.equal(current.results[0].status, "current")

    const historical = await managedRecall(vault, "semantic query", DEFAULT_RUNTIME_CONFIG, {
      scope: "Project", includeSuperseded: true, semanticExpansion: true, semanticLaneImpl,
    })
    assert.ok(historical.results.some((item) => item.path === "Project/history.md"))
    assert.equal(historical.historicalCandidatesIncluded, true)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("Curator semantic expansion is opt-in and inference failures stay explicit", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-curator-semantic-opt-in-"))
  try {
    fs.writeFileSync(path.join(vault, "current.md"), "# Current\n\nSome current content.")
    let laneCalls = 0
    const semanticLaneImpl = async () => {
      laneCalls += 1
      throw new Error("OPTIONAL_DEPENDENCY_MISSING: semantic model unavailable")
    }
    const baseline = await managedRecall(vault, "current", DEFAULT_RUNTIME_CONFIG)
    const disabled = await managedRecall(vault, "current", DEFAULT_RUNTIME_CONFIG, {
      semanticExpansion: false, semanticLaneImpl,
    })
    assert.deepEqual(disabled, baseline)
    assert.equal(laneCalls, 0)
    assert.equal(Object.hasOwn(disabled, "expanded"), false)
    await assert.rejects(managedRecall(vault, "current", DEFAULT_RUNTIME_CONFIG, {
      semanticExpansion: true, semanticLaneImpl,
    }), /OPTIONAL_DEPENDENCY_MISSING/u)
    assert.equal(laneCalls, 1)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("optional curator previews keep every candidate and prefer matched user evidence on ties", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-curator-preview-"))
  try {
    fs.writeFileSync(path.join(vault, "one.md"), "# Kitchen conversation\n## user\nI bought a new kitchen mat.\n## assistant\nKitchen recipe suggestions are unrelated.\n## user\nLater I replaced a toaster.")
    fs.writeFileSync(path.join(vault, "two.md"), "# Kitchen note\nThe faucet was fixed.")
    const baseline = await managedRecall(vault, "kitchen", DEFAULT_RUNTIME_CONFIG, { k: 1 })
    const preview = await managedRecall(vault, "kitchen", DEFAULT_RUNTIME_CONFIG, { k: 1, evidencePreview: true })
    assert.equal(preview.totalCandidates, baseline.totalCandidates)
    assert.equal(preview.nextOffset, baseline.nextOffset)
    assert.deepEqual(preview.results.map((item) => item.path), baseline.results.map((item) => item.path))
    const next = await managedRecall(vault, "kitchen", DEFAULT_RUNTIME_CONFIG, { k: 1, offset: preview.nextOffset, evidencePreview: true })
    const all = [...preview.results, ...next.results]
    assert.equal(all.length, 2)
    const conversation = all.find((item) => item.path === "one.md")
    assert.match(conversation.evidencePreview[0].heading, /user$/u)
    assert.match(conversation.evidencePreview[0].text, /new kitchen mat/u)
    const replacement = curatorEvidencePreview(loadVaultDocuments(vault).find((item) => item.id === "one.md"), "replace")
    assert.match(replacement[1].text, /replaced a toaster/u)
    assert.ok(all.every((item) => item.evidencePreview.every((section) => section.text.length <= 350)))
    assert.ok(baseline.results.every((item) => !Object.hasOwn(item, "evidencePreview")))
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("byte-budgeted curator bundle preserves ranking and continuation across note layouts", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-curator-bundle-"))
  try {
    for (let index = 0; index < 25; index++) {
      const markdown = index % 2
        ? `# Project note ${index}\n## Decision\nProject memory evidence: choose the current API.`
        : `# Conversation ${index}\n## user\nProject memory evidence for the release.\n## assistant\nAcknowledged.`
      fs.writeFileSync(path.join(vault, `note-${index}.md`), markdown)
    }
    const baseline = []
    for (let offset = 0; ; offset += 10) {
      const page = await managedRecall(vault, "project memory evidence", DEFAULT_RUNTIME_CONFIG, { offset })
      baseline.push(...page.results.map((item) => item.path))
      if (!page.hasMore) break
    }
    const bundled = []
    let offset = 0
    do {
      const page = await managedRecall(vault, "project memory evidence", DEFAULT_RUNTIME_CONFIG, { offset, bundleBytes: 2000 })
      assert.equal(page.totalCandidates, baseline.length)
      assert.ok(page.results.length > 0)
      assert.ok(page.bundleUsedBytes <= page.bundleBytes)
      assert.ok(page.results.every((item) => item.evidencePreview.length > 0))
      bundled.push(...page.results.map((item) => item.path))
      if (!page.hasMore) break
      assert.ok(page.nextOffset > offset)
      offset = page.nextOffset
    } while (true)
    assert.deepEqual(bundled, baseline)
    assert.equal(new Set(bundled).size, 25)
    const adaptive = await managedRecall(vault, "project memory evidence", DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true })
    assert.equal(adaptive.adaptiveMode, "wide")
    assert.ok(adaptive.results.length > 10)
    const matchedPaths = []
    let matchedOffset = 0
    do {
      const page = await managedRecall(vault, "project memory evidence", DEFAULT_RUNTIME_CONFIG, { offset: matchedOffset, adaptiveBundle: true, matchedPreviews: true })
      matchedPaths.push(...page.results.map((item) => item.path))
      if (!page.hasMore) break
      matchedOffset = page.nextOffset
    } while (true)
    assert.deepEqual(matchedPaths, baseline)
    await assert.rejects(managedRecall(vault, "project memory evidence", DEFAULT_RUNTIME_CONFIG, { bundleBytes: 1999 }), /bundleBytes/u)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("adaptive routing keeps descriptive, narrow lookups small and expands exhaustive questions", () => {
  const descriptive = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa"]
    .map((name) => ({ title: `Distinct architecture concept ${name}` }))
  assert.equal(chooseAdaptiveMode("Which paper explains memory layers?", descriptive), "focused")
  assert.equal(chooseAdaptiveMode("List all memory layers", descriptive), "wide")
  assert.equal(chooseAdaptiveMode("Find all papers about memory", descriptive), "wide")
  assert.equal(chooseAdaptiveMode("Is there a case against RAG at all?", descriptive), "focused")
  assert.equal(chooseAdaptiveMode("Which benchmark evaluates retrieval across datasets?", descriptive), "focused")
  assert.equal(chooseAdaptiveMode("How much did the ticket cost?", descriptive), "focused")
  assert.equal(chooseAdaptiveMode("How many projects changed?", descriptive), "wide")
  const generic = Array.from({ length: 10 }, (_, index) => ({ title: `Conversation ${index + 1}` }))
  assert.equal(chooseAdaptiveMode("What happened to the project?", generic), "wide")
})

test("matched previews omit weak text without dropping ranked paths or changing ordinary auto", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-matched-preview-"))
  try {
    fs.writeFileSync(path.join(vault, "adjacent.md"), "# Adjacent gift\n## user\nI bought a gift for my coworker.\n## assistant\nThat sounds thoughtful.")
    fs.writeFileSync(path.join(vault, "answer.md"), "# Birthday source\n## user\nMy sister gave me a birthday gift: a stand mixer.\n## assistant\nEnjoy it.")
    const query = "What did dad give me as a birthday gift?"
    const wideQuery = "List all evidence: what did dad give me as a birthday gift?"
    const ordinary = await managedRecall(vault, wideQuery, DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true })
    const matched = await managedRecall(vault, wideQuery, DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true, matchedPreviews: true })
    assert.deepEqual(matched.results.map((item) => item.path), ordinary.results.map((item) => item.path))
    assert.equal(matched.totalCandidates, ordinary.totalCandidates)
    assert.ok(ordinary.results.find((item) => item.path === "adjacent.md").evidencePreview.length > 0)
    assert.equal(matched.results.find((item) => item.path === "adjacent.md").evidencePreview, undefined)
    assert.match(matched.results.find((item) => item.path === "answer.md").evidencePreview[0].text, /stand mixer/u)
    await assert.rejects(managedRecall(vault, query, DEFAULT_RUNTIME_CONFIG, { matchedPreviews: true }), /requires adaptiveBundle/u)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("optional coverage previews surface matching speaker turns without changing candidates", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-coverage-preview-"))
  try {
    fs.writeFileSync(path.join(vault, "conversation.md"), "# Conversation\nTimestamp: Tuesday\n## Nate (D1:1)\nHow is Joanna?\n## Joanna (D1:2)\nI am allergic to reptiles.\n## Nate (D1:3)\nThat sounds difficult.\n## Joanna (D1:4)\nI also avoid animals with fur.")
    fs.writeFileSync(path.join(vault, "ordinary.md"), "# Ordinary project note\n## Decision\nJoanna approved the release.")
    const query = "What is Joanna allergic to?"
    const baseline = await managedRecall(vault, query, DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true })
    const coverage = await managedRecall(vault, query, DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true, coveragePreviews: true })
    assert.deepEqual(coverage.results.map(item => item.path), baseline.results.map(item => item.path))
    assert.equal(coverage.nextOffset, baseline.nextOffset)
    const turns = coverage.results.find(item => item.path === "conversation.md").evidencePreview
    assert.ok(turns.some(turn => turn.heading.includes("Joanna (D1:2)")))
    assert.ok(turns.every(turn => !turn.text.includes("Timestamp:")))
    assert.ok(coverage.results.find(item => item.path === "ordinary.md").evidencePreview.length > 0)
    const cli = spawnSync(process.execPath, ["scripts/brain-sync.mjs", "recall-managed", "--retrieval-mode", "lexical", "--vault", vault,
      "--query", query, "--auto", "--coverage-previews", "--agent"], { encoding: "utf8" })
    assert.equal(cli.status, 0, cli.stderr)
    assert.deepEqual(JSON.parse(cli.stdout).results.map(item => item.path), baseline.results.map(item => item.path))
    await assert.rejects(managedRecall(vault, query, DEFAULT_RUNTIME_CONFIG, { coveragePreviews: true }), /requires adaptiveBundle/u)
    await assert.rejects(managedRecall(vault, query, DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true, matchedPreviews: true, coveragePreviews: true }), /Choose coveragePreviews or matchedPreviews/u)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("runtime configuration persists without a secret and validates endpoint isolation", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mph-runtime-"))
  try {
    const file = path.join(dir, "config.json")
    const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
    config.curator = { provider: "anthropic", model: "custom-curator" }
    saveRuntimeConfig(file, config)
    assert.deepEqual(loadRuntimeConfig(file), config)
    if (process.platform !== "win32") assert.equal(fs.statSync(file).mode & 0o777, 0o600)
    assert.throws(() => validateRuntimeConfig({ ...config, workflow: "local-decision", decision: { ...config.decision, endpoint: "https://example.com/v1/systemone" } }), /localhost/u)
    assert.throws(() => validateRuntimeConfig({ ...config, workflow: "hosted-jev", decision: { ...config.decision, endpoint: "http://127.0.0.1:8000/v1/systemone" } }), /Hosted Jev/u)
    assert.doesNotThrow(() => validateRuntimeConfig({ ...config, workflow: "hosted-jev", decision: { ...config.decision, endpoint: "https://ai-gateway.vercel.sh/typesafe/v1/systemone", model: "typesafe-ai/jev", apiKeyEnv: "AI_GATEWAY_API_KEY" } }))
    assert.throws(() => validateRuntimeConfig({ ...config, workflow: "hosted-jev", decision: { ...config.decision, endpoint: "https://ai-gateway.vercel.sh.evil.example/typesafe/v1/systemone" } }), /Hosted Jev/u)
    assert.doesNotThrow(() => validateRuntimeConfig({ ...config, workflow: "local-rerank", decision: { ...config.decision, endpoint: "http://127.0.0.1:8000/v1/rerank" } }))
    assert.throws(() => validateRuntimeConfig({ ...config, workflow: "local-rerank", decision: { ...config.decision, endpoint: "https://example.com/v1/rerank" } }), /localhost/u)
    assert.doesNotThrow(() => validateRuntimeConfig({ ...config, workflow: "hosted-jev", curator: undefined }))
    assert.throws(() => validateRuntimeConfig({ ...config, curator: undefined }), /curator.provider/u)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test("local reranker ranks bounded candidates without treating raw scores as probabilities", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-rerank-"))
  try {
    fs.writeFileSync(path.join(vault, "Alpha.md"), "# Alpha\n\nquery token and useful evidence")
    fs.writeFileSync(path.join(vault, "Beta.md"), "# Beta\n\nquery token and other evidence")
    const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
    config.workflow = "local-rerank"
    config.decision.endpoint = "http://127.0.0.1:8000/v1/rerank"
    config.decision.model = "Qwen3-Reranker-4B-4bit"
    const report = await managedRecall(vault, "query token", config, { fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body)
      assert.equal(request.documents.length, 2)
      return { ok: true, json: async () => ({ results: [
        { index: 1, relevance_score: 9.4 }, { index: 0, relevance_score: 2.1 },
      ] }) }
    } })
    assert.deepEqual(report.results.map((item) => item.path), ["Beta.md", "Alpha.md"])
    assert.equal(report.decisionGate, "rank-only")
    assert.equal(report.evidencePacket.evidence[0].rankScore, 9.4)
    assert.equal(report.evidencePacket.evidence[0].relevance, undefined)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("local reranker rejects missing or repeated candidate scores", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-rerank-invalid-"))
  try {
    fs.writeFileSync(path.join(vault, "Alpha.md"), "# Alpha\n\nquery token evidence")
    fs.writeFileSync(path.join(vault, "Beta.md"), "# Beta\n\nquery token evidence")
    const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
    config.workflow = "local-rerank"
    config.decision.endpoint = "http://127.0.0.1:8000/v1/rerank"
    await assert.rejects(managedRecall(vault, "query token", config, { fetchImpl: async () => ({
      ok: true, json: async () => ({ results: [
        { index: 0, relevance_score: 1 }, { index: 0, relevance_score: 2 },
      ] }),
    }) }), /invalid scores/u)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("local decision gate reranks candidates and abstains when none pass", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "mph-decision-"))
  try {
    fs.writeFileSync(path.join(vault, "Alpha.md"), "# Alpha\n\nquery token and useful evidence")
    fs.writeFileSync(path.join(vault, "Beta.md"), "# Beta\n\nquery token and unrelated material")
    const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
    config.workflow = "local-decision"
    config.decision.endpoint = "http://127.0.0.1:8000/v1/systemone"
    const seen = []
    const fetchImpl = async (_url, options) => {
      const request = JSON.parse(options.body)
      assert.equal(options.redirect, "error")
      seen.push(request.state.candidates.map((item) => item.path))
      const answers = Object.fromEntries(request.state.candidates.map((candidate, index) => [
        `relevant_${index}`, { noul: candidate.path === "Beta.md" ? 0.95 : 0.3 },
      ]))
      return { ok: true, json: async () => ({ answers }) }
    }
    const report = await managedRecall(vault, "query token", config, { fetchImpl })
    assert.deepEqual(report.results.map((item) => item.path), ["Beta.md"])
    assert.equal(report.needsExpansion, false)
    assert.equal(report.curator, undefined)
    assert.equal(report.evidencePacket.status, "ready")
    assert.equal(report.evidencePacket.evidence.length, 1)
    assert.match(report.evidencePacket.evidence[0].excerptHash, /^[a-f0-9]{64}$/u)
    assert.equal(report.evidencePacket.nextAction, "lead-review")
    assert.deepEqual(seen, [["Alpha.md", "Beta.md"]])
    config.decision.relevanceThreshold = 0.99
    const abstained = await managedRecall(vault, "query token", config, { fetchImpl })
    assert.equal(abstained.results.length, 0)
    assert.equal(abstained.needsExpansion, true)
    assert.equal(abstained.evidencePacket.status, "abstain")
    assert.deepEqual(abstained.evidencePacket.evidence, [])
    assert.equal(abstained.evidencePacket.nextAction, "continue-without-memory")
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("hosted workflow requires explicit vault-content consent", async () => {
  const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
  config.workflow = "hosted-jev"
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "mph-private-"))
  try {
    fs.writeFileSync(path.join(vault, "note.md"), "# Note\nsecret content")
    await assert.rejects(managedRecall(vault, "secret", config, { fetchImpl: () => { throw new Error("network must not run") } }), /disabled/u)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("Vercel gateway route sends a TypeSafe-compatible request with the configured key", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-gateway-"))
  const previous = process.env.GRAPHMORY_TEST_GATEWAY_KEY
  try {
    fs.writeFileSync(path.join(vault, "note.md"), "# Note\n\nrelevant retrieval evidence")
    process.env.GRAPHMORY_TEST_GATEWAY_KEY = "test-only-key"
    const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
    config.workflow = "hosted-jev"
    Object.assign(config.decision, { endpoint: "https://ai-gateway.vercel.sh/typesafe/v1/systemone",
      model: "typesafe-ai/jev", apiKeyEnv: "GRAPHMORY_TEST_GATEWAY_KEY", allowRemoteVaultContent: true })
    const report = await managedRecall(vault, "retrieval evidence", config, { fetchImpl: async (url, options) => {
      assert.equal(url, config.decision.endpoint)
      assert.equal(options.headers.authorization, "Bearer test-only-key")
      const request = JSON.parse(options.body)
      assert.equal(request.model, "typesafe-ai/jev")
      assert.equal(request.questions.relevant_0.type, "noul")
      return { ok: true, json: async () => ({ answers: { relevant_0: { noul: 0.9 } } }) }
    } })
    assert.equal(report.evidencePacket.decisionGate, "pass")
  } finally {
    if (previous === undefined) delete process.env.GRAPHMORY_TEST_GATEWAY_KEY
    else process.env.GRAPHMORY_TEST_GATEWAY_KEY = previous
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("Vercel verification error explains the account action", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-gateway-billing-"))
  const previous = process.env.GRAPHMORY_TEST_GATEWAY_KEY
  try {
    fs.writeFileSync(path.join(vault, "note.md"), "# Note\n\nrelevant retrieval evidence")
    process.env.GRAPHMORY_TEST_GATEWAY_KEY = "test-only-key"
    const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
    config.workflow = "hosted-jev"
    Object.assign(config.decision, { endpoint: "https://ai-gateway.vercel.sh/typesafe/v1/systemone",
      model: "typesafe-ai/jev", apiKeyEnv: "GRAPHMORY_TEST_GATEWAY_KEY", allowRemoteVaultContent: true })
    await assert.rejects(managedRecall(vault, "retrieval evidence", config, { fetchImpl: async () => ({
      ok: false, status: 403, json: async () => ({ error: { type: "customer_verification_required" } }),
    }) }), /requires a verified payment card/u)
  } finally {
    if (previous === undefined) delete process.env.GRAPHMORY_TEST_GATEWAY_KEY
    else process.env.GRAPHMORY_TEST_GATEWAY_KEY = previous
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("empty local retrieval abstains without calling a decision model", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "mph-empty-decision-"))
  try {
    const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
    config.workflow = "local-decision"
    config.curator = undefined
    config.decision.endpoint = "http://127.0.0.1:8000/v1/systemone"
    const report = await managedRecall(vault, "missing evidence", config, {
      fetchImpl: () => { throw new Error("decision model must not run") },
    })
    assert.equal(report.evidencePacket.status, "abstain")
    assert.equal(report.evidencePacket.candidateCount, 0)
    assert.deepEqual(report.evidencePacket.evidence, [])
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("semantic expansion can judge a lexical candidate that was not in the scored shortlist", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-semantic-expansion-"))
  try {
    fs.writeFileSync(path.join(vault, "Alpha.md"), "# Alpha\n\nquery query query token")
    fs.writeFileSync(path.join(vault, "Beta.md"), "# Beta\n\nquery token with independent evidence")
    fs.writeFileSync(path.join(vault, "Index.md"), "---\ncanonical_memory: false\n---\n# Query index\n[[Alpha]] [[Beta]]")
    const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
    config.workflow = "local-decision"
    config.decision.endpoint = "http://127.0.0.1:8000/v1/systemone"
    config.decision.maxCandidates = 1
    let calls = 0
    const report = await managedRecall(vault, "query token", config, {
      semanticExpansion: true,
      semanticRecallImpl: async () => ({ results: [
        { path: "Index.md", title: "Query index", score: 2, status: "current" },
        { path: "Beta.md", title: "Beta", score: 1, status: "current" },
      ] }),
      fetchImpl: async () => ({ ok: true, json: async () => ({ answers: { relevant_0: { noul: ++calls === 1 ? 0.1 : 0.9 } } }) }),
    })
    assert.equal(report.expanded, true)
    assert.equal(report.candidateCount, 2)
    assert.deepEqual(report.results.map((item) => item.path), ["Beta.md"])
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("conversation profile persists and rejects unknown retrieval strategies", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-profile-"))
  try {
    fs.writeFileSync(path.join(vault, "Current.md"), '# Zephyr\nThe valid release threshold is three percent.')
    fs.writeFileSync(path.join(vault, "Old.md"), '---\nstatus: stale\n---\n# Zephyr\nZephyr Zephyr Zephyr incorrect old threshold.')
    const config = {...structuredClone(DEFAULT_RUNTIME_CONFIG), retrievalProfile:'conversations'}
    const file=path.join(vault,'runtime.json')
    saveRuntimeConfig(file,config)
    assert.equal(loadRuntimeConfig(file).retrievalProfile,'conversations')
    const result=await managedRecall(vault,'Zephyr release threshold',loadRuntimeConfig(file))
    assert.deepEqual(result.results.map(r=>r.path),['Current.md'])
    assert.throws(()=>validateRuntimeConfig({...config,retrievalProfile:'unknown'}),/retrievalProfile/)
    await assert.rejects(managedRecall(vault,'Zephyr',{...config,retrievalProfile:'unknown'}),/retrievalProfile/)
  } finally {fs.rmSync(vault,{recursive:true,force:true})}
})
