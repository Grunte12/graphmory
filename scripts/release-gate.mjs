#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const steps = []

function runStep(name, command, args, { parseJson = false } = {}) {
  const started = Date.now()
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    stdio: parseJson ? "pipe" : "pipe",
  })
  const elapsedMs = Date.now() - started
  const passed = result.status === 0
  steps.push({ name, passed, elapsedMs })
  if (!passed) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    throw new Error(`${name} failed with exit ${result.status}`)
  }
  return parseJson ? JSON.parse(result.stdout) : result.stdout
}

function npmCli() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ].filter(Boolean)
  return candidates.find((candidate) => fs.existsSync(candidate))
}

function npmArgs(args) {
  const cli = npmCli()
  return cli ? { command: process.execPath, args: [cli, ...args] } : { command: "npm", args }
}

function runNpmStep(name, args, options) {
  const npm = npmArgs(args)
  return runStep(name, npm.command, npm.args, options)
}

function assertPackIsClean(packReport) {
  const [packed] = packReport
  if (!packed?.files?.length) throw new Error("npm pack dry-run returned no files")
  const files = packed.files.map((entry) => entry.path.replaceAll("\\", "/"))
  const forbidden = [
    /^\.opencode\//u,
    /^tmp\//u,
    /^node_modules\//u,
    /^\.git\//u,
    /private-vault/u,
    /Stockalytics/u,
    /GrunteBrain/u,
  ]
  const offenders = files.filter((file) => forbidden.some((pattern) => pattern.test(file)))
  if (offenders.length) {
    throw new Error(`package includes forbidden files:\n${offenders.join("\n")}`)
  }
  const required = [
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
    "scripts/brain-sync.mjs",
    "scripts/install.mjs",
    "scripts/recommend-curation.mjs",
    "src/memory-lifecycle-audit.mjs",
    "docs/portable-brain-sync.md",
    "adapters/generic-agent/INSTALL.md",
  ]
  const missing = required.filter((file) => !files.includes(file))
  if (missing.length) throw new Error(`package is missing required release files:\n${missing.join("\n")}`)
  return { fileCount: files.length, unpackedSize: packed.unpackedSize, filename: packed.filename }
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
  if (!/^0\.5\.0-rc\.\d+$/u.test(pkg.version)) {
    throw new Error(`release gate expects a v0.5 release candidate, got ${pkg.version}`)
  }

  runNpmStep("check: unit + schema + core evals", ["run", "check"])
  runNpmStep("eval: report artifact contracts", ["run", "eval:report"])
  const packReport = runNpmStep("npm pack dry-run", ["pack", "--dry-run", "--json"], { parseJson: true })
  const pack = assertPackIsClean(packReport)

  console.log("")
  console.log("Memory Patch Harness release gate")
  console.log("")
  console.log(`Version: ${pkg.version}`)
  console.log(`Package: ${pack.filename ?? "(dry-run)"} (${pack.fileCount} files, ${pack.unpackedSize ?? "unknown"} bytes unpacked)`)
  console.log("")
  console.log("| Gate | Result | Time |")
  console.log("|---|---:|---:|")
  for (const step of steps) {
    console.log(`| ${step.name} | ${step.passed ? "PASS" : "FAIL"} | ${(step.elapsedMs / 1000).toFixed(1)}s |`)
  }
  console.log("")
  console.log("Release gate passed. This does not push or publish anything.")
}

try {
  main()
} catch (error) {
  console.error(`\nRelease gate failed: ${error.message}`)
  process.exit(1)
}
