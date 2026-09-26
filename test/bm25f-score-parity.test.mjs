import test from "node:test"
import assert from "node:assert/strict"
import { bm25fRank } from "../src/retrieval.mjs"

// Frozen outputs from the pre-optimization implementation. Custom parameters
// catch changed normalization, field weighting, arithmetic order, or tie order.
const documents = [
  { id: "a", fields: { title: ["rollback", "policy"], body: ["rollback", "rollback"] } },
  { id: "b", fields: { title: ["policy"], body: ["rollback", "policy", "policy"] } },
  { id: "c", fields: { title: ["other"], body: [] } },
]
const cases = [
  [{}, [{ id: "a", score: 1.5538803247079835 }, { id: "b", score: 1.21983105833739 }]],
  [{ b: 0, k1: 0.8, fieldWeights: { title: 2, body: 0.5 } }, [{ id: "a", score: 1.2721902746501115 }, { id: "b", score: 0.993287022130664 }]],
  [{ b: 1, k1: 2, fieldWeights: { title: 0, body: 3 } }, [{ id: "b", score: 1.5221708447163027 }, { id: "a", score: 1.0071506340980048 }]],
]
for (const [options, expected] of cases) {
  test(`BM25F preserves frozen scores with ${JSON.stringify(options)}`, () => {
    assert.deepEqual(bm25fRank(documents, "rollback policy", options).map(({ id, score }) => ({ id, score })), expected)
  })
}
