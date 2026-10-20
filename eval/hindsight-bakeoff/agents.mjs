// Agent-level bake-off: a headless Cursor agent answers memory questions through one MCP server
// (Graphmory or Hindsight). Measures wall time, MCP tool calls, correct source and token usage when reported.
// Usage: node eval/hindsight-bakeoff/agents.mjs --model gemini-3.7-flash-high [--systems graphmory,hindsight] [--ids a,b]
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback }
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const vault = path.join(repo, "eval/real-vault/vault")
const model = arg("--model", "gemini-3.7-flash-high")
const systems = arg("--systems", "graphmory,hindsight").split(",")
const ids = arg("--ids", "exact-toki,semantic-degradation,conflict-dont-use-rag,multihop-agent-memory-foundations,link-recovery-selfrag").split(",")
const queries = JSON.parse(fs.readFileSync(path.join(repo, "eval/real-vault/queries.json"), "utf8")).filter(q => ids.includes(q.id))
const agentBin = process.env.CURSOR_AGENT || path.join(os.homedir(), ".local/bin/agent")
const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-bakeoff-"))

const server = system => system === "graphmory"
  ? { command: process.execPath, args: [path.join(repo, "scripts/graphmory-mcp.mjs")], env: { GRAPHMORY_VAULT: vault, GRAPHMORY_STATE_DIR: path.join(root, "gm-state") } }
  : { url: `${process.env.HINDSIGHT_URL || "http://127.0.0.1:8888"}/mcp/graphmory-bakeoff/` }

const prompt = q => `Use only the MCP server named bakeoff_memory; ignore every other MCP server and do not read or edit files.
Find the answer in that memory: ${q.query}
Reply with only JSON: {"answer": "<one sentence>", "sources": ["<note path or document id you relied on>"]}`

const run = (cwd, text) => new Promise(resolve => {
  const t0 = Date.now(), out = []
  const child = spawn(agentBin, ["--print", "--output-format", "stream-json", "--approve-mcps", "--trust", "--auto-review", "--sandbox", "enabled", "--model", model, "--workspace", cwd, text], { cwd })
  child.stdout.on("data", d => out.push(d)); child.stderr.on("data", d => out.push(d))
  const timer = setTimeout(() => child.kill("SIGTERM"), 240000)
  child.on("close", code => { clearTimeout(timer); resolve({ code, ms: Date.now() - t0, raw: Buffer.concat(out).toString() }) })
})

const rows = []
for (const system of systems) {
  const ws = path.join(root, system)
  fs.mkdirSync(path.join(ws, ".cursor"), { recursive: true })
  fs.writeFileSync(path.join(ws, ".cursor/mcp.json"), JSON.stringify({ mcpServers: { bakeoff_memory: server(system) } }, null, 2))
  for (const q of queries) {
    const r = await run(ws, prompt(q))
    if (process.env.RAW_DIR) fs.writeFileSync(path.join(process.env.RAW_DIR, `${model}-${system}-${q.id}.jsonl`), r.raw)
    const events = r.raw.split("\n").flatMap(line => { try { return [JSON.parse(line)] } catch { return [] } })
    const toolCalls = events.filter(e => e.type === "tool_call" && e.subtype === "started")
    const names = toolCalls.map(e => Object.keys(e.tool_call ?? {})[0] === "mcpToolCall" ? e.tool_call.mcpToolCall.args?.toolName ?? "mcp" : Object.keys(e.tool_call ?? {})[0])
    const final = events.findLast(e => e.type === "result")
    const relevant = new Set(q.relevant ?? q.relevant_groups.flat())
    const answer = final?.result ?? ""
    rows.push({ system, id: q.id, exit: r.code, seconds: +(r.ms / 1000).toFixed(1), tool_calls: names.length, tools: names,
      correct_source: [...relevant].some(p => answer.includes(p) || answer.includes(path.basename(p, ".md"))), usage: final?.usage ?? null, answer: answer.slice(0, 300) })
    console.error(JSON.stringify(rows.at(-1)))
  }
}
const agg = system => { const rs = rows.filter(r => r.system === system); const med = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  return { system, runs: rs.length, correct: rs.filter(r => r.correct_source).length, median_seconds: med(rs.map(r => r.seconds)), median_tool_calls: med(rs.map(r => r.tool_calls)) } }
console.log(JSON.stringify({ date: new Date().toISOString(), model, summary: systems.map(agg), rows }, null, 2))
fs.rmSync(root, { recursive: true, force: true })
