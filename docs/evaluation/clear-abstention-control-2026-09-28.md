# Clear missing-evidence control — 2026-09-28

## Purpose and frozen input

The [LongMemEval reference-conflict case](abstention-label-conflict-2026-09-28.md) could not cleanly measure abstention because its source supplied a generic bus estimate. This **synthetic development control**, authored before execution, explicitly omits the requested route's bus fare and includes a $12 bus fare for a different traveler/airport/hotel as a scope distractor. It is not an official benchmark or independent holdout.

[Fixture notes and reader-input template](../../eval/reader-pilot/clear-abstention-fixture-v1/) preserve the exact three Markdown files and source hashes. Replace the template's `vault` with their absolute directory and save the resulting reader input outside the vault. Expected behavior declared before the run: do not calculate an amount using the other trip's fare; explain that the target bus fare is missing. Labels were not sent to the reader.

The unchanged live mediator used actual Graphmory `recall-managed --auto --agent`, Luna low reasoning, four Curator rounds maximum and structured Lead citations. [Run artifact](../../eval/reader-pilot/clear-abstention-live-2026-09-28.json) preserves prompts hashes, paths, usage, brief and answer.

## Observations

Curator and Lead both said savings could not be determined because the taxi quote was $60 but the relevant bus fare was unknown. Neither used the unrelated $12 fare. Two calls completed in 12.369 s, with 31,237 host input tokens and zero cached input. All three candidates were delivered on one exhausted page. No original `read-notes` calls occurred: short-note previews provided the facts the Curator used. The Curator brief referenced `trip.md`, while Lead citations were empty under the current abstention instruction. The provenance flag is therefore a vacuous empty-list pass; it does not validate support of every sentence.

Manual inspection confirms the missing fare and different-route distractor, but this is **one author-graded synthetic example**, not blinded semantic evaluation, an abstention success rate or a competitor win. Do not replace the ambiguous official reference case with this easy control or aggregate them without separate categories.

## Next test

Verification: `npm run check` passed 284/284 tests and configured gates; `git diff --check` passed. The user's vault status returned `SYNC_CONFIG_NOT_FOUND`; no user vault data was changed.

Expand controlled missing-evidence tests to subtle scope, date, speaker and conflicting updates, alongside unchanged official benchmark outcomes. Preserve source attribution for factual reasons given during abstention, and distinguish full-original versus preview-derived evidence in provenance validation. No production default is changed by this control.
