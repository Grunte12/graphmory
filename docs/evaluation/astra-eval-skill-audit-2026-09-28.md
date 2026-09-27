# Astra evaluation audit — 2026-09-28

## Conclusion and scope

Graphmory's pinned LoCoMo development retrieval result reproduces exactly. It does **not yet demonstrate standard-benchmark answer correctness**. Complete multi-session evidence remains much weaker than aggregate recall, and existing live synthetic answers demonstrate unsupported relationships despite containing all required facts. An inexpensive counterexample also exposes false passes and incomplete coverage in the older write-side evaluator.

Applied the repository-installed `eval-audit`, `evaluate-rag`, and `validate-evaluator` instructions from [ai-evals-course/evals-skills](https://github.com/ai-evals-course/evals-skills/tree/80d5f7b0127c7572ed9e9339937adbfd7240ffeb), commit `80d5f7b0127c7572ed9e9339937adbfd7240ffeb`. These are workflow guidance, not scientific authority. Numerical sample-size and judge-threshold suggestions are heuristics. In particular, the RAG skill's assumption that a reader can ignore irrelevant content is contradicted by the local scope errors below. Its suggested k values do not justify a product cap, and its criticism of overlap metrics does not justify replacing official benchmark metrics.

This audit changed no product code, called no paid model, and transmitted no private vault content. LoCoMo development conversation content alone was inspected; the original script necessarily reads and hashes the full source JSON, but holdout conversations were not evaluated or inspected. LongMemEval review used adapter code, tests, and existing derived reports, without opening conversation content. Existing acceptance aggregate results have already been exposed in prior work and cannot serve as a fresh future holdout.

## Reproduction and observed results

From the repository root:

```sh
node scripts/eval-locomo.mjs --input /private/tmp/graphmory-locomo10.json --out tmp/astra-locomo-audit-2026-09-28.json --revision 3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376
node --test test/locomo.test.mjs test/longmemeval.test.mjs
npm test
```

Results: **6/6 targeted tests and 271/271 full tests passed** before the lead agent's subsequent scorer repair. Parsed JSON deep equality with `eval/locomo/development-v1.json` is true, including all **2,198 case/arm rows**, summaries, exclusions and runtime hashes. Source SHA-256: `79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4`.

The seven development conversations supply 1,439 questions. Scored: 1,099 per arm. Excluded: 330 category-5 adversarial questions, six unresolved gold-turn cases, and four cases without evidence. These are explicit exclusions, not successes. Three conversation holdouts remain unopened by this audit.

| Development diagnostic | BM25 | Fusion |
| --- | ---: | ---: |
| Mean distinct-gold-session recall@5 | 84.80% | 85.72% |
| Complete evidence@5 | 878/1,099 | 886/1,099 |
| Complete evidence@10 | 962/1,099 | 978/1,099 |
| Complete evidence@20 | 1,051/1,099 | 1,050/1,099 |
| Category-1 complete@5 | 49/180 | 53/180 |
| Category-1 complete@20 | 149/180 | 146/180 |
| Multiple-gold-session complete@5 | 62/209 | 65/209 |
| Multiple-gold-session complete@20 | 171/209 | 168/209 |
| Complete evidence anywhere in ranked list | 1,099/1,099 | 1,099/1,099 |

Saved sanitized results: [astra-eval-skill-audit-2026-09-28.json](astra-eval-skill-audit-2026-09-28.json). Raw rerun remains in ignored `tmp/astra-locomo-audit-2026-09-28.json`; no source conversations are included in these reports. The full ranked-list score establishes reachability only, not successful stopping, sufficient excerpts, reader accuracy, or affordable context size.

## Findings ordered by impact

### P1 — Evaluator design: wrong write actions can pass and coverage is not enforced

**Status: problem reproduced in the pre-repair scorer.** `scripts/eval-live-agent-score.mjs` assigns only 30% of its score to action correctness, then passes every total of at least 70. A zero-action-correctness response with other fields filled can pass. It iterates supplied outputs and uses their count as its denominator, allowing duplicates and silently omitting missing incidents.

The actual C pilot's `hot-context-entry` returned `block` where `hot-context-candidate` was expected and scored 63. A controlled counterexample using the existing `ui-visual-owner-after-build-pass` fixture demonstrates the boundary at which the same wrong-action class passes:

```sh
python3 - <<'PY'
import json
from pathlib import Path
incidents = json.loads(Path('eval/live-agent/incidents.json').read_text())
i = next(x for x in incidents if x['id'] == 'ui-visual-owner-after-build-pass')
p = Path('tmp/astra-scorer-probe'); p.mkdir(exist_ok=True)
x = dict(incident_id=i['id'], action='block', confidence='high',
         claim='No action taken.', evidence_paths=i['evidence'],
         status='current', revalidate_when=['next review'])
(p/'curator-output.json').write_text(json.dumps([x, x]))
PY
node scripts/eval-live-agent-score.mjs --run-dir tmp/astra-scorer-probe --json
```

Observed before repair: **100% pass, two scored entries, average 70**, while both are the same wrong decision and the other expected write incidents are absent. Original output is retained in `tmp/astra-scorer-probe/result.txt`.

**Fix/criterion:** retain descriptive component scores but require acceptable action semantics for a pass; reject duplicate/unknown IDs and account for all expected write incidents, marking missing outputs failed/incomplete. Add counterexample tests before rescoring the pilot. The lead agent owns the repair; this report records the original observation, not the post-repair state.

Two additional limitations need explicit naming: `scoreScope` measures citation count, not topic correctness; the pre-repair `scoreProvenance` uses substring path overlap, not evidence entailment. The repair below changes matching to exact case-normalized identifiers, which still does not prove entailment. `scoreNoFabrication` checks length/confidence/empty paths and cannot certify a claim is true. Do not call those heuristic component scores semantic scope, provenance verification, or absence of fabrication. Binary critical-failure checks should not be compensated by unrelated metadata.

### P1 — Error analysis: true facts and citations can still produce an incorrect answer

**Status: observed in live model outputs on synthetic fixtures.** Inspected `eval/competitor-pilot/preview-state-live.json` against the source fixtures in `scripts/eval-codex-preview-state.py`. In `long/new/repeat=0`, the answer adds a recovery deadline of October 12 and deployment approval/Friday restrictions. The relevant fixture only states a project deadline; separate policy text concerns deployment. Neither entails that those constraints govern recovery.

Both arms and both repeats fail this recovery question despite all required fact/path screens passing. Across all 32 rows, the artifact records 32/32 required-fact and source-path passes, but only **25/32 strict supported answers** (old 12/16; new 13/16). These are eight unique synthetic questions, not 32 independent examples or standard-benchmark answers. The visible source text supports the recorded scope failure. Citation presence alone cannot detect it.

**Fix/criterion:** judge each asserted relation, scope, negation and time qualifier against the actually delivered evidence. An unsupported added requirement fails strict support even when core facts are present. Keep this minimal observed taxonomy: incomplete evidence; incorrect scope/relationship; wrong action; unsupported assertion; failed abstention. Do not add a large generic quality rubric before more traces justify it.

### P1 — Error analysis: complete multi-hop evidence is substantially worse than average recall

**Status: reproduced and inspected against development gold turns.** Fusion complete@5 is 53/180 (29.4%) on category 1, despite overall mean recall@5 of 85.7%. Even at 20 results, 34/180 category-1 questions lack at least one annotated evidence session. All 209 cases requiring multiple sessions are a separate useful slice; only 65/209 are complete at five.

Concrete development traces, with ranks independently checked against raw development evidence:

| Case | Observed missing evidence | Interpretation |
| --- | --- | --- |
| `conv-43:21`, category 1 | City-visit question needs sessions 3, 6, 9; fusion ranks them 1, 26, 10 | Chicago evidence is absent at 20; partial city lists cannot count as complete answers. |
| `conv-43:20`, category 2 | Temporal city-order question needs sessions 3, 5, 6; ranks 5, 15, 2 | The connecting event is outside ten results even when city names are retrieved. |
| `conv-50:140`, category 4 | Shared-attitude question's gold session 26 ranks 27 | Broad paraphrase can miss even a single annotated evidence session. |

These are verified retrieval failures relative to annotated evidence, not measured reader failures. Redundant support elsewhere could sometimes answer a question; the next reader trace must establish that rather than assuming it.

**Fix/criterion:** prioritize complete evidence and inspect actual delivered excerpts before choosing retrieval changes. Measure continuation through later pages and the point at which the reader stops. k=3/5/10/20 are diagnostics, never fixed total retrieval caps. No automatic chunk-size grid search or new runtime lane is warranted from this audit alone.

### P2 — Evaluator design: benchmark-compatible answer evaluation is still missing

**Status: gap confirmed.** The LoCoMo script scores deduplicated session sets, not generated answers. Its average differs even from upstream session-context recall, which weights annotated evidence turns: audited BM25 recall@5 is 84.802% by distinct sessions versus 84.880% by gold turns; fusion is 85.723% versus 85.817%.

The [pinned official LoCoMo evaluator](https://github.com/snap-research/locomo/blob/3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376/task_eval/evaluation.py) computes category-specific answer overlap, with separate multi-answer handling and an adversarial response check. Preserve those official outputs for comparability and add supported-answer/abstention diagnostics alongside them. Do not rename custom session recall as official QA F1 or accuracy.

Existing LongMemEval development reports contain 58 answerable and ten abstention cases: BM25 complete@3 44/58 and complete@12 52/58; fusion 34/58 and 50/58. These were inspected, not rerun here. All ten abstention questions returning candidates establish neither false answers nor successful abstention. The [official LongMemEval evaluator](https://github.com/xiaowu0162/LongMemEval/blob/main/src/evaluation/evaluate_qa.py) uses category-aware yes/no answer grading. Pin its code revision before execution; the link inspected here is mutable `main`.

**Fix/criterion:** run a frozen reader using isolated question/history inputs; retain raw answers and delivered context; produce official benchmark scores plus a separate strict-support audit. Include adversarial/abstention questions even when retrieval gold is empty. Missing retrieval labels need not make answer grading impossible. Preserve unscorable reasons and counts rather than silently dropping cases.

### P2 — Judge validation, human review and labeled data: semantic grade reliability is unknown

**Status: cannot determine calibrated reliability.** The recent preview study explicitly records author manual, unblinded grading. The older pilot contains model metadata and decisions but no independently calibrated semantic-label confusion matrix. Its exact model provenance cannot be independently authenticated from the inspected metadata. Deterministic synthetic expected outputs in `eval/memory-management-ab/answers.json` are not independent expert annotations of generated benchmark answers.

**Fix/criterion:** use the smallest reviewable trace table first: question, actual context and tool requests, answer, gold reference, criterion verdict and short cited rationale. Have a knowledgeable human independently adjudicate a stratified development sample, including random passes, observed failures, multi-hop, temporal and abstention cases. Keep labels used to design a judge separate from labels used to measure it. Report false-pass/false-fail counts, TPR/TNR with uncertainty when both classes exist, and category disagreements. No human labels were created or claimed in this audit, so calibration and judge-based correctness remain blocked on that evidence. Do not mechanically apply the skill's numerical thresholds or bias correction across changed categories or distributions.

### P2 — Pipeline hygiene: useful isolation exists, but generalization and execution boundaries remain limited

**Status: partly OK, limitations remain.** LoCoMo checks exact source revision/hash, splits by conversation before processing questions, excludes gold answers and generated summaries from retrieval, and records implementation hashes. LongMemEval strips `has_answer` and preserves verbatim text/timestamps; six targeted tests verify important adaptation and export boundaries. These are substantial reproducibility safeguards.

LongMemEval's revision argument alone does not authenticate the file. Its source SHA-256 and pinned source URL must accompany a run. The known 76 cases with future timestamps are an explicit alternative temporal-policy experiment, not grounds to silently trim history and claim official improvement. Duplicate source IDs are grouped as session alternatives, not verified turn-equivalent evidence. Its family split does not rule out shared conversation material between families. Both datasets are public; model pretraining contamination cannot be excluded.

**Fix/criterion:** freeze code, data, prompt, model version, context budget and selection manifest together. For live evaluation, prevent reader access to evaluator/source-label files; object-level field omission is not a filesystem sandbox. Preserve original history for the standard track, label temporal adaptations separately, and report category denominators. Treat development tuning and previously opened acceptance results as development evidence for subsequent choices. Do not infer significance from thousands of questions as though they were independent when LoCoMo contains seven evaluated conversation clusters.

## Minimum next answer-evaluation protocol

1. Repair and regression-test the proven write scorer defects, then refresh affected historical scores with a clear scorer version. This is independent of retrieval tuning.
2. Freeze a small development reader pilot using the existing deterministic manifests. Include representative random cases plus the three observed retrieval failures and abstention/adversarial cases. Diagnostic sampling must not be presented as an overall benchmark score.
3. Use the same reader, source rendering, question/date, total context budget and continuation policy for each compared retrieval arm. Allow additional pages when evidence is incomplete. Log all actual evidence delivered, offsets, stop reason, final answer, model snapshot, calls and tokens. Keep gold evaluator-only.
4. Compute official LoCoMo answer metrics unchanged; run the pinned official LongMemEval answer protocol when an authorized reader/judge is available. Report categories separately. Add strict completeness, supported relationships, contradiction/negation, citations and abstention decisions without replacing the official metric.
5. Review failed and sampled passing traces independently, distinguish retrieval from reader errors, and calibrate any semantic judge against human labels. Automated deterministic checks should cover IDs, coverage, duplicates, schema and known artifact invariants.
6. Only after the protocol is frozen, open the three LoCoMo holdout conversations once for a final evaluation. Report conversation-level uncertainty and the small number of independent groups. LongMemEval needs fresh untouched evaluation cases for further tuning claims because existing acceptance results have already been seen.

No new reader-answer generation or model judging was run in this artifact audit. Standard answer accuracy, semantic judge calibration, and production-user generalization therefore remain unmeasured. The next useful evidence is a small, fully traceable answer evaluation, not another large synthetic score dashboard.


## Post-repair verification in the same audit session

The lead agent repaired `scripts/eval-live-agent-score.mjs` after receiving the reproduced defect. I independently inspected that diff and reran the **unchanged duplicate probe** above:

```sh
node scripts/eval-live-agent-score.mjs --run-dir tmp/astra-scorer-probe --json > tmp/astra-scorer-probe/result-after-repair.txt
node --test test/live-agent-score.test.mjs
```

Verified result: protocol `write-decision-v2-complete-denominator`; **0/11 pass**, ten missing write incidents, one duplicate incident, `runComplete: false`. The one recall incident is explicitly excluded. All **12/12 scorer tests pass**, including a wrong action with 70 diagnostic points that now fails, complete valid 11/11 coverage, duplicate and missing outputs, invalid extra outputs, inexact provenance identifiers, and a detected leak with 90 diagnostic points that now fails.

The repair enforces expected-incident coverage, action correctness (including explicit supersession metadata for the composite action), detected leakage/fabrication gates, and exact case-normalized provenance matching. It closes the reproduced false-pass and denominator defects. The original probe output is retained separately from the repaired output so this report's before/after claim is checkable.

`passRate` remains a per-expected-incident diagnostic when `runComplete` is false. An otherwise fully passing run with unknown/malformed extra entries can retain `passRate: 1` while correctly setting `runComplete: false`; **that run is invalid and must not be reported as a valid 100% benchmark result**. Reviewers must check completion/validity before interpreting scores. At this review point the human stdout summary did not print validity, so I requested that the lead agent expose validity and missing/duplicate/invalid counts there as well.

This repair does not establish semantic truth, topic scope, calibrated judge reliability, or standard-benchmark answer accuracy. The remaining audit findings and next answer-evaluation protocol still apply. Historical pilot scores need their protocol/version recorded when rescored.
