# BEIR Markdown baseline: exposed development, no treatment yet

## Why this changes the next action

The existing 54-note / 34-question vault scored recall-loop Recall@10 = 1.000 on this rerun. That exposed cohort cannot demonstrate a semantic-retrieval completeness gain. The planned section-hybrid prototype was stopped before edits. Luna subsequently hit its usage limit; no retriever implementation or model call was completed.

To find an actual gap using existing research infrastructure, downloaded the official [BEIR](https://github.com/beir-cellar/beir) SciFact archive and verified its published MD5 `5f7d1de60b170fc8027bb7898e2efca1`. SHA-256: `536e14446a0ba56ed1398ab1055f39fe852686ecad24a6306c80c490fa8e0165`. NFCorpus was downloaded separately and verified against published MD5 `a89dba18a62ef92f7d323ec890a0d38d` (SHA-256 `efe5be03f8c5b86a5870102d0599d227c8c6e2484328e68c6522560385671b0b`). NFCorpus member names were inspected for archive-path safety, but no corpus/query/qrels contents were read or rendered. It remains a separately reserved corpus, not an already passed holdout.

## Actual execution

`scripts/prepare-beir-markdown.py` rendered all **5,183 SciFact documents** as one title/body Markdown note each. All 300 official test queries with positive qrels were retained; no failure-based query selection or synthetic paraphrasing. Query-set SHA-256: `57cddbed64eb5ff2bce11ab6c6171e449cf139a3a70c887c5580c55ae04510db`. Original relevance labels stayed outside retrieval input. This publicly released test split is now **exposed development for Graphmory**; do not describe subsequent tuning on it as zero-shot confirmation.

The converter's first attempt failed on the qrels header before creating output. It was fixed to validate the standard `query-id/corpus-id/score` header explicitly. The evaluator's default 5,000-note cap would omit 183 documents; added `--max-files` and a fail-closed scan-limit check, then ran with 6,000. No archive contents are committed; rendered vault, hashes, query sets and reports remain private in `/private/tmp/graphmory-beir-scifact-markdown-v1` and `/private/tmp/graphmory-beir-scifact-*v1.*`.

| Actual arm | Hit@10 | Mean Recall@10 | MRR over returned ranking | Binary nDCG@10 |
| --- | ---: | ---: | ---: | ---: |
| Whole-note BM25 | 80.3% | 78.2% | 0.641 | 0.668 |
| BM25F sections, governed | 78.7% | 76.9% | 0.620 | 0.648 |
| Existing recall-loop helper (8 candidates/lane) | 80.0% | 77.8% | 0.635 | 0.665 |
| Curator-equivalent lexical first page (full lanes, existing eight-item shortlist) | 80.0% | 77.8% | 0.634 | 0.665 |

The Curator-equivalent first page retrieved every positive-qrel document in 228/300 queries and at least one in 240/300. This uses the actual `recallVaultLoop` with all source documents and existing shortlist ordering; it excludes preview transport, model reasoning and pagination reads. Positive qrels are relevance annotations, **not guarantees of exhaustive factual support**. There is no supported-answer or whole-workflow latency result here.

Scores use Graphmory's current scorer. They are **adapted diagnostic scores**, not official BEIR evaluator outputs or leaderboard submissions; grade handling, tie behavior and run depth must be verified against the official evaluator before a standard benchmark claim. SciFact is scientific claim retrieval, not personal conversational memory. It supplements, not replaces, LongMemEval/LoCoMo and linked-note tests.

## Decision and next meaningful unit

Do not claim that sparse fusion improves over BM25: this run shows no improvement. Freeze an actual three-arm retrieval comparison (current lexical, existing BGE hybrid, section-level BGE hybrid), retain all queries, and use the official BEIR scoring implementation with complete runfiles. Measure cold/warm query cost, index size/build/update cost and peak RSS. Only if the added lane produces a useful gain under a fixed resource budget should it be connected to the Curator and evaluated for supported-complete answers, citation support and token/latency cost on memory datasets. Do not tune using NFCorpus before freezing confirmation parameters.

Keep the converter, evaluator correction, optional integration and outcome report as one reviewable delivery where possible. Do not push each exploratory note or rerun as a separate optimization claim.

Verification after the converter/evaluator edits: `npm run check` passed and `git diff --check` passed. The read-only personal-vault status returned `SYNC_CONFIG_NOT_FOUND`; no personal vault files were modified. These edits were initially held for a coherent delivery; they are now grouped with the [standard BEIR scorer integration and actual full-ranking comparison](beir-official-scorer-2026-09-29.md), rather than presented as a successful retriever optimization.
