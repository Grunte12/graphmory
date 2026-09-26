#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { performance } from "node:perf_hooks"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"
import { summarizeHostUsage } from "./lib/host-usage.mjs"

// Developer-only pilot: requires an isolated authenticated OpenCode environment.
const args = process.argv.slice(2)
const option = (flag) => args[args.indexOf(flag) + 1]
for (const flag of ["--workspace", "--out"]) if (!args.includes(flag)) throw new Error(`Missing ${flag}`)
const workspace = path.resolve(option("--workspace"))
const out = path.resolve(option("--out"))
if (fs.existsSync(out) || fs.existsSync(`${out}.checkpoint`)) throw new Error("Report/checkpoint exists; preserve prior trials")
const traceDir = `${out}.traces`
fs.mkdirSync(traceDir, { mode: 0o700 })
const cli = path.resolve("scripts/brain-sync.mjs")
const vault = path.join(workspace, "vault")
const runtime = path.join(workspace, "runtime.json")
fs.writeFileSync(runtime, JSON.stringify(DEFAULT_RUNTIME_CONFIG), { mode: 0o600 })
const question = "What fields belong in a Memory Patch, who authors its meaning, and should the curator write without supporting provenance?"
const rows = []
const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`
for (let repeat = 0; repeat < 3; repeat++) {
  const order = repeat % 2 ? ["plain", "graphmory"] : ["graphmory", "plain"]
  for (const arm of order) {
    const strategy = arm === "graphmory"
      ? `Start with node ${shellQuote(cli)} recall-managed --vault ${shellQuote(vault)} --config ${shellQuote(runtime)} --query ${shellQuote(question)} --agent. Follow pagination if evidence is missing; read relevant source notes.`
      : "Use ordinary file search and read to find relevant evidence in ./vault. Do not use Graphmory commands."
    const prompt = `${strategy}\nQuestion: ${question}\nOnly inspect ./vault and the stated retrieval command. Reply with supported facts and exact note paths; do not edit any files.`
    const start = performance.now()
    const child = spawnSync("opencode", ["run", "--pure", "--agent", "paired_eval", "--format", "json", "--dir", workspace, prompt], {
      encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024,
    })
    const elapsedMs = performance.now() - start
    fs.writeFileSync(path.join(traceDir, `${arm}-${repeat}.jsonl`), child.stdout, { mode: 0o600, flag: "wx" })
    let events = []
    let parseFailure = null
    try { events = child.stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line)) }
    catch { parseFailure = "Host emitted invalid JSONL; inspect the private trace" }
    const usage = summarizeHostUsage(events)
    const text = events.filter((event) => event.type === "text").map((event) => event.part.text).join("\n")
    const failure = events.find((event) => event.type === "error")
    rows.push({ arm, repeat, elapsedMs, usage, answer: text, trace: `${arm}-${repeat}.jsonl`,
      failure: parseFailure ?? (child.status !== 0 || failure ? (child.error?.message ?? failure?.error?.data?.message ?? "host failed") : null),
      toolCalls: events.filter((event) => event.type === "tool_use").length })
    fs.writeFileSync(`${out}.checkpoint`, JSON.stringify({ model: "openai/gpt-5.6-luna", question, rows }, null, 2), { mode: 0o600 })
    console.log(`${arm} repeat ${repeat}: ${rows.at(-1).failure ? "FAILED" : "completed"}; usage=${usage ? "reported" : "unknown"}`)
    if (rows.at(-1).failure) throw new Error("Host trial failed; preserve checkpoint and audit before retry")
  }
}
fs.writeFileSync(out, `${JSON.stringify({ model: "openai/gpt-5.6-luna", host: "OpenCode", question, rows,
  limitation: "One development question, three trials per arm; host-reported token usage, billed subscription cost unknown; no superiority acceptance claim." }, null, 2)}\n`, { mode: 0o600 })
