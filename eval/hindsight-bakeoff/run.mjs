// Retrieval bake-off: Graphmory recall vs Hindsight recall on the same vault and questions.
// Usage: node eval/hindsight-bakeoff/run.mjs [--ingest] [--vault eval/real-vault/vault] [--queries eval/real-vault/queries.json]
// Needs a Hindsight server at HINDSIGHT_URL (default http://127.0.0.1:8888). No LLM is used at query time by either system.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback }
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const vault = path.resolve(repo, arg("--vault", "eval/real-vault/vault"))
const queries = JSON.parse(fs.readFileSync(path.resolve(repo, arg("--queries", "eval/real-vault/queries.json")), "utf8"))
const hs = process.env.HINDSIGHT_URL || "http://127.0.0.1:8888"
const bank = arg("--bank", "graphmory-bakeoff")
const K = 5
const hsMaxTokens = arg("--hs-max-tokens") ? Number(arg("--hs-max-tokens")) : undefined

const notes = []
const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
  if (e.name.startsWith(".")) continue
  const p = path.join(dir, e.name)
  if (e.isDirectory()) walk(p); else if (e.name.endsWith(".md")) notes.push(path.relative(vault, p))
} }
walk(vault)

const post = async (url, body) => {
  const res = await fetch(hs + url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${url} ${res.status} ${await res.text()}`)
  return res.json()
}

if (process.argv.includes("--ingest")) {
  const t0 = Date.now()
  for (let i = 0; i < notes.length; i += 6) {
    const items = notes.slice(i, i + 6).map(rel => ({ content: fs.readFileSync(path.join(vault, rel), "utf8"), document_id: rel, context: `Markdown note ${rel}` }))
    await post(`/v1/default/banks/${bank}/memories`, { items, async: false })
    console.error(`ingested ${Math.min(i + 6, notes.length)}/${notes.length}`)
  }
  console.error(`hindsight ingest ${notes.length} notes in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
}

const relevantOf = q => new Set(q.relevant ?? (q.relevant_groups ?? []).flat())
const score = (paths, q) => { const rel = relevantOf(q); const top = [...new Set(paths)].slice(0, K); return { hit: top.some(p => rel.has(p)), rank: top.findIndex(p => rel.has(p)) + 1 } }
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }

async function runGraphmory() {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "gm-bakeoff-"))
  const client = new Client({ name: "bakeoff", version: "0" })
  await client.connect(new StdioClientTransport({ command: "node", args: [path.join(repo, "scripts/graphmory-mcp.mjs")],
    env: { ...process.env, GRAPHMORY_VAULT: vault, GRAPHMORY_STATE_DIR: state } }))
  await client.callTool({ name: "recall", arguments: { query: "warm up" } })
  const rows = []
  for (const q of queries) {
    const t = performance.now()
    const r = await client.callTool({ name: "recall", arguments: { query: q.query } })
    const ms = performance.now() - t, text = r.content[0].text
    rows.push({ id: q.id, ms, chars: text.length, ...score((JSON.parse(text).candidates ?? []).map(c => c.path), q) })
  }
  await client.close()
  fs.rmSync(state, { recursive: true, force: true })
  return rows
}

async function runHindsight() {
  await post(`/v1/default/banks/${bank}/memories/recall`, { query: "warm up" })
  const rows = []
  for (const q of queries) {
    const t = performance.now()
    const r = await post(`/v1/default/banks/${bank}/memories/recall`, { query: q.query, ...(hsMaxTokens ? { max_tokens: hsMaxTokens } : {}) })
    const ms = performance.now() - t
    rows.push({ id: q.id, ms, chars: JSON.stringify(r).length, ...score(r.results.map(x => x.document_id).filter(Boolean), q) })
  }
  return rows
}

const summary = (name, rows) => ({ system: name, queries: rows.length, [`hit@${K}`]: +(rows.filter(r => r.hit).length / rows.length).toFixed(3),
  mrr: +(rows.reduce((s, r) => s + (r.rank ? 1 / r.rank : 0), 0) / rows.length).toFixed(3),
  p50_ms: Math.round(pct(rows.map(r => r.ms), 0.5)), p95_ms: Math.round(pct(rows.map(r => r.ms), 0.95)),
  avg_response_chars: Math.round(rows.reduce((s, r) => s + r.chars, 0) / rows.length) })

const gm = await runGraphmory(), hsr = await runHindsight()
const out = { date: new Date().toISOString(), vault: path.relative(repo, vault), notes: notes.length, summary: [summary("graphmory", gm), summary(hsMaxTokens ? `hindsight max_tokens=${hsMaxTokens}` : "hindsight", hsr)],
  misses: { graphmory: gm.filter(r => !r.hit).map(r => r.id), hindsight: hsr.filter(r => !r.hit).map(r => r.id) } }
console.log(JSON.stringify(out, null, 2))
