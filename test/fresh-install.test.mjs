import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

function npmCommand(args, options) {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ].filter(Boolean)
  const npmCli = candidates.find((candidate) => fs.existsSync(candidate))
  // A fresh-machine simulation must not inherit the developer's own npm
  // config (e.g. an allow-scripts entry newer npm rejects in project-scoped
  // installs) — neither via ~/.npmrc nor via the npm_config_* env vars the
  // parent `npm test` process exports.
  const env = Object.fromEntries(
    Object.entries({ ...process.env, ...options?.env }).filter(
      ([key]) => !/^npm_config_/i.test(key),
    ),
  )
  env.NPM_CONFIG_USERCONFIG = os.devNull
  env.NPM_CONFIG_CACHE = options?.npmCache ?? path.join(os.tmpdir(), `mph-npm-cache-${process.pid}`)
  const spawnOptions = { ...options }
  delete spawnOptions.npmCache
  const merged = { ...spawnOptions, env, shell: false }
  return npmCli
    ? spawnSync(process.execPath, [npmCli, ...args], merged)
    : spawnSync("npm", args, merged)
}

test("packed harness installs on a fresh machine surface and exposes agent commands", { timeout: 60_000 }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mph-fresh-install-"))
  const npmCache = path.join(root, "npm-cache")
  try {
    const packed = npmCommand(["pack", "--pack-destination", root], {
      cwd: path.resolve("."),
      encoding: "utf8",
      npmCache,
    })
    assert.equal(packed.status, 0, packed.stderr)
    const archive = fs.readdirSync(root).find((file) => file.endsWith(".tgz"))
    assert.ok(archive, "npm pack should create an installable archive")

    const initialized = npmCommand(["init", "-y"], {
      cwd: root,
      encoding: "utf8",
      npmCache,
    })
    assert.equal(initialized.status, 0, initialized.stderr)

    const installed = npmCommand(["install", "--ignore-scripts", "--omit=optional", "--no-audit", "--no-fund", path.join(root, archive)], {
      cwd: root,
      encoding: "utf8",
      npmCache,
    })
    assert.equal(installed.status, 0, installed.stderr)

    const cli = path.join(root, "node_modules", "graphmory", "scripts", "brain-sync.mjs")
    const help = spawnSync(process.execPath, [cli, "--help"], { cwd: root, encoding: "utf8", shell: false })
    assert.equal(help.status, 0, help.stderr)
    assert.match(help.stdout, /recall --vault/)
    assert.match(help.stdout, /sync-plan --vault/)
    assert.match(help.stdout, /doctor/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("agent package documents autonomy-first human gates", () => {
  const agents = fs.readFileSync(path.resolve("AGENTS.md"), "utf8")
  assert.match(agents, /autonomous loop engineering/)
  assert.match(agents, /smallest safe change/)
  assert.match(agents, /Stop only at decision gates/)
  assert.match(agents, /clearly reversible metadata\/link improvements/)
})

test("install.mjs copies skill, src, and CLI to target and CLI runs without a vault", { timeout: 30_000 }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mph-installer-smoke-"))
  try {
    const installScript = path.resolve("scripts", "install.mjs")
    const target = path.join(tmp, "target")

    const before = spawnSync(process.execPath, [installScript, "--target", target, "--check"], {
      cwd: path.resolve("."), encoding: "utf8", shell: false,
    })
    assert.equal(before.status, 0, before.stderr)
    assert.ok(JSON.parse(before.stdout).changes.some((change) => change.file.startsWith("skills/memory-curator/")))

    // Run the installer
    const install = spawnSync(process.execPath, [installScript, "--target", target, "--force"], {
      cwd: path.resolve("."),
      encoding: "utf8",
      shell: false,
    })
    assert.equal(install.status, 0, `installer failed: ${install.stderr}`)

    // Verify skill was copied
    const skillPath = path.join(target, "skills", "memory-curator", "SKILL.md")
    assert.ok(fs.existsSync(skillPath), "skills/memory-curator/SKILL.md should exist after install")

    // Verify src module was copied
    const srcPath = path.join(target, "src", "brain-sync.mjs")
    assert.ok(fs.existsSync(srcPath), "src/brain-sync.mjs should exist after install")

    // Verify CLI was copied
    const cliPath = path.join(target, "bin", "graphmory.mjs")
    assert.ok(fs.existsSync(cliPath), "bin/graphmory.mjs should exist after install")
    assert.ok(fs.existsSync(path.join(target, "bin", "memory-patch-harness.mjs")), "legacy launcher should remain available")

    // Verify installed CLI runs doctor without a vault
    const doctor = spawnSync(process.execPath, [cliPath, "doctor", "--json"], {
      cwd: tmp,
      encoding: "utf8",
      shell: false,
    })
    assert.equal(doctor.status, 0, `doctor failed: ${doctor.stderr}`)
    const report = JSON.parse(doctor.stdout)
    assert.equal(report.ok, true, "doctor should report ok: true")

    // Verify installed CLI can print help
    const help = spawnSync(process.execPath, [cliPath, "--help"], {
      cwd: tmp,
      encoding: "utf8",
      shell: false,
    })
    assert.equal(help.status, 0, `--help failed: ${help.stderr}`)
    assert.match(help.stdout, /doctor/)

    const check = spawnSync(process.execPath, [installScript, "--target", target, "--check"], {
      cwd: path.resolve("."), encoding: "utf8", shell: false,
    })
    assert.equal(check.status, 0, check.stderr)
    assert.deepEqual(JSON.parse(check.stdout.split("\nNo changes needed.")[0]).changes, [])
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
