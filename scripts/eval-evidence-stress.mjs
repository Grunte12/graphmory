#!/usr/bin/env node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { managedRecall } from "../src/decision-recall.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"

// Synthetic diagnostic cases, frozen independently of retrieval results.
const cases = [
  { id: "conflict", query: "Compare all Orion storage decisions", gold: ["old.md", "new.md"], notes: { "old.md": "# Orion storage\nOrion storage uses SQLite. Recorded January 2025.", "new.md": "# Orion storage\nOrion storage uses PostgreSQL. Recorded March 2025; replaces January decision." } },
  { id: "negation", query: "List all Orion deployment restrictions", gold: ["policy.md"], notes: { "policy.md": "# Orion deployment\nOrion deployment must NOT run on Friday. Approval is required." } },
  { id: "split-evidence", query: "Compare all Orion owners and deadlines", gold: ["owner.md", "deadline.md"], notes: { "owner.md": "# Orion owners\nOrion owner is Mira.", "deadline.md": "# Orion deadlines\nOrion deadline is October 12." } },
  { id: "long-section", query: "List all Orion recovery requirements", gold: ["recovery.md"], marker: "restore encrypted backup", notes: { "recovery.md": `# Orion recovery\nOrion recovery requirements. ${"Operational context. ".repeat(150)}The required procedure is to restore encrypted backup.` } },
  { id: "synonym", query: "How does the app recover deleted data?", gold: ["backup.md"], notes: { "backup.md": "# Disaster procedure\nRestore the nightly snapshot after accidental erasure." } },
  { id: "unknown", query: "Who approved Orion deployment?", gold: [], notes: { "deployment.md": "# Orion deployment\nOrion deployment needs approval. The approver has not been recorded." } },
  { id: "many-related", query: "List all Orion migration decisions", gold: Array.from({ length: 24 }, (_, i) => `decision-${i}.md`), notes: Object.fromEntries(Array.from({ length: 24 }, (_, i) => [`decision-${i}.md`, `# Orion migration ${i}\nOrion migration decision ${i}: retain audit record ${i}.`])) },
  { id: "nested-layout", query: "Compare all Orion cache settings", gold: ["projects/orion/cache.md", "archive/cache.md"], notes: { "projects/orion/cache.md": "# Orion cache\nCurrent Orion cache TTL is 60 seconds.", "archive/cache.md": "# Orion cache\nHistorical Orion cache TTL was 300 seconds." } },
]
const rows = []
for (const item of cases) {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-evidence-stress-"))
  try {
    for (const [name, markdown] of Object.entries(item.notes)) {
      fs.mkdirSync(path.dirname(path.join(vault, name)), { recursive: true })
      fs.writeFileSync(path.join(vault, name), markdown)
    }
    for (const matchedPreviews of [false, true]) {
      const paths = [], previewPaths = [], previews = []
      let offset = 0, pages = 0, bytes = 0
      const start = performance.now()
      while (true) {
        const page = await managedRecall(vault, item.query, DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true, matchedPreviews, offset })
        pages++; bytes += Buffer.byteLength(JSON.stringify(page))
        for (const result of page.results) {
          paths.push(result.path)
          if (result.evidencePreview?.length) previewPaths.push(result.path)
          previews.push(...(result.evidencePreview ?? []).map((section) => section.text))
        }
        if (!page.hasMore) break
        if (!(page.nextOffset > offset) || pages > Object.keys(item.notes).length) throw new Error(`Pagination stalled: ${item.id}`)
        offset = page.nextOffset
      }
      rows.push({ id: item.id, variant: matchedPreviews ? "matched" : "auto", goldCount: item.gold.length,
        retrievedGold: item.gold.filter((name) => paths.includes(name)).length,
        previewGold: item.gold.filter((name) => previewPaths.includes(name)).length,
        markerFound: item.marker ? previews.some((text) => text.includes(item.marker)) : null,
        candidates: paths.length, pages, bytes, elapsedMs: Number((performance.now() - start).toFixed(2)) })
    }
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
}
const output = { kind: "synthetic-diagnostic-not-live-answer-eval", cases: cases.length, rows }
const outIndex = process.argv.indexOf("--out")
if (outIndex >= 0) fs.writeFileSync(process.argv[outIndex + 1], JSON.stringify(output, null, 2) + "\n")
console.log(JSON.stringify(output, null, 2))
