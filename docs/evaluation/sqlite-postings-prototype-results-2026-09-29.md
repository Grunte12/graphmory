# SQLite postings prototype: development result

Status: **promising storage prototype; no production change**. This follows the [frozen protocol](sqlite-postings-prototype-protocol-2026-09-29.md). The code is in `scripts/experimental-sqlite-postings.mjs` and uses the experimental `node:sqlite` API on Node 24. Graphmory's packaged runtime still supports Node 20 and still uses its existing retriever.

## What changed

The prototype stores the existing focused-section BM25F field token frequencies and lengths in a local SQLite posting index. It executes Graphmory's existing query expansion, score formula, weights, tie order and note deduplication in JavaScript. It changes storage and loading, **not the relevance algorithm**. The index is read-only after full build and is not wired into `recall-managed`.

## Reproducible evidence

The exposed SciFact Markdown fixture has 5,183 notes and 300 frozen test queries. It is development data, not an independent memory-answer holdout. The 500-note/30-query screen passed. On the full corpus, the original-ID order **and score** of every ranked result matched the existing focused-section BM25F path for **300/300 queries**. Each query's full result JSON hash matched. Source, query, code and index hashes were recorded in the raw ledgers. The official unchanged BEIR 2.2.0 scorer produced identical scores for the two arms: nDCG@10 **0.65311**, Recall@10 **0.76633**, with identical run SHA-256. These are scores for focused-section BM25F alone, not Graphmory's managed fusion or a Curator answer.

For 30 query pairs, the benchmark started a fresh Node process for each arm, alternated which arm ran first, included full JSON output, and verified equal output hashes before recording each pair. OS file caching was warm/uncontrolled. The p50 and p95 below use nearest-rank quantiles of the 30 calls; memory is child end-of-process RSS, with the raw process peak also checked on the same host.

| Measure | Current Markdown parse + focused BM25F | Experimental SQLite posting lookup |
| --- | ---: | ---: |
| Fresh-process p50 | 763.21 ms | 44.27 ms |
| Fresh-process p95 | 807.28 ms | 62.67 ms |
| Median end RSS | 459.28 MB | 76.32 MB |
| Maximum end RSS | 461.36 MB | 112.57 MB |
| Median raw peak-RSS sample | 448,512 | 74,544 |
| Complete exact pairs | 30/30 | 30/30 |

The measured p50 reduction is **94.2% for this isolated lookup CLI**, above the frozen 15% development screen. Building the 5,183-note index separately took **2.21 s** and produced a **16,928,768-byte** SQLite file. The 500-note index took 0.71 s and occupied 1,638,400 bytes. Raw peak-RSS values use the host's `ru_maxrss` unit and are compared only within this Mac run.

## Decision and remaining gates

Keep this as an experimental branch of work. The large lookup improvement and exact rank parity justify designing a supported persistent index, but they do **not** establish an end-to-end speed improvement, better retrieval quality or better supported answers. The current index must be rebuilt after changes; it has no proved incremental add/edit/delete/rename invalidation, scope/lifecycle refresh, or complete candidate pagination. Its Node 24 API cannot silently replace the advertised Node 20 path. Direct query mode trusts the prebuilt index; the evaluation harness checks source and index integrity around the experiment, but ordinary users would need automatic freshness validation.

Next experiment: freeze mutation and pagination fixtures, then compare incremental updates with a clean rebuild; only after parity should an opt-in `recall-managed` integration receive paired end-to-end latency, Curator/Lead answer-quality and independent-holdout tests. Do not compare these isolated lookup times with Basic Memory or another tool's full workflow.

## Raw records

- 500-note correctness: `/private/tmp/graphmory-sqlite-postings-500-parity-v1/report.json` (SHA-256 `788c08cdf1e55590f9a5aa4ce9f029329625224237301e9dd075cb51edb798e5`)
- Full correctness: `/private/tmp/graphmory-sqlite-postings-full-parity-v2/report.json` (SHA-256 `0f88698d99f840a053681f256509bfa9bfa9cdcd3fca294b63da5a95b5d5327f`)
- Fresh-process pairs: `/private/tmp/graphmory-sqlite-postings-cold-v1/report.json` (SHA-256 `e91b97dfaa339a27afbf16a7db269c36e098d4e3cd9f1e7413b0fde4a4de66d9`)
- Official BEIR score: `/private/tmp/graphmory-sqlite-postings-score-v1.json` (SHA-256 `8f4717912c9f9f1ab8b872b6b53e35efb9a71476aa9f5d9c9bf91598a77113ad`). This scoring run used the prior v1 prototype code; the v2 code only added telemetry and a matched-baseline CLI mode, then passed all 300 exact parity checks again.

The compact committed record is [the experiment manifest](experiments/sqlite-postings-prototype-2026-09-29.json). The large raw ledgers and SQLite database remain local and contain no private Obsidian vault content.
