import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { planDecisionCuration } from "../src/decision-curation.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"

function fixture() {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-curate-"))
  fs.writeFileSync(path.join(vault, "Atlas.md"), "# Atlas\n\nAtlas screenshots require owner review.\n")
  const patch = {
    claim: "Atlas mobile layouts require review at 320px width before release.",
    why_it_matters: "This keeps mobile release checks consistent across future tasks.",
    scope: { applies: ["Atlas UI"], excludes: [] },
    provenance: [{ kind: "artifact", value: "review-201" }], confidence: "high", suggested_type: "decision",
    lifecycle: { status: "active", revalidate_when: ["UI policy changes"], supersedes: [] },
  }
  const input = { patch, sources: [{ id: "review-201", text: "Atlas UI owner approved review at 320px width before release." }], candidate_paths: ["Atlas.md"] }
  const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
  config.workflow = "local-decision"
  config.decision.endpoint = "http://127.0.0.1:8000/v1/systemone"
  return { vault, input, config }
}

function respond(choice, support = 0.95) {
  return async (_url, request) => {
    const body = JSON.parse(request.body)
    assert.equal(Object.keys(body.questions).length, 2)
    assert.equal(body.state.candidates.length, 1)
    return { ok: true, json: async () => ({ answers: {
      source_support: { type: "noul", noul: support },
      relation_0: { type: "choice", choice, confidence: 0.92 },
    } }) }
  }
}

test("Jev curation returns review advice without writing the vault", async () => {
  const { vault, input, config } = fixture()
  try {
    const before = fs.readFileSync(path.join(vault, "Atlas.md"), "utf8")
    const report = await planDecisionCuration(vault, input, config, { fetchImpl: respond("compatible") })
    assert.equal(report.status, "review")
    assert.equal(report.suggestedOperation, "update")
    assert.equal(report.operation, "none")
    assert.equal(report.writeEnabled, false)
    assert.equal(fs.readFileSync(path.join(vault, "Atlas.md"), "utf8"), before)
    assert.deepEqual(fs.readdirSync(vault), ["Atlas.md"])
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("unsupported claim and duplicate remain no-write decisions", async () => {
  const { vault, input, config } = fixture()
  try {
    const unsupported = await planDecisionCuration(vault, input, config, { fetchImpl: respond("compatible", 0.2) })
    assert.equal(unsupported.status, "abstain")
    const duplicate = await planDecisionCuration(vault, input, config, { fetchImpl: respond("duplicate") })
    assert.equal(duplicate.status, "duplicate")
    assert.equal(duplicate.operation, "none")
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("conflict needs review, unrelated and low-confidence answers abstain", async () => {
  const { vault, input, config } = fixture()
  try {
    const conflict = await planDecisionCuration(vault, input, config, { fetchImpl: respond("conflict") })
    assert.equal(conflict.reason, "CONFLICT")
    assert.equal(conflict.operation, "none")
    const unrelated = await planDecisionCuration(vault, input, config, { fetchImpl: respond("unrelated") })
    assert.equal(unrelated.status, "abstain")
    const low = await planDecisionCuration(vault, input, config, { fetchImpl: async () => ({ ok: true, json: async () => ({ answers: {
      source_support: { noul: 0.95 }, relation_0: { choice: "compatible", confidence: 0.4 },
    } }) }) })
    assert.equal(low.status, "abstain")
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("missing provenance, secret, path escape, and malformed answers fail closed", async () => {
  const { vault, input, config } = fixture()
  try {
    assert.equal((await planDecisionCuration(vault, { ...input, sources: [] }, config)).reason, "INVALID_SOURCES")
    await assert.rejects(planDecisionCuration(vault, { ...input, candidate_paths: ["../escape.md"] }, config), /Invalid candidate path/u)
    const secretInput = structuredClone(input)
    secretInput.patch.claim = "Store secret: sk-abcdefghijklmnopqrstuvwx in Atlas memory."
    assert.equal((await planDecisionCuration(vault, secretInput, config)).reason, "SECRET")
    await assert.rejects(planDecisionCuration(vault, input, config, { fetchImpl: async () => ({ ok: true, json: async () => ({ answers: {} }) }) }), /invalid source support/u)
    await assert.rejects(planDecisionCuration(vault, input, config, { fetchImpl: async () => ({ ok: true, json: async () => ({ answers: {
      source_support: { noul: 0.95 }, relation_0: { choice: "invented", confidence: 0.95 },
    } }) }) }), /invalid relation_0/u)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("rerank-only mode cannot silently become a curator", async () => {
  const { vault, input, config } = fixture()
  try {
    config.workflow = "local-rerank"
    await assert.rejects(planDecisionCuration(vault, input, config), /cannot classify memory placement/u)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})
