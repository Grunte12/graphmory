import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { cachedDocumentVectors, semanticConfidence } from "../src/semantic-recall.mjs"
import { parseMarkdown } from "../src/retrieval.mjs"

test("semantic confidence stays low when only one retrieval lane supports the top result", () => {
  assert.equal(semanticConfidence([]), "none")
  assert.equal(semanticConfidence([{ fusedScore: 1 / 61, lanes: ["semantic-vector"] }]), "low")
})

test("semantic confidence requires lane agreement and a clear score margin", () => {
  assert.equal(semanticConfidence([
    { fusedScore: 0.033, lanes: ["semantic-vector", "bm25f-sections"] },
    { fusedScore: 0.032, lanes: ["semantic-vector", "bm25f-sections"] },
  ]), "low")
  assert.equal(semanticConfidence([
    { fusedScore: 0.033, lanes: ["semantic-vector", "bm25f-sections"] },
    { fusedScore: 0.016, lanes: ["semantic-vector"] },
  ]), "bounded")
})

test("semantic vectors are reused across calls and changed notes are re-embedded", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-semantic-"))
  try {
    let embedded = 0
    const embed = async (texts) => {
      embedded += texts.length
      return { tolist: () => texts.map((text) => [text.length, 1]) }
    }
    const options = { vault: directory, model: "test-model", modelCache: directory, maxDocumentCharacters: 100 }
    const first = [parseMarkdown("a.md", "# A\n\noriginal"), parseMarkdown("b.md", "# B\n\nother")]
    await cachedDocumentVectors(first, embed, options)
    assert.equal(embedded, 2)
    const second = await cachedDocumentVectors(first, embed, options)
    assert.equal(embedded, 2)
    assert.equal(second.get("a.md").length, 2)
    await cachedDocumentVectors([parseMarkdown("a.md", "# A\n\nchanged"), first[1]], embed, options)
    assert.equal(embedded, 3)
    const files = fs.readdirSync(path.join(directory, "graphmory-vectors"))
    assert.equal(files.length, 1)
    if (process.platform !== "win32") assert.equal(fs.statSync(path.join(directory, "graphmory-vectors", files[0])).mode & 0o777, 0o600)
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
