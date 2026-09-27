import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { chooseAdaptiveMode, curatorEvidencePreview, managedRecall } from "../src/decision-recall.mjs"
import { loadVaultDocuments, recallVaultLoop } from "../src/memory-recall.mjs"
import { DEFAULT_RUNTIME_CONFIG, loadRuntimeConfig, saveRuntimeConfig, validateRuntimeConfig, retrievalMethods } from "../src/runtime-config.mjs"

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
    await assert.rejects(managedRecall(vault, "project memory evidence", DEFAULT_RUNTIME_CONFIG, { bundleBytes: 1999 }), /bundleBytes/u)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("adaptive routing keeps descriptive, narrow lookups small and expands exhaustive questions", () => {
  const descriptive = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa"]
    .map((name) => ({ title: `Distinct architecture concept ${name}` }))
  assert.equal(chooseAdaptiveMode("Which paper explains memory layers?", descriptive), "focused")
  assert.equal(chooseAdaptiveMode("List all memory layers", descriptive), "wide")
  const generic = Array.from({ length: 10 }, (_, index) => ({ title: `Conversation ${index + 1}` }))
  assert.equal(chooseAdaptiveMode("What happened to the project?", generic), "wide")
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
