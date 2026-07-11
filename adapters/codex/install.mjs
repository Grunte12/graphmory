#!/usr/bin/env node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const args = process.argv.slice(2)

function option(name, fallback = "") {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}

function flag(name) {
  return args.includes(name)
}

function required(name) {
  const value = option(name)
  if (!value) throw new Error(`${name} is required`)
  return value
}

const codexHome = path.resolve(option("--codex-home", process.env.CODEX_HOME || path.join(os.homedir(), ".codex")))
const harnessTarget = path.resolve(option("--harness-target", path.join(codexHome, "tools", "memory-patch-harness")))
const vault = path.resolve(required("--vault"))
const scope = required("--scope")
const modelCache = path.resolve(option("--model-cache", path.join(codexHome, "cache", "memory-patch-harness", "models")))
const dryRun = flag("--dry-run")
const force = flag("--force")
const withSemantic = flag("--with-semantic")
const skipHarness = flag("--skip-harness")

const replacements = {
  "{{CODEX_HOME}}": codexHome,
  "{{HARNESS_CLI}}": path.join(harnessTarget, "bin", "memory-patch-harness.mjs"),
  "{{VAULT}}": vault,
  "{{SCOPE}}": scope,
  "{{MODEL_CACHE}}": modelCache,
  "{{CURATOR_MODEL}}": option("--curator-model", "gpt-5.4-mini"),
  "{{CURATOR_EFFORT}}": option("--curator-effort", "medium"),
  "{{DEEP_MODEL}}": option("--deep-model", "gpt-5.4"),
  "{{DEEP_EFFORT}}": option("--deep-effort", "low"),
  "{{INGEST_MODEL}}": option("--ingest-model", "gpt-5.4-mini"),
  "{{INGEST_EFFORT}}": option("--ingest-effort", "medium"),
}

function render(content, toml = false) {
  let result = content
  for (const [marker, rawValue] of Object.entries(replacements)) {
    const value = toml ? rawValue.replaceAll("\\", "\\\\").replaceAll('"', '\\"') : rawValue
    result = result.replaceAll(marker, value)
  }
  return result
}

function installFile(source, destination, { toml = false } = {}) {
  if (fs.existsSync(destination) && !force) {
    throw new Error(`Refusing to overwrite ${destination}; rerun with --force after review`)
  }
  if (dryRun) {
    console.log(`[dry-run] ${path.relative(root, source)} -> ${destination}`)
    return
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, render(fs.readFileSync(source, "utf8"), toml))
  console.log(`Installed: ${destination}`)
}

function runNode(script, scriptArgs) {
  const result = spawnSync(process.execPath, [script, ...scriptArgs], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Failed: ${script}`)
  if (result.stdout.trim()) console.log(result.stdout.trim())
}

function runNpm(npmArgs) {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ].filter(Boolean)
  const npmCli = candidates.find((candidate) => fs.existsSync(candidate))
  const result = npmCli
    ? spawnSync(process.execPath, [npmCli, ...npmArgs], { encoding: "utf8", shell: false })
    : spawnSync("npm", npmArgs, { encoding: "utf8", shell: process.platform === "win32" })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "npm install failed")
  if (result.stdout.trim()) console.log(result.stdout.trim())
}

if (!fs.existsSync(vault) || !fs.statSync(vault).isDirectory()) {
  throw new Error(`Vault directory does not exist: ${vault}`)
}

if (!dryRun && !skipHarness) {
  const manifest = path.join(harnessTarget, "skills", "memory-curator", ".install-manifest.json")
  runNode(path.join(root, "scripts", "install.mjs"), [
    "--target",
    harnessTarget,
    "--vault",
    vault,
    "--runtime",
    "core",
    ...(fs.existsSync(manifest) ? ["--upgrade"] : []),
  ])
}

if (skipHarness && !fs.existsSync(path.join(harnessTarget, "bin", "memory-patch-harness.mjs"))) {
  throw new Error(`--skip-harness requires an existing harness CLI under ${harnessTarget}`)
}

for (const skill of ["memory-curator", "brain-ingest", "brain-update"]) {
  const source = skill === "memory-curator"
    ? path.join(here, "skills", skill, "SKILL.md")
    : path.join(root, "skills", skill, "SKILL.md")
  installFile(
    source,
    path.join(codexHome, "skills", skill, "SKILL.md"),
  )
}

for (const agent of ["memory-curator", "memory-curator-deep", "memory-ingest"]) {
  installFile(
    path.join(here, "agents", `${agent}.toml`),
    path.join(codexHome, "agents", `${agent}.toml`),
    { toml: true },
  )
}

installFile(
  path.join(here, "AGENTS.snippet.md"),
  path.join(codexHome, "memory-patch-harness", "AGENTS.snippet.md"),
)

if (withSemantic) {
  if (dryRun) {
    console.log(`[dry-run] install @huggingface/transformers under ${harnessTarget}`)
  } else {
    runNpm(["install", "--prefix", harnessTarget, "@huggingface/transformers@^3.4.0"])
  }
}

console.log("")
console.log("Codex adapter installed without modifying AGENTS.md.")
console.log(`Review and merge: ${path.join(codexHome, "memory-patch-harness", "AGENTS.snippet.md")}`)
console.log(`Vault: ${vault}`)
console.log(`Scope: ${scope}`)
console.log("Start a fresh Codex task after merging the snippet so skills and custom agents reload.")
