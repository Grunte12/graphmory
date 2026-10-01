# MVP evaluator repair follow-up — 1 October 2026

This follow-up repairs native evaluator parsing and capture before the next fresh native attempt. It does not change the packaged Graphmory candidate or any shipped role/skill. Existing run prompts, gold, captures, scores, state, and traces for native02/03/04 remain untouched.

## Changes

- `linkTo()` now removes a `.md` suffix from the note path after splitting its fragment, and checks an expected `#D1`/`#D2` fragment against the actual link.
- Trace scanning keeps original command text and path case for `GRAPHMORY_STATE_DIR` comparison. Lowercased text remains limited to case-insensitive route checks.
- Page-offset parsing reads native shell command invocations. An omitted `--offset` counts as the documented default `0`; malformed explicit offsets remain invalid. The R10 gate still requires offsets 0, 2, and 4.
- `capture-update` handles missing targets as structured failures. It records `missingRequiredTargets`, still runs receipt verification, and writes the full capture instead of throwing `ENOENT`. The score also persists those missing paths and remains failed when there is no successful receipt.
- Pending setup saves a recursive pre-session state-tree snapshot after prepare/status and before native launch. It records directory and file presence, file content hashes and sizes, and permission bits. Pending scoring compares the complete tree along with the existing vault snapshot and pending-manifest checks. A missing/unreadable state root or missing baseline fails closed and is included in the score artifact.
- Newly prepared update prompts explicitly authorize creating only `01 Projects/HelioForge/Recovery Window Policy.md` when absent. They direct the Curator to skip a nonexistent original body, include that path in checkpoint preparation, and confirm `existed:false` with `sha256:null` before the first write. The target set, patch, and semantic gold are unchanged.

## Preserved-output regression evidence

Tests read the preserved native02/03/04 traces and private evidence without writing to those run directories. On a temporary copy of native03, the actual `capture-update` and `score-update` commands now persist a complete FAIL with the missing target and absent receipt; the original native03 ENOENT record remains preserved. Native02's source-anchor false negative is corrected on replay, but its current semantic/file checks still do not create a receipt: the historical score remains FAIL. The historical native04 pending PASS remains unchanged; its seed lacks a pre-session state-tree snapshot, so the new gate correctly cannot use that old run to claim state-tree integrity retroactively.

The approved new-target prompt wording affects only runs prepared with this evaluator version. Native05 must use its freshly generated and frozen prompt before native work.

## Verification

```sh
node --check scripts/eval-mvp-correctness-repair.mjs
node --check test/mvp-correctness-evaluator.test.mjs
node --test test/mvp-correctness-evaluator.test.mjs
```

Result: 7 focused tests passed, 0 failed, 0 skipped. The tests cover exact source fragments, mixed-case native state paths, implicit offset 0 in native02/03 traces, preservation of native02's missing-receipt failure, persisted native03 missing-target capture/score failures, pending tree identity/mutation/missing-root behavior, and the new-target prompt contract.

The evaluator source was frozen after the focused test run at SHA-256 `f2f8eb1634e04a141536a589ecdfc585ea3a3e4d8ce85900bbd15f6f32c05371`. Its normal `freeze` command archives those exact bytes in each new private run. This repair does not establish R10/R11 native success; run05 remains the next authorized fresh native attempt.

## Limits

The pending tree snapshot hashes names, types, file contents, sizes, and permission bits. It does not record ownership, ACLs, extended attributes, or timestamps. The host filesystem remains outside the evaluator's sandbox boundary. No claim about unattended production safety follows from these synthetic gates.
