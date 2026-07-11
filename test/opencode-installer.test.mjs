import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const root = path.resolve(".")
const installer = path.join(root, "scripts", "install.mjs")

function run(target, vault, extra = []) {
  return spawnSync(process.execPath, [installer, "--target", target, "--vault", vault, ...extra], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  })
}

function fixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mph-opencode-install-"))
  const target = path.join(tmp, "opencode")
  const vault = path.join(tmp, "Brain Vault")
  fs.mkdirSync(vault, { recursive: true })
  return { tmp, target, vault }
}

test("OpenCode check and dry-run report exact additions without writing", () => {
  const { tmp, target, vault } = fixture()
  try {
    const checked = run(target, vault, ["--check"])
    assert.equal(checked.status, 0, checked.stderr)
    const report = JSON.parse(checked.stdout)
    assert.equal(report.runtime, "opencode")
    assert.ok(report.changes.some((change) => change.action === "add" && change.file === "agents/memory_curator.md"))
    assert.equal(fs.existsSync(target), false)

    const dryRun = run(target, vault, ["--dry-run"])
    assert.equal(dryRun.status, 0, dryRun.stderr)
    assert.match(dryRun.stdout, /Dry run only; no files were changed\./u)
    assert.equal(fs.existsSync(target), false)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test("fresh OpenCode install renders one bounded wildcard curator and only the core skill", () => {
  const { tmp, target, vault } = fixture()
  try {
    const result = run(target, vault)
    assert.equal(result.status, 0, result.stderr)

    const agents = fs.readdirSync(path.join(target, "agents")).filter((file) => file.endsWith(".md"))
    assert.deepEqual(agents, ["memory_curator.md"])
    assert.equal(fs.existsSync(path.join(target, "skills", "memory-curator", "SKILL.md")), true)
    assert.equal(fs.existsSync(path.join(target, "skills", "brain-ingest")), false)
    assert.equal(fs.existsSync(path.join(target, "skills", "brain-update")), false)

    const agent = fs.readFileSync(path.join(target, "agents", "memory_curator.md"), "utf8")
    assert.doesNotMatch(agent, /\{\{[A-Z0-9_]+\}\}/u)
    assert.match(agent, /mode: subagent/u)
    assert.match(agent, /task: deny/u)
    assert.match(agent, /webfetch: deny/u)
    assert.match(agent, /websearch: deny/u)
    assert.match(agent, /bash:\s+["']?\*["']?: deny/us)
    assert.match(agent, new RegExp(vault.replaceAll("\\", "/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"))
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test("normal install and upgrade preserve unmanaged or locally modified curator agents", () => {
  const { tmp, target, vault } = fixture()
  const agentPath = path.join(target, "agents", "memory_curator.md")
  try {
    fs.mkdirSync(path.dirname(agentPath), { recursive: true })
    fs.writeFileSync(agentPath, "personal curator\n")

    const installed = run(target, vault)
    assert.equal(installed.status, 0, installed.stderr)
    assert.equal(fs.readFileSync(agentPath, "utf8"), "personal curator\n")
    assert.match(installed.stdout, /preserve: .*memory_curator\.md/u)

    const upgraded = run(target, vault, ["--upgrade"])
    assert.equal(upgraded.status, 0, upgraded.stderr)
    assert.equal(fs.readFileSync(agentPath, "utf8"), "personal curator\n")
    assert.match(upgraded.stdout, /unmanaged or locally modified/u)

    const forced = run(target, vault, ["--force"])
    assert.equal(forced.status, 0, forced.stderr)
    assert.doesNotMatch(fs.readFileSync(agentPath, "utf8"), /^personal curator$/mu)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test("upgrade can rerender an unchanged installer-managed curator for a new Brain path", () => {
  const { tmp, target, vault } = fixture()
  const nextVault = path.join(tmp, "Next Brain")
  fs.mkdirSync(nextVault, { recursive: true })
  try {
    const first = run(target, vault)
    assert.equal(first.status, 0, first.stderr)

    const upgraded = run(target, nextVault, ["--upgrade"])
    assert.equal(upgraded.status, 0, upgraded.stderr)
    assert.match(upgraded.stdout, /update: .*memory_curator\.md/u)
    const agent = fs.readFileSync(path.join(target, "agents", "memory_curator.md"), "utf8")
    assert.match(agent, new RegExp(nextVault.replaceAll("\\", "/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"))
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test("core runtime install omits the OpenCode agent", () => {
  const { tmp, target, vault } = fixture()
  try {
    const result = run(target, vault, ["--runtime", "core"])
    assert.equal(result.status, 0, result.stderr)
    assert.equal(fs.existsSync(path.join(target, "agents", "memory_curator.md")), false)
    assert.equal(fs.existsSync(path.join(target, "skills", "memory-curator", "SKILL.md")), true)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
