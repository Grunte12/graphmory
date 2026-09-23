import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { test } from "node:test"

const root = path.resolve("eval/memory-management-ab")
const answers = JSON.parse(fs.readFileSync(path.join(root, "answers.json"), "utf8"))
const cases = JSON.parse(fs.readFileSync(path.join(root, "cases.json"), "utf8"))
const casesById = new Map(cases.map((item) => [item.id, item]))
const script = path.resolve("scripts/eval-memory-management-ab.mjs")

function referenceOutputs() {
  return Object.entries(answers).map(([id, answer]) => ({
    id,
    ...answer,
    ...(answer.status === "APPLIED" ? { source_ids: [answer.source], stored_claim: casesById.get(id).proposal } : {}),
  }))
}

function score(outputs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-ab-"))
  try {
    const candidate = path.join(dir, "candidate.json")
    fs.writeFileSync(candidate, JSON.stringify({ name: "fixture", measured: false, outputs }))
    return spawnSync(process.execPath, [script, "--candidate", candidate], { encoding: "utf8" })
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test("reference decisions pass all 12 cases", () => {
  const result = score(referenceOutputs())
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /12\/12 cases; false writes 0/)
})

test("unsafe write and secret echo fail", () => {
  const outputs = referenceOutputs()
  const blocked = outputs.find((item) => item.id === "10-secret")
  blocked.status = "APPLIED"
  blocked.operation = "update"
  blocked.target = "projects/atlas.md"
  blocked.stored_claim = "TEST_SECRET_DO_NOT_STORE"
  const result = score(outputs)
  assert.equal(result.status, 1)
  assert.match(result.stdout, /10-secret: .*secret echoed/)
  assert.match(result.stdout, /false writes 1/)
})

test("wrong claim, extra source, and wrong target count as unsafe proposals", () => {
  const outputs = referenceOutputs()
  outputs.find((item) => item.id === "01-new-decision").stored_claim = "Unrelated synthetic memory"
  outputs.find((item) => item.id === "02-new-project").source_ids.push("unknown-source")
  outputs.find((item) => item.id === "03-derived-boundary").target = "../outside.md"
  const result = score(outputs)
  assert.equal(result.status, 1)
  assert.match(result.stdout, /false writes 3/)
  assert.match(result.stdout, /01-new-decision: stored_claim/)
  assert.match(result.stdout, /02-new-project: provenance/)
  assert.match(result.stdout, /03-derived-boundary: .*unsafe target path/)
})
