#!/usr/bin/env node
// Synthetic lifecycle delivery screen; never an answer-quality benchmark.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { performance } from "node:perf_hooks"
import { DEFAULT_RUNTIME_CONFIG, saveRuntimeConfig } from "../src/runtime-config.mjs"
const args = process.argv.slice(2), out = args[args.indexOf("--out") + 1]
if (!args.includes("--out") || !out || fs.existsSync(out)) throw new Error("Use --out <new report>")
const hash = bytes => createHash("sha256").update(bytes).digest("hex")
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-history-eval-"))
const rows = []
try {
  for (const layout of ["atomic", "conversation", "nested"]) for (const scoped of [false, true]) {
    const id = `${layout}-${scoped ? "scoped" : "global"}`, vault = path.join(scratch, id)
    fs.mkdirSync(path.join(vault, "Cedar"), { recursive: true })
    const render = (status, value, when) => `---\nstatus: ${status}\n---\n# Cedar storage policy\nDate: ${when}\n\n${layout === "conversation" ? "## user\n" : layout === "nested" ? "## Decision\n" : ""}Cedar storage policy uses ${value}.\n`
    const notes = {
      "Cedar/current.md": render("active", "PostgreSQL", "2025-03-01"),
      "Cedar/prior.md": render("superseded", "SQLite", "2025-01-01"),
      "Cedar/raw.md": render("raw", "UnapprovedDB", "2025-04-01"),
      "Cedar/stale.md": render("stale", "WrongDB", "2025-05-01"),
      "Cedar/archived.md": render("archived", "OtherDB", "2025-06-01"),
      "Cedar/deprecated.md": render("deprecated", "RetiredDB", "2025-07-01"),
      "Cedar/index.md": "---\ncanonical_memory: false\n---\n# Cedar storage policy index\n[[prior]]\n",
      "other.md": "---\nstatus: superseded\n---\n# Cedar storage policy\nA different project once used Cedar storage policy as its benchmark name.\n",
    }
    for (const [name, markdown] of Object.entries(notes)) fs.writeFileSync(path.join(vault, name), markdown)
    const config = path.join(vault, "runtime.json")
    saveRuntimeConfig(config, DEFAULT_RUNTIME_CONFIG)
    for (const questionType of ["current", "prior"]) for (const arm of ["existing", "explicit-history"]) {
      const query = questionType === "current" ? "What is Cedar storage policy currently?" : "What was Cedar storage policy before March 2025?"
      const historical = arm === "explicit-history" && questionType === "prior"
      const pages = [], results = [], start = performance.now()
      let offset = 0
      while (true) {
        const argv = ["scripts/brain-sync.mjs", "recall-managed", "--vault", vault, "--query", query, "--config", config, "--agent", "--auto", "--offset", String(offset), ...(scoped ? ["--scope", "Cedar"] : []), ...(historical ? ["--include-superseded"] : [])]
        const call = spawnSync(process.execPath, argv, { cwd: root, encoding: "utf8" })
        if (call.status !== 0) throw new Error(call.stderr)
        const packet = JSON.parse(call.stdout)
        pages.push({ offset, stdoutBytes: Buffer.byteLength(call.stdout), historicalCandidatesIncluded: packet.historicalCandidatesIncluded ?? false, paths: packet.results.map(row => row.path) })
        results.push(...packet.results)
        if (!packet.hasMore) break
        if (!(packet.nextOffset > offset)) throw new Error("Non-progressing page")
        offset = packet.nextOffset
      }
      const gold = questionType === "current" ? "Cedar/current.md" : "Cedar/prior.md"
      rows.push({ id, questionType, arm, querySha256: hash(query), historical, requiredPath: gold,
        evidenceReachable: results.some(row => row.path === gold), paths: results.map(row => row.path),
        statuses: results.map(row => row.status), pages, elapsedMs: performance.now() - start,
        unsafeLifecycleReturned: results.some(row => ["raw", "stale", "archived", "deprecated"].includes(row.status)),
        navigationReturned: results.some(row => row.path === "Cedar/index.md"),
        scopeViolated: scoped && results.some(row => !row.path.startsWith("Cedar/")),
        sourcesUnchanged: Object.entries(notes).every(([name, markdown]) => fs.readFileSync(path.join(vault, name), "utf8") === markdown) })
    }
  }
  const summary = Object.fromEntries(["existing", "explicit-history"].map(arm => {
    const selected = rows.filter(row => row.arm === arm)
    return [arm, { trials: selected.length, currentReachable: selected.filter(row => row.questionType === "current" && row.evidenceReachable).length,
      priorReachable: selected.filter(row => row.questionType === "prior" && row.evidenceReachable).length,
      boundaryFailures: selected.filter(row => row.unsafeLifecycleReturned || row.navigationReturned || row.scopeViolated || !row.sourcesUnchanged).length }]
  }))
  const report = { protocol: "synthetic-historical-lifecycle-delivery-v1", runnerSha256: hash(fs.readFileSync(new URL(import.meta.url))),
    runtimeHashes: Object.fromEntries(["src/retrieval.mjs", "src/memory-recall.mjs", "src/decision-recall.mjs", "scripts/brain-sync.mjs"].map(name => [name, hash(fs.readFileSync(path.join(root, name)))])),
    plannedTrials: 24, actualTrials: rows.length, summary, rows,
    limitations: ["Synthetic mechanical evidence reachability; no answer model, official benchmark or semantic support grading", "Explicit flag policy is supplied by the evaluator; autonomous Curator choice is unmeasured", "Single-pass timings are observations, not latency/cost acceptance"] }
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n")
  console.log(JSON.stringify(summary))
} finally { fs.rmSync(scratch, { recursive: true, force: true }) }
