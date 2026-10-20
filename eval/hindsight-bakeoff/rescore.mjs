// Re-score saved agent runs (RAW_DIR *.jsonl from agents.mjs) by coverage: the share of expected notes the
// final answer names, by path, file slug or short title (text before ":" in the note title).
// Usage: node eval/hindsight-bakeoff/rescore.mjs <raw-dir> [<raw-dir> ...]
import fs from "node:fs"
import path from "node:path"

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const vault = path.join(repo, "eval/real-vault/vault")
const queries = new Map(JSON.parse(fs.readFileSync(path.join(repo, "eval/real-vault/queries.json"), "utf8")).map(q => [q.id, q]))
const names = rel => {
  const text = fs.readFileSync(path.join(vault, rel), "utf8")
  const title = /^title:\s*"?(.+?)"?\s*$/mu.exec(text)?.[1] ?? /^#\s+(.+)$/mu.exec(text)?.[1] ?? ""
  return [rel, path.basename(rel, ".md"), title.split(":")[0].trim()].filter(n => n.length > 3).map(n => n.toLowerCase())
}

const rows = []
for (const dir of process.argv.slice(2)) for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".jsonl"))) {
  const [, model, system, id] = /^(.+?)-(graphmory|hindsight)-(.+)\.jsonl$/u.exec(file) ?? []
  const q = queries.get(id)
  if (!q) continue
  const events = fs.readFileSync(path.join(dir, file), "utf8").split("\n").flatMap(l => { try { return [JSON.parse(l)] } catch { return [] } })
  const answer = (events.findLast(e => e.type === "result")?.result ?? "").toLowerCase()
  const expected = q.relevant ?? q.relevant_groups.flat()
  const found = expected.filter(rel => names(rel).some(n => answer.includes(n)))
  const calls = events.filter(e => e.type === "tool_call" && e.subtype === "started").length
  rows.push({ dir: path.basename(dir), model, system, id, coverage: +(found.length / expected.length).toFixed(2), calls })
}
for (const r of rows.sort((a, b) => `${a.dir}${a.model}${a.system}${a.id}`.localeCompare(`${b.dir}${b.model}${b.system}${b.id}`)))
  console.log([r.dir, r.model, r.system, r.id, `coverage=${r.coverage}`, `calls=${r.calls}`].join("\t"))
