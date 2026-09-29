# SQLite mutation parity: development result

Status: **synthetic mutation screen passed; no product integration**. The [frozen protocol](sqlite-mutation-parity-protocol-2026-09-29.md) was written before the updater and evaluator. All work used disposable generic Markdown notes under `/private/tmp`; `<private vault>` was not changed.

## What was tested

The Node 24 experimental updater compares the indexed source hashes with a prior vault snapshot, detects changed Markdown paths, replaces only their section rows and postings in one SQLite transaction, then recomputes corpus averages and section count. A rename appears as one deletion plus one addition. The experimental query command gained optional `--offset` and `--k` flags; no Graphmory production command changed.

| Frozen state | Notes matching broad `memory` query | Exact full-ranked queries versus both fresh rebuild and current BM25F | Page reachability, 3 per page |
| --- | ---: | ---: | ---: |
| Initial 12-note vault | 12 | 12/12 | 12/12 |
| Add two-section note | 13 | 12/12 | 13/13 |
| Edit body and lifecycle metadata | 13 | 12/12 | 13/13 |
| Delete note | 12 | 12/12 | 12/12 |
| Rename across folders | 12 | 12/12 | 12/12 |
| Edit renamed note | 12 | 12/12 | 12/12 |

All **72/72** frozen query/state comparisons matched the original focused-section BM25F scorer and a fresh SQLite rebuild on full original-ID order, section ID and score. The broad query returned every candidate through the experimental page command without gaps or duplicate paths. An intentionally stale prior-vault snapshot was rejected with exit code 1; the DB SHA-256 was unchanged before and after the failed update.

The first attempt failed on the 11th query of the initial state: an empty result was rejected by the new query command as an invalid page even though no page had been requested. This was a real regression, preserved in the failed ledger. The fix distinguishes an empty full result from an explicit page request; the second run completed all 72 comparisons. After that code change, a fresh 5,183-note SciFact index again matched the current scorer's **full rank and score for 300/300 queries**. The unchanged BEIR 2.2.0 scorer again gave identical original-ID runs, nDCG@10 **0.65311** and Recall@10 **0.76633**, for the current and SQLite focused-section BM25F arms.

## Decision

This demonstrates core incremental posting correctness on the **six synthetic states only**. It does not prove concurrency safety, crashes mid-update, vault scans beyond current limits, lifecycle/scope governance, multi-lane fusion, semantic recall, end-to-end Curator latency, answer quality, or automatic index freshness for ordinary users. The updater requires both prior and next vault snapshots; this is an evaluation mechanism, not the installation UX. Node 24 `node:sqlite` remains incompatible with Graphmory's advertised Node >=20 baseline. The experimental raw-index page command is not the `recall-managed` paginator.

Next, design a Node 20-compatible optional persistent index with automatic source validation; freeze matched `recall-managed` comparisons before wiring it into the user path. The answer-level and independent-holdout gates remain open.

## Raw evidence

- Failed first attempt: `/private/tmp/graphmory-sqlite-mutation-v1/report.json`, SHA-256 `cba79a1694f5b14afc1f3468d9ea23fd5d8c4f078ecf2c3525750499df35c3ff`
- Passing mutation run: `/private/tmp/graphmory-sqlite-mutation-v2/report.json`, SHA-256 `01e477686b483b1d604ea25d3fe48088db34b8333018ab905b2f68f5fa3b5627`
- Post-fix full SciFact parity: `/private/tmp/graphmory-sqlite-postings-full-parity-v3/report.json`, SHA-256 `d38a8607c7e0ebe07bece222bd5569ba1a2856d8f554085fe157b065787d3665`
- Post-fix BEIR run manifest: `/private/tmp/graphmory-sqlite-postings-beir-v3/manifest.json`, SHA-256 `fe7c54267386e3df570bf97b3525a9fbe7d0a79b2d9ddde94692a05ffc0774b7`
- Post-fix official scores: `/private/tmp/graphmory-sqlite-postings-score-v3.json`, SHA-256 `17c28a5d8d385231861f536ce082ab6241db4193bba196bd15bf0459e500034e`

The large raw ledgers and fixture remain local. The [compact experiment manifest](experiments/sqlite-mutation-parity-2026-09-29.json) is committed without note content.
