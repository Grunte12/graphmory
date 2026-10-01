# Hybrid integration experiment 3 — 2026-10-02

## Change

Separate embedding windows at Markdown headings to isolate the long-tail policy from unrelated surrounding text.

## Execution

`node scripts/eval-hybrid-summary.mjs --out ../graphmory-hybrid-summary-20261002/real-bge-03 --model-cache ../work/transformers-cache`

Real local `Xenova/bge-small-en-v1.5`, fp32, existing weights, remote model downloads disabled. 19 synthetic Markdown notes, six authored questions. No Curator/answer LLM or competitor run. Both methods use the same fixture and gold paths.

## Results

| Method | Recall@5 | MRR@10 | Superseded note excluded |
|---|---:|---:|---|
| lexical | 0.4167 | 0.5000 | True |
| hybrid | 1.0000 | 0.9167 | True |

First hybrid request 1119.4 ms including cold pipeline initialization/indexing; subsequent requests median 6.9 ms in this same process/fixture. These do not measure a new CLI process, host dispatch, RAM or full application latency.

Hybrid returns a broad candidate pool (up to 17 notes here). The cosine floor is not calibrated relevance probability; Curator still must inspect support. Recall@5 is a ranking screen, not a total Curator-read cap. Gold lists are limited support paths rather than exhaustive graded relevance judgments. Results cannot establish performance on independent/user vaults or superiority over Hindsight.

Raw evidence: `outputs/graphmory-hybrid-summary-20261002/real-bge-03/report.json`. Fixture files are retained. Earlier experiment runtime hashes were not captured; this limitation must not be retroactively replaced with final-runtime hashes. Final experiment 4 records runtime/source hashes at start. Earlier report JSON remains unchanged.
