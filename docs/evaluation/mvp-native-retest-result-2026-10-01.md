# MVP native-05 test result — 2026-10-01

## Summary

**The end-to-end memory update did not pass, so it is not yet confirmed that the MVP is ready for the full workflow.**

The test used a real Codex CLI on a synthetic vault that is separate from the user's Obsidian vault, with `gpt-5.6-luna` at `low` reasoning for both the Lead and the named `graphmory_curator`, in a fresh session. No conversation history was passed to the Curator. The results of the file checks and the raw logs were all kept.

| What was tested | Result | Meaning |
|---|---|---|
| `npm run check` | passed: 421/421 tests, none skipped | includes 7 new regression cases for the eval |
| Install the package and create the Curator in a separate project | passed | package files match 119 of 119; setup created the role and the skill |
| R10: the Curator updates notes from evidence | **a real failure** | all 4 targets were edited or created, but 2 metadata values of the old policy were wrong; the verifier blocked it and no receipt was issued |
| R11: read back in a fresh session after the update | not run | R10 is still pending, so there is no confirmed update to test |
| R12: refuse to answer while a checkpoint is pending | behavior passed; the eval's trace score did not | `CURATION_PENDING` appeared, the policy was not answered, the guard was not bypassed; the vault and the state tree did not change |

The overall result of the **frozen eval** is still 0 of 3 primary tasks passed: R10 and R12 were scored FAIL and R11 NOT RUN. The original scores were not changed afterwards. A further check of the raw logs explains the limits of the trace parser, recorded separately in the [independent review](mvp-native-05-independent-review-2026-10-01.md).

## The real failure: metadata of the old policy

The Curator created `Recovery Window Policy.md`, updated the MOC and the Runbook, and kept the full patch record of the new policy, but `Batch Policy.md` still had:

```yaml
status: active
superseded_by: [[Recovery Window Policy]]
```

The contract requires:

```yaml
status: superseded
superseded_by: "01 Projects/HelioForge/Recovery Window Policy.md"
```

The `verify-patch-persistence --full` command that the Curator actually ran returned `valid:false` with these two errors, so the Curator stopped before `finish`, as the protocol says, and left operation `89ec5120-2e37-4601-b12b-b239a0d834e9` pending.

- `receipt: null` and `lastFailure: null` are consistent with finish not having been called; the verifier is a read-only command.
- The source SHA still matches the frozen data; `sourceIdentityPass:false` comes from a receipt that has no source binding.
- The four targets changed as allowed, with one new note, and no source or other file was edited.
- The failed vault, manifest and preimages were kept as they were, with no hand repair counted as a native success.

## Result of the pending mode

On another separate vault and state root, the Curator called `recall-managed` and refused with `CURATION_PENDING`, without answering the policy question.

- The frozen scorer passed every behavioral gate: pending state, blocked envelope, no answer, no bypass, vault read-only, state tree read-only and state-root binding.
- All 12 Markdown and config files of the vault were identical to before the run.
- All 10 entries (files and directories) of the state tree were identical to before the run, including type, size, byte hash and permission bits.
- The root checked the inventory again separately and got the same result. The first inventory used directory names without a trailing `/`, which can create a false difference, and both the first artifact and the explanation of the fix were kept.

This comparison does not cover ownership, ACLs, extended attributes or timestamps, and it does not provide host filesystem isolation.

## Limits of the measurement found in the real run

1. The first version of the raw trace collector could not read a prompt written as a JavaScript template literal. The collector was repaired and the traces were collected from the same session, without running the model again. A failure record and the hash of the revised version exist; there is no hash of the collector before the fix, so this limit is recorded as it is.
2. The frozen evaluator still does not read waits of the form `[r.agent_id]` and `[load("child_id")]` completely, so it scored the delegation and trace gate FAIL even though the collector verified the spawn, the returned child ID, the matching completed wait and the actual model metadata.
3. The R10 workflow parser does not yet support shell commands that use CLI variables and some forms of the default offset, so it reported extra missing routes. They had to be checked against the raw log.

These limits do not change why R10 failed: the native full verifier and the real files agree that the predecessor metadata was wrong. The receipt criteria were not lowered and the frozen score was not edited to make it pass.

## What was fixed in this round of testing

Only the development evaluator was fixed: `.md#heading` links, the case of the state path, the default offset 0, the missing-target FAIL artifact, and the snapshot and state-tree comparison including a missing state root. An approval to create the exact target was added to the new prompt. No fixture fact, patch, target set or semantic gold changed.

[Details and regression tests](mvp-evaluator-repair-followup-2026-10-01.md)

## Recommended next steps

1. **Let the tooling write lifecycle metadata deterministically**: use the path from the validated patch, set the predecessor to superseded, and bind the replacement with the canonical path. Check the checkpoint target and hash before writing, and preserve the original history. The Curator remains responsible for synthesizing the content.
2. Extend the trace parser with the raw native-05 regression to support values returned from spawn, store and load, and shell variables. Check from the real calls and results, then freeze a new evaluator version.
3. Test a fresh fixture again. Open a fresh recall session only after a matching receipt is obtained. Do not substitute a hand repair of the failed fixture for a native end-to-end result.

This round ended with testing and naming the blocker. No runtime feature or latency and cost optimization was added.

## Version identity and evidence

| Artifact | SHA-256 |
|---|---|
| rc.5 candidate, iteration-03 | `11725097611ba5e65ecf2ee6ea39fbf5562061b0053c0e811946e3afe90ff04a` |
| frozen evaluator | `f2f8eb1634e04a141536a589ecdfc585ea3a3e4d8ce85900bbd15f6f32c05371` |
| revised private collector | `4bd44b1ef9b9cafa90a9f3f229b52a5de166d2ff2668c543720197f8bf4dc482` |

Local evidence is under `outputs/graphmory-mvp-repair-20261001/native/private/repair-native-05/evidence/`: `update-capture.json`, `update-score.json`, `pending-score.json`, `final-score.json`, `native-traces.json`, four raw Lead and Curator JSONL files, `collector-failures.json`, the independent inventory and its correction, `post-score-integrity.json` and `cleanup.json`. The oracle, freeze and preimage data are kept in the same private run.

Times from the launcher: the update took about 186 seconds and the pending refusal about 38 seconds. These are the wall time of the whole Lead and Curator workflow for one run, and support no general conclusion about speed.

Only the native-05 `node_modules` and the temporary npm cache were cleaned after scoring. The candidate tarball, the fixture, the state, the preimages and all the evidence were kept. No real vault or global config was changed, and nothing was committed or pushed.

This result covers one synthetic scenario on Codex with Luna. It is evidence of correctness for this round only. It is not a benchmark result showing superiority over other tools, and not an endorsement of unattended use.
