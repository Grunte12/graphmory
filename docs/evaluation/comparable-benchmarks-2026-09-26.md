# Comparable benchmarks and retrieval simplification — 2026-09-26

## Claim we can currently support

On a fixed internal acceptance sample from LongMemEval-S cleaned, the single governed BM25 lane finds all evidence sessions in its first three results on 49/60 answerable cases, versus 39/60 for Graphmory's existing two-lane fusion. This is **retrieval completeness**, not answer accuracy or superiority over other products. Ten abstention cases are reported separately. The choice was made on a disjoint question-family development split before opening acceptance.

| Acceptance measure | Existing fusion | Governed BM25 |
| --- | ---: | ---: |
| Complete evidence@3 | 39/60 (65.0%) | 49/60 (81.7%) |
| Complete evidence@12 | 54/60 (90.0%) | 55/60 (91.7%) |
| Mean evidence recall@3 | 76.2% | 87.9% |
| Mean evidence recall@12 | 93.3% | 93.6% |

Paired complete@3: 11 wins, 1 loss, 48 ties; difference +16.7 percentage points. A 10,000-resample question-family bootstrap gives a conditional 95% interval of +6.7 to +28.3 points. This interval does not account for all cross-question history overlap or dataset-selection uncertainty. All evidence sessions in the first three results are required; a hit on just one does not pass.

Development had 68 cases (58 answerable); acceptance 70 (60 answerable). The proposed three-lane variant failed development and was rejected before acceptance. The winning simplification adds no models or dependencies. It is available as **Conversation histories** in `graphmory config` for managed recall, or `recall-loop --methods bm25`. Mixed project notes keep the existing default: the evidence here is about raw conversation histories. Managed recall can use a smaller shortlist than the eval's 12; its downstream model/answer quality still requires separate evaluation.

Precommit protocol: `eval/longmemeval/experiment-v2.md`. Data revision, source hashes, selected IDs, per-case results and implementation hashes are in `development-v2.json`, `acceptance-v2.json`, and `comparison-v2.json` under `eval/longmemeval/`. Public data was used; personal vault contents were not.

## External comparisons: what can and cannot be claimed

| Source | Useful comparison path | Current status / caveat |
| --- | --- | --- |
| [LongMemEval official implementation](https://github.com/xiaowu0162/LongMemEval) | Same histories, reader prompt, reader model and native answer judge | Retrieval adapter and input exporter implemented; answer generation and official judging not run. |
| [ProsusAI MemEval](https://github.com/ProsusAI/MemEval) | Multi-system harness intended to standardize models, embeddings and scoring | Candidate harness, not run. README's LME table uses 102 sampled questions, not our acceptance subset. Reproduce exact IDs/config or rerun all arms together. |
| [Mem0 memory-benchmarks](https://github.com/mem0ai/memory-benchmarks) | Public ingest/search/answer evaluation pipeline | Not run. Distinguish managed platform from OSS; do not label an OSS reproduction as a test of cloud. |
| [Graphiti](https://github.com/getzep/graphiti) / [Zep paper](https://arxiv.org/abs/2501.13956) | Explicit version and backend in the same harness | Not run. Graphiti OSS and Zep commercial service are distinct treatments. |

[MemDelta](https://arxiv.org/abs/2606.29914) studies how changing models/embeddings can change memory-system comparisons. This motivates controls; it is not proof of any Graphmory gain. Scores from papers/READMEs stay in a separate literature table, never mixed with our reproduced results.

A claim against any named tool requires: pinned code/service/model versions; identical dataset bytes and selected IDs; equal reader/judge, history visibility, output/context budget and question-time policy; explicit ingest/query costs; fresh state; repeated live trials; missing-response accounting; and paired quality uncertainty. Run both a controlled equal-component comparison and, if useful, a separate best-supported-configuration comparison. Proprietary or unavailable systems must be marked not tested. “Better than all tools” is not supported.

## Reproduce retrieval experiments

After the revision-pinned dataset download in `eval/longmemeval/README.md`:

```sh
node scripts/eval-longmemeval.mjs --input tmp/datasets/longmemeval_s_cleaned.json --revision 98d7416c24c778c2fee6e6f3006e7a073259d48f --split dev --per-category 10 --arms bm25,baseline,multigranularity --out tmp/development-v2.json
node scripts/eval-longmemeval.mjs --input tmp/datasets/longmemeval_s_cleaned.json --revision 98d7416c24c778c2fee6e6f3006e7a073259d48f --split acceptance --per-category 10 --arms bm25,baseline --out tmp/acceptance-v2.json
node scripts/compare-memory-eval.mjs tmp/acceptance-v2.json bm25 baseline tmp/comparison-v2.json
```

The committed original pilot IDs form part of the family-split definition. Preserve that file when reproducing v2. Once this acceptance set informs further optimization it becomes development evidence; use a fresh holdout for a new promotion decision. Single-pass timing is not a speed claim. Both arms use Graphmory's governance; the BM25 control is not an independent reimplementation of a competitor.

## Official reader interoperability

```sh
node scripts/export-longmemeval.mjs tmp/datasets/longmemeval_s_cleaned.json eval/longmemeval/acceptance-v2.json bm25 tmp/bm25-generation.jsonl
node scripts/export-longmemeval.mjs tmp/datasets/longmemeval_s_cleaned.json eval/longmemeval/acceptance-v2.json baseline tmp/fusion-generation.jsonl
```

Outputs are created exclusively (no silent overwrite), mode 0600, and contain public history/query text, opaque session paths and ranked items. Gold answers are blank and `has_answer` is removed. Original gold remains in the evaluator's separate source file. The exporter verifies dataset byte hash and rejects invented/duplicate retrieval paths.

Validated against `prepare_prompt` in official `src/generation/run_generation.py`, commit `9e0b455f4ef0e2ab8f2e582289761153549043fc`: all 70 exported cases render with `flat-session`, JSON history, both roles, no CoT, no expansion. This check used a tokenizer stub and made no model calls; it verifies schema/prompt rendering only, not the tokenizer, token budget or final accuracy. Opaque occurrence-specific IDs preserve duplicate upstream session occurrences instead of letting a map overwrite them; disclose that adaptation for strict reproductions.

For a live comparison, pin identical reader settings and a real tokenizer, then feed the resulting `{question_id, hypothesis}` JSONL to the official `evaluate_qa.py` using original answers. Audit missing responses: upstream generation can continue after request errors, so count every requested ID rather than scoring only successes. The pinned upstream CLI prints its argument namespace including its API-key argument; use a reviewed environment-based wrapper/redacted logging before a real-key run. No model keys were printed or passed in this experiment.

A compatible model API credential and agreed inference budget are still required for live reader/judge and competitor runs. Coding-agent subscription results, if used instead, must be reported as a separate same-host experiment and cannot inherit published API benchmark claims.
