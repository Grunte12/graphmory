#!/usr/bin/env node
import { performance } from "node:perf_hooks"
import { parseMarkdown, rank } from "../src/retrieval.mjs"

const args = process.argv.slice(2)
const sizesIndex = args.indexOf("--sizes")
const sizes = (sizesIndex >= 0 ? args[sizesIndex + 1] : "100,1000,10000")
  .split(",")
  .map((value) => Number.parseInt(value, 10))
  .filter((value) => Number.isInteger(value) && value > 0)
const iterationsIndex = args.indexOf("--queries")
const queryCount = Number.parseInt(
  iterationsIndex >= 0 ? args[iterationsIndex + 1] : "20",
  10,
)

if (!sizes.length || !Number.isInteger(queryCount) || queryCount < 1) {
  console.error("Usage: node scripts/bench-scale.mjs [--sizes 100,1000,10000] [--queries 20]")
  process.exit(2)
}

function makeDocuments(count) {
  return Array.from({ length: count }, (_, index) => {
    const group = index % 25
    return parseMarkdown(
      `note-${index}`,
      `# Policy ${index}\n\n## Decision\nAgent group ${group} owns workflow ${index} and preserves provenance.\n\n## Boundary\nDo not use this policy for unrelated group ${(group + 1) % 25} tasks.\n\n## Evidence\nVerified artifact ${index}.`,
    )
  })
}

const methods = ["lexical", "bm25", "bm25-sections", "bm25f-sections"]
console.log("| Notes | Method | Avg query ms | Retrieved context chars |")
console.log("|---:|---|---:|---:|")

for (const size of sizes) {
  const documents = makeDocuments(size)
  for (const method of methods) {
    let elapsed = 0
    let contextCharacters = 0
    for (let index = 0; index < queryCount; index += 1) {
      const query = `Which agent owns workflow ${index % size} and where is its provenance?`
      const start = performance.now()
      const results = rank(documents, query, method).slice(0, 3)
      elapsed += performance.now() - start
      contextCharacters += results.reduce((sum, result) => sum + result.characters, 0)
    }
    console.log(
      `| ${size} | ${method} | ${(elapsed / queryCount).toFixed(2)} | ${Math.round(contextCharacters / queryCount)} |`,
    )
  }
}
