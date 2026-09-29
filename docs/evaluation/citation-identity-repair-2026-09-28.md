# Citation identity verifier repair — 2026-09-28

## Trigger and repair

The [frozen LoCoMo reader A/B](locomo-preview-reader-ab-2026-09-28.md) falsely rejected two emitted answers because Curator briefs wrote `session_8` and `session_11`, while Lead citations used the exact verified paths `session_8.md` and `session_11.md`. The original substring check required the extension in the brief. It also incorrectly allowed filenames merely containing the cited path, such as `other-note.md` or `note.md.bak`.

After all ten frozen live attempts ended, `brief_mentions_source` in [the mediator](../../scripts/run-curator-paging-pilot.py) was added. It permits omission of the Markdown extension for the exact supplied relative path, requires token/path boundaries, and accepts sentence punctuation. It retains the requirement that every Lead citation names an original actually read. It does not resolve a bare basename to a different folder or prove semantic support.

## Verification experiments

A focused regression failed before the repair on `[[note]]`. After repair, all eight mediation tests pass. New checks accept extensionless and sentence-final exact citations, and reject `note.md.bak`, `other-note.md` and `note.pdf`. Existing unread-source and session-identity rejection tests remain green.

[Offline frozen-trace replay](../../eval/reader-pilot/locomo-citation-identity-repair-2026-09-28.json) compiled only the repaired `brief_mentions_source` function from the mediator and checked its identities against all eight generated-answer reports. Two old false rejections become accepted identity checks; six existing identity outcomes stay accepted. One has an empty citation array: that is a vacuous identity pass, not answer support.

**No live trial was rerun or reclassified.** Original operational outcomes, raw predictions and official scores remain unchanged. This is evaluator correctness work, not an improved supported-complete rate or competitor result. Future preparation produces a new frozen runner hash; old manifests intentionally cannot execute against a changed runner.

Repository check after repair passed 288/288 tests and all configured gates; vault status remains `SYNC_CONFIG_NOT_FOUND`.
