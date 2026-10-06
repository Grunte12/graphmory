# Pre-push readiness check — 2026-10-01

## Summary

**rc.5 should not be released yet as an MVP with a complete working workflow.** The code and package checks pass, but a memory update through a real Curator on the same candidate still fails, and there is no fresh-session recall after a successful receipt.

This round only verified. It did not change the runtime, retry the native run, commit or push, or touch a real Obsidian vault. The earlier results and the pending operation were kept.

## What was re-checked

| Item | Result and scope |
|---|---|
| `npm run check` | exit 0, tests 421/421 passed, 0 failed, skipped or cancelled; about 11.5 seconds for the test suite |
| `git diff --check` | passed, no whitespace errors |
| `doctor --json` | `ok:true`; this checks the environment and CLI, not the native workflow |
| Candidate identity | rc.5 iteration-03 SHA-256 `11725097611ba5e65ecf2ee6ea39fbf5562061b0053c0e811946e3afe90ff04a`; the runtime in the checkout matches the archive for 119 of 119 files |
| Synthetic metadata reproduction | the full verifier rejected a predecessor that was still active and a replacement written as a short name, with the same two errors as native-05 |
| Package dry-run | rc.5, 119 files; bins and local imports complete, semantic dependency still optional; the path and credential scan found nothing suspicious within the scope checked |
| Sync status of the synthetic vault | `SYNC_CONFIG_NOT_FOUND`, because this fixture has no Git brain sync configured; it is not evidence either way for shared sync |
| Failed fixture integrity | the files in the native-05 vault still match the failed capture exactly, after a read-only diagnostic |

The model was not re-run: all 119 runtime files are unchanged from the candidate that had the native failure, so there is no new evidence that the problem was fixed.

## Blockers to fix

### 1. The Curator has to write lifecycle metadata itself

native-05 created and edited all the targets, but the predecessor still had `status: active` and `superseded_by: [[Recovery Window Policy]]`. The full verifier requires `superseded` and the canonical replacement path, so it issued no receipt, the work stayed pending, and R11 did not run.

render-patch produces the successor data but not the predecessor transition. The fix should have the existing note workflow handle only the approved metadata, from the validated patch and the declared targets, while preserving the preimages, the source hashes, the pending guard and the full verification.

The predecessor rule matches the documentation and the focused test. This error came from what the Curator wrote, not from a false rejection by the verifier.

### 2. The native evaluator still misreads some trace shapes

The eval does not support dynamic child IDs or some commands that use variables, so the trace gate result was off. A regression from the raw native-05 trace needs to be added and the corrected evaluator frozen as a new version, keeping the original frozen score. Fixing the eval does not change the real error in item 1.

### 3. The documentation shipped in the package refers to an older candidate

`package.json` declares rc.5 and ships `docs/guides/trial-mvp.md` and `docs/evaluation/mvp-native-acceptance-2026-10-01.md`. Line 13 of the guide points to the rc.4 acceptance report, which says ready for a trial in the tested configuration, but the package does not ship the [latest rc.5 report](mvp-native-retest-result-2026-10-01.md), which records R10 FAIL and R11 NOT RUN.

The historical reports should stay, and the guide and package should state the status of the current candidate and the limits of the host and model actually tested.

## Criteria before saying the full workflow is ready for a trial

1. Fix the lifecycle metadata in the tooling and give the Curator a single path, reducing validation that duplicates finish and keeping diagnostics separate.
2. Repair the evaluator, then freeze a new candidate, fixture and gold set.
3. Run a native update with Luna on a fresh synthetic vault. It must produce a matching receipt with source and target bindings and a correct replacement history.
4. Open a new session and read it back. It must use the current data, answer history questions, and add no fact that has no evidence.
5. A pending refusal must still block reads and keep the vault and state unchanged. Check the package and the documentation for the current candidate before commit and push.

No new provider, semantic model or benchmark is needed before this workflow is closed. A pass on Codex with Luna must be reported for the configuration tested and not extended into an endorsement of every host and model.

## Evidence

- [Native-05 retest](mvp-native-retest-result-2026-10-01.md)
- [Independent raw review](mvp-native-05-independent-review-2026-10-01.md)
- Private evidence root: `outputs/graphmory-mvp-repair-20261001/`
- New artifacts: `readiness-reverify-check.log`, `readiness-reverify-identity.json`, `readiness-reverify-core.json`, `readiness-reverify-package.json`, `readiness-reverify-doctor.json`, `readiness-reverify-status.log`, `readiness-reverify-fixture-integrity.json`

The first package dry-run hit a permission problem in the user's npm cache, so a temporary cache under `/private/tmp` was used without changing the global config or ownership. The check succeeded and only that temporary cache was deleted. The private report keeps the command, the initial error, the retry and the cleanup.

This result is a readiness check of the current candidate, not a benchmark against other tools.
