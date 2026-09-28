import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { managedRecall } from "../src/decision-recall.mjs"
import { persistentIndexLocation, supportsNativeSqlite } from "../src/index-capability.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"

test("opt-in cache follows Markdown changes and falls back on corruption", { skip: !supportsNativeSqlite() }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-cache-lifecycle-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const vault = path.join(root, "vault")
  const cache = path.join(root, "cache")
  fs.mkdirSync(vault)
  const write = (name, content) => {
    fs.mkdirSync(path.dirname(path.join(vault, name)), { recursive: true })
    fs.writeFileSync(path.join(vault, name), content)
  }
  for (let n = 1; n <= 12; n++) {
    const name = String(n).padStart(2, "0")
    const first = n === 1 ? "violet" : n === 3 ? "budget" : "graph"
    const second = n === 1 ? "rendezvous" : n === 4 ? "taxonomy" : "provenance"
    write(`Projects/Project-${name}.md`, `---\nstatus: ${n === 11 ? "superseded" : "current"}\n---\n# Project ${name}\n## Overview\nmemory ${first} section.\n## Details\nmemory ${second} section.\n`)
  }
  const queries = ["memory", "violet rendezvous", "rendezvous violet", "taxonomy", "project-03",
    "provenance", "budget", "superseded", "section", "graph", "newfangled", "no_matching_term_69491"]
  const compare = async () => {
    for (const query of queries) {
      const expected = await managedRecall(vault, query, DEFAULT_RUNTIME_CONFIG)
      const fallback = []
      const actual = await managedRecall(vault, query, DEFAULT_RUNTIME_CONFIG,
        { indexCache: cache, onIndexFallback: code => fallback.push(code) })
      assert.deepEqual(actual, expected, query)
      assert.deepEqual(fallback, [], `unexpected cache fallback for ${query}`)
    }
  }
  await compare()
  write("Projects/Project-13.md", "---\nstatus: current\n---\n# Project 13\n## Overview\nmemory violet section.\n## Details\nmemory rendezvous section.\n")
  await compare()
  const edited = path.join(vault, "Projects/Project-03.md")
  fs.writeFileSync(edited, fs.readFileSync(edited, "utf8").replace("status: current", "status: superseded")
    .replace("memory budget section.", "memory budget revised provenance section."))
  await compare()
  fs.unlinkSync(path.join(vault, "Projects/Project-08.md"))
  await compare()
  fs.mkdirSync(path.join(vault, "Archive"))
  fs.renameSync(path.join(vault, "Projects/Project-05.md"), path.join(vault, "Archive/Renamed-05.md"))
  await compare()
  const renamed = path.join(vault, "Archive/Renamed-05.md")
  fs.writeFileSync(renamed, fs.readFileSync(renamed, "utf8").replace("memory provenance section.", "memory provenance newfangled section."))
  await compare()
  fs.writeFileSync(persistentIndexLocation(vault, "", cache), "not a SQLite database")
  const fallbacks = []
  const expected = await managedRecall(vault, "violet budget", DEFAULT_RUNTIME_CONFIG)
  const actual = await managedRecall(vault, "violet budget", DEFAULT_RUNTIME_CONFIG,
    { indexCache: cache, onIndexFallback: code => fallbacks.push(code) })
  assert.deepEqual(actual, expected)
  assert.ok(fallbacks.length <= 1)
})

test("busy index falls back with current evidence and concurrent cold calls agree", { skip: !supportsNativeSqlite() }, async (t) => {
  const { DatabaseSync } = await import("node:sqlite")
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-cache-busy-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const vault = path.join(root, "vault")
  const cache = path.join(root, "cache")
  fs.mkdirSync(vault)
  const file = path.join(vault, "policy.md")
  fs.writeFileSync(file, "# Policy\nViolet rendezvous starts on Monday.\n")
  const expected = await managedRecall(vault, "violet rendezvous", DEFAULT_RUNTIME_CONFIG)
  const configFile = path.join(root, "config.json")
  fs.writeFileSync(configFile, JSON.stringify(DEFAULT_RUNTIME_CONFIG))
  const run = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [new URL("../scripts/brain-sync.mjs", import.meta.url).pathname,
      "recall-managed", "--vault", vault, "--query", "violet rendezvous", "--config", configFile,
      "--index-cache", cache, "--json"])
    let stdout = "", stderr = ""
    child.stdout.on("data", chunk => { stdout += chunk })
    child.stderr.on("data", chunk => { stderr += chunk })
    child.on("error", reject)
    child.on("close", code => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr)))
  })
  const outputs = await Promise.all([run(), run()])
  for (const output of outputs) assert.deepEqual(output, expected)
  const db = new DatabaseSync(persistentIndexLocation(vault, "", cache))
  db.exec("BEGIN EXCLUSIVE")
  try {
    fs.writeFileSync(file, "# Policy\nViolet rendezvous starts on Tuesday.\n")
    const fallback = []
    assert.deepEqual(await managedRecall(vault, "violet rendezvous", DEFAULT_RUNTIME_CONFIG,
      { indexCache: cache, onIndexFallback: code => fallback.push(code) }),
    await managedRecall(vault, "violet rendezvous", DEFAULT_RUNTIME_CONFIG))
    assert.deepEqual(fallback, ["INDEX_UNAVAILABLE"])
  } finally { db.exec("ROLLBACK"); db.close() }
  const fallback = []
  await managedRecall(vault, "violet rendezvous", DEFAULT_RUNTIME_CONFIG,
    { indexCache: cache, onIndexFallback: code => fallback.push(code) })
  assert.deepEqual(fallback, [])
})

test("failed incremental transaction preserves the previous index and recovers", { skip: !supportsNativeSqlite() }, async (t) => {
  const { DatabaseSync } = await import("node:sqlite")
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-cache-rollback-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const vault = path.join(root, "vault"), cache = path.join(root, "cache")
  fs.mkdirSync(vault)
  const file = path.join(vault, "policy.md")
  fs.writeFileSync(file, "# Policy\nViolet rollback starts Monday.\n")
  await managedRecall(vault, "violet rollback", DEFAULT_RUNTIME_CONFIG, { indexCache: cache })
  const dbFile = persistentIndexLocation(vault, "", cache)
  const db = new DatabaseSync(dbFile)
  db.exec("CREATE TRIGGER fail_update BEFORE INSERT ON sections BEGIN SELECT RAISE(ABORT, 'forced failure'); END;")
  db.close()
  const hash = () => createHash("sha256").update(fs.readFileSync(dbFile)).digest("hex")
  const before = hash()
  fs.writeFileSync(file, "# Policy\nViolet rollback starts Tuesday.\n")
  const fallback = []
  assert.deepEqual(await managedRecall(vault, "violet rollback", DEFAULT_RUNTIME_CONFIG,
    { indexCache: cache, onIndexFallback: code => fallback.push(code) }),
  await managedRecall(vault, "violet rollback", DEFAULT_RUNTIME_CONFIG))
  assert.deepEqual(fallback, ["INDEX_UNAVAILABLE"])
  assert.equal(hash(), before)
  const recoveredDb = new DatabaseSync(dbFile)
  recoveredDb.exec("DROP TRIGGER fail_update")
  recoveredDb.close()
  const recoveredFallback = []
  await managedRecall(vault, "violet rollback", DEFAULT_RUNTIME_CONFIG,
    { indexCache: cache, onIndexFallback: code => recoveredFallback.push(code) })
  assert.deepEqual(recoveredFallback, [])
})

test("cached ranking preserves scoped historical and linked evidence", { skip: !supportsNativeSqlite() }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-cache-graph-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const vault = path.join(root, "vault"), cache = path.join(root, "cache")
  fs.mkdirSync(path.join(vault, "Projects"), { recursive: true })
  const notes = {
    "Hub.md": "---\ncanonical_memory: false\n---\n# Zephyr routing\nzephyr rollback routing [[Policy]] [[Evidence]] [[Bridge]].\n",
    "Policy.md": "# Safe policy\nUse guarded sync and preserve source history.\n",
    "Evidence.md": "# Evidence log\nOriginal log confirms the guarded operation.\n",
    "Bridge.md": "---\ncanonical_memory: false\n---\n# Handoff bridge\nSee [[Answer]] for the final instruction.\n",
    "Answer.md": "# Final instruction\nVerify the canonical record before acting.\n",
    "Cycle.md": "# Cycle\nzephyr cyclic path to [[Hub]].\n",
    "Old.md": "---\nstatus: superseded\n---\n# Old plan\nLegacy routing to [[Hub]].\n",
    "Projects/Note.md": "# Graph memory\n## Decision\nProject graph memory.\n## Review\nSecond section on design.\n",
  }
  for (const [name, markdown] of Object.entries(notes)) fs.writeFileSync(path.join(vault, name), markdown)
  for (const options of [{}, { includeSuperseded: true }, { scope: "Projects" }]) {
    for (const query of ["zephyr rollback routing", "zephyr routing", "policy", "logs", "answer", "handoff", "cycle", "old", "memory graph", "graph memory", "design", "no_matching_term_69491"]) {
      const fallback = []
      assert.deepEqual(await managedRecall(vault, query, DEFAULT_RUNTIME_CONFIG,
        { ...options, indexCache: cache, onIndexFallback: code => fallback.push(code) }),
      await managedRecall(vault, query, DEFAULT_RUNTIME_CONFIG, options))
      assert.deepEqual(fallback, [])
    }
  }
})
