#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(root, "scripts", "brain-sync.mjs")
const args = process.argv.slice(2)
const option = (flag) => args[args.indexOf(flag) + 1]
if (!args.includes("--vault") || !args.includes("--queries")) {
  console.error("Usage: node scripts/eval-agent-output.mjs --vault <path> --queries <json>")
  process.exit(2)
}
const vault = path.resolve(option("--vault"))
const queries = JSON.parse(fs.readFileSync(option("--queries"), "utf8"))
if (!Array.isArray(queries) || !queries.length) throw new Error("queries must be a non-empty array")
const run = (command, item, format) => {
  const result = spawnSync(process.execPath, [cli, command, "--vault", vault, "--query", item.query,
    "--k", "3", ...(item.scope ? ["--scope", item.scope] : []), format], { encoding: "utf8" })
  if (result.status !== 0) throw new Error(`${command} ${format} failed for ${item.id}: ${result.stderr}`)
  return { value: JSON.parse(result.stdout), bytes: Buffer.byteLength(result.stdout) }
}
for (const command of ["recall", "recall-loop"]) {
  let fullBytes = 0
  let compactFullBytes = 0
  let agentBytes = 0
  let hits = 0
  for (const item of queries) {
    const full = run(command, item, "--json")
    const agent = run(command, item, "--agent")
    const paths = (value) => value.results.map(({ path }) => path)
    if (JSON.stringify(paths(full.value)) !== JSON.stringify(paths(agent.value))) throw new Error(`Path drift for ${item.id}`)
    for (const key of ["confidence", "needsExpansion", "scanLimitReached"]) {
      if (full.value[key] !== agent.value[key]) throw new Error(`${key} drift for ${item.id}`)
    }
    if (JSON.stringify(full.value.results.map(({ status }) => status)) !== JSON.stringify(agent.value.results.map(({ status }) => status))) {
      throw new Error(`Lifecycle status drift for ${item.id}`)
    }
    if (command === "recall-loop" && JSON.stringify(full.value.results.map(({ lanes }) => lanes))
      !== JSON.stringify(agent.value.results.map(({ lanes }) => lanes))) throw new Error(`Lane drift for ${item.id}`)
    const gold = Array.isArray(item.relevant_groups) ? item.relevant_groups.flat() : item.relevant ?? []
    if (paths(full.value).some((candidate) => gold.some((id) => candidate === id || candidate === `${id}.md`
      || candidate.endsWith(`/${id}.md`)))) hits++
    fullBytes += full.bytes
    compactFullBytes += Buffer.byteLength(JSON.stringify(full.value))
    agentBytes += agent.bytes
  }
  const saved = (before) => `${((1 - agentBytes / before) * 100).toFixed(1)}%`
  console.log(`${command}: ${queries.length} queries; path/status/gate parity PASS; Hit@3 ${(hits / queries.length * 100).toFixed(1)}%; `
    + `pretty JSON ${fullBytes} B → agent ${agentBytes} B (${saved(fullBytes)} less); `
    + `minified full ${compactFullBytes} B → agent ${agentBytes} B (${saved(compactFullBytes)} less)`)
}
