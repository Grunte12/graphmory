# Experiment 1: actual CLI pagination

## Question and controls

Does the deployed CLI preserve deep evidence reachability, rather than just a simulated ranking list? Public pinned LoCoMo development data only; two exposed late-evidence failures plus one hash-selected eligible question in each category 1–4. Six questions, three delivery modes, **18 actual CLI trials**. No model, external judge, competitor or holdout.

The runner invokes `recall-managed --agent` in a fresh temporary Markdown vault, follows the returned `nextOffset` until `hasMore` is false, rejects duplicates/non-progress/count changes, and verifies returned source paths and original byte hashes. Gold is used only by the evaluator, not the retrieval command. It exhausts by deterministic policy; this is not an autonomous curator test.

## Result

- Run complete: **18/18**. All required source paths available by exhaustion; no protocol failure or original-source mutation detected.
- Required paths available on page one: **12/18**, or four of six questions in each mode.
- `conv-43:21` and `conv-50:140` need page **three** in all three modes. The former includes the source for Chicago that was absent from the previous top-10 reader condition.
- `--auto --matched-previews` gave the same output as `--auto` here because these cases chose focused mode. This does not test the wide matched-preview branch.

This validates candidate pagination only. It does not establish that a model requests later pages, that preview spans contain the required fact, or that an answer is correct. Source hashes verify originals; they do not mean their full content was sent to a model. Tiny single-pass wall times include CLI startup and cannot establish a latency advantage.

Artifact: [18-trial report](../../eval/reader-pilot/cli-pages-initial-2026-09-28.json), including the original runner/runtime hashes. The final runner has since gained the fourth bundle arm; use the preserved artifact to distinguish experiment versions. Original ephemeral staging vaults were removed after hashing; immutable results retained.

Decision: do not add a new search architecture yet. Inspect preview loss and actual curator stopping next.
