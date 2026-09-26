import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

const script = path.resolve("scripts/setup-curator-agent.mjs")

function run(host, project, extra = []) {
  return spawnSync(process.execPath, [script, "--host", host, "--scope", "project", "--project", project, ...extra], { encoding: "utf8" })
}

test("curator setup previews, installs host definitions, and refuses overwrite", () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-agents-"))
  try {
    const preview = run("codex", project)
    assert.equal(preview.status, 0, preview.stderr)
    const agent = path.join(project, ".codex", "agents", "graphmory_curator.toml")
    assert.equal(fs.existsSync(agent), false)

    for (const [host, model] of [["codex", "gpt-6-luna"], ["claude", "haiku"], ["cursor", "chosen-small-model"]]) {
      const extra = host === "cursor" ? ["--model", model] : []
      const applied = run(host, project, [...extra, "--apply"])
      assert.equal(applied.status, 0, applied.stderr)
      const agentFile = path.join(project, `.${host}`, "agents", host === "codex" ? "graphmory_curator.toml" : "graphmory-curator.md")
      const definition = fs.readFileSync(agentFile, "utf8")
      assert.match(definition, new RegExp(model))
      assert.match(definition, /Memory Patch/)
      const skillFile = path.join(project, host === "codex" ? ".agents" : `.${host}`, "skills", "memory-curator", "SKILL.md")
      assert.ok(fs.existsSync(skillFile))
      assert.equal(run(host, project, [...extra, "--apply"]).status, 0)
    }
    fs.appendFileSync(agent, "\n# personal change\n")
    const conflict = run("codex", project, ["--apply"])
    assert.equal(conflict.status, 1)
    assert.match(conflict.stderr, /will not overwrite/)
    fs.writeFileSync(agent, fs.readFileSync(agent, "utf8").replace("\n# personal change\n", ""))
    const skill = path.join(project, ".agents", "skills", "memory-curator", "SKILL.md")
    fs.appendFileSync(skill, "\npersonal skill change\n")
    const skillConflict = run("codex", project, ["--apply"])
    assert.equal(skillConflict.status, 1)
    assert.match(skillConflict.stderr, /Existing skill differs/)
  } finally {
    fs.rmSync(project, { recursive: true, force: true })
  }
})

test("Cursor requires an explicit model", () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-cursor-"))
  try {
    const result = run("cursor", project)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /needs --model/)
  } finally {
    fs.rmSync(project, { recursive: true, force: true })
  }
})
