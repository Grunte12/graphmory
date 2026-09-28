# Precise component rubric: new-control reviewer calibration

## Frozen protocol

Baseline `bc93955`. Preserve v1 results. Freeze rubric v2 and 24 **new** shuffled synthetic answers (12 families) before one fresh Luna low review. Values, people, entities and evidence text differ from v1. This is a new development control set after learning from v1, not an independent product/benchmark holdout. No treatment, expected label, reference or score is shown to reviewer.

Define completeness as correctly covering requested facts, source support over all factual assertions including extra claims, and citation coverage as actual supporting text in cited paths. A true partial answer can have support/citations but fail completeness. Correct requested facts with an unsupported extra claim can pass completeness while failing support/citations. Freeze primary exact agreement >=90%, **every dimension** agreement >=90%, and zero false acceptance. These are project sanity gates, not paper-recommended guarantees. No retry, post-result label change or same-case rubric tuning.

## Result

One actual fresh Luna review returned 24/24 identities. The repository scorer accepted its JSON and accounting without repair. The reviewer reported an unavailable `python` command during its own JSON check; this tooling limitation did not prevent file output or the actual repository validator. Preserve that disclosure; no second model review or response repair occurred.

| Metric | Result |
|---|---:|
| Primary exact agreement | 24/24 (100%) |
| Source support | 24/24 (100%) |
| Factual completeness | 24/24 (100%) |
| Supporting citation coverage | 24/24 (100%) |
| Positive precision / recall / F1 | 1 / 1 / 1 |
| False acceptance | 0/12 |
| Unclear primary verdicts | 0/24 |

All predeclared **synthetic sanity** gates pass. The nuanced controls distinguish correctly cited partial facts, incorrect requested values, correct requested facts plus an unsupported extra, and a correct answer with a wrong citation. This verifies that the revised definitions can be applied consistently on these controls. Because v1 and v2 use different sources and cases, do not claim a causal 60%-to-100% improvement or general calibration.

## Evidence and limitations

Artifacts: [rubric](../../eval/judge-calibration/rubric-v2.md), [packet](../../eval/judge-calibration/packet-v2.json), [author labels and gate](../../eval/judge-calibration/labels-v2.json), [manifest](../../eval/judge-calibration/manifest-v2.json), [unaltered review](../../eval/judge-calibration/review-v2.json), [score](../../eval/judge-calibration/score-v2.json), [hash bindings](../../eval/judge-calibration/review-binding-v2.json).

Original packet/rubric/label hashes match the frozen manifest. Exact replay reproduces score bytes. Reviewer isolation relies on explicit instructions and its report of reading only the packet; collaboration did not expose an audited file-access trace or token billing. This is not mechanically enforced blindness. Author-constructed controls are not human-annotated real-data gold, and this small sample cannot estimate broad false-acceptance rates, complex conversational interpretation or correctness under prompt injection. It does not satisfy final independent semantic acceptance.

Extend the scorer to match v1/v2 protocol identities and enforce the v2 per-dimension gate. Regression verifies perfect aggregate decisions still fail when citation agreement is below 90%, malformed primary labels/protocol mismatch are refused, and the original v1 score is unchanged. Full repository check: 316/316 tests and configured deterministic gates pass. Vault status remains `SYNC_CONFIG_NOT_FOUND`; no user-vault content changed.

Next investigate an externally human-annotated source-support dataset before using automatic support grading as final benchmark evidence. Completeness and citation calibration need separate provenance/limitations; a hallucination-only dataset cannot validate every dimension. Defaults and official scores remain unchanged, and sealed histories remain untouched. Goal active.
