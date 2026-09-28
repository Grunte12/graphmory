# Curator temporal decision A/B — 2026-09-28

## Frozen intervention

The [two-family native comparison](matched-native-two-family-development-2026-09-28.md) showed both tools delivered the dated yoga evidence, yet both Curators first briefed it as a 2–3 range. This follow-up tests a short **experimental Curator instruction**: for conflicting statements about the same property, check speaker, scope and dates; use the latest applicable user statement for a current-state question and the requested earlier state for a previous-state question. Unclear order/scope still requires uncertainty. The retrieval CLI, source-read protocol, Lead prompt, Luna model, low reasoning, four-round cap and citation schema remain the same in both arms.

The [pre-generation manifest](../../eval/reader-pilot/temporal-decision-ab-manifest-2026-09-28.json) freezes two source-disjoint exposed LongMemEval-S development cases and opposite arm orders: current yoga frequency (`945e3d21`: control then treatment) and previous United status (`50635ada`: treatment then control). Four planned runs were completed with no replacement or retry. Gold answers stayed in separate local files and were not included in prompts. This is an unblinded development A/B with one generation per arm and case, not an independent holdout or calibrated semantic evaluation.

## Results

| Case / arm | Answer | Gold notes read | Calls | Wall time | Input / cached tokens |
|---|---|---:|---:|---:|---:|
| Current yoga / control | About 3 times weekly, notes earlier 2 | 2/2 | 3 | 21.026 s | 67,906 / 28,160 |
| Current yoga / temporal instruction | 3 times weekly | 2/2 | 3 | 21.301 s | 70,339 / 23,040 |
| Previous United status / temporal instruction | Premier Silver | 2/2 | 3 | 21.944 s | 57,693 / 31,232 |
| Previous United status / control | Premier Silver | 2/2 | 3 | 22.853 s | 60,426 / 42,240 |

All four Leads cited both gold notes and passed the runner's citation-identity check. The [yoga control](../../eval/reader-pilot/temporal-945e-control-2026-09-28.json) now led with the latest value, although it called the old/new frequencies “somewhat inconsistent”; the [yoga treatment](../../eval/reader-pilot/temporal-945e-treatment-2026-09-28.json) gave the concise latest value and also opened a third candidate. Both [United treatment](../../eval/reader-pilot/temporal-506-treatment-2026-09-28.json) and [United control](../../eval/reader-pilot/temporal-506-control-2026-09-28.json) returned the previous Premier Silver status rather than the later Premier Gold status. Manual inspection of the cited user statements supports those status/frequency distinctions. The reference answers are “Three times a week” and “Premier Silver”; official benchmark scoring was not run on this selected pair.

The **control's behavior changed across runs**: the prior Graphmory yoga run answered 2–3, while this rerun answered about 3 with an explicit old-value caveat. Therefore the apparent improvement in wording cannot be attributed confidently to the new instruction. The treatment consumed one extra yoga source read and 10,216 more submitted prompt bytes on that case. Gross and cached token shares moved differently across arms; noncached input was higher in the treatment on both cases. These observations do not establish a latency or cost gain, and subscription billing is unknown.

## Decision

Keep the temporal rule **experimental** in the evaluator; do not install it into product Curator prompts yet. Both treatment and control gave a plausible current-state answer in this run, and both handled the previous-state control. Repeated, counterbalanced generations across more source-disjoint update, scope and attribution cases, with independent support labels, are needed before a default change. A useful tool-side complement is to expose source dates clearly in retrieval/read packets, but that would be a separate intervention with its own evidence and token cost. The goal's independent quality and comparator efficiency gates remain open.

## Verification

`npm run check` passed 293/293 tests and configured gates. `git diff --check` passed. The frozen runner hash matches the four sanitized artifacts; all planned calls completed and each report records valid citation identity. The user's Obsidian status command returned `SYNC_CONFIG_NOT_FOUND`; these runs used only disposable public benchmark vaults. Raw local Codex traces and temporary vault/index directories were removed after saving the sanitized artifacts.
