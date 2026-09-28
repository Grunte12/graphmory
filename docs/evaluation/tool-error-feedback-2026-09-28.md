# Recoverable tool-error feedback — 2026-09-28

## Trigger and contract

The [targeted live diagnostic](idempotent-targeted-live-2026-09-28.md) stopped when Curator guessed future-page filenames while requesting continuation. No unseen original was read. A terminal mediator error prevented the model from correcting a benign request, unlike a tool returning an error response to its caller.

The development mediator now records `curator-paging-development-v4-tool-error-feedback`. It rejects an entire request containing unobserved relative paths before executing any read or continuation, records `sourceRequestErrors`, then returns `UNSEEN_SOURCE_PATH` feedback for the next Curator turn. If more pages exist, feedback asks for continuation with an empty path list before choosing new paths; if exhausted, it asks for supplied paths or an honest missing-evidence statement. The original round and prompt-byte budgets still apply. Absolute/traversal/backslash/NUL/malformed paths remain terminal boundary errors. Source/hash/citation/session failures remain terminal.

This is a reader-mediator change. It does not improve production retrieval scores by itself or prove semantic correctness. Rejected requests remain visible even if a subsequent workflow finishes.

## Controlled experiment

The fake Codex host chooses deterministic responses; Graphmory CLI retrieval, pagination and original-source reads are real. The [four final controlled reports](../../eval/reader-pilot/tool-error-feedback-controlled-2026-09-28.json) explicitly mark model names and token usage as mocked. The [initial reports](../../eval/reader-pilot/tool-error-feedback-controlled-initial-2026-09-28.json) remain separate. Final tests also verify exhaustion-aware feedback; no real model calls were made.

| Scenario | Outcome | Actual original reads |
|---|---|---:|
| Unseen name, then corrected supplied name | Rejection recorded, workflow finishes | 1 known note |
| Known plus unseen mixed request | Entire mixed request rejected, then finishes using prior original | 1 total |
| Repeated unseen requests | Three rejections, `round-budget`, no answer | 0 |
| Future-page name, observe next page, then read | Rejection, real offsets 0 → 10, verified source/citation, finishes | 1 newly observed note |

The future-page fixture has 21 Markdown notes with distinct headings. An initial fixture with identical headings legitimately triggered adaptive wide mode and delivered every path on page one; it could not test an unseen next-page request. That failed fixture setup was corrected by giving headings distinct names. Production routing was not modified for this test.

A mediator extracted from commit `eb0625e` fails both recovery regression tests because it treats unseen requests as terminal. Current focused mediation tests pass 12/12, including unsafe-path refusal, duplicate-read handling, exhausted pagination, source provenance and resumed-session checks. Synthetic host decisions cannot establish that Luna will autonomously recover.

## Reproduction

```sh
node --test test/curator-paging-pilot.test.mjs
READER_FIXTURE_REPORT_DIR=/tmp/new-fixture-reports node --test --test-name-pattern='unseen paths return|future-page request' test/curator-paging-pilot.test.mjs
```

The report directory must be fresh: the test capture refuses to overwrite a previous fixture report. For the negative baseline, place the `eb0625e` mediator in an isolated temporary `scripts/` directory with a link to the current CLI, then pass its path through the test-only `READER_PILOT_RUNNER` variable. Captured fixtures are synthetic; private live traces are not republished or rewritten.

## Verification and next gate

`npm run check` passed 292/292 tests, example validation and configured deterministic gates; diff formatting passed. A scoring replay preserved every prior targeted live row, failure and official score, with only an empty new error array added for historical reports. Obsidian status remains `SYNC_CONFIG_NOT_FOUND`; the user vault was untouched.

The last host quota snapshot was 89% of the five-hour window used. Additional live generation was deferred; no quota failure or synthetic result was substituted for a live trial. Next freeze a matched live protocol using this contract and account for corrections, rounds, cache, latency and failures. Independently adjudicate supported-complete answers before opening holdout or making matched competitor claims. All those acceptance gates remain open; the persistent goal is active.
