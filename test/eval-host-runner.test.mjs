import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

function trial(t, { mutate = false, labels = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-host-test-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  for (const dir of ["bin", "config", "workspace/vault"]) fs.mkdirSync(path.join(root, dir), { recursive: true })
  fs.writeFileSync(path.join(root, "workspace/vault/note.md"), "original evidence")
  fs.writeFileSync(path.join(root, "config/opencode.json"), JSON.stringify({ model: "openai/gpt-5.6-luna" }))
  const questions = [{ id: "first", question: "First?" }, { id: "second", question: "Second?" }]
  if (labels) questions[0].answer = "Do not reveal"
  fs.writeFileSync(path.join(root, "questions.json"), JSON.stringify(questions))
  const fake = `#!${process.execPath}
import fs from 'node:fs';
if(process.argv.includes('--version')) console.log('test-host');
else {
${mutate ? `fs.writeFileSync(${JSON.stringify(path.join(root, "workspace/vault/note.md"))}, 'changed');` : ""}
console.log(JSON.stringify({type:'text',part:{text:'test answer'}}));
console.log(JSON.stringify({type:'step_finish',part:{tokens:{input:10,output:2,cache:{read:5,write:0}}}}));
}`
  fs.writeFileSync(path.join(root, "bin/opencode"), fake, { mode: 0o700 })
  const report = path.join(root, "report.json")
  const result = spawnSync(process.execPath, ["scripts/eval-host-usage.mjs", "--workspace", path.join(root, "workspace"), "--out", report, "--questions", path.join(root, "questions.json"), "--repeats", "1"], {
    encoding: "utf8", env: { ...process.env, PATH: `${path.join(root, "bin")}:${process.env.PATH}`, XDG_CONFIG_HOME: path.join(root, "config") },
  })
  return { result, report }
}

test("multi-question runner retains paired private traces and reproducibility metadata", (t) => {
  const { result, report } = trial(t)
  assert.equal(result.status, 0, result.stderr)
  const data = JSON.parse(fs.readFileSync(report))
  assert.equal(data.rows.length, 4)
  assert.equal(data.hostVersion, "test-host")
  assert.match(data.sourceHash, /^[a-f0-9]{64}$/)
  assert.deepEqual(data.rows.map((row) => row.questionId), ["first", "first", "second", "second"])
  for (const row of data.rows) {
    assert.equal(row.vaultUnchanged, true)
    assert.ok(fs.existsSync(path.join(`${report}.traces`, row.trace)))
  }
})

test("runner stops after a vault mutation and preserves its failed checkpoint", (t) => {
  const { result, report } = trial(t, { mutate: true })
  assert.notEqual(result.status, 0)
  assert.equal(fs.existsSync(report), false)
  const checkpoint = JSON.parse(fs.readFileSync(`${report}.checkpoint`))
  assert.equal(checkpoint.rows.length, 1)
  assert.equal(checkpoint.rows[0].vaultUnchanged, false)
})

test("runner rejects gold labels in question input", (t) => {
  const { result, report } = trial(t, { labels: true })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /keep gold labels separate/)
  assert.equal(fs.existsSync(report), false)
})
