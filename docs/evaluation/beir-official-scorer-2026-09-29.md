# Standard BEIR scorer integration and full-ranking baseline

## Result that changes the implementation decision

Used **unchanged BEIR 2.2.0 `EvaluateRetrieval`**, backed by `pytrec-eval-terrier` 0.5.10, on complete positive lexical rankings for all 300 exposed SciFact test queries and all 5,183 Markdown documents. This establishes a standard evaluator path instead of inventing another metric implementation. BEIR default same-query/document-ID exclusion is retained. TREC evaluator returned scores for all 300 queries in both arms; no missing-query denominator reduction occurred.

| Standard metric | Whole-note BM25 | Managed lexical (existing two-lane RRF + shortlist) |
| --- | ---: | ---: |
| nDCG@10 | 0.66763 | 0.66471 |
| MAP@10 | 0.62616 | 0.62361 |
| Recall@10 | 0.78233 | 0.77800 |
| MRR@10 | 0.63661 | 0.63417 |
| Recall@100 | 0.87922 | 0.88589 |
| Recall@1000 | 0.95722 | 0.97167 |

**Interpretation:** existing fusion does not improve the first ten results on this corpus. It exposes somewhat more annotated relevant documents deeper in the ranking, but those deep-recall differences do not prove a Curator can extract better answers or do so cheaply. No statistical significance or end-to-end superiority claim. Keep the mixed-note default unchanged until a matched memory-workflow experiment provides stronger evidence; do not tune fusion weights on this exposed corpus.

The Markdown adapter retains original corpus IDs and one title/body note per document. Run scores are strict decreasing values representing the emitted order; this prevents evaluator tie sorting from changing Graphmory's actual order. The first export implemented the same fusion operations directly; a second, preserved export calls **actual `recallVaultLoop`** for the managed arm. Both produced the same aggregate @10 result. They are separate recorded diagnostic executions, not independent repetitions.

This is standard BEIR **scoring of a Graphmory Markdown-adapted retrieval run**, not a BEIR leaderboard submission or an official Graphmory answer benchmark. Markdown titles, paths and tokenization differ from other systems' inputs; model/host/transport parity must be stated for any comparison. Scientific claim retrieval supplements conversational memory tests, and positive relevance labels do not establish exhaustive answer support.

## Reproducibility and preserved artifacts

Dataset/archive and Markdown conversion are pinned in [the baseline report](beir-markdown-baseline-2026-09-29.md). NFCorpus remains unopened at the content level and is not used here. Full runs and reports are private in `/private/tmp/graphmory-beir-official-lexical-runs-v1`, `-v2` and `/private/tmp/graphmory-beir-official-lexical-score-v1.json`, `-v2.json`.

- BEIR evaluation source SHA-256: `f346bd20f258e552895e438257e3cc91308b65e0b1ee6c09422e987084bc3bd0`.
- v2 BM25 run SHA-256: `88a8480407c9e53dd12fa484e7a6f349c288fae58008d5e6875a208ba4703303`.
- v2 managed run SHA-256: `be75ecba8465cecf753cb175ca899a5fa0ebf8a10404f2d388d1d08076028109`.
- v2 scored report SHA-256: `83443678d9f38cafe68769e0ac74ada93153ef636caea8fbe5f6155701f178bb`.

Minimal scoring-only environment (does not install retrieval-model stacks):

```sh
python3 -m venv <private-eval-venv>
<private-eval-venv>/bin/python -m pip install --no-deps beir==2.2.0
<private-eval-venv>/bin/python -m pip install pytrec-eval-terrier==0.5.10 tqdm==4.70.1
node scripts/export-beir-lexical-runs.mjs --prepared <prepared-scifact> --out <new-run-directory>
<private-eval-venv>/bin/python scripts/score-beir-runs.py \
  --zip <pinned-scifact.zip> --dataset scifact --split test \
  --runs <new-run-directory> --out <new-score.json>
```

The scoring-only installation deliberately omits BEIR's datasets/sentence-transformers retrieval dependencies; `pip` reports them as missing. The unchanged evaluation import and one-query smoke ran successfully after adding its `tqdm` import dependency. It is not a full BEIR retrieval installation.

Timing collected by the exporter is warm in-process ranking, BM25 always before fusion. It excludes corpus IO, model inference, original reads and host startup; do not use it to claim a speed win. Future paired measurements need rotated arm order, cold/warm separation and whole-workflow timing.

## Next cohesive delivery

Compare current lexical retrieval, existing whole-note BGE hybrid, and section-level BGE hybrid on the same complete SciFact corpus with these runfiles and scorer. Reuse Transformers.js/BGE, Markdown sections and original readers before adopting a new runtime or model family. Freeze query/model/cache/index settings and resource gates before outputs. A positive retrieval result only earns a matched memory-answer evaluation; it does not promote a default. Source integrity, lifecycle filtering, citation support, abstention and independent confirmation remain required.

Sources: [official BEIR repo and evaluation instructions](https://github.com/beir-cellar/beir), [BEIR paper](https://arxiv.org/abs/2104.08663), [RRF primary publication](https://research.google/pubs/reciprocal-rank-fusion-outperforms-condorcet-and-individual-rank-learning-methods/).

Verification: the actual zip-render/export fixture passed, including archive-digest rejection, output-overwrite rejection, original-ID preservation, and source-mutation rejection. Repository `npm run check` passed all 338 Node tests and configured gates; `git diff --check` passed. Read-only personal-vault status returned `SYNC_CONFIG_NOT_FOUND`; personal vault contents were not changed.
