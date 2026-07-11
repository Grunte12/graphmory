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

const claudeHome = path.resolve(option("--claude-home", process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude")))
const vault = path.resolve(required("--vault"))
const scope = required("--scope")
const dryRun = flag("--dry-run")
const force = flag("--force")
const skipHarness = flag("--skip-harness")

const replacements = {
  "<CLAUDE_HOME>": claudeHome,
  "<path-to-your-vault>": vault,
  "<your-memory-scope>": scope,
}

function render(content, json = false) {
  let result = content
  for (const [marker, rawValue] of Object.entries(replacements)) {
    const value = json ? rawValue.replaceAll("\\", "\\\\") : rawValue
    result = result.replaceAll(marker, value)
  }
  return result
}

function guardOverwrite(destination) {
  if (fs.existsSync(destination) && !force) {
    throw new Error(`Refusing to overwrite ${destination}; rerun with --force after review`)
  }
}

function copyFile(source, destination) {
  guardOverwrite(destination)
  if (dryRun) {
    console.log(`[dry-run] ${path.relative(root, source)} -> ${destination}`)
    return
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.copyFileSync(source, destination)
  console.log(`Installed: ${destination}`)
}

function writeRendered(source, destination, { json = false } = {}) {
  guardOverwrite(destination)
  if (dryRun) {
    console.log(`[dry-run] rendered ${path.relative(root, source)} -> ${destination}`)
    return
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, render(fs.readFileSync(source, "utf8"), json))
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

if (!fs.existsSync(vault) || !fs.statSync(vault).isDirectory()) {
  throw new Error(`Vault directory does not exist: ${vault}`)
}

if (!dryRun && !skipHarness) {
  const manifest = path.join(claudeHome, "skills", "memory-curator", ".install-manifest.json")
  runNode(path.join(root, "scripts", "install.mjs"), [
    "--target",
    claudeHome,
    "--vault",
    vault,
    "--runtime",
    "core",
    ...(fs.existsSync(manifest) ? ["--upgrade"] : []),
  ])
}

if (skipHarness && !fs.existsSync(path.join(claudeHome, "bin", "memory-patch-harness.mjs"))) {
  throw new Error(`--skip-harness requires an existing harness CLI under ${claudeHome}`)
}

// Subagent: no placeholders, copy as-is.
copyFile(
  path.join(here, "agents", "memory-curator.md"),
  path.join(claudeHome, "agents", "memory-curator.md"),
)

// Handoff skill: SKILL.md carries <CLAUDE_HOME>/<path-to-your-vault>/<your-memory-scope> placeholders.
writeRendered(
  path.join(here, "skills", "claude-memory-handoff", "SKILL.md"),
  path.join(claudeHome, "skills", "claude-memory-handoff", "SKILL.md"),
)

// Helper scripts: copy individually so an existing scripts/ directory with unrelated
// files (other hooks, personal tooling) is never overwritten wholesale.
const scriptsDir = path.join(here, "scripts")
for (const script of fs.readdirSync(scriptsDir).filter((file) => file.endsWith(".ps1"))) {
  copyFile(path.join(scriptsDir, script), path.join(claudeHome, "scripts", script))
}

// CLAUDE.md and settings.json are never modified directly. Render both snippets
// for manual review/merge, matching the codex adapter's AGENTS.md-safe pattern.
writeRendered(
  path.join(here, "CLAUDE.snippet.md"),
  path.join(claudeHome, "memory-patch-harness", "CLAUDE.snippet.md"),
)
writeRendered(
  path.join(here, "settings.snippet.json"),
  path.join(claudeHome, "memory-patch-harness", "settings.snippet.json"),
  { json: true },
)

if (dryRun) {
  console.log(`[dry-run] installation skipped (use without --dry-run to apply)`)
  process.exit(0)
}

console.log("")
console.log("Claude Code adapter installed without modifying CLAUDE.md or settings.json.")
console.log(`Review and merge: ${path.join(claudeHome, "memory-patch-harness", "CLAUDE.snippet.md")}`)
console.log(`Review and optionally merge: ${path.join(claudeHome, "memory-patch-harness", "settings.snippet.json")}`)
console.log(`Vault: ${vault}`)
console.log(`Scope: ${scope}`)
console.log("Start a fresh Claude Code session after merging the snippet so the subagent, skill, and scripts reload.")
