# LongMemEval transfer split source-overlap audit — 2026-09-28

## Intended experiment

After the verified Basic Memory hybrid development pilot, freeze a new question-only 12-case LongMemEval slice and compare Graphmory baseline/BM25 with Basic Memory hybrid. The [first manifest](../../eval/competitor-pilot/overlap-diagnostic-manifest-2026-09-28.json) excluded question IDs found in prior local evaluation JSON and selected two per remaining answerable category. All public corpus bytes matched the pinned cleaned-S SHA-256 `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.

Graphmory's [diagnostic retrieval run](../../eval/competitor-pilot/overlap-diagnostic-graphmory-2026-09-28.json) completed 12/12 cases: baseline complete evidence@3 was 10/12 and @12 was 11/12; BM25 was also 10/12 and 11/12. These are **not independent holdout estimates**. Before inspecting Basic Memory outcomes, the source-overlap audit found every selected question shared 2–13 original session IDs with previously evaluated questions. The attempted Basic Memory hybrid run was interrupted after its first two cases reported successful indexing/smoke; it wrote no scored JSON. Those two cases must not be treated as failures or recall observations.

## Root cause and correction

Removing `_abs` from a question ID is insufficient as a conversation-family split. The cleaned-S histories reuse source session IDs across different question IDs. An audit of the prior locally observed cases found 214 question families and 9,780 source session IDs before adding this diagnostic run; **zero** remaining questions had a source history disjoint from them. After preserving this diagnostic under its own name, the same audit counted 226 observed families and 10,266 source sessions, still with zero disjoint candidates. This does not prove benchmark contamination of an external model, but it prevents us from calling another slice of this local corpus an unseen *source-level* holdout.

The [transfer freezer](../../scripts/freeze-lme-transfer.mjs) now checks source session overlap and refuses to issue a manifest when no source-disjoint cases exist. The Basic Memory evaluator also accepts an explicit frozen `--ids-manifest` and records its hash, so future matched runs can use the same IDs without changing the source corpus. No production retrieval default changed.

Verification: the focused LongMemEval tests passed 6/6, including a source-overlap and input-order regression. `npm run check` passed 285/285 tests and configured deterministic gates. The vault status check returned `SYNC_CONFIG_NOT_FOUND` for `<private vault>`; this experiment did not read or change that vault.

## Decision and limits

Keep the 12-case result as an exposed diagnostic only. For independent memory evaluation, use a different corpus or the three still-sealed LoCoMo conversations after freezing the reader/Curator protocol; do not tune on them after opening. Abstention in this LongMemEval file is already exhausted under the local exposure audit, so evaluate it separately with a predeclared product-risk suite. No claim of Graphmory superiority, noninferiority, answer quality, or end-to-end efficiency follows from this interrupted experiment.
