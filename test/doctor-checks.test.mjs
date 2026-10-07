import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { curatorFreshnessCheck, curatorModelCheck, doctorSummaryLines, mcpToolsCheck, semanticBackendCheck } from "../src/doctor-checks.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(repoRoot, "scripts", "brain-sync.mjs")

function fakeHome(files) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-doctor-home-"))
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(home, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  return home
}

test("curator-model passes when an installed agent pins a model", () => {
  const home = fakeHome({ ".claude/agents/graphmory-curator.md": "---\nname: graphmory-curator\nmodel: haiku\n---\nBody\nmodel: inherit\n" })
  const check = curatorModelCheck({ home })
  assert.equal(check.status, "pass")
  assert.equal(check.model, "haiku")
})

test("curator-model reads a Codex TOML model", () => {
  const home = fakeHome({ ".codex/agents/graphmory_curator.toml": 'name = "graphmory_curator"\nmodel = "gpt-6-luna"\n' })
  assert.equal(curatorModelCheck({ home }).model, "gpt-6-luna")
})

test("curator-model warns when the agent inherits the main agent's model", () => {
  const home = fakeHome({ ".cursor/agents/graphmory-curator.md": "---\nname: graphmory-curator\nmodel: inherit\n---\n" })
  const check = curatorModelCheck({ home })
  assert.equal(check.status, "warn")
  assert.match(check.detail, /cursor/)
  assert.match(check.fix, /--model/)
})

test("curator-model warns when no host agent is installed", () => {
  const check = curatorModelCheck({ home: fakeHome({}) })
  assert.equal(check.status, "warn")
  assert.match(check.fix, /graphmory-setup/)
})

test("mcp-tools lists exactly recall, read and remember without a vault", async () => {
  const check = await mcpToolsCheck()
  assert.equal(check.status, "pass")
  assert.equal(check.detail, "mcp tools: recall · read · remember")
})

test("semantic-backend warns when the dependency is missing and when the model is not downloaded", () => {
  const missing = semanticBackendCheck({ env: { MPH_TEST_SEMANTIC_MOCK_MISSING: "1" } })
  assert.equal(missing.status, "warn")
  assert.match(missing.detail, /unavailable/)
  const emptyCache = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-doctor-cache-"))
  assert.match(semanticBackendCheck({ env: {}, modelCache: emptyCache, dependencyResolves: () => true }).detail, /downloads on first use/)
  fs.mkdirSync(path.join(emptyCache, "Xenova", "bge-small-en-v1.5"), { recursive: true })
  assert.equal(semanticBackendCheck({ env: {}, modelCache: emptyCache, dependencyResolves: () => true }).status, "pass")
})

test("summary lines mirror the setup scene and flag problems", () => {
  const lines = doctorSummaryLines([
    { id: "vault-detection", status: "pass" }, { id: "vault-permission", status: "pass" },
    { id: "curator-model", status: "pass", model: "haiku" },
    { id: "mcp-tools", status: "pass", detail: "mcp tools: recall · read · remember" },
    { id: "semantic-backend", status: "warn" },
  ])
  assert.deepEqual(lines, ["vault ok", "curator model ok (haiku)", "mcp tools: recall · read · remember", "meaning search: needs attention"])
})

test("doctor --json adds the new check ids and still reports ok when only warnings remain", () => {
  const home = fakeHome({})
  const result = spawnSync(process.execPath, [cli, "doctor", "--json"], {
    cwd: repoRoot, encoding: "utf8", env: { ...process.env, HOME: home, USERPROFILE: home, MPH_TEST_SEMANTIC_MOCK_MISSING: "1" },
  })
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  const byId = Object.fromEntries(report.checks.map((check) => [check.id, check.status]))
  assert.equal(byId["curator-model"], "warn")
  assert.equal(byId["mcp-tools"], "pass")
  assert.equal(byId["semantic-backend"], "warn")
  assert.equal(report.ok, true)
})

test("semantic-warmup is an explicit command and reports a missing dependency instead of downloading", () => {
  const result = spawnSync(process.execPath, [cli, "semantic-warmup"], {
    cwd: repoRoot, encoding: "utf8", env: { ...process.env, MPH_TEST_SEMANTIC_MOCK_MISSING: "1" },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /OPTIONAL_DEPENDENCY_MISSING/)
  const help = spawnSync(process.execPath, [cli, "help"], { cwd: repoRoot, encoding: "utf8" })
  assert.match(help.stdout, /semantic-warmup/)
  assert.match(help.stdout, /review list/)
})

test("curator freshness check warns when the installed curator is older than the package", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-fresh-"))
  try {
    assert.equal(spawnSync(process.execPath, [path.resolve("scripts/setup-curator-agent.mjs"), "--host", "claude", "--scope", "project", "--project", home, "--model", "haiku", "--apply"], { encoding: "utf8" }).status, 0)
    assert.equal(curatorFreshnessCheck({ home }).status, "pass")
    fs.appendFileSync(path.join(home, ".claude", "skills", "graphmory-curator", "SKILL.md"), "\nold\n")
    const check = curatorFreshnessCheck({ home })
    assert.equal(check.status, "warn")
    assert.match(check.fix, /graphmory-setup --host claude --apply --update/)
    assert.ok(doctorSummaryLines([check]).includes("curator: update available"))
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})
