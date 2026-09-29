# Experiment 3: omitted-section source-read signaling

## Demonstrated failure and intervention

The bundle development experiment found source paths reachable but evidence missing from selected short previews. Added a regression counterexample with four short sections: the preview returns three, omitting “I was in Chicago”; no selected section has `truncated`. Before the change the expected `sourceReadRequired: true` assertion fails (`undefined` observed). This is a real warning-contract failure, not a fabricated semantic score.

Runtime correction: mark a nonempty preview as requiring its original source when either a displayed section is shortened **or selected preview count is below the original parsed section count**. Notes with omitted previews retain `previewOmitted`, which still means uninspected, not irrelevant. Simple fully represented notes retain their previous behavior. No model, new dependency, ranking change, additional source text or fixed total retrieval cap was added.

The flag does not force reading every candidate. It says the displayed preview is insufficient to rely on that note or rule it out. Candidate relevance and task completeness still require judgment. More source reads may increase downstream cost; quality/cost effects require a live trace comparison and are not inferred from this fix.

## Controlled verification

- Counterexample fails before the fix and passes afterward.
- Focused decision-recall/evidence-completeness tests: **18/18** pass, including simple-note compatibility.
- Repeat actual CLI protocol on the same six development questions and four delivery modes: **24/24** complete.
- Pairwise **24/24** identical delivered path order and original hashes, identical first complete page and gold-turn preview presence. Source-read warning coverage changes; evidence content and ranking do not.
- For the late Chicago case, bundle warnings increase from **3/29 to 29/29** candidates. Bundle response grows from 21,970 to 22,646 bytes; this is diagnostic metadata, not extra source prose.
- Across the six bundle trials, source-read flags increase from 23 to 168; total response bytes increase from 132,878 to 136,648 (3,770 bytes, about 2.84%). These are output bytes, not tokenizer counts or billed costs.

Artifacts: [before](../../eval/reader-pilot/cli-pages-bundle-before-2026-09-28.json), [after](../../eval/reader-pilot/cli-pages-bundle-after-2026-09-28.json). Original red/green logs retained locally; public test reproduces the counterexample. No live model generation or independent semantic grading was performed in this experiment. No named competitor quality or latency claim is justified.

## Interpretation and next gate

Mechanical partial-evidence signaling is repaired for the demonstrated failure. This does not close the active goal's semantic, competitor, host or efficiency gates. Next compare actual curator continuation/source-read traces and final support/completeness, accounting for all model calls and cache usage. Keep the previously observed corpus as development evidence; final evaluation needs independent cases and labels.

Full verification after the correction: `npm run check` passed 278/278 tests and configured deterministic gates. No live-model calls or paid API usage occurred in these three CLI experiments.
