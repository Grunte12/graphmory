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
  return npmCli
    ? spawnSync(process.execPath, [npmCli, ...args], { ...options, shell: false })
    : spawnSync("npm", args, { ...options, shell: false })
}

test("packed harness installs on a fresh machine surface and exposes agent commands", { timeout: 60_000 }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mph-fresh-install-"))
  const packed = npmCommand(["pack", "--pack-destination", root], {
    cwd: path.resolve("."),
    encoding: "utf8",
  })
  assert.equal(packed.status, 0, packed.stderr)
  const archive = fs.readdirSync(root).find((file) => file.endsWith(".tgz"))
  assert.ok(archive, "npm pack should create an installable archive")

  const initialized = npmCommand(["init", "-y"], {
    cwd: root,
    encoding: "utf8",
  })
  assert.equal(initialized.status, 0, initialized.stderr)

  const installed = npmCommand(["install", "--ignore-scripts", "--no-audit", "--no-fund", path.join(root, archive)], {
    cwd: root,
    encoding: "utf8",
  })
  assert.equal(installed.status, 0, installed.stderr)

  const cli = path.join(root, "node_modules", "memory-patch-harness", "scripts", "brain-sync.mjs")
  const help = spawnSync(process.execPath, [cli, "--help"], { cwd: root, encoding: "utf8", shell: false })
  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /recall --vault/)
  assert.match(help.stdout, /sync-plan --vault/)
  assert.match(help.stdout, /doctor/)
})

test("agent package documents autonomy-first human gates", () => {
  const agents = fs.readFileSync(path.resolve("AGENTS.md"), "utf8")
  assert.match(agents, /autonomous loop engineering/)
  assert.match(agents, /smallest safe change/)
  assert.match(agents, /Stop only at decision gates/)
  assert.match(agents, /clearly reversible metadata\/link improvements/)
})
