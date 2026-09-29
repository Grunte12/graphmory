# LoCoMo coverage-preview development experiments — 2026-09-28

## Question and intervention

The previous live diagnostic delivered every gold note on page one, yet the Curator read only one. Could tool-side previews expose more useful sections without changing retrieval rankings? The experimental `--auto --coverage-previews` option selects three nested sections by query overlap in body (weight 2) and heading (weight 1), skips the root metadata section, and falls back to the existing preview when no nested sections exist. The section count limits preview size only; original Markdown and paginated candidates remain accessible. This is lexical section selection, not semantic retrieval or a new model.

**Decision: retain opt-in only.** Evidence opportunity improved on average, but some questions regressed and the single live answer remained incomplete. Default behavior is unchanged.

## Controls

- Pinned LoCoMo dataset SHA-256: `79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4`.
- Seven exposed development conversations, 1,099 answerable questions with resolvable gold references; category 5 excluded from these preview diagnostics. Three sealed conversations were not rendered or evaluated.
- Identical query and original Markdown per pair. Section selection sees the query, never gold IDs. Gold IDs are used only by the diagnostic scorer.
- Heading presence measures an opportunity to read evidence, not semantic support, correctness, or Curator completeness. Report untruncated sections separately.

## Experiment 1: frozen-ranking preview ablation

[Initial artifact](../../eval/reader-pilot/locomo-preview-coverage-2026-09-28.json) and [production-option follow-up](../../eval/reader-pilot/locomo-preview-coverage-opt-in-2026-09-28.json) preserve both runs. Top ten paths use the previously frozen fusion ranking, before page byte limits.

| Variant | All gold turn IDs visible / 1,099 | Mean turn recall | Median preview bytes |
|---|---:|---:|---:|
| Existing | 469 | 0.4681 | 6,929 |
| No root anchor, three sections | 545 | 0.5464 | 8,134 |
| Heading-aware prototype, three sections | 618 | 0.6160 | 8,080 |
| Heading-aware prototype, five sections | 710 | 0.7038 | 13,071 |
| Implemented opt-in, three sections | 614 | 0.6125 | 8,075 |

The prototype and implemented option use different stopword sets; 618 is **not** the implemented option's result. Five sections increase payload substantially and were not implemented. No model calls were made.

## Experiment 2: actual managed first-page delivery

[Artifact](../../eval/reader-pilot/locomo-preview-delivery-2026-09-28.json) uses actual `managedRecall` with adaptive page budgets rather than a fixed top-ten approximation.

| Metric | Existing | Coverage opt-in |
|---|---:|---:|
| All gold turn headings visible / 1,099 | 467 | 611 |
| All gold turns in untruncated sections / 1,099 | 437 | 565 |
| Mean gold-turn recall on page one | 0.4653 | 0.6099 |
| All gold note paths delivered / 1,099 | 981 | 981 |
| Median in-process response bytes | 8,772 | 9,911 |
| Median first-page paths | 10 | 10 |

Heading visibility improved in 232 questions, regressed in 31, and tied in 836. Untruncated visibility improved in 219, regressed in 31, and tied in 849. There was no first-page gold-note delivery regression. One wide query's page shrank from 30 to 29 paths due to the byte budget; both gold notes remained. Median paired byte increase was 1,194 (p95 2,205; maximum 5,513). These are in-process report bytes, not token billing or CLI latency. Existing pagination regression now also checks the option across 80 notes for path completeness.

Reproduce the final diagnostic scripts with new output paths:

```sh
node scripts/eval-locomo-preview-coverage.mjs --input /path/to/pinned/locomo10.json --out /tmp/preview-coverage-new.json
node scripts/eval-locomo-preview-delivery.mjs --input /path/to/pinned/locomo10.json --out /tmp/preview-delivery-new.json
```

## Experiment 3: live Curator/Lead diagnostic

[Sanitized artifact](../../eval/reader-pilot/locomo-coverage-preview-live-2026-09-28.json) and [prior baseline](locomo-live-development-attribution-2026-09-28.md). Exposed question `conv-42:11`, Luna `gpt-5.6-luna` Curator and Sol `gpt-5.6-sol` Lead, actual CLI retrieval and mediated original-source reads.

An initial attempt failed before generation because the sandbox denied writing the Codex host state database. The failed call remains in the artifact; it is not scored as a successful answer. After filesystem/network permission, the retry completed.

| Metric | Prior baseline | Completed opt-in retry |
|---|---:|---:|
| Pinned category-1 raw QA F1 | 0.2159 | 0.625 |
| Original notes read | 1 | 2 |
| End-to-end seconds | 25.893 | 31.304 |
| Reported input tokens | 52,656 | 54,229 |
| Cached input tokens | 14,080 | 0 |

The opt-in answer included reptiles, fur-bearing animals and cockroaches; it still missed dairy. Preview visibility increased from zero to two of three gold turns. Three gold note paths were delivered in both runs. Scorer source SHA-256: `8e3be5d57ff2ff9ec5cd05939592f468c5f3f1fd95d13e431932bdf6bf0fd6fd`; this is the pinned extracted raw QA function, not a full official benchmark run.

This is one exposed question, sequential run order and unequal cache conditions. It does not establish causal latency/cost savings, a general quality gain, independent supported-complete success, or competitor superiority. Further model calls were deferred after the host five-hour allowance reached 96% used; deterministic checks can continue.

## Next gate

Before promotion, freeze and counterbalance a multi-conversation development reader trial with missing-evidence and conflicting-evidence cases. Preserve all failed workflows and score official answers alongside independently reviewed supported-complete labels. Then freeze the selected protocol before opening sealed conversations and comparing named tools on matched hosts. The persistent optimization goal remains active.

## Repository verification

`npm run check` passed 287/287 tests, example validation and configured deterministic eval gates; `git diff --check` passed. Focused preview, pagination and pilot tests passed 26/26. The required Obsidian status command returned `SYNC_CONFIG_NOT_FOUND` at `<private vault>`; no vault mutation was performed. These checks do not close live semantic or competitor acceptance gates.
