# SQLite ranker after governance: managed Curator development result

Status: **frozen development screens passed; not a production default**. This follows the [prewritten protocol](sqlite-eligible-ranker-protocol-2026-09-29.md) after the earlier [precomputed-lane failure](sqlite-managed-recall-screen-2026-09-29.md). No private Obsidian content or remote model was used.

## Architecture tested

Graphmory still loads the Markdown notes, filters the eligible set, runs ordinary BM25, performs graph navigation and fusion, then generates Curator previews. Only the focused-section BM25F rank call can use the experimental SQLite posting index. It computes corpus statistics over the **eligible documents**, verifies their current Markdown hashes, and reconstructs section objects from that Markdown. This avoids trusting index-provided titles and preserves the section-title behavior that caused the previous failure. The path is enabled only by an explicit in-process callback in the development worker; the installed CLI and defaults do not select it.

## Correctness and matched results

- Six generic synthetic vault states (initial, add, edit, delete, rename, edit again) × four contexts (default, include superseded, `Projects` scope, `Archive` scope) × 12 frozen queries: **288/288 full managed JSON responses byte-identical**. This includes empty/no-hit contexts and checks candidate paths, status, section titles, scores, pagination flags, evidence previews and output bytes.
- One stale-source negative control: the indexed arm rejected a changed Markdown note, and the index SHA-256 was unchanged.
- Exposed SciFact Markdown, first 5,000 notes loaded by Graphmory and first 30 frozen queries: **30/30 full managed JSON responses byte-identical**. This is not the 5,183-note official BEIR scoring corpus; no official score is reported for this subset.

The 30 SciFact pairs each launched a fresh Node process per arm and alternated arm order. Timing includes process startup, vault parse, BM25, focused-section scoring, managed fusion/previews and full response serialization. File-system cache was warm/uncontrolled. Quantiles use nearest rank.

| Measure | Existing managed path | Experimental eligible SQLite ranker |
| --- | ---: | ---: |
| Fresh-process p50 | 815.50 ms | 533.19 ms |
| Fresh-process p95 | 843.35 ms | 679.02 ms |
| Median response bytes | 8,727 | 8,727 |
| Median child end RSS | 496.76 MB | 390.35 MB |
| Maximum child end RSS | 506.41 MB | 448.38 MB |
| Median raw peak-RSS sample | 485,120 | 381,200 |

The observed p50 reduction is **34.6%**, above the frozen 20% screen; p95, response bytes and RSS also satisfy the predeclared non-regression checks. Building the 5,000-note DB separately took **2.44 s** and produced **16,392,192 bytes**. Raw peak-RSS values use the host's `ru_maxrss` unit and are compared only within this Mac run. The development cost of index creation and updates is not amortized in the per-query timing.

## Decision and remaining gates

This is sufficient evidence to continue a guarded product design, not to change the default. The benchmark has no graph-linked synthetic note, Curator/Lead model answers, answer-level support grading, independent holdout or matched competitor workflow. The SQLite API is Node 24-only while Graphmory advertises Node >=20. The development ranker checks hashes for eligible notes but is not a production automatic index lifecycle for every vault mutation, process crash or concurrent writer. The 5,000-note managed scan limit remains a separate issue. A production design must provide a correct Node 20 fallback and fail closed or rebuild on stale index, then rerun paired whole-workflow quality/latency tests.

## Raw evidence

- Complete paired ledger: `/private/tmp/graphmory-sqlite-eligible-managed-v1/report.json`, SHA-256 `d3f07c9b425ed7b523c6ac48de0de77a21db8d4313686ddada93f2e8be412c71`
- Synthetic fixture and mutation parity: `/private/tmp/graphmory-sqlite-mutation-v3/report.json`
- 5,000-note index: `/private/tmp/graphmory-sqlite-postings-5000-managed-v2.db`

The committed [compact manifest](experiments/sqlite-eligible-ranker-2026-09-29.json) records the exact counts, statistics, source/code hashes and limitations. Large raw files remain local.
