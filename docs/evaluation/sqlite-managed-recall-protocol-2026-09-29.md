# SQLite lane inside managed Curator recall: frozen screen

## Question

Does replacing only the focused-section BM25F lane's computation with the already built SQLite posting result improve the **actual managed Curator recall response** without changing its bytes, candidate reachability, scope/lifecycle governance or failure behavior? This is a development screen before any installed CLI/default integration.

## Paired design

Use the existing exposed SciFact Markdown fixture and its first 30 frozen queries, in original order. `managedRecall` currently scans at most 5,000 notes, so build the experimental DB from **the exact same first 5,000 loaded notes**; do not score it as a full 5,183-note BEIR run. Both arms use the same curator config, `k=10`, adaptive bundle, no semantic model, no remote calls. Baseline computes `bm25` and `bm25f-focused-sections` in Graphmory. Treatment computes `bm25` normally and supplies a precomputed `bm25f-focused-sections` lane from the SQLite prototype through the existing precomputed-lane governance path. Add only a private optional input seam to `managedRecall`; installed commands and defaults stay unchanged.

First prove for all 30 queries that the **complete managed return JSON** is byte-identical, including ranked candidates, scores, flags, pagination and evidence previews. A mismatch is a correctness failure, even when the top result is the same. Also test a small frozen synthetic vault with a superseded note and a narrowed scope. If the precomputed lane changes managed output under that governance, stop and record the failure; do not silently weaken the comparison.

For parity-passing cases, alternate arm order by query and launch a fresh Node process per arm. Include process startup, Markdown loading, BM25, SQLite child lookup, fusion, preview generation and full JSON serialization in wall time. Record p50/p95, response bytes and child RSS, with source/code/index hashes and every failed attempt. OS filesystem cache is warm/uncontrolled. Build time and DB bytes are reported separately. The performance screen is at least 20% lower paired median, no p95 regression, no response-byte increase and exact response parity; a narrower isolated lookup win is insufficient.

This screen is exposed development data. It cannot prove supported answers, Curator model cost, independent holdout or competitor superiority. It must not change the product default without those later gates and a Node 20-compatible freshness/index path.
