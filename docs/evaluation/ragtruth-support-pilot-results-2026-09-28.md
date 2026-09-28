# RAGTruth source-support pilot: failed acceptance gate

## Decision

The fresh Luna Max reviewer agreed with the human-derived reference on **16/24 cases (66.7%)**. It did not meet the predeclared >=90% agreement gate. Zero false acceptances alone is insufficient: it rejected eight of the twelve responses with no human-annotated hallucination span. Do not use this judge as the sole authority for a final Graphmory comparison. No retry, relabeling, rubric tuning or default change was performed to improve this score.

This evaluates a support judge, **not Graphmory retrieval or competitor answer quality**. No annotated span does not certify complete support of every assertion; the eight disagreements require investigation rather than automatic assignment of fault to either humans or the model.

## Frozen design and evidence

- [Protocol](ragtruth-support-pilot-protocol-2026-09-28.md) declared 24 good train responses, four per task/span-presence cell, globally distinct sources, one reviewer, strict supplied-context support, >=90% agreement and zero false acceptances.
- [Independent schema audit](ragtruth-schema-audit-2026-09-28.md) checked pinned source-file identity, joins, offsets and escape-aware original-prompt alignment. [Preflight](ragtruth-support-pilot-preflight-2026-09-28.md) records selection and exclusions before outcomes.
- A fresh `gpt-6-luna` / `max` Codex collaboration subagent received only the original-prompt/response packet and instructions. It returned all 24 planned identities, validated syntax/identity and reported no tool limitation. Isolation was instruction-based, not an enforced filesystem boundary.
- [Public manifest](../../eval/ragtruth-support-pilot/manifest-v1.public.json), [unchanged score](../../eval/ragtruth-support-pilot/score-v1.json) and [hash bindings](../../eval/ragtruth-support-pilot/review-binding-v1.json) contain no raw corpus prose. Source-containing packet and reviewer rationales remain local. [Author dataset](https://github.com/ParticleMedia/RAGTruth/tree/1d52a81c9e28e79e252a1945d858eb8dfd975c23) supplies human hallucination spans; this is our binary pilot, not the paper's official detector evaluation.

## Results

Positive class means `sourceSupport=yes` (no annotated hallucination span in the reference).

| Metric | Result | Interpretation |
|---|---:|---|
| Exact agreement / accuracy | 16/24 = 66.7% | Fails the >=90% pilot gate |
| False acceptance | 0/12 | No annotated-unsupported response accepted in this sample |
| No-span reference accepted | 4/12 | Eight no-span responses rejected |
| Positive precision | 100% | Four acceptances all matched the no-span reference |
| Positive recall | 33.3% | Most no-span references were rejected |
| Positive F1 | 50% | Precision alone hides the rejection problem |
| Unclear | 0/24 | No cases dropped or counted as ambiguous |

| Human-derived reference | Judge yes | Judge no | Judge unclear |
|---|---:|---:|---:|
| yes: no spans | 4 | 8 | 0 |
| no: one or more spans | 0 | 12 | 0 |

| Task | Exact agreement | False acceptance |
|---|---:|---:|
| QA | 5/8 | 0/4 |
| Summary | 5/8 | 0/4 |
| Data2txt | 6/8 | 0/4 |

The prior synthetic v2 judge sanity check passed 24/24; this external human-reference sample did not. These are different datasets, so the difference is not a controlled treatment effect. It demonstrates why synthetic success cannot establish general judge reliability.

## Cost, latency and limits

The packet was 81,687 bytes. Dispatch was recorded at 12:44:56 UTC; completion was observed at 12:53:13 UTC, a 497-second observation interval. This includes scheduling and observation time; it is neither model generation time nor Graphmory retrieval latency. Per-call billed tokens, cached tokens and provider cost were unavailable and are not estimated.

The sample is small, train-only and balanced by annotation presence rather than natural prevalence. It contains zero `implicit_true` spans, despite preserving that unsupported-label rule. It excludes truncated responses and incorrect refusals. It cannot certify completeness, citation coverage, abstention quality, production calibration, official benchmark superiority or latency improvement.

## Verification and next action

`npm run check` passed: 324 tests, zero failures/skips, example validation and existing deterministic evals. The actual score CLI verified frozen input/source hashes, all planned identities and six-cell accounting before scoring. The v1 synthetic score bytes remain unchanged with the optional manifest guard. Vault status returned `SYNC_CONFIG_NOT_FOUND`; the real user vault was not modified.

Investigate the eight disagreements without changing this result. Distinguish judge errors, acceptable paraphrase/inference and possible annotation omissions; uncertain semantic disputes need independent human adjudication. Any later rubric or detector change needs a new frozen evaluation rather than a second attempt on this packet. Completeness/citations and matched tool comparisons remain open gates. A separate post-outcome error audit is diagnostic only and cannot replace this score.

[The post-outcome Luna Max audit](ragtruth-support-error-audit-2026-09-28.md) provisionally identifies four possible annotation gaps, two external/unstated-fact cases, one plausible overly strict inference decision and one unresolved case. These are model diagnoses, not independent human adjudication or proof the reference is wrong. The recorded 16/24 score remains unchanged. Continue matched tool evaluation with preserved official deterministic QA metrics; report this uncalibrated support judge separately rather than use it as a sole pass/fail authority.
