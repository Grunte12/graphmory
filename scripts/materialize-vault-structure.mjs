#!/usr/bin/env node
// Create physical Obsidian vault copies for the structure ablation. Never edits the source.
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const args = process.argv.slice(2)
const option = (name) => args[args.indexOf(name) + 1]
if (!["--vault", "--queries", "--out"].every((name) => args.includes(name) && option(name))) {
  console.error("Usage: node scripts/materialize-vault-structure.mjs --vault <existing-vault> --queries <labels.json> --out <new-directory>")
  process.exit(2)
}
const source = path.resolve(option("--vault"))
const queryPath = path.resolve(option("--queries"))
const out = path.resolve(option("--out"))
if (!fs.statSync(source).isDirectory()) throw new Error("Source vault must be a directory")
if (!fs.statSync(queryPath).isFile()) throw new Error("Queries must be a JSON file")
if (fs.existsSync(out)) throw new Error("Output directory already exists; refusing to overwrite it")
if (out === source || out.startsWith(`${source}${path.sep}`)) throw new Error("Output must be outside the source vault")

function filesBelow(directory, relative = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git" || (relative === ".obsidian" && entry.name === "workspace.json")) return []
    const next = path.join(relative, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Symlink in source vault: ${next}`)
    if (entry.isDirectory()) return filesBelow(path.join(directory, entry.name), next)
    if (!entry.isFile()) throw new Error(`Unsupported source entry: ${next}`)
    return [next]
  })
}
const files = filesBelow(source)
const notes = files.filter((file) => file.toLowerCase().endsWith(".md"))
const moc = (file) => /-moc\.md$/iu.test(file)
const basenames = notes.map((file) => path.basename(file).toLowerCase())
if (new Set(basenames).size !== basenames.length) throw new Error("Flattening would collide on note filenames")
const queries = JSON.parse(fs.readFileSync(queryPath, "utf8"))
if (!Array.isArray(queries) || !queries.length) throw new Error("Expected non-empty query list")
const targets = [
  { name: "flat-no-index", flat: true, index: false },
  { name: "grouped-no-index", flat: false, index: false },
  { name: "flat-with-index", flat: true, index: true },
  { name: "grouped-with-index", flat: false, index: true },
]
const mapNote = (file, flat) => flat ? path.basename(file) : file.replaceAll(path.sep, "/")
const validNote = new Set(notes.map((file) => file.replaceAll(path.sep, "/")))
for (const item of queries) {
  for (const gold of [...(item.relevant ?? []), ...(item.relevant_groups ?? []).flat()]) {
    if (!validNote.has(gold)) throw new Error(`Gold note missing from source vault: ${gold}`)
    if (moc(gold)) throw new Error("MOC is gold evidence; no-index arm would invalidate labels")
  }
  if (item.scope) throw new Error("This ablation expects unscoped queries")
}

const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
fs.mkdirSync(out, { recursive: true })
const manifest = { sourceNoteCount: notes.length, variants: {} }
for (const target of targets) {
  const vault = path.join(out, target.name)
  fs.mkdirSync(vault)
  let copiedNotes = 0
  for (const relative of files) {
    const isNote = relative.toLowerCase().endsWith(".md")
    if (isNote && !target.index && moc(relative)) continue
    const destination = path.join(vault, isNote ? mapNote(relative, target.flat) : relative)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(path.join(source, relative), destination)
    if (digest(path.join(source, relative)) !== digest(destination)) throw new Error(`Copy mismatch: ${relative}`)
    if (isNote) copiedNotes++
  }
  const mappedQueries = queries.map((item) => ({
    ...item,
    ...(item.relevant ? { relevant: item.relevant.map((file) => mapNote(file, target.flat)) } : {}),
    ...(item.relevant_groups ? { relevant_groups: item.relevant_groups.map((group) => group.map((file) => mapNote(file, target.flat))) } : {}),
  }))
  fs.writeFileSync(path.join(out, `${target.name}-queries.json`), `${JSON.stringify(mappedQueries, null, 2)}\n`)
  manifest.variants[target.name] = { notes: copiedNotes, copiedBytesMatch: true, obsidianConfig: fs.existsSync(path.join(vault, ".obsidian", "app.json")) }
}
fs.writeFileSync(path.join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ output: out, ...manifest }, null, 2))
