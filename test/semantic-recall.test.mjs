import assert from "node:assert/strict"
import test from "node:test"
import { semanticConfidence } from "../src/semantic-recall.mjs"

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
