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
    assert.doesNotThrow(() => validateRuntimeConfig({ ...config, workflow: "hosted-jev", curator: undefined }))
    assert.throws(() => validateRuntimeConfig({ ...config, curator: undefined }), /curator.provider/u)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
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
