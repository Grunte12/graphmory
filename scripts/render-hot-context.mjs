#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { validateHotContextPack } from "../src/contracts.mjs"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const packPath = path.resolve(option("--pack", "examples/hot-context-pack.json"))
const outputPath = option("--out", "")

const pack = JSON.parse(fs.readFileSync(packPath, "utf8"))
const validation = validateHotContextPack(pack)
if (!validation.valid) {
  console.error("hot-context-pack validation failed:")
  validation.errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

const priorityRank = { high: 0, medium: 1, low: 2 }
const entries = [...pack.entries].sort((a, b) =>
  priorityRank[a.priority] - priorityRank[b.priority] ||
  a.category.localeCompare(b.category) ||
  a.id.localeCompare(b.id),
)

const lines = [
  "# Hot Context Pack",
  "",
  "This is a compact derived context pack. It is not canonical memory.",
  `Generated: ${pack.generated_at}`,
  "",
]

for (const entry of entries) {
  const sources = entry.source_paths.join(", ")
  const revalidate = entry.lifecycle.revalidate_when.length
    ? entry.lifecycle.revalidate_when.join("; ")
    : "not specified"
  lines.push(
    `- [${entry.priority.toUpperCase()}][${entry.category}] ${entry.summary}`,
    `  Source: ${sources}`,
    `  Status: ${entry.lifecycle.status}; revalidate when: ${revalidate}`,
  )
}

const markdown = `${lines.join("\n")}\n`
if (outputPath) {
  const absolute = path.resolve(outputPath)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  fs.writeFileSync(absolute, markdown)
  console.log(`Wrote ${absolute}`)
} else {
  process.stdout.write(markdown)
}
