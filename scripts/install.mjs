#!/usr/bin/env node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { writeJsonAtomic } from "../src/atomic-write.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")
const args = process.argv.slice(2)

function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}

function flag(name) {
  return args.includes(name)
}

const targetRoot = path.resolve(option("--target", path.join(os.homedir(), ".config", "opencode")))
const force = args.includes("--force")
const dryRun = flag("--dry-run")

// --- Read installed manifest if present ---
const manifestPath = path.join(targetRoot, "skills", "memory-curator", ".install-manifest.json")
let oldVersion = null
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    oldVersion = manifest.version || null
  } catch { /* ignore malformed */ }
}

const ownVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version

// --- Warn on upgrade / downgrade ---
if (oldVersion && oldVersion !== ownVersion) {
  console.log(`Existing install: v${oldVersion}, repository: v${ownVersion}`)
  if (!force) {
    console.log("Run with --force to overwrite, or --upgrade to apply a safe migration.")
  }
}

// --- Upgrade mode: diff known config changes ---
const upgradeMode = force || flag("--upgrade")
if (oldVersion && !upgradeMode && !flag("--check")) {
  console.error(`Existing install detected (v${oldVersion}) at ${targetRoot}`)
  console.error("Use --upgrade to apply a safe migration, or --force to overwrite.")
  console.error("Use --check to see what would change without installing.")
  process.exit(1)
}

// --- Check mode: diff what would change ---
if (flag("--check")) {
  const check = { version: ownVersion, installed: oldVersion, changes: [] }
  const installedSkill = path.join(targetRoot, "skills", "memory-curator")
  if (fs.existsSync(installedSkill)) {
    const skillFiles = fs.readdirSync(path.join(root, "skills", "memory-curator"), { recursive: true })
    for (const file of skillFiles) {
      const repoFile = path.join(root, "skills", "memory-curator", file)
      const targetFile = path.join(installedSkill, file)
      if (!fs.existsSync(targetFile)) {
        check.changes.push({ action: "add", file: `skills/memory-curator/${file}` })
      } else if (
        fs.statSync(repoFile).isFile() &&
        fs.readFileSync(repoFile, "utf8") !== fs.readFileSync(targetFile, "utf8")
      ) {
        check.changes.push({ action: "update", file: `skills/memory-curator/${file}` })
      }
    }
    for (const file of fs.readdirSync(installedSkill, { recursive: true })) {
      if (file === ".install-manifest.json") continue
      if (!fs.existsSync(path.join(root, "skills", "memory-curator", file))) {
        check.changes.push({ action: "remove", file: `skills/memory-curator/${file}` })
      }
    }
  } else {
    check.changes.push({ action: "add", file: "skills/memory-curator/ (directory)" })
  }
  const srcDest = path.join(targetRoot, "src")
  if (fs.existsSync(srcDest)) {
    const srcFiles = fs.readdirSync(path.join(root, "src"), { recursive: true })
    for (const file of srcFiles) {
      const repoFile = path.join(root, "src", file)
      const targetFile = path.join(srcDest, file)
      if (!fs.existsSync(targetFile)) {
        check.changes.push({ action: "add", file: `src/${file}` })
      } else if (
        fs.statSync(repoFile).isFile() &&
        fs.readFileSync(repoFile, "utf8") !== fs.readFileSync(targetFile, "utf8")
      ) {
        check.changes.push({ action: "update", file: `src/${file}` })
      }
    }
  } else {
    check.changes.push({ action: "add", file: "src/ (directory)" })
  }
  for (const name of ["graphmory.mjs", "memory-patch-harness.mjs"]) {
    const cliTarget = path.join(targetRoot, "bin", name)
    if (!fs.existsSync(cliTarget)) {
      check.changes.push({ action: "add", file: `bin/${name} (CLI launcher)` })
    } else if (fs.readFileSync(path.join(root, "scripts", "brain-sync.mjs"), "utf8") !== fs.readFileSync(cliTarget, "utf8")) {
      check.changes.push({ action: "update", file: `bin/${name}` })
    }
  }
  console.log(JSON.stringify(check, null, 2))
  if (!check.changes.length) console.log("No changes needed.")
  process.exit(0)
}

// --- Copy skill ---
const skillSource = path.join(root, "skills", "memory-curator")
const skillDest = path.join(targetRoot, "skills", "memory-curator")
if (fs.existsSync(skillDest)) {
  if (!upgradeMode) {
    console.error(`Refusing to overwrite ${skillDest}`)
    console.error("Review the existing skill or rerun with --force.")
    process.exit(1)
  }
  if (dryRun) {
    console.log(`[dry-run] would overwrite ${skillDest}`)
  } else {
    fs.rmSync(skillDest, { recursive: true, force: true })
  }
}
if (!dryRun) {
  fs.mkdirSync(path.dirname(skillDest), { recursive: true })
  fs.cpSync(skillSource, skillDest, { recursive: true, force: upgradeMode })
  console.log(`Installed skill: ${skillDest}`)
}

// --- Copy src/ modules so the CLI can run ---
const srcSource = path.join(root, "src")
const srcDest = path.join(targetRoot, "src")
if (!dryRun) {
  fs.mkdirSync(srcDest, { recursive: true })
  for (const entry of fs.readdirSync(srcSource, { recursive: true })) {
    const sourceFile = path.join(srcSource, entry)
    const targetFile = path.join(srcDest, entry)
    if (!fs.statSync(sourceFile).isFile()) continue
    fs.mkdirSync(path.dirname(targetFile), { recursive: true })
    fs.cpSync(sourceFile, targetFile, { force: upgradeMode })
  }
  console.log(`Installed src modules: ${srcDest}`)
}

// --- Install CLI launcher ---
const binDir = path.join(targetRoot, "bin")
const cliSource = path.join(root, "scripts", "brain-sync.mjs")
if (!dryRun) {
  fs.mkdirSync(binDir, { recursive: true })
  for (const name of ["graphmory.mjs", "memory-patch-harness.mjs"]) {
    fs.cpSync(cliSource, path.join(binDir, name), { force: upgradeMode })
  }
  console.log(`Installed CLI: ${path.join(binDir, "graphmory.mjs")}`)
}

// --- Write install manifest ---
if (!dryRun) {
  const manifest = {
    version: ownVersion,
    installedAt: new Date().toISOString(),
    target: targetRoot,
    components: ["skills/memory-curator", "src/", "bin/graphmory.mjs", "bin/memory-patch-harness.mjs"],
  }
  writeJsonAtomic(path.join(skillDest, ".install-manifest.json"), manifest)
}

if (dryRun) {
  console.log(`[dry-run] installation skipped (use without --dry-run to apply)`)
  process.exit(0)
}

console.log("")
console.log("Manual OpenCode integration:")
console.log(`1. Review ${path.join(root, "adapters", "opencode", "AGENTS.snippet.md")}`)
console.log(`2. Review ${path.join(root, "adapters", "opencode", "memory-curator-prompt.md")}`)
console.log(`3. Merge the example agent using only fields supported by your OpenCode version.`)
console.log(`4. To run the CLI from anywhere, add ${binDir} to your PATH.`)
console.log("The installer intentionally does not edit opencode.json.")
