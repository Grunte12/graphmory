# Retrieval-stage profile: observed bottleneck

Protocol: [frozen before measurement](retrieval-stage-profile-protocol-2026-09-29.md). The [compact machine-readable result](experiments/retrieval-stage-profile-2026-09-29.json) includes source/model/code hashes and the SHA-256 of the full, attempt-level raw report at `/private/tmp/graphmory-retrieval-stage-profile-2026-09-29-v1/report.json`.

All 30/30 pinned SciFact questions completed on all 5,183 Markdown notes. No vector-cache miss or source/code drift occurred. The model was already downloaded, and remote model access was disabled. The same local BGE model and existing retrieval functions were called; no code or ranking changes were made for this profile.

| Diagnostic stage | Warm median ms, queries 2–30 | p95 ms | Share of summed stage medians |
|---|---:|---:|---:|
| Load and parse all Markdown notes | 224.0 | 269.6 | 25.1% |
| BM25 | 95.3 | 161.2 | 10.7% |
| Focused-section BM25F | 474.0 | 537.3 | 53.2% |
| Validate and hydrate vector JSON | 87.8 | 94.7 | 9.9% |
| Query embedding, model already loaded | 6.2 | 10.3 | 0.7% |
| Dense exact scan and sort | 4.0 | 5.4 | 0.5% |

The separate model-pipeline initialization took 141.7 ms with cached files. Final process RSS was 2,282,160,128 bytes. The resource-usage `maxRSS` field is preserved raw because its unit is platform dependent. The decomposition's summed medians are **not** a whole API latency measurement: stage calls were sequential in a diagnostic script, and garbage collection, cache state and preparation differ from a real CLI invocation. It provides a direction, not a speedup claim.

## Decision

The previous parsed-vector-cache prototype targeted a stage that accounts for only about one tenth of these decomposed warm medians. Focused-section BM25F plus loading/parsing Markdown dominates. The next controlled experiment should therefore test a **persistent index of the existing section tokens and field statistics**, preserving Graphmory's tokenizer, note-level identities, whole-note BGE vectors and fusion exactly. Do not replace BM25F scoring with FTS5's different formula or switch to section embeddings in a storage-only comparison.

Freeze a same-host A/B before implementation: 30 or 300 pinned SciFact queries plus source-verified memory cases; complete per-query original-ID order and score parity; add/edit/delete/rename versus full rebuild; candidate pagination; cold-process and warm-process p50/p95; index build/update time, disk and peak RSS. Compare to the actual CLI, not only index lookup. Keep the advertised Node 20 support or explicitly measure and document a separate compatibility path. The current result does not establish supported-complete answers, citation quality, abstention or a comparator win.
