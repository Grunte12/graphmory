import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { managedRecall } from "../src/decision-recall.mjs"
import { DEFAULT_RUNTIME_CONFIG, loadRuntimeConfig, saveRuntimeConfig, validateRuntimeConfig } from "../src/runtime-config.mjs"

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
    const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
    config.workflow = "local-decision"
    config.decision.endpoint = "http://127.0.0.1:8000/v1/systemone"
    config.decision.maxCandidates = 1
    let calls = 0
    const report = await managedRecall(vault, "query token", config, {
      semanticExpansion: true,
      semanticRecallImpl: async () => ({ results: [{ path: "Beta.md", title: "Beta", score: 1, status: "current" }] }),
      fetchImpl: async () => ({ ok: true, json: async () => ({ answers: { relevant_0: { noul: ++calls === 1 ? 0.1 : 0.9 } } }) }),
    })
    assert.equal(report.expanded, true)
    assert.equal(report.candidateCount, 2)
    assert.deepEqual(report.results.map((item) => item.path), ["Beta.md"])
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})
