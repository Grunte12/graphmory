# Mechanical evidence-state experiment — 2026-09-28

## Decision

**Do not promote this candidate as a quality or efficiency improvement.** All six workflows finish, but the count pair reads all 29 originals in both arms. Added state changes the answer from two letters to a qualified lower bound, not a demonstrated improvement against the reference. The false-premise treatment reads 29 rather than ten originals and uses five rather than three model calls. Each treatment takes longer than its baseline. Keep the option only as experimental evaluation instrumentation; Graphmory production/default prompts and retrieval remain unchanged.

This follows the [native session A/B](native-session-ab-2026-09-28.md), where persistence failed to fix complete-source selection. The prior turn produced a committed, verified experiment and changed the next decision; it was progress, not a wait or status restatement.

## Candidate and safety contract

The new `--evidence-state` option on the live mediator supplies compact deterministic counters: observed candidates, delivered originals, observed candidates without originals, older-page candidates without originals, current partial previews without originals, and whether further candidates exist. `semanticCompleteness` is always `not_assessed`. Counts describe delivery, never relevance, source support or a globally exhaustive search.

A short explanation asks the Curator to distinguish supported totals from partial enumeration, inspect additional applicable evidence when necessary, and avoid unrelated reads just to clear counters. This tests counters plus explanation together, not their separate causal effects. It adds no router/model/server/dependency and does not force all candidates to be read. Finalization is allowed with unread candidates or more pages, e.g. for a supported narrow fact; unsafe paths remain rejected.

## Frozen protocol

Three previously exposed LoCoMo development cases from distinct conversations: `conv-42:62` (letters count), `conv-50:14` (meeting date), `conv-43:185` (false premise about Tim surfing). Same original Markdown bytes and Graphmory managed auto, fresh Luna `gpt-5.6-luna` Curator rounds, fresh Sol `gpt-5.6-sol` Lead, low, structured citations, ten-round/300,000-byte budgets. Neither coverage-preview selection nor persistence is changed. Counterbalanced fixed pair order is recorded before generation. Six planned attempts, no replacement or rerun, no host failures.

- [Frozen manifest](../../eval/reader-pilot/evidence-state-ab-manifest-2026-09-28.json): identities, runtime/module/original hashes, budget, promotion rule and limitations.
- [All six results](../../eval/reader-pilot/evidence-state-ab-results-2026-09-28.json): unchanged answers/briefs, original reads, actual candidate pages, state snapshots, calls/usage.
- [Pinned raw QA scores](../../eval/reader-pilot/evidence-state-ab-raw-scores-2026-09-28.json).
- [Scoring failure record](../../eval/reader-pilot/evidence-state-ab-scoring-failure-2026-09-28.json) and [binding audit](../../eval/reader-pilot/evidence-state-ab-binding-audit-2026-09-28.json).

The input schema contains query, vault and immutable source hashes only; answer labels/gold paths are separate and never passed to models. Only development conversations are rendered. Sealed conversations `conv-41`, `conv-44`, `conv-49` remain unrendered; this is not an independent holdout. Basic Memory is not run in this intervention, so there is no competitor inference.

## Results

| Case | Evidence state | Raw QA | Gold originals read | All originals read | Calls incl. Lead | Whole workflow s | Gross / cached / noncached input |
|---|---|---:|---:|---:|---:|---:|---:|
| Letters | Off | 0 | 2/2 | 29 | 3 | 31.695 | 86,419 / 8,960 / 77,459 |
| Letters | On | 0 | 2/2 | 29 | 3 | 35.764 | 86,700 / 14,080 / 72,620 |
| Meeting date | On | 0.500 | 1/1 | 1 | 3 | 30.435 | 53,475 / 14,080 / 39,395 |
| Meeting date | Off | 0.375 | 1/1 | 1 | 3 | 26.052 | 53,216 / 43,520 / 9,696 |
| Surfing premise | Off | 0 | 1/1 | 10 | 3 | 30.310 | 64,455 / 31,232 / 33,223 |
| Surfing premise | On | 0 | 1/1 | 29 | 5 | 49.026 | 119,123 / 38,400 / 80,723 |

Completion is 3/3 each; all six Lead citation arrays have valid source identities, which does not itself prove semantic coverage. Every gold source is actually read in both arms. Raw mean QA is 0.125 off and 0.1667 on, entirely from date-answer wording; it does not establish improved correctness. Total gross input is 204,090 off versus 259,298 on; total noncached is 120,378 versus 192,738. Cache conditions differ, monetary subscription allocation is unknown, and these are three single-generation pairs. No tail-latency or causal savings claim.

### Source-support review

This is an unblinded author audit, **not independent calibrated supported-complete grading**:

- Both count briefs cite the two gold turns describing separate received letters. The on answer additionally qualifies an unknown total due to unspecified childhood notes. That qualifier is source-supported, but broadens “letters” to “notes” and does not demonstrate better requested-count behavior. Preserve the reference “Two” and emitted digit-based sentences; do not normalize outputs after seeing scores.
- Both date answers correctly identify June 8, 2023 using June 9's “yesterday” statement. Different wording yields different lexical QA scores with the same date/support.
- Both surfing answers decline to give Tim's surfing feelings. The on brief explicitly quotes that Tim does not surf; both distinguish fantasy-reading experience. Neither emitted sentence contains the exact category-5 refusal phrases recognized by the unchanged scorer, so both raw scores remain zero. The extra 19 treatment reads do not establish additional requested-answer benefit.

### Actual state behavior

Count treatment ends with 29 observed and 29 read, no more candidates; semantic completeness remains `not_assessed`. Date treatment correctly finalizes with one original, nine current partial-preview candidates unread and more pages available, demonstrating that the contract does not mandate clearing every counter. The false-premise treatment chooses more pages/reads voluntarily. This is consistent with an attention/overchecking cost, but one stochastic pair cannot prove its mechanism or frequency.

## Failures and repairs preserved

The first offline summary attempt fails with `KeyError: answer`: the prepared category-5 source label has no answer property. No model call is rerun and frozen source labels are unchanged. The summary adapter now binds an unused empty string only for missing category-5 answers; answerable missing references remain errors. The pinned upstream function accesses this key before branching, but category-5 scores depend solely on refusal phrases in the prediction. An actual scorer replay substituting a distinctive sentinel for the empty string produces byte-identical score artifacts for all six unchanged predictions. This is an explicit environment/input adaptation, not a new gold answer or rewritten official function. The four unchanged [upstream QA function bodies](https://github.com/snap-research/locomo/blob/3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376/task_eval/evaluation.py) are used; this is not a full upstream CLI run.

The new paginated deterministic test initially used default bundle mode although its host mock expects paginated auto mode. It fails before the intended assertions; correcting the test configuration to the existing auto/five-round fixture passes. No live treatment/runtime was changed. Preserve this fixture error separately from actual live model outcomes.

## Reproduction and verification

Use the pinned corpus and scorer SHA-256 recorded in artifacts. Prepare a new directory with `node scripts/prepare-evidence-state-ab.mjs --input <corpus> --out <prepared>`, then run `python3 scripts/run-evidence-state-ab.py --prepared <prepared> --out <runs>`. Score with the scorer's Python dependencies via `scripts/summarize-evidence-state-ab.py --prepared <prepared> --runs <runs> --scorer-source <pinned source> --out <new summary>`. Authentic Codex access and the recorded model IDs are required; exact stochastic responses/cache states are not promised.

Controlled tests cover real CLI read-state transitions, real pagination retaining old-page gaps after a rejected guessed path, deduplication, refusal of unseen originals and unknown semantic completeness even after all originals are read. Summary checks reject pending/duplicate/unordered slots, treatment/configuration drift, duplicate/unknown/mutated read hashes and mismatched completion or score identities. Frozen runtime/module hashes match after all six generations. Public artifacts contain no API keys, private machine paths or raw host thread identifiers.

## Next correctness/cost target

Do not add more reminders or require every original by default. Investigate a tool-side source-selection contract that retains speaker/time/negation and exposes applicable evidence within a note while reporting omitted content explicitly. Compare its real original-read behavior against full reads on count, scope/negation, update/conflict and missing-evidence cases. Freeze candidate/metrics before generation; retain a clean source-family holdout and require calibrated independent support review before promotion. Reuse official scores unchanged alongside semantic completeness. The goal's independent quality/comparator/host/efficiency gates remain open.

Final verification: `npm run check` passes 301/301 tests and all configured deterministic gates; diff formatting passes. User-vault status remains `SYNC_CONFIG_NOT_FOUND`; no user-vault writes. Disposable rendered benchmark vaults, raw model traces, scorer inputs and logs are cleaned after sanitized results are preserved. Shared corpus/scorer/dependency caches are retained.
