# LoCoMo anchored-preview development screen — 2026-09-28

## Decision

**Reject the proposed first-section reservation.** Keep the production default and the existing coverage option unchanged. The candidate failed the [frozen manifest](../../eval/reader-pilot/anchored-preview-development-manifest-2026-09-28.json) before any answer-model or held-out trial.

## Setup

The [raw result](../../eval/reader-pilot/locomo-preview-anchored-development-2026-09-28.json) reuses the pinned LoCoMo dataset (`79fa87e9…651ea698ff4`), seven exposed development conversations, and the frozen fusion top-ten ranking (`2cff1b04…18`). It evaluates 1,099 answerable questions with resolvable gold turn IDs. Three sealed conversations were not opened. Each variant saw the same query and ranked original Markdown; only the three short section previews per note changed. The candidate reserved one slot for the first nested section when its body contained a non-stopword query term, leaving two slots for coverage-ranked sections. An unconditional reservation was exploratory.

The primary measure is **complete gold turn IDs visible in top-ten preview headings before byte-budget pagination**. It measures an opportunity to inspect evidence, not whether the evidence supports an answer or whether the Curator reads it. Gold IDs were used only for scoring. The candidate's rules did not inspect them.

## Results

| Variant | Complete / 1,099 | Mean gold-turn recall | Median preview bytes | Gains vs current | Losses vs current |
|---|---:|---:|---:|---:|---:|
| Current | 469 | 0.4681 | 6,929 | — | — |
| Existing coverage option | 614 | 0.6125 | 8,075 | 163 | 18 |
| Reserve first when body overlaps query | 591 | 0.5910 | 8,121 | 147 | 25 |
| Always reserve first | 572 | 0.5768 | 8,235 | 133 | 30 |

Relative to the coverage option, the conditional candidate exposed more gold turns in 8 questions and fewer in 40. Its median preview size was 0.6% larger. It failed the frozen minimum of 614 complete cases, maximum of 15 paired losses against current, and no-development-conversation-regression gate. It passed only the median size ceiling (110% of coverage).

| Development conversation | Questions | Coverage complete | Conditional candidate complete |
|---|---:|---:|---:|
| conv-26 | 149 | 75 | 74 |
| conv-30 | 81 | 48 | 47 |
| conv-42 | 197 | 110 | 109 |
| conv-43 | 177 | 101 | 95 |
| conv-47 | 149 | 76 | 70 |
| conv-48 | 191 | 114 | 109 |
| conv-50 | 155 | 90 | 87 |

The earlier managed-page coverage experiment found 31 losses against current, while this frozen-top-ten screen has 18. These numbers use different delivery protocols and must not be combined or described as a single measured regression rate.

## Interpretation and next test

The first chronological section often displaced a better query-matched section. Even a positive keyword match did not protect recall. This is a failed development intervention, so there is no reason to spend model calls or open the holdout for it. The next correctness work should focus on how the Curator resolves dated or conflicting facts *after* it receives and reads the original notes; the two-family native comparison already found a failure at that point. Any further intervention needs a frozen answer-level protocol with source-support judgments and matched competitor conditions. No product default or superiority claim changes.

## Reproduction

```sh
node scripts/eval-locomo-preview-coverage.mjs --input /path/to/pinned/locomo10.json --out /new/output/path.json
```

The script and runtime hashes were frozen in the manifest before running. `npm run check` and `git diff --check` passed. `node scripts/brain-sync.mjs status --vault <private vault>` returned `SYNC_CONFIG_NOT_FOUND`; this experiment did not write to that vault.
