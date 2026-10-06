import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { createHash } from "node:crypto"
import { pathToFileURL } from "node:url"

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

// The cache `npm install` populated: ~/.npm on POSIX, %LocalAppData%\npm-cache on Windows.
function systemNpmCache() {
  const npmCli = [process.env.npm_execpath, path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")]
    .filter(Boolean).find((candidate) => fs.existsSync(candidate))
  const result = npmCli
    ? spawnSync(process.execPath, [npmCli, "config", "get", "cache"], { encoding: "utf8", shell: false })
    : spawnSync("npm", ["config", "get", "cache"], { encoding: "utf8", shell: process.platform === "win32" })
  const cache = result.status === 0 ? result.stdout.trim() : ""
  return cache || path.join(os.homedir(), ".npm")
}

test("packed harness installs on a fresh machine surface and exposes agent commands", { timeout: 180_000 }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mph-fresh-install-"))
  // Mandatory MCP runtime dependencies must already be cached by npm install.
  // The fresh target/config remains isolated; --offline prohibits registry calls.
  const npmCache = process.env.npm_config_cache || process.env.NPM_CONFIG_CACHE || systemNpmCache()
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

    // Freeze the installed dependency graph to the repository lock. This tests
    // the actual packed manifest without asking the registry for version ranges.
    const lock = JSON.parse(fs.readFileSync(path.resolve("package-lock.json"), "utf8"))
    const packedManifest = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"))
    const fixtureManifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
    const archivePath = path.join(root, archive)
    fixtureManifest.dependencies = { graphmory: `file:${archivePath}` }
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify(fixtureManifest))
    lock.name = fixtureManifest.name
    lock.version = fixtureManifest.version
    lock.packages[""] = { name: fixtureManifest.name, version: fixtureManifest.version, dependencies: fixtureManifest.dependencies }
    lock.packages["node_modules/graphmory"] = {
      version: packedManifest.version, resolved: `file:${archivePath}`,
      integrity: "sha512-" + createHash("sha512").update(fs.readFileSync(archivePath)).digest("base64"),
      dependencies: packedManifest.dependencies, optionalDependencies: packedManifest.optionalDependencies,
      bin: packedManifest.bin, engines: packedManifest.engines, license: packedManifest.license,
    }
    fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify(lock))
    const installed = npmCommand(["install", "--ignore-scripts", "--omit=optional", "--no-audit", "--no-fund", "--offline", path.join(root, archive)], {
      cwd: root,
      encoding: "utf8",
      npmCache,
      timeout: 120_000, // Windows npm needs well over 30 s for an offline install with MCP dependencies
    })
    assert.equal(installed.status, 0, installed.stderr)

    const cli = path.join(root, "node_modules", "graphmory", "scripts", "brain-sync.mjs")
    const help = spawnSync(process.execPath, [cli, "--help"], { cwd: root, encoding: "utf8", shell: false })
    assert.equal(help.status, 0, help.stderr)
    assert.match(help.stdout, /recall --vault/)
    assert.match(help.stdout, /sync-plan --vault/)
    assert.match(help.stdout, /doctor/)
    const setup = path.join(root, "node_modules", "graphmory", "scripts", "setup-curator-agent.mjs")
    const setupHelp = spawnSync(process.execPath, [setup, "--help"], { cwd: root, encoding: "utf8", shell: false })
    assert.equal(setupHelp.status, 0, setupHelp.stderr)
    assert.match(setupHelp.stdout, /graphmory-setup --host/)
    const mcp = path.join(root, "node_modules", "graphmory", "scripts", "graphmory-mcp.mjs")
    const mcpHelp = spawnSync(process.execPath, [mcp, "--help"], { cwd: root, encoding: "utf8", shell: false })
    assert.equal(mcpHelp.status, 0, mcpHelp.stderr)
    assert.match(mcpHelp.stdout, /graphmory-mcp/)
    for (const guide of ["mcp-recall.md", "mcp-remember.md"]) {
      assert.ok(fs.existsSync(path.join(root, "node_modules", "graphmory", "docs", "guides", guide)))
    }
    const vault = path.join(root, "synthetic-vault")
    fs.mkdirSync(vault)
    fs.writeFileSync(path.join(vault, "Evidence.md"), "# Release approval\nProduction releases need independent approval.\n")
    const serverUrl = pathToFileURL(path.join(root, "node_modules", "graphmory", "src", "mcp-server.mjs")).href
    const sdkRoot = path.join(root, "node_modules", "@modelcontextprotocol", "sdk", "dist", "esm")
    const clientUrl = pathToFileURL(path.join(sdkRoot, "client", "index.js")).href
    const transportUrl = pathToFileURL(path.join(sdkRoot, "inMemory.js")).href
    const smoke = `
      import { createMcpServer } from ${JSON.stringify(serverUrl)};
      import { createMemoryEngine } from ${JSON.stringify(pathToFileURL(path.join(root, "node_modules", "graphmory", "src", "mcp-engine.mjs")).href)};
      import { Client } from ${JSON.stringify(clientUrl)};
      import { InMemoryTransport } from ${JSON.stringify(transportUrl)};
      const engine = createMemoryEngine({vault:process.argv[1],stateRoot:process.argv[2],config:${JSON.stringify({ version: 1, workflow: "curator", retrievalMode: "lexical", curator: {provider:"synthetic",model:"fixture"},decision:{maxCandidates:8}})}});
      const server = createMcpServer(engine), pair = InMemoryTransport.createLinkedPair();
      await server.connect(pair[1]);
      const client = new Client({name:"installed-smoke",version:"1"});await client.connect(pair[0]);
      const recall = await client.callTool({name:"recall",arguments:{query:"release approval"}});
      if (recall.structuredContent.candidates[0].path !== "Evidence.md") throw Error("packed recall failed");
      const resource = await client.readResource({uri:"graphmory://guide/remember"});
      if (!resource.contents[0].text.includes("checkpoint")) throw Error("packed resource missing");
      await client.close();await server.close();
    `
    const mcpSmoke = spawnSync(process.execPath, ["--input-type=module", "-e", smoke, vault, path.join(root, "state")], { cwd: root, encoding: "utf8", shell: false })
    assert.equal(mcpSmoke.status, 0, mcpSmoke.stderr)
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
    assert.equal(fs.existsSync(path.join(target, "bin", "memory-patch-harness.mjs")), false, "the legacy launcher is no longer installed")

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
