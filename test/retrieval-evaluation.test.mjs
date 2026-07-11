import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { summarizeSelectiveRetrieval } from "../src/retrieval-evaluation.mjs"

test("selective retrieval metrics penalize false abstention on answerable cases", () => {
  const summary = summarizeSelectiveRetrieval(
    [
      { abstained: true, metrics: { hit: 1 } },
      { abstained: false, metrics: { hit: 1 } },
      { abstained: false, metrics: { hit: 0 } },
    ],
    [
      { abstained: true },
      { abstained: false },
    ],
  )

  assert.equal(summary.answerableAcceptanceAccuracy, 2 / 3)
  assert.equal(summary.abstentionAccuracy, 1 / 2)
  assert.equal(summary.answerabilityDecisionAccuracy, 3 / 5)
  assert.equal(summary.selectiveAccuracy, 2 / 5)
  assert.deepEqual(summary.confusion, {
    answerableAccepted: 2,
    falseAbstentions: 1,
    unanswerableAbstained: 1,
    falseAnswers: 1,
    correctAcceptedRetrievals: 1,
  })
})

test("hard retrieval gate enforces frozen ranking and answerability floors", () => {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mph-hard-eval-")), "report.json")
  const result = spawnSync(
    process.execPath,
    ["scripts/eval-retrieval-hard.mjs", "--gate", "--json", output],
    { cwd: path.resolve("."), encoding: "utf8" },
  )

  assert.equal(result.status, 0, result.stderr || result.stdout)
  const report = JSON.parse(fs.readFileSync(output, "utf8"))
  assert.equal(report.answerability.answerableAcceptanceAccuracy, 1)
  assert.ok(report.answerability.abstentionAccuracy >= 0.33)
  assert.ok(report.answerability.answerabilityDecisionAccuracy >= 0.91)
  assert.ok(report.answerability.selectiveAccuracy >= 0.80)
})
