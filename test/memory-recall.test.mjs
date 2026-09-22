import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { filterByScope, fuseRankedLanes, loadVaultDocuments, recallVault } from "../src/memory-recall.mjs"
import { parseMarkdown } from "../src/retrieval.mjs"

test("scoped recall prunes unrelated notes before applying maxFiles", () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "mph-scoped-recall-"))
  try {
    fs.mkdirSync(path.join(vault, "02 Projects", "alpha"), { recursive: true })
    fs.mkdirSync(path.join(vault, "02 Projects", "alphabet"), { recursive: true })
    fs.writeFileSync(path.join(vault, "00 unrelated.md"), "# Unrelated\nneedle")
    fs.writeFileSync(path.join(vault, "02 Projects", "alpha", "Policy.md"), "# Alpha\nneedle")
    fs.writeFileSync(path.join(vault, "02 Projects", "alphabet", "Policy.md"), "# Alphabet\nneedle")

    const scope = "02 Projects/alpha"
    assert.deepEqual(loadVaultDocuments(vault, { scope, maxFiles: 1 }).map((item) => item.id), ["02 Projects/alpha/Policy.md"])
    const result = recallVault(vault, "needle", { scope, maxFiles: 1 })
    assert.deepEqual(result.results.map((item) => item.path), ["02 Projects/alpha/Policy.md"])
    assert.equal(result.scanned, 1)
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})

test("scope matches exact note paths or directory prefixes only", () => {
  const documents = [
    parseMarkdown("Memory/Policy.md", "# Policy"),
    parseMarkdown("OldMemory/Policy.md", "# Old Policy"),
    parseMarkdown("MemoryExtra/Policy.md", "# Extra Policy"),
  ]
  assert.deepEqual(filterByScope(documents, "Memory").map((item) => item.id), ["Memory/Policy.md"])
  assert.deepEqual(filterByScope(documents, "Memory/Policy").map((item) => item.id), ["Memory/Policy.md"])
})

test("rank fusion uses standard reciprocal rank fusion damping", () => {
  const alpha = { id: "alpha.md", title: "Alpha" }
  const beta = { id: "beta.md", title: "Beta" }
  const fused = fuseRankedLanes([
    { method: "one", results: [alpha, beta] },
    { method: "two", results: [beta, alpha] },
  ])
  assert.equal(fused[0].fusedScore, 1 / 61 + 1 / 62)
  assert.equal(fused[0].lanes.length, 2)
})
