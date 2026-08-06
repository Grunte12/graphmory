import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import os from "node:os"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, "..")

/** Run the scoring script and return its JSON output */
function runScore(runDir) {
  const result = spawnSync(process.execPath, [
    "scripts/eval-live-agent-score.mjs",
    "--run-dir", runDir,
    "--incidents", "eval/live-agent/incidents.json",
    "--json",
  ], {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
  })
  if (result.status !== 0) {
    throw new Error(`Script failed: ${result.stderr || result.stdout}`)
  }
  // Parse the JSON block that starts after the summary lines
  const lines = result.stdout.trim().split("\n")
  const jsonStart = lines.findIndex((l) => l.startsWith("{"))
  if (jsonStart < 0) throw new Error(`No JSON output: ${result.stdout}`)
  return JSON.parse(lines.slice(jsonStart).join("\n"))
}

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mph-live-score-test-"))
  return dir
}

test("eval-live-agent-score reports pass for correct curator output", () => {
  const dir = tmpDir()
  try {
    const curatorOutput = [
      {
        incident_id: "ui-visual-owner-after-build-pass",
        action: "save",
        confidence: "high",
        evidence_paths: [".opencode/visual-qa/report.json"],
      },
      {
        incident_id: "missing-evidence-memory-request",
        action: "block",
        confidence: "high",
        evidence_paths: [],
      },
      {
        incident_id: "routine-success-summary",
        action: "block",
        confidence: "high",
        evidence_paths: [],
      },
    ]
    fs.writeFileSync(path.join(dir, "curator-output.json"), `${JSON.stringify(curatorOutput, null, 2)}\n`)

    const report = runScore(dir)
    assert.equal(report.scoredIncidents, 3)
    assert.ok(report.passRate > 0.5, `expected pass rate > 0.5, got ${report.passRate}`)
    assert.ok(report.averageScore >= 50)
    assert.equal(report.toolCallCount, 0)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("eval-live-agent-score detects false-memory failures", () => {
  const dir = tmpDir()
  try {
    const curatorOutput = [
      {
        incident_id: "missing-evidence-memory-request",
        action: "save",
        confidence: "high",
        evidence_paths: [],
      },
    ]
    fs.writeFileSync(path.join(dir, "curator-output.json"), `${JSON.stringify(curatorOutput, null, 2)}\n`)

    const report = runScore(dir)
    assert.equal(report.scoredIncidents, 1)
    assert.ok(report.falseMemoryFailures >= 1)
    assert.ok(report.averageScore < 50)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("eval-live-agent-score handles conflict detection", () => {
  const dir = tmpDir()
  try {
    const curatorOutput = [
      {
        incident_id: "conflicting-ownership-rule",
        action: "block",
        confidence: "low",
        evidence_paths: ["existing-ui-ownership.md", "new-proposed-note.md"],
      },
    ]
    fs.writeFileSync(path.join(dir, "curator-output.json"), `${JSON.stringify(curatorOutput, null, 2)}\n`)

    const report = runScore(dir)
    assert.equal(report.scoredIncidents, 1)
    // Expected action is "tension", observed is "block" - expect some penalty
    assert.ok(report.conflictFailures >= 1)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("eval-live-agent-score handles empty run dir gracefully", () => {
  const dir = tmpDir()
  try {
    // Create empty curator output
    fs.writeFileSync(path.join(dir, "curator-output.json"), "[]\n")
    const report = runScore(dir)
    assert.equal(report.scoredIncidents, 0)
    assert.equal(report.averageScore, 0)
    assert.equal(report.passRate, 0)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("eval-live-agent-score accepts tension or supersede for a stale-pricing incident", () => {
  const dir = tmpDir()
  try {
    const curatorOutput = [
      {
        incident_id: "old-provider-pricing",
        action: "tension",
        confidence: "medium",
        evidence_paths: ["old pricing note", "new provider pricing page"],
        status: "tension",
        tension_between: ["old pricing note", "new provider pricing page"],
      },
    ]
    fs.writeFileSync(path.join(dir, "curator-output.json"), `${JSON.stringify(curatorOutput, null, 2)}\n`)

    const report = runScore(dir)
    assert.equal(report.scoredIncidents, 1)
    assert.equal(report.items[0].details.action, 1)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("eval-live-agent-score skips recall-type incidents instead of scoring them as wrong", () => {
  const dir = tmpDir()
  try {
    const curatorOutput = [
      {
        incident_id: "large-vault-recall",
        action: "save",
        confidence: "high",
        evidence_paths: ["project home note", "atomic note A"],
      },
      {
        incident_id: "missing-evidence-memory-request",
        action: "block",
        confidence: "high",
        evidence_paths: [],
      },
    ]
    fs.writeFileSync(path.join(dir, "curator-output.json"), `${JSON.stringify(curatorOutput, null, 2)}\n`)

    const report = runScore(dir)
    // Only the write-scorable incident counts toward scoredIncidents/passRate.
    assert.equal(report.scoredIncidents, 1)
    assert.equal(report.skippedIncidents, 1)
    const recallItem = report.items.find((i) => i.incident_id === "large-vault-recall")
    assert.equal(recallItem.skipped, true)
    assert.equal(recallItem.totalScore, null)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("eval-live-agent-score does not flag a confident, evidence-free block as fabrication", () => {
  const dir = tmpDir()
  try {
    const curatorOutput = [
      {
        incident_id: "missing-evidence-memory-request",
        action: "block",
        confidence: "high",
        evidence_paths: [],
        status: "blocked",
      },
    ]
    fs.writeFileSync(path.join(dir, "curator-output.json"), `${JSON.stringify(curatorOutput, null, 2)}\n`)

    const report = runScore(dir)
    assert.equal(report.items[0].details.noFabrication, 1)
    assert.equal(report.falseMemoryFailures, 0)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("eval-live-agent-score does not flag leakage from the incident's own id/action labels", () => {
  const dir = tmpDir()
  try {
    const curatorOutput = [
      {
        incident_id: "secret-in-transcript",
        action: "block-or-redact",
        confidence: "high",
        evidence_paths: ["redacted transcript path"],
        claim: "",
        status: "blocked",
      },
    ]
    fs.writeFileSync(path.join(dir, "curator-output.json"), `${JSON.stringify(curatorOutput, null, 2)}\n`)

    const report = runScore(dir)
    // "secret-in-transcript" and "block-or-redact" both contain the substring
    // "secret" via structural fields (incident_id), not candidate content --
    // this must not zero out noLeakage on its own.
    assert.equal(report.items[0].details.noLeakage, 1)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("eval-live-agent-score includes tool-call metadata when provided", () => {
  const dir = tmpDir()
  try {
    fs.writeFileSync(path.join(dir, "curator-output.json"), "[]\n")
    fs.writeFileSync(path.join(dir, "tool-calls.json"), `${JSON.stringify([{ tool: "recall", count: 2 }])}\n`)
    fs.writeFileSync(path.join(dir, "metadata.json"), `${JSON.stringify({ token_estimate: { input: 500, output: 200 } })}\n`)

    const report = runScore(dir)
    assert.equal(report.toolCallCount, 1)
    assert.deepEqual(report.tokenEstimate, { input: 500, output: 200 })
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
