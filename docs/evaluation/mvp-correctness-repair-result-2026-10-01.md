# Graphmory: MVP repair and test result — 2026-10-01

## Status summary

**The code and the guide were fixed, but the MVP is not yet declared ready for the full workflow.**

The code checks pass 414/414, the installed package matches the archive for 119 of 119 files, refusing to read while work is pending passes on a real Codex, and a checkpoint created with rc.4 can be finished or recovered with rc.5.

What still needs confirmation is **the Curator completing an update when there is a new note, then reading the data back in a fresh session**. Two update tests still FAILED, and both were kept. The guide fixed the latest cause, but no native update has been run after that fix, because the scope limits repeated attempts.

## What was fixed and why

| Area | What was fixed |
|---|---|
| Lifecycle | A reference to an old note that has correct predecessor and successor links is no longer taken to mean the current note is itself old. It supports prior, previous and earlier rule, policy, record and version, and still checks the relationship in both directions |
| Conflict | `No decision yet.` no longer counts as a decision path. A named step or owner is required |
| Retrieval and read authority | The agent read command checks the pending state before reading, before provider or cache work, and before sending output. It also checks for a state change during the read |
| Recovery | A recovery read is allowed only for the operation and the paths in the manifest. It checks the source hash and keeps partial and recovery data apart from confirmed data |
| Finish diagnostics | When a task cannot be finished, a short path, kind and next action are reported and the pending work is kept. No note body appears in an error |
| Curator setup and skill | A single state root, respect for BLOCKED, and a receipt check. An existing original is separated from a clearly approved new target, and prepare is required before a new file is created |

Exploration, code fixes and focused checks were done by separate Luna Max runs. The root combined the work, checked the archive and ran the native acceptance. No retrieval strategy was changed, no provider was added and no competitor was benchmarked in this round.

## Results against criteria R1–R13

| Criterion | Result | Evidence |
|---|---|---|
| R1–R4 lifecycle, history, conflict | PASS, deterministic | Exact chain, self-stale, broken, ambiguous or expired chain, negated decision, and the wording found in the native failure |
| R5–R8 read guard, recovery, clear reads, state transition | PASS, deterministic | Focused integration 104/104 and the regression suite |
| R9 regression, package, install | PASS | `npm run check` 414/414, zero skipped; the final archive, checkout and installed copy match for 119 files; the project skill and role were created by the real installer |
| R10 native approved update | not confirmed against the final guide candidate | The two earlier native runs FAILED; one wrote partial edits and then finish failed, the other stopped before prepare or any write |
| R11 fresh current, history and unsupported recall | NOT RUN | There is no native update with a matching APPLIED receipt yet, and data prepared by hand was not substituted to make it pass |
| R12 fresh pending refusal | PASS within what could be observed | Actual Lead and Curator, a pending envelope, no policy answer or raw vault bypass, vault hashes 12/12 equal to the seed; all automated gates passed |
| R13 rc.4 to final rc.5 compatibility | PASS | Two lanes: finish produced a matching receipt and full persistence; the reviewed restore returned all 12 baseline files, a recovered state and no receipt |

R12 has an evidence limit: the hash of every state tree file was not recorded before launch, so it is not claimed that the whole state bytes were compared before and after. It could be checked that the operation, the preimages and the current hashes match the seed, that the state files have an mtime before launch, and that the trace has no command that writes state.

## Native experiments that actually ran

Every session used the Codex CLI, with the Lead and the named `graphmory_curator` on `gpt-5.6-luna` at effort `low`. They have a raw dispatch with `fork_context:false`, no child model override, and the actual child and wait metadata was checked.

| Run | Candidate | Result |
|---|---|---|
| `repair-native-01` | `978c…cdd` | The model did not start: the graph preflight read the edge objects wrongly, and a role created by the harness itself conflicted with the installer. The failure was kept and the harness fixed |
| `repair-native-02` | `978c…cdd` | R10 FAIL: persistence was correct, but the audit rejected a Runbook that cites `superseded prior rule` even though the chain was correct. There were partial edits and a pending operation, and no receipt. The grammar was fixed with negative tests |
| `repair-native-03` | `aa2b…a80` | R10 FAIL: the Curator treated an approved new target with no file yet as a blocker and stopped before prepare or any write. An independent check found the vault 12/12 unchanged, with no operation or receipt. The guidance was fixed |
| `repair-native-04` | `1172…04a` | Ran R12 only: BLOCKED and CURATION_PENDING as expected, no policy details and no vault changes in either parent or child; it ended with task_complete |

The final candidate is `artifacts/iteration-03/graphmory-0.5.0-rc.5.tgz`, SHA-256:

`11725097611ba5e65ecf2ee6ea39fbf5562061b0053c0e811946e3afe90ff04a`

The version is the same in all three iterations but the archive hashes differ, so they are kept apart and the hash identifies the candidate; older archives were not replaced.

## Recorded eval errors

- The first lifecycle focused run scored 15/16, which led to fixing a genuine negated-decision defect. The FAIL was not deleted.
- The first R13 harness expected a field `blocked:false` that rc.4 does not return; the second called the rc.4 binary instead of rc.5. It was fixed to use two separate installs, and the version and archive-member parity are checked before every CLI call. The run with the right candidate passed.
- The native scorer was fixed for reading graph edges and the actual host dispatch schema, recording the old and new scorer hashes and keeping the semantic gold, candidate and input unchanged.
- Native02 still had scorer limitations: the source anchor `.md#D2`, lowercasing of the state path, and offset 0 that the CLI uses as a default. The native03 capture still threw when a required new target was missing. All of this is in the remaining eval work, and these errors were not used to remove a genuine workflow FAIL.
- The first independent pending review compared the status with the manifest using the wrong type, and misread a `sed` that read the skill as a raw vault read. The original file was kept and the correction recorded separately. The automated R12 PASS stands.

## Next steps before declaring the MVP ready

1. Repair the scorer using the recorded traces: source fragments, case-preserved state paths, implicit offset 0, and a missing target must return FAIL with a reason instead of crashing. Add a state-tree hash snapshot before launch.
2. Freeze the evaluator, candidate, input and gold before opening the model, and keep the exact evaluator bytes.
3. Run a new native update with the fixed new-target guide. Check the source, target, history, receipt and state separately.
4. After the update produces a receipt, run a fresh recall for current, historical and unsupported facts. Report any that fail as they are.

## Scope and evidence handling

This is a synthetic correctness and workflow acceptance for Codex with Luna. It is not a LoCoMo or LongMemEval score, general accuracy, or evidence of superiority over other tools. The CLI guard relies on the agent following the rules; it is not host filesystem isolation and does not promise atomicity against external edits after the last check.

No real vault, `<user-vault>`, or global config or trust was changed, and nothing was committed or pushed. The original failed fixture and operation, the private gold, the raw rollouts, the manifests and the preimages were kept. The pending state was not cleared to make a result pass.

Private evidence: `../graphmory-mvp-repair-20261001/`, including `baseline.json`, `repository-check-03.log`, `candidate-03.json`, the native evidence, and `r13-compatibility-2026-10-01-r13-final-guide-20261001/result.json`. The earlier work left in the working tree was kept, with a round inventory separate from the original Git diff.

Related reports: [lifecycle](mvp-lifecycle-context-repair-2026-10-01.md), [read authority](mvp-read-authority-repair-2026-10-01.md), [native protocol and failures](mvp-correctness-native-protocol-2026-10-01.md), [checkpoint compatibility](mvp-checkpoint-compatibility-repair-2026-10-01.md), [acceptance protocol](mvp-correctness-repair-protocol-2026-10-01.md)

Cleanup is done: only the dependencies, the cache and the Python bytecode in the private test root were deleted. The archives, gold, raw traces, fixture vaults, manifests and preimages were all kept, and the main checkout's dependencies were not touched. It is recorded in `cleanup.json`.

## Follow-up: native-05 after the user approved more testing

The development evaluator was fixed with regression 7/7 and `npm run check` passed 421/421. The same final candidate was then tested with a real Lead and Curator on Luna on a fresh fixture. R10 still FAILED: the Curator did not change the predecessor to superseded and used a short-name replacement link; the full verifier correctly blocked it, the task stayed pending with no receipt, so R11 was not run.

R12 refused to give the data and kept the vault and state tree unchanged, but the frozen automated trace gate still does not read the dynamic wait completely, so the original FAIL score was kept, with an independent raw review that separates the behavior from the limits of the eval. No manual repair was made to turn a failed attempt into a success.

[Follow-up report and recommended fixes](mvp-native-retest-result-2026-10-01.md) · [independent review](mvp-native-05-independent-review-2026-10-01.md)
