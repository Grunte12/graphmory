# Existing BGE hybrid: complete development screen

## Decision

Reuse the existing optional BGE + lexical + RRF implementation for a subsequent integration experiment. It passed the [frozen screen](existing-bge-screen-protocol-2026-09-29.md): mean Recall@10 improves by more than 0.02 without a mean nDCG@10 loss. **Do not promote it to the default yet.** Quality improves on this corpus, but indexing, memory consumption, source paging and end-to-end memory answers still need separate gates.

This delivery adds a complete-run exporter and reuses the unchanged standard BEIR evaluator. It does not change retrieval runtime, install requirements, model settings, user vaults or Curator instructions. That makes the experiment interpretable before an integration changes multiple layers.

## Controlled comparison

All 5,183 original SciFact documents were represented as Markdown notes; all 300 exposed test queries were attempted and scored. No query replacement, omitted failure, corpus scan truncation, parameter tuning or LLM call occurred. The semantic exporter calls actual `recallVaultSemantic`. Compare with preserved lexical v2 runs calling the actual managed lexical API. All arms retain original corpus/query IDs, official relevance labels and BEIR's default same-ID exclusion.

| Standard metric | Whole-note BM25 | Managed lexical | Existing BGE hybrid |
| --- | ---: | ---: | ---: |
| nDCG@10 | 0.66763 | 0.66471 | **0.70797** |
| Recall@10 | 0.78233 | 0.77800 | **0.84667** |
| MAP@10 | 0.62616 | 0.62361 | **0.65845** |
| MRR@10 | 0.63661 | 0.63417 | **0.67078** |

Recall measures the fraction of annotated relevant documents retrieved; nDCG measures their ranking quality. Neither establishes complete factual support or a correct Curator summary. Output depth ten is a benchmark comparison cutoff, **not a universal limit on what the Curator may read**.

### Per-query losses and uncertainty

| Comparison: BGE minus baseline | Metric | Mean difference | Better / worse / tied queries | Paired bootstrap 95% interval |
| --- | --- | ---: | --- | --- |
| Managed lexical | Recall@10 | +0.06867 | 28 / 5 / 267 | [0.03583, 0.10317] |
| Managed lexical | nDCG@10 | +0.04326 | 77 / 31 / 192 | [0.02040, 0.06699] |
| Whole-note BM25 | Recall@10 | +0.06433 | 28 / 6 / 266 | [0.03133, 0.09917] |
| Whole-note BM25 | nDCG@10 | +0.04034 | 75 / 30 / 195 | [0.01704, 0.06498] |

Computed from pytrec_eval per-query scores for every one of the 300 queries, with NumPy RNG seed 20260929 and 10,000 paired-query bootstrap samples. Intervals are exploratory descriptions on an exposed development corpus, not independent confirmation or evidence of universal superiority. The five Recall@10 regressions against managed lexical must remain in the evaluation denominator and receive an error audit before integration.

## Resource costs and timing scope

- Cold preflight: **638.795 seconds**, including model download, first indexing and first query. It scanned 5,183 notes and produced 5,183 cached vectors. This is not warm query latency.
- Cached model files: **133,805,935 bytes** (127.6 MiB); vector JSON: **60,396,377 bytes** (57.6 MiB). Disk sizes are not RAM requirements.
- Complete 300-query run using the existing cache in one persistent Node process: first API call **1,047.50 ms**; remaining 299 calls p50 **812.51 ms**, p95 **1,052.79 ms**; total timed API calls **254.48 seconds**.
- Node `resourceUsage().maxRSS`: **2,217,424 KiB**, approximately **2.12 GiB**. Final RSS was 1,857,568,768 bytes (1.73 GiB), with heap used 1,314,954,200 bytes (1.22 GiB).

API timing includes Markdown/cache IO, query embedding and ranking. It excludes Curator/Lead model responses and CLI startup. Prior lexical timings excluded IO; they are not a matched speed comparison. A single observed process and corpus do not establish minimum RAM on every machine. Cache reload/allocation is a plausible profiling target, not a demonstrated root cause yet.

## Reproduction and integrity

Use the pinned corpus conversion and scoring-only environment in [the baseline](beir-markdown-baseline-2026-09-29.md) and [official scorer report](beir-official-scorer-2026-09-29.md). Existing optional Transformers.js 3.8.1 was available for this run; model, pooling, normalization, candidate limits and whole-note representation stayed unchanged.

```sh
node scripts/export-beir-existing-semantic.mjs \
  --prepared <prepared-scifact> --out <new-semantic-run-directory> \
  --model-cache <model-cache-outside-vault>
<private-eval-venv>/bin/python scripts/score-beir-runs.py \
  --zip <pinned-scifact.zip> --dataset scifact --split test \
  --runs <new-semantic-run-directory> --out <new-score.json>
```

The exporter refuses output overwrite, validates source/query hashes, saves planned and completed query slots, and preserves incomplete runs with their error. The scorer refuses incomplete manifests and missing/substituted queries. Retrieval code hashes and resource measurements are preserved in the run manifest.

Preserved local artifacts:

- `/private/tmp/graphmory-beir-existing-bge-runs-v1/`: complete run and manifest; run SHA-256 `019287a0ad1b3bc2a1eb04e08779897d4663aa4df4979c4833aa92ee98f642b8`.
- `/private/tmp/graphmory-beir-existing-bge-score-v1.json`: unchanged BEIR scores; SHA-256 `d011790cfbd56ff91ae9b3c932d2bca83bbc81a7d03c5f5e8be327f3711e3fd2`.
- `/private/tmp/graphmory-beir-existing-bge-analysis-v1.json`: paired analysis/resource summary; SHA-256 `17bcca315085eda83f75bf72cbc2839d519f2e983a1c7f48086b346b58cabb9a`.
- `/private/tmp/graphmory-beir-bge-preflight-v1.json` and `.log`: cold preflight evidence; preserve separately from the warm run.

No personal-vault content was used. These results measure scientific claim retrieval, not conversational memory, lifecycle correctness, multi-hop factual inference, abstention, or supported final answers. NFCorpus content is still reserved and unopened; source overlap has not been verified.

## Next meaningful package and its gates

1. Profile the existing cache/index path before changing it. Preserve rankings and source invalidation while reducing measured repeated work; reuse the current encoder rather than add another model/runtime.
2. Integrate semantic candidate access into Curator recall with lifecycle/scope checks, original-note reads and continuation paging. The current 20-per-lane/ten-output semantic baseline cannot silently become a total evidence cap.
3. Evaluate the integrated workflow on frozen memory questions, including conflicts, unanswerable queries and multi-note evidence. Gate on supported complete answers, citation support, abstention, whole-workflow p50/p95, RAM and token cost; audit regressions.
4. Use independent frozen confirmation only after development decisions are fixed. Keep the default lexical path unless the quality and resource gates justify changing it.

Research supports the components, not a presumed win on our task: [BEIR paper](https://arxiv.org/abs/2104.08663), [official BEIR evaluator](https://github.com/beir-cellar/beir), [RRF publication](https://research.google/pubs/reciprocal-rank-fusion-outperforms-condorcet-and-individual-rank-learning-methods/), [Xenova BGE model card](https://huggingface.co/Xenova/bge-small-en-v1.5), [BAAI BGE model card](https://huggingface.co/BAAI/bge-small-en-v1.5).

## Delivery verification

`npm run check` passed the repository test and configured evaluation gates. Re-scoring the preserved complete semantic run with the updated scorer reproduced every reported aggregate metric. `git diff --check` passed. The failure fixture preserves an incomplete semantic ledger when its optional dependency is unavailable. Read-only personal-vault status returned `SYNC_CONFIG_NOT_FOUND`; no private vault configuration or notes were changed.
