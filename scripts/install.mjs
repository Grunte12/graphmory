#!/usr/bin/env node
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")
const args = process.argv.slice(2)

function option(name, fallback = null) {
  const index = args.indexOf(name)
  if (index < 0) return fallback
  const value = args[index + 1]
  if (!value || value.startsWith("--")) {
    console.error(`${name} requires a value`)
    process.exit(1)
  }
  return value
}

function flag(name) {
  return args.includes(name)
}

function slash(value) {
  return value.replaceAll("\\", "/")
}

function digest(content) {
  return crypto.createHash("sha256").update(content).digest("hex")
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath || entry.path, entry.name))
}

function renderAgent(template, values) {
  let rendered = template
  for (const [name, value] of Object.entries(values)) {
    rendered = rendered.replaceAll(`{{${name}}}`, value)
  }
  const unresolved = rendered.match(/\{\{[A-Z0-9_]+\}\}/gu)
  if (unresolved) throw new Error(`Unresolved OpenCode agent placeholders: ${unresolved.join(", ")}`)
  return rendered
}

const targetRoot = path.resolve(option("--target", path.join(os.homedir(), ".config", "opencode")))
const vaultInput = option("--vault", process.env.OBSIDIAN_VAULT)
if (!vaultInput) {
  console.error("A configured Brain path is required. Pass --vault <path> or set OBSIDIAN_VAULT.")
  process.exit(1)
}
const vaultRoot = path.resolve(vaultInput)
const runtime = option("--runtime", "opencode")
if (!new Set(["opencode", "core"]).has(runtime)) {
  console.error("--runtime must be opencode or core")
  process.exit(1)
}
const force = flag("--force")
const upgrade = flag("--upgrade")
const check = flag("--check")
const dryRun = flag("--dry-run")
const replaceManagedFiles = force || upgrade

const ownVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version
const manifestPath = path.join(targetRoot, "skills", "memory-curator", ".install-manifest.json")
let oldManifest = null
if (fs.existsSync(manifestPath)) {
  try {
    oldManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  } catch {
    oldManifest = null
  }
}

const cliTarget = path.join(targetRoot, "bin", "memory-patch-harness.mjs")
const agentTarget = path.join(targetRoot, "agents", "memory_curator.md")
const normalizedVault = slash(vaultRoot)
const normalizedTarget = slash(targetRoot)
const normalizedCli = slash(cliTarget)
const renderedAgent = runtime === "opencode"
  ? renderAgent(
      fs.readFileSync(path.join(root, "adapters", "opencode", "agents", "memory_curator.md"), "utf8"),
      {
        VAULT_GLOB_JSON: JSON.stringify(`${normalizedVault}/**`),
        TARGET_GLOB_JSON: JSON.stringify(`${normalizedTarget}/**`),
        CLI_COMMAND_GLOB_JSON: JSON.stringify(`node \"${normalizedCli}\" *`),
        VAULT_PATH_JSON: JSON.stringify(normalizedVault),
        CLI_PATH_JSON: JSON.stringify(normalizedCli),
      },
    )
  : null

const planned = []
const fileOperations = []

function planManagedFile(source, destination, display) {
  const content = fs.readFileSync(source)
  if (!fs.existsSync(destination)) {
    planned.push({ action: "add", file: display })
    fileOperations.push({ destination, content })
    return
  }
  const installed = fs.readFileSync(destination)
  if (installed.equals(content)) return
  if (replaceManagedFiles) {
    planned.push({ action: "update", file: display })
    fileOperations.push({ destination, content })
  } else {
    planned.push({ action: "preserve", file: display, reason: "use --upgrade or --force to replace" })
  }
}

for (const source of listFiles(path.join(root, "skills", "memory-curator"))) {
  const relative = path.relative(path.join(root, "skills", "memory-curator"), source)
  planManagedFile(
    source,
    path.join(targetRoot, "skills", "memory-curator", relative),
    slash(path.join("skills", "memory-curator", relative)),
  )
}

for (const source of listFiles(path.join(root, "src"))) {
  const relative = path.relative(path.join(root, "src"), source)
  planManagedFile(source, path.join(targetRoot, "src", relative), slash(path.join("src", relative)))
}

planManagedFile(
  path.join(root, "scripts", "brain-sync.mjs"),
  cliTarget,
  "bin/memory-patch-harness.mjs",
)

const existingAgent = runtime === "opencode" && fs.existsSync(agentTarget)
  ? fs.readFileSync(agentTarget, "utf8")
  : null
const expectedManagedAgentHash = oldManifest?.agent?.sha256 || null
const agentIsUnchangedManaged = existingAgent !== null && expectedManagedAgentHash === digest(existingAgent)
let agentOperation = null

if (runtime === "opencode" && existingAgent === null) {
  planned.push({ action: "add", file: "agents/memory_curator.md" })
  agentOperation = { destination: agentTarget, content: renderedAgent }
} else if (runtime === "opencode" && existingAgent !== renderedAgent) {
  if (force || (upgrade && agentIsUnchangedManaged)) {
    planned.push({ action: "update", file: "agents/memory_curator.md" })
    agentOperation = { destination: agentTarget, content: renderedAgent }
  } else {
    planned.push({
      action: "preserve",
      file: "agents/memory_curator.md",
      reason: agentIsUnchangedManaged
        ? "use --upgrade or --force to replace the managed agent"
        : "existing agent is unmanaged or locally modified; use --force to replace",
    })
  }
}

const report = {
  version: ownVersion,
  installed: oldManifest?.version || null,
  runtime,
  target: targetRoot,
  vault: vaultRoot,
  changes: planned,
}

if (check || dryRun) {
  console.log(JSON.stringify(report, null, 2))
  if (dryRun) console.log("Dry run only; no files were changed.")
  process.exit(0)
}

for (const operation of fileOperations) {
  fs.mkdirSync(path.dirname(operation.destination), { recursive: true })
  fs.writeFileSync(operation.destination, operation.content)
}
if (agentOperation) {
  fs.mkdirSync(path.dirname(agentOperation.destination), { recursive: true })
  fs.writeFileSync(agentOperation.destination, agentOperation.content)
}

const installedAgentHash = runtime === "opencode" && fs.existsSync(agentTarget)
  ? digest(fs.readFileSync(agentTarget, "utf8"))
  : null
const agentWasPreservedUnmanaged = existingAgent !== null && !agentOperation && !agentIsUnchangedManaged
const manifest = {
  version: ownVersion,
  installedAt: new Date().toISOString(),
  target: targetRoot,
  vault: vaultRoot,
  components: [
    "skills/memory-curator",
    "src/",
    "bin/memory-patch-harness.mjs",
    ...(runtime === "opencode" ? ["agents/memory_curator.md"] : []),
  ],
  agent: runtime === "opencode"
    ? {
        path: "agents/memory_curator.md",
        sha256: agentWasPreservedUnmanaged ? expectedManagedAgentHash : installedAgentHash,
      }
    : null,
}
fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

for (const change of planned) {
  const suffix = change.reason ? ` (${change.reason})` : ""
  console.log(`${change.action}: ${path.join(targetRoot, change.file)}${suffix}`)
}
if (!planned.length) console.log("No managed file changes were needed.")
if (runtime === "opencode") console.log(`Installed OpenCode wildcard curator: ${agentTarget}`)
console.log("The installer did not modify opencode.json.")
