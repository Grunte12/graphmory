#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
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
const defaultQuestion = "What fields belong in a Memory Patch, who authors its meaning, and should the curator write without supporting provenance?"
const suite = args.includes("--questions") ? JSON.parse(fs.readFileSync(path.resolve(option("--questions")), "utf8")) : [{ id: "patch-development", question: defaultQuestion }]
if (!Array.isArray(suite) || !suite.length || suite.some((item) => !/^[a-z0-9-]+$/.test(item.id) || typeof item.question !== "string" || !item.question.trim() || Object.keys(item).some((key) => !["id", "question"].includes(key))) || new Set(suite.map((item) => item.id)).size !== suite.length) throw new Error("Questions must have unique safe IDs and question text only; keep gold labels separate")
const repeats = args.includes("--repeats") ? Number(option("--repeats")) : 3
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 10) throw new Error("Repeats must be 1..10")
const digest = (value) => createHash("sha256").update(value).digest("hex")
const snapshot = (root) => {
  const entries = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name)
      if (entry.isSymbolicLink()) throw new Error("Evaluation vault must not contain symlinks")
      if (entry.isDirectory()) walk(file)
      else if (entry.isFile()) entries.push([path.relative(root, file), digest(fs.readFileSync(file))])
    }
  }
  walk(root)
  return digest(JSON.stringify(entries))
}
const baselineVault = snapshot(vault)
const configRoot = process.env.XDG_CONFIG_HOME
if (!configRoot) throw new Error("Use an isolated XDG_CONFIG_HOME for the evaluation")
const hostConfig = JSON.parse(fs.readFileSync(path.join(configRoot, "opencode.json"), "utf8"))
if ((hostConfig.agent?.paired_eval?.model ?? hostConfig.model) !== "openai/gpt-5.6-luna") throw new Error("Paired evaluator model must match the recorded model")
const metadata = { runnerHash: digest(fs.readFileSync(new URL(import.meta.url))), sourceHash: digest(snapshot(path.resolve("src")) + digest(fs.readFileSync(cli))), model: "openai/gpt-5.6-luna", host: "OpenCode", hostVersion: spawnSync("opencode", ["--version"], { encoding: "utf8" }).stdout.trim(),
  revision: spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim(),
  questionsHash: digest(JSON.stringify(suite)), vaultHash: baselineVault, runtimeHash: digest(fs.readFileSync(runtime)),
  hostConfigHash: digest(fs.readFileSync(path.join(configRoot, "opencode.json"))), repeats,
  treatment: "retrieval adapter only; shared evidence-based prompt; full product skill not loaded" }
const rows = []
const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`
for (const [questionIndex, { id, question }] of suite.entries()) {
  for (let repeat = 0; repeat < repeats; repeat++) {
    const order = (repeat + questionIndex) % 2 ? ["plain", "graphmory"] : ["graphmory", "plain"]
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
      fs.writeFileSync(path.join(traceDir, `${id}-${arm}-${repeat}.jsonl`), child.stdout, { mode: 0o600, flag: "wx" })
      let events = []
      let parseFailure = null
      try { events = child.stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line)) }
      catch { parseFailure = "Host emitted invalid JSONL; inspect the private trace" }
      const usage = summarizeHostUsage(events)
      const text = events.filter((event) => event.type === "text").map((event) => event.part.text).join("\n")
      const failure = events.find((event) => event.type === "error")
      const vaultUnchanged = snapshot(vault) === baselineVault
      rows.push({ questionId: id, arm, repeat, elapsedMs, usage, answer: text, trace: `${id}-${arm}-${repeat}.jsonl`,
        vaultUnchanged,
        failure: !vaultUnchanged ? "Evaluation vault changed; stop and inspect" : parseFailure ?? (child.status !== 0 || failure ? (child.error?.message ?? failure?.error?.data?.message ?? "host failed") : null),
        toolCalls: events.filter((event) => event.type === "tool_use").length })
      fs.writeFileSync(`${out}.checkpoint`, JSON.stringify({ ...metadata, questions: suite, rows }, null, 2), { mode: 0o600 })
      console.log(`${id} ${arm} repeat ${repeat}: ${rows.at(-1).failure ? "FAILED" : "completed"}; usage=${usage ? "reported" : "unknown"}`)
      if (rows.at(-1).failure) throw new Error("Host trial failed; preserve checkpoint and audit before retry")
    }
  }
}
fs.writeFileSync(out, `${JSON.stringify({ ...metadata, questions: suite, rows,
  limitation: "Development suite, paired trials; host-reported token usage, billed subscription cost unknown; no superiority acceptance claim." }, null, 2)}\n`, { mode: 0o600 })
