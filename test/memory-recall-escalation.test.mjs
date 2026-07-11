import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { recallVault } from "../src/memory-recall.mjs"

function tempVault(prefix = "mph-escalation-") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  fs.writeFileSync(
    path.join(root, "Retry Backoff.md"),
    "---\nstatus: current\n---\n# Retry Backoff\nUse exponential backoff with jitter for retries.",
  )
  fs.writeFileSync(
    path.join(root, "Deploy Rollback.md"),
    "---\nstatus: current\n---\n# Deploy Rollback\nRoll back the previous release when health checks fail.",
  )
  return root
}

test("escalate defaults to off: low-confidence recall stays lexical-only", async () => {
  const vault = tempVault()
  const report = await recallVault(vault, "unrelated maternity leave contractor policy", { k: 3 })
  assert.equal(report.escalated, false)
  assert.equal(report.escalationMethod, null)
  assert.equal(report.escalationSkipped, null)
})

test("escalate auto does not trigger when lexical confidence is already bounded", async () => {
  const vault = tempVault()
  const report = await recallVault(vault, "retry backoff jitter", { k: 3, escalate: "auto" })
  assert.equal(report.confidence, "bounded")
  assert.equal(report.escalated, false)
  assert.equal(report.escalationSkipped, null)
})

test("escalate auto fails closed to lexical-only results when the optional dependency is missing", async () => {
  const vault = tempVault()
  const previous = process.env.MPH_TEST_SEMANTIC_MOCK_MISSING
  process.env.MPH_TEST_SEMANTIC_MOCK_MISSING = "1"
  try {
    const lexical = await recallVault(vault, "unrelated maternity leave contractor policy", { k: 3 })
    const escalated = await recallVault(vault, "unrelated maternity leave contractor policy", { k: 3, escalate: "auto" })
    assert.ok(lexical.confidence === "low" || lexical.confidence === "none")
    assert.equal(escalated.escalated, false)
    assert.equal(escalated.escalationSkipped, "OPTIONAL_DEPENDENCY_MISSING")
    assert.deepEqual(escalated.results, lexical.results)
    assert.equal(escalated.confidence, lexical.confidence)
  } finally {
    if (previous === undefined) delete process.env.MPH_TEST_SEMANTIC_MOCK_MISSING
    else process.env.MPH_TEST_SEMANTIC_MOCK_MISSING = previous
  }
})

test("alias retry rung (rung 2) resolves a low-confidence tie and skips semantic escalation", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mph-rung-"))
  // Two documents both match "retry" closely enough at rung 1 that the score
  // ratio stays below the "bounded" threshold (a near-tie -> "low"). Only the
  // first document carries vault-mined aliases that the rung-2 retry expands
  // into, decisively separating the scores.
  fs.writeFileSync(
    path.join(root, "Retry Backoff.md"),
    "---\nstatus: current\naliases: [reconnect policy]\n---\n# Retry Backoff\nUse exponential backoff with jitter when a retry occurs.",
  )
  fs.writeFileSync(
    path.join(root, "Retry Metrics.md"),
    "---\nstatus: current\n---\n# Retry Metrics Dashboard\nTrack retry counts across services for retry visibility.",
  )

  // The retry rung runs unconditionally, ahead of any opt-in semantic
  // escalation. Without it, "retry" alone is a near-tie between the two
  // documents ("low" confidence); with the vault-mined alias expansion the
  // first document's score decisively separates, reaching "bounded".
  const previous = process.env.MPH_TEST_SEMANTIC_MOCK_MISSING
  process.env.MPH_TEST_SEMANTIC_MOCK_MISSING = "1"
  try {
    const report = await recallVault(root, "retry", { k: 3, escalate: "auto" })
    assert.equal(report.confidence, "bounded")
    assert.equal(report.retrievalRung, 2)
    assert.equal(report.escalated, false)
    assert.equal(report.escalationSkipped, null, "semantic escalation should never be reached once rung 2 is bounded")
    assert.deepEqual(report.queryAnalysis.expansionsUsed.sort(), ["policy", "reconnect"])
    assert.equal(report.results[0].path, "Retry Backoff.md")
  } finally {
    if (previous === undefined) delete process.env.MPH_TEST_SEMANTIC_MOCK_MISSING
    else process.env.MPH_TEST_SEMANTIC_MOCK_MISSING = previous
  }
})

test("escalate auto never throws even when confidence is none and results are empty", async () => {
  const vault = tempVault()
  const previous = process.env.MPH_TEST_SEMANTIC_MOCK_MISSING
  process.env.MPH_TEST_SEMANTIC_MOCK_MISSING = "1"
  try {
    const report = await recallVault(vault, "quantum flux capacitor invoice reimbursement", { k: 3, escalate: "auto" })
    assert.equal(report.escalated, false)
    assert.equal(report.escalationSkipped, "OPTIONAL_DEPENDENCY_MISSING")
  } finally {
    if (previous === undefined) delete process.env.MPH_TEST_SEMANTIC_MOCK_MISSING
    else process.env.MPH_TEST_SEMANTIC_MOCK_MISSING = previous
  }
})
