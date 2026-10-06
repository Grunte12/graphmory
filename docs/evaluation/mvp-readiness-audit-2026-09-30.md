# MVP readiness audit — 2026-09-30

**Scope:** read-only exploration, validation, audit and verification of baseline `e3e43ab`, Graphmory `0.5.0-rc.3`. **Outcome:** baseline checks pass, but scoped MVP readiness is not established. Two concrete correctness gaps were independently reproduced; several mandatory native integration gates remain unverified.

The user changed the round to plan-only while implementation drafts were in progress. Those drafts and their new runtime/tests were removed from the active repository; no draft result is used to claim baseline readiness. The active deliverables are this audit, the [implementation plan](../history/mvp-finalization-plan-2026-09-30.md), and a [proposed unexecuted native protocol](mvp-native-protocol-2026-09-30.md). No commit/push, global installation, native Codex acceptance session, or private Obsidian vault mutation occurred.

## Actual checks

| Check | Actual result | What it establishes |
|---|---|---|
| `npm run check` on restored baseline | PASS: 368 tests, zero failures, example/schema checks and configured deterministic evals | Existing mechanical/regression coverage passes; does not prove complete native workflow. |
| `doctor --json` | ok=true; Node 24.18.0/Git required checks pass; optional GitHub-auth warning | Machine prerequisites for local use are available. No vault was connected by this check. |
| `npm pack --dry-run --json` with isolated writable cache | PASS: 105 files; all ten checked CLI/skill/reference/guide paths present | Package includes the checked runtime/install instructions, not actual installed native dispatch. |
| Runtime/package/test diff vs baseline after cleanup | None | Proposed fixes are not active implementations. |
| New native acceptance execution | Not started | No new end-to-end success claim is available. |

The first package dry-run failed because the default npm cache was inaccessible (`EPERM`). No ownership/sudo/config change was made. An isolated temporary cache resolved it. The audit parser initially assumed array-shaped npm JSON; the installed npm emitted an object shape, so the audit extraction was corrected. Both issues are recorded rather than treated as Graphmory runtime failures.

## Reproduction 1: missing durable fields passes persistence check

A disposable synthetic vault contained `Policy.md` with only matching `status: active` and the requested multiline `revalidate_when` item. Its body did not save the supplied claim, rationale, applies/excludes, source or confidence/type. A schema-valid patch supplied all those fields.

Executed baseline CLI:

```sh
node scripts/brain-sync.mjs verify-patch-persistence --vault "<temporary-vault>" --input "<temporary-patch.json>" --note "Policy.md" --agent
```

Actual exit code: **0**. Actual result:

```json
{"valid":true,"metadataOnly":true,"checkedFields":["lifecycle.status","lifecycle.revalidate_when[0]"],"errors":[]}
```

The command is honest about being metadata-only, but that limited check cannot establish complete patch persistence. Existing Curator guidance still depends on model judgment for saved claim/scope/source correctness. Proposed fix: strict field-preservation gate plus independent native evidence support review; do not relabel textual preservation as semantic truth verification.

Evidence: `src/patch-persistence.mjs`, `skills/memory-curator/SKILL.md`, `scripts/setup-curator-agent.mjs` on `e3e43ab`.

## Reproduction 2: expired active authority reaches current recall

A synthetic `Expired.md` had `status: active`, `valid_until: 2020-01-01` and a deployment-owner policy. Query was `deployment owner approval` with the default Curator workflow, no historical/noncanonical flags.

```sh
node scripts/brain-sync.mjs recall-managed --vault "<temporary-vault>" --query "deployment owner approval" --agent
node scripts/brain-sync.mjs lifecycle-audit --vault "<temporary-vault>" --json
```

Actual current recall exited **0** with confidence `bounded`, returned `Expired.md` as an active candidate, and reported no incomplete scan. The separate lifecycle audit exited **1** with `expired-valid-until` for that same file. Thus audit detects expiry while eligibility permits it. Proposed fix: one consistent expiry rule in both audit and current-retrieval eligibility, including cache invalidation and explicit historical access tests.

Evidence: `src/retrieval.mjs:isRetrievable`, `src/memory-lifecycle-audit.mjs:auditDocument` on `e3e43ab`. The synthetic files were removed after recording the outcomes; no private data was used.

## Native evidence available before this round

The source-repository report `docs/evaluation/source-handoff-fresh-session-2026-09-29.md` records one actual installed Codex named-Curator write→fresh-session recall case (historical evidence, intentionally not shipped in the trial package). It passed exact path/hash handoff, immutable source, lifecycle/lineage and read-only subsequent recall in that case. It used a Sol Lead and Luna child before the later preference for Luna-only tests; future acceptance must use Luna for both.

That report explicitly leaves these gates open:

- unsupported-write refusal,
- equal-authority conflict handling,
- necessary evidence beyond the first candidate page with a stop reason,
- actual graph-engine path trail, distinct from manual link following,
- broader host acceptance and failure recovery.

Read-only fixture exploration in this round found a depth-2 graph path and showed that changing the query can move required evidence from page 0 to offset 10. These are fixture-preparation observations only: no frozen native acceptance run was executed, and they are not evidence that the Curator handled either scenario.

## Capability interpretation

| Capability | Status for this audit |
|---|---|
| CLI/schema/keyword paging/original readers | Implemented; baseline deterministic checks pass. |
| Markdown-derived graph and historical status filters | Implemented; native coverage remains bounded. |
| Date audit | Implemented; current retrieval has reproduced eligibility inconsistency. |
| Event revalidation | Conditions can be stored; external events require manual review. |
| Whole patch field persistence | Not provided by current metadata-only verifier. |
| Multi-note completion/recovery checkpoint | Proposed, not active in baseline. |
| Named Codex Curator write→fresh-read | One previous synthetic native case passed; full acceptance still open. |
| Cursor/Claude/OpenCode native workflow | Not established by this scoped audit. |
| Semantic/Jev/local decision/sync | Existing optional paths; not evaluated in this round or required for the local Codex trial. |

## Release recommendation

Do not label the final scoped MVP ready yet. Complete bundles A–D and every mandatory gate in the [implementation plan](../history/mvp-finalization-plan-2026-09-30.md), then publish actual state/trace evidence. Keep the baseline's passing tests as useful mechanical evidence, while leaving missing integrations and failed invariants visible.

## Plan review addendum — 2026-10-01

The user requested review and optimization of the plan. Runtime/package/skill/test code is unchanged; no new implementation or native acceptance was run. The plan and protocol are now revision 2. The baseline test count and reproductions above remain the original observations, not new test results.

Read-only code inspection confirmed the integration boundaries relevant to this revision:

- `source-handoff.mjs` binds exact file paths, hashes and real vault root; it has no whole-operation target/preimage state and requires at least one file source. A user-statement-only patch therefore cannot simply be forced through that helper.
- `source-read.mjs` provides safe full Markdown reads; `atomic-write.mjs` provides per-file replacement. Neither establishes multi-file completion, pending-work discovery or ownership across native edits.
- `validateMemoryPatch` accepts user-statement/file/command/artifact/url attribution and requires lifecycle conditions, but `valid_until` is currently checked as a string rather than strict calendar validity. The proposed stricter workflow must be explicit about compatibility/date behavior.
- The note-schema reference gives general claim/applicability/provenance guidance; it does not define an unambiguous full-field comparison format. The proposed full verifier needs a frozen record format and negative cases, not whole-note substring matching.
- Installation docs describe repository distribution, Node 20+, optional dependencies and preservation of existing layout/config. Fresh Node 24 acceptance alone cannot establish the declared minimum runtime; test it or narrow the supported claim honestly.

The following are **design-review risks**, not independently reproduced failures: forgotten private checkpoints after session interruption, overlapping Curator operations, closing against a different patch, stale success receipts, quoted-only field matches, unrelated audit findings blocking a patch, and inadequate coverage of new-memory intake.

Revision 2 adds explicit contracts/gates for those risks, a single coordinated-writer scope, pending-work guards, patch-bound completion/replay, new-memory creation, and independent state assertions. Optional hosts/engines and external editor concurrency remain outside the trial claim. The one-hour implementation target now has early interface/host preflight and no waiver of mandatory gates.

This addendum reports a document/code review. It does not establish that any proposed guard works. Implementation and G1–G9 acceptance remain open.

Document verification after revision 2: all 14 local Markdown links resolve, code fences/whitespace checks pass, and G1–G9 have explicit plan/protocol coverage. Git comparison confirms no tracked runtime/package/skill/test changes. The baseline suite was not rerun for this document-only revision; 368 passing tests above remain the prior audited result.

## Final independent verification — 2026-10-01

Root and an independent Luna Max reviewer checked the plan/protocol against existing helpers. Two remaining ambiguities were corrected in revision 3:

1. Checkpoint coverage now names all regular Markdown, including raw/history/hidden files, plus `.obsidian/` JSON, excluding `.git/` and `node_modules/`. Recall readers have different filters and cannot silently define this coverage. Incomplete/unreadable coverage refuses. Independent whole-fixture snapshots remain broader than the runtime checkpoint's supported formats.
2. Source drift blocks successful application, but approved target-only restoration preserves that external drift and reports it. “Sources untouched” means restore never writes them, not that recovery must overwrite evidence to recover old hashes. Recovery does not attest factual revalidation.

The matching assertions were added to the proposed protocol. No implementation/native run, package installation or new performance experiment was executed. The one-hour target remains conditional; missing acceptance gates remain open. Baseline runtime files remain unchanged.

Final revision-3 document checks: PASS for all 14 local links, G1–G9 coverage, revision headers, balanced code fences and whitespace. `git diff --exit-code HEAD` passes for all tracked files; only the three planning/audit documents are untracked. No new runtime-test result is claimed.
