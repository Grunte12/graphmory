# Historical lifecycle recall — 2026-09-28

## Finding and change

Code inspection found that managed retrieval always excludes `superseded` notes. That protects current-memory lookups but makes an explicitly requested prior state unreachable after the old canonical note is superseded. Ordinary recall's broad `--include-noncanonical` option also admits other excluded lifecycle states, and managed recall did not expose it. A narrower curator-only `--include-superseded` option now admits superseded notes while preserving the existing exclusion of raw, stale, archived, and deprecated notes. It leaves the default untouched. It returns original lifecycle labels and `historicalCandidatesIncluded: true`; neither inclusion nor ranking asserts historical truth.

No automatic query classifier was introduced. The documented Curator selects this option only for an explicit prior-state request, reads originals, and compares attribution, scope and dates. Host setup instructions, the installed curator skill, OpenCode guidance, CLI help, and the managed retrieval guide describe this option. Existing host agent files were not overwritten. Decision workflows reject the option before invoking a provider.

## Frozen controlled experiment

The [manifest](../../eval/reader-pilot/historical-recall-manifest-2026-09-28.json) froze the runner and runtime hashes before the experiment. The [artifact](../../eval/reader-pilot/historical-recall-development-2026-09-28.json) contains all 24 planned CLI trials, with unique case/type/arm keys, query hashes, delivered paths/statuses, continuation state, stdout bytes, and single-pass times.

Six synthetic vaults cross three Markdown layouts (atomic, role-based conversation, nested decision) with scoped/global retrieval. Each contains an active March PostgreSQL policy, superseded January SQLite policy, same-topic raw/stale/archived/deprecated distractors, a noncanonical index linking the prior policy, and an outside-scope distractor. Both arms ask current and prior questions using actual `recall-managed --auto --agent`; the treatment adds the history flag only for prior questions. They share the same current working-tree runtime. Thus this isolates explicit lifecycle inclusion, not a full old-commit versus new-commit comparison.

| Mechanical result | Existing flag policy | Explicit history policy |
|---|---:|---:|
| Current required path reachable | 6/6 | 6/6 |
| Prior required path reachable | 0/6 | 6/6 |
| Unsafe lifecycle, navigation, scope or mutation failures | 0/12 | 0/12 |

All six current-state pairs have identical ordered paths and status labels. Source contents remain unchanged in all 24 trials. Reported runner/runtime hashes match the pre-run manifest. These meet the declared mechanical gates.

Two regression tests additionally verify cache isolation when current/history/current queries reuse the same documents; actual CLI pagination over 13 eligible notes; status preservation, scope and navigation exclusion; and rejection in all three decision workflows before provider access. The tested current default remains unchanged.

## Evidence limits and decision

Ship the explicit option as a mechanical correctness capability, without enabling it by default. The evaluator supplied the flag policy; autonomous Curator selection and supported-complete answers remain unmeasured. These are synthetic trials, not official LoCoMo/LongMemEval scores or independent competitor comparisons. No live model calls, benchmark holdout inspection, source summarization, or private vault modification occurred. Single-pass timing is recorded for transparency and does not establish latency/cost improvement.

The separate yoga update failure happened in unsuperseded conversation histories, so this feature does not resolve that reader interpretation failure. The next answer-level test must include prior-state requests on superseded notes alongside current-state, ambiguous-order, and scope-conflict controls. Preserve failures and independent semantic support review before claiming a quality gain.

## Reproduce

```sh
node --test test/historical-recall.test.mjs
node scripts/eval-historical-recall.mjs --out /new/report.json
```

The experiment removed its generated temporary vaults after recording the sanitized result. `npm run check` passed 295/295 tests, example validation and configured deterministic gates. `git diff --check` passed. The required `brain-sync status --vault <private vault>` returned `SYNC_CONFIG_NOT_FOUND`; the user's vault was not modified.

Package verification first failed with `EPERM` at the user's npm cache; no ownership or global configuration was changed. Retrying with a disposable cache succeeded. The initial report parser assumed an array, whereas this npm version returned an object keyed by package name; the corrected parser verified 95 shipped files, the runtime module included, and this development evaluator, reader artifacts and tests excluded. This is a package-content check, not an authenticated host installation.
