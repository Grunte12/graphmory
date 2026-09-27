#!/usr/bin/env node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { performance } from "node:perf_hooks"
import { readSourceNotes } from "../src/source-read.mjs"
const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-read-bench-"))
const rows = []
try {
  const paths = Array.from({ length: 20 }, (_, i) => `note-${i}.md`)
  for (const [i, name] of paths.entries()) fs.writeFileSync(path.join(vault, name), `# Source ${i}\n${"Background. ".repeat(200)}\nRequired fact ${i}: do NOT erase records.\n`)
  const expected = readSourceNotes(vault, paths)
  const cli = (selected) => {
    const child = spawnSync(process.execPath, ["scripts/brain-sync.mjs", "read-notes", "--vault", vault, "--paths", JSON.stringify(selected)], { encoding: "utf8" })
    if (child.status !== 0) throw new Error(child.stderr)
    return { sources: JSON.parse(child.stdout).sources, bytes: Buffer.byteLength(child.stdout) }
  }
  for (let repeat = 0; repeat < 7; repeat++) {
    const order = repeat % 2 ? ["batch-cli", "single-cli", "batch-cat"] : ["batch-cat", "single-cli", "batch-cli"]
    for (const arm of order) {
      const start = performance.now()
      let sources = [], bytes = 0
      if (arm === "batch-cat") {
        const child = spawnSync("cat", paths.map((name) => path.join(vault, name)), { encoding: "utf8" })
        if (child.status !== 0 || child.stdout !== expected.sources.map((s) => s.markdown).join("")) throw new Error("cat source mismatch")
        bytes = Buffer.byteLength(child.stdout)
      } else {
        for (const selected of arm === "single-cli" ? paths.map((p) => [p]) : [paths]) {
          const output = cli(selected); sources.push(...output.sources); bytes += output.bytes
        }
        if (JSON.stringify(sources) !== JSON.stringify(expected.sources)) throw new Error("Source parity failed")
      }
      rows.push({ repeat, arm, elapsedMs: Number((performance.now() - start).toFixed(2)), bytes,
        processes: arm === "single-cli" ? paths.length : 1, sourceParity: true })
    }
  }
  const report = { notes: paths.length, repeats: 7, kind: "local-io-not-model-eval", rows }
  const index = process.argv.indexOf("--out")
  if (index >= 0) fs.writeFileSync(process.argv[index + 1], JSON.stringify(report, null, 2) + "\n")
  const median = (values) => values.sort((a,b) => a-b)[Math.floor(values.length / 2)]
  for (const arm of ["single-cli", "batch-cli", "batch-cat"]) {
    const group = rows.filter((r) => r.arm === arm)
    console.log(JSON.stringify({ arm, medianMs: median(group.map((r) => r.elapsedMs)), bytes: group[0].bytes, processes: group[0].processes }))
  }
} finally { fs.rmSync(vault, { recursive: true, force: true }) }
