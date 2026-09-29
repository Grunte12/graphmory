# SQLite eligible ranker: graph parity and small-vault cost

Status: **graph parity passed; no automatic small-vault indexing**. The [protocol](sqlite-graph-small-vault-protocol-2026-09-29.md) was written before testing. After the run, its personal vault path was replaced with “user-authorized local Obsidian vault” for publication; the test design, queries and gates did not change.

## Graph-linked synthetic vault

A 12-note generic Markdown vault included a non-answer hub linking to two answer notes, a two-hop chain, a cycle, ambiguous same-name targets, a superseded note and a multiple-section project note. The hub-only query surfaced at least one linked answer note that had no lexical hub terms, confirming that graph navigation was actually exercised. The existing managed Curator response and the experimental index-backed response were byte-identical for **36/36** frozen query/context pairs across default, historical and project-scope modes. This covers the one-hop navigation behavior in this fixture, not every graph form or multi-hop answer.

## User-authorized 55-note Obsidian vault

The vault was read locally and not modified. The two arms returned byte-identical complete managed responses for **10/10** frozen generic questions. Each call started a new Node process and arm order alternated by question. The baseline worker dynamically skipped the SQLite module import; the indexed arm paid that startup cost. Timing includes loading the Markdown, ranking, graph/fusion, preview generation and full JSON serialization. OS file cache was warm/uncontrolled.

| Measure | Existing managed path | Experimental SQLite ranker |
| --- | ---: | ---: |
| Fresh-process p50, 10 calls | 44.10 ms | 41.87 ms |
| Fresh-process p95, 10 calls | 46.34 ms | 50.11 ms |
| Median response bytes | 5,997 | 5,997 |
| Median child end RSS | 70.16 MB | 66.27 MB |

The index build took **20.03 ms** and produced a **196,608-byte** DB. With only ten generic queries and a p95 that is higher for the indexed arm, the few milliseconds of p50 difference are not dependable evidence of a better small-vault experience. Keep the default unindexed there. The 5,000-note result in the [earlier managed experiment](sqlite-eligible-ranker-results-2026-09-29.md) remains a separate large-vault development finding; it does not justify indexing every installation.

## Privacy and limits

The report records aggregate source-set hashes and response hashes, not note bodies, returned paths or user-specific query text. All 55 loaded Markdown source hashes matched before and after the run. The temporary symlink, manifest, generated graph fixture and both DBs were removed; the sanitized local ledger remains at `/private/tmp/graphmory-sqlite-graph-small-v1/report.json` (SHA-256 `f9aa6b5eff6c47a5f393710bf0258a82a1a45711a98cb897d3422973c4da18d4`). The [compact manifest](experiments/sqlite-graph-small-vault-2026-09-29.json) is safe to commit.

This screen has no user-answer labels, model calls, competitor or independent holdout. The generic queries measure local mechanics only. Node 24 experimental SQLite still needs a Node 20 fallback and automatic index maintenance before any installed feature. The small sample does not establish a precise crossover size; test a medium vault and repeat timing before choosing a threshold.
