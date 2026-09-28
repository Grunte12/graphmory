# Targeted live read-contract follow-up — 2026-09-28

## Frozen setup

[Manifest](../../eval/reader-pilot/idempotent-targeted-manifest-2026-09-28.json) was saved before generation. It targets the two previously stopped workflows from the exposed five-pair A/B: `conv-47:52` with existing previews and `conv-48:36` with coverage previews. The initial five-case preparation is preserved privately; the target manifest selects original case indexes 1 and 2, records the parent preparation hash, changes protocol to `locomo-idempotent-targeted-development-v1`, and predeclares exactly two attempts. Labels remain separate; no holdout conversation was rendered.

Same Luna `gpt-5.6-luna` Curator and Sol `gpt-5.6-sol` Lead, low reasoning, fresh host calls, ten-round / 300,000-prompt-byte budgets and structured citations. The mediator now has the citation-identity repair, explicit already-read path state and idempotent originals. These changes and cache/model variation prevent a single-variable causal comparison with the earlier failures.

## Results

[Sanitized artifact](../../eval/reader-pilot/idempotent-targeted-live-2026-09-28.json).

| Case | Outcome | Original reads | Seconds | Pinned raw QA score |
|---|---|---:|---:|---:|
| `conv-47:52`, existing previews | Finished: approximately June 2022, exact date uncertain | 6 | 34.479 | 0.2353 |
| `conv-48:36`, coverage previews | Stopped on unseen source request; no final answer | 10 | 19.128 | 0 |

All planned attempts are accounted for. Combined reported input tokens: 124,393; cached input: 51,200. The all-planned raw QA mean is 0.1176, with the no-answer attempt represented by an empty prediction. It is a selected two-case diagnostic, not a benchmark quality rate or cost-savings claim. The official scorer's pinned extracted functions are unchanged; category-3 reference inference and semantic support limitations from the prior A/B still apply.

**Neither live retry exercised the repeated-read reuse branch.** The completed temporal workflow requested only new sources. The age workflow requested unseen filenames while simultaneously asking for the next page: `session_3.md`, `session_5.md`, `session_8.md`, `session_9.md`, `session_10.md`, `session_11.md`, `session_12.md`, `session_13.md`, `session_14.md`, `session_15.md`. Only the first retrieval page had been supplied, so these paths were rejected before another read. The raw failure is preserved; it is not silently relabeled as a successful recovery.

This exposes a distinct interaction problem: the model guesses future-page paths before observing the next page. The request contract says only supplied paths may be read. The current mediator treats this contract error as terminal; ordinary agent tools may let an agent recover from an error response. Any recovery design must refuse unauthorized reads, retain a visible rejection record and remain within the declared economic budget. Do not count tool/schema recovery as semantic correctness.

## Reproduction and next step

Regenerate the exposed five-case preparation, derive the targeted manifest with the recorded two IDs/indexes and protocol, and retain the new input/source hashes. The launcher validates these frozen hashes before any model call:

```sh
python3 scripts/run-locomo-preview-reader-ab.py --prepared /path/to/targeted/prepared --out /tmp/targeted-runs-new
/path/to/scorer-venv/bin/python scripts/summarize-locomo-preview-reader-ab.py --prepared /path/to/targeted/prepared --runs /tmp/targeted-runs-new --scorer-source /path/to/pinned/evaluation.py --out /tmp/targeted-summary-new
```

Exact recorded source hashes are in the manifest. New protocol variants require new manifests and output directories. Targeted retries are aggregated separately, without an A/B delta between different questions. The original ten-trial artifact remains unchanged.

Next: test a bounded tool-error feedback path and explicit continuation state on controlled traces before spending more model quota. Independently review speaker attribution and unsupported inference in the final reader protocol. Keep current retrieval defaults; these diagnostics close no primary semantic, efficiency, holdout or competitor acceptance gate.

Verification: `npm run check` passed 291/291 tests, example validation and all configured deterministic gates; `git diff --check` passed. Required Obsidian sync status returned `SYNC_CONFIG_NOT_FOUND`; the user vault was untouched. These are mechanical checks, not semantic quality acceptance.
