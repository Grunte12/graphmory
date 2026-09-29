# Matched CLI retrieval diagnostic — 2026-09-28

## Question and frozen protocol

Can Graphmory's actual `recall-loop --agent` CLI locate the same LongMemEval evidence as Basic Memory 0.23.2 native hybrid search, and how much wall time and stdout does each call use on this machine? This is an **exposed development diagnostic**, not an independent holdout or answer-quality comparison.

The [pre-run manifest](../../eval/competitor-pilot/matched-cli-development-manifest-2026-09-28.json) freezes the 14 LongMemEval-S cases, question-only queries, 12 answerable cases, primary Complete Evidence@10, secondary @3/recall/time/output/ingest/failures, and three warm CLI repeats. The [raw report](../../eval/competitor-pilot/matched-cli-development-2026-09-28.json) records dataset, helper and CLI hashes, per-query SHA-256, 698 original Markdown body hashes, ordered returned paths, all 84 call measurements, index metadata and failures. The [runner](../../scripts/eval-matched-cli-retrieval.mjs) reconstructs each case in separate disposable vaults, uses Basic Memory's own hybrid index and Graphmory's own CLI, alternates which arm goes first per case, and checks Graphmory source bodies after search. The one-case smoke run passed before the full run. All 14 full-run cases completed without a runner/index/path error.

```sh
node scripts/eval-matched-cli-retrieval.mjs \
  --input tmp/datasets/longmemeval_s_cleaned.json \
  --out eval/competitor-pilot/<new-unique-report>.json
```

The dataset is local and hash-pinned; the runner refuses to overwrite an existing report. Basic Memory used `bm tool search-notes ... --page-size 12 --json --hybrid` after `bm reindex --search --embeddings`. Its reported embedding model was `FastEmbedEmbeddingProvider:bge-small-en-v1.5:384`, with nonzero embedded entities and zero embedding errors in every case. Graphmory used `node scripts/brain-sync.mjs recall-loop ... --k 10 --agent`. All 698 original Markdown files were altered by Basic Memory's native ingestion; that normalization is part of its measured treatment, and Graphmory originals retained their input hashes.

## Observed results

| Metric | Basic Memory hybrid | Graphmory recall-loop |
|---|---:|---:|
| Complete Evidence@10, answerable cases | 12/12 | 12/12 |
| Complete Evidence@3, answerable cases | 10/12 | 10/12 |
| Mean Recall@3 | 0.9375 | 0.9167 |
| Mean Recall@10 | 1.0000 | 1.0000 |
| Median warm CLI wall time, 42 calls each | 2,001 ms | 90 ms |
| Median stdout size, 42 calls each | 84,020 bytes | 1,016 bytes |
| Median native ingest/index time per case | 36.5 s | no prebuilt index |
| Operational failures | 0/14 | 0/14 |

At @3, one case favors Basic Memory and one favors Graphmory; the totals tie. Two abstention cases were excluded from evidence-recall denominators; retrieval alone cannot score whether either system would abstain correctly. Both arms returned all gold evidence groups by @10 on these exposed cases. The paired @10 result is a tie, so it does not justify a retrieval-quality superiority claim.

Graphmory's observed call time is about 22 times lower in this specific warm CLI setup. That ratio includes process startup and each tool's serialization. Basic Memory emitted full note text; Graphmory emitted a compact path/preview packet that requires later reads. The output-byte ratio is therefore **not** a token-cost or end-to-end speed comparison. Basic Memory also paid a median 36.5 s native index build per case (522.9 s total); Graphmory scanned original Markdown on demand. Different indexing and delivery contracts are precisely what the practical CLI comparison captures, but they prevent attributing the entire time difference to ranking algorithms.

## Decision and next gate

Leave Graphmory's documented default recall workflow unchanged. `recall-loop` is currently a fallback, so this result does not promote it to default. The sample shows equal Complete Evidence@10 and materially shorter individual CLI calls for the compared lanes, with no reason to add an embedding dependency just for these cases. Do not declare Graphmory better than Basic Memory as a memory assistant. The next controlled experiment should hold the Curator/Lead host and answer rubric constant, fetch the required full evidence through each tool's native workflow, and measure supported-complete answers, citations, abstention, total latency, tool-call count and real model usage. Include a frozen independent holdout with late evidence, conflicts and unanswerable questions before promotion. Exposed development cases can debug that harness but cannot certify generalization.

## Verification

`npm run check` passed the repository's configured tests and evaluation gates. `git diff --check` passed. The required `brain-sync status --vault <private vault>` returned `SYNC_CONFIG_NOT_FOUND`; this benchmark used disposable reconstructed vaults and did not change the user's Obsidian vault. The matched report has 14/14 complete rows, three repeats per arm per case, matching frozen script/CLI hashes, and no failure. A Basic Memory temporary `:memory:.ses` file created during the run was removed after recording the report.
