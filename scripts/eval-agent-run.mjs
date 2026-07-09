#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import process from "node:process"

const args = process.argv.slice(2)
function option(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : ""
}

const curatorOutput = option("--curator-output")
const patches = option("--patches")
const allowFailures = args.includes("--allow-failures")

if (!curatorOutput && !patches) {
  console.error("Usage: node scripts/eval-agent-run.mjs [--curator-output file-or-dir] [--patches file-or-dir] [--allow-failures]")
  process.exit(2)
}

function run(label, commandArgs) {
  console.log(`\n== ${label} ==`)
  const result = spawnSync(process.execPath, commandArgs, {
    stdio: "inherit",
    shell: false,
  })
  if (result.status !== 0 && !allowFailures) process.exit(result.status ?? 1)
  return result.status ?? 0
}

const failures = []
if (curatorOutput) {
  const status = run("Curator behavior", ["scripts/eval-curator.mjs", "--candidate", curatorOutput])
  if (status !== 0) failures.push("curator behavior")
}
if (patches) {
  const status = run("Patch quality", ["scripts/eval-patch-quality.mjs", "--candidate", patches])
  if (status !== 0) failures.push("patch quality")
}

if (failures.length) {
  console.log(`\nCompleted with failing sections: ${failures.join(", ")}`)
  if (!allowFailures) process.exit(1)
} else {
  console.log("\nAgent run eval passed")
}
