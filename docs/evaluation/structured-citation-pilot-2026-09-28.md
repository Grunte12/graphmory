# Structured Lead citation pilot — 2026-09-28

## Intervention

The [previous multi-session run](longmemeval-multisession-live-2026-09-28.md) answered correctly but dropped the Curator's two citations. An opt-in `--structured-citations` evaluator mode now requires Lead output `{answer, citations}`. The mediator rejects duplicated paths and paths that were not both actually read and present in the Curator brief. Empty citations remain allowed for insufficient/abstaining answers; this check alone cannot distinguish an uncited factual answer from valid abstention. Path membership is provenance validation, **not semantic entailment**. No citations are silently attached by the runner.

## Actual run

The same exposed LongMemEval development case `67e0d0f2`, pinned source dataset, 52-session vault, Luna low-reasoning configuration, actual Graphmory CLI and four-round Curator budget were rerun. The reader input excludes gold labels. [Run artifact](../../eval/reader-pilot/longmemeval-multi-structured-citations-2026-09-28.json) preserves the full diagnostic record.

Lead answered “20 online courses” and returned both `sessions/0038-e070111f44b2.md` and `sessions/0007-730ea6f80239.md` in `citations`. Both were read and explicitly cited by the brief; manual inspection in the preceding report supports the 12+8 arithmetic. Citation provenance validation passed. This is not blinded support adjudication or an official benchmark QA score.

The run completed four calls, three original reads (56,910 bytes), 93,940 host input tokens including 32,000 cached, and 27.565 s. The prior run used five calls, eleven reads and 42.675 s. **Do not attribute this timing/token difference to the schema:** the Curator made different source-selection decisions before Lead saw the intervention, run order was not counterbalanced, and cache state differs. One repeated exposed case is not an efficiency estimate.

## Verification and decision

`npm run check` passed 284/284 tests and configured gates. A fake-host regression accepts a verified brief citation and rejects an unread citation without marking the workflow complete. The Obsidian status check returned `SYNC_CONFIG_NOT_FOUND`; user vault content was unchanged. Keep the new mode experimental. Next evaluate missing/empty, irrelevant-but-read and fabricated citations separately, then compare independently scored answer support across diverse cases before changing host adapters or production defaults.
