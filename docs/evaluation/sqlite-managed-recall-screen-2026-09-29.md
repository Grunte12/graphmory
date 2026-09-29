# SQLite inside managed Curator recall: stopped at first parity failure

The [frozen protocol](sqlite-managed-recall-protocol-2026-09-29.md) required the full managed response to match exactly before any latency conclusion. This experimental treatment **failed the first of 30 planned SciFact queries**, so no performance A/B or synthetic governance arm was run. The product CLI and default remain unchanged.

## Attempt and finding

Both arms used the same 5,000-note exposed SciFact Markdown input, curator config, `k=10`, adaptive bundle and no semantic model. Baseline computed BM25 plus focused-section BM25F; treatment computed BM25 plus a SQLite-precomputed focused-section lane. The first question's full response hashes differed:

| Artifact | SHA-256 |
| --- | --- |
| Frozen query text | `1f2fcc021564497de2674fb06879f80c6f33b80adaa4e0a6ed0264ce2cb310a8` |
| Baseline managed JSON | `875d0d8df814d74f65f475838e26d6165bd8381d7d81d245fdcbfc52de68ac72` |
| SQLite-lane managed JSON | `fc5ad4f235992f30d1f302b15bdd8efe1c609acf78b305245f911f4e8b0d02d9` |
| 5,000-note SQLite DB | `8c94cb246bc50ddb013c570d7b15ec7b7ef000bdf61697e1b0f6f75e92c3c7a3` |

The top 10 paths, positions, rounded fused scores, evidence previews, source-read flags and other top-level fields matched on this question. **Three of ten result titles differed** (ranks 6, 7 and 9): Graphmory's original BM25F lane supplied a section title, while the precomputed-lane sanitizer substituted the note title. The sanitizer intentionally derives metadata from loaded Markdown instead of trusting external lane text. The mismatch is therefore in the integration boundary, not the posting scorer. It still violates the exact managed-response contract and could change what a Curator sees.

The design also still needs tests for scoped/lifecycle-specific rank statistics and graph navigation. A global precomputed rank may differ when the managed scorer restricts its eligible corpus. Do not bypass the mismatch by ignoring titles or comparing only paths. Do not infer speed from the isolated lookup benchmark.

## Next test design

Preserve the source-governance boundary. A candidate repair should let the managed lexical lane use an index-backed ranker **after** the eligible note set is determined, and reconstruct section metadata from the current validated Markdown rather than accepting text from the index. Freeze a new protocol with scope, superseded-note and graph-link cases before measuring latency. It must also account for index freshness and Node 20 support. The failed opt-in seam and reproduction arm are development scaffolding; they are not an installed user path.

## Local raw evidence

- `/private/tmp/graphmory-managed-baseline-q1.json`
- `/private/tmp/graphmory-managed-sqlite-q1.json`
- `/private/tmp/graphmory-sqlite-postings-5000-managed-v1.db`

The [compact failed-attempt record](experiments/sqlite-managed-recall-screen-2026-09-29.json) has the attempted/planned counts, code hashes and mismatch fields. No private Obsidian note content was used or changed.
