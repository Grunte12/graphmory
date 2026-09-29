# Graph/history repair: installed and native acceptance

## Result

**The history-link defect is repaired on the tested case. Strict native protocol acceptance is not complete.** The installed CLI and final native state preserve both history directions while still excluding superseded authority from current retrieval. The child initially guessed nonexistent filenames, repaired the read and continued; that contradicts this trial's preregistered instruction to stop on tool execution failure. Record the deviation rather than changing the frozen protocol or reporting a perfect run.

Baseline `334ee5e`, plus the graph diagnostic and installed Curator guidance changes; [preregistered protocol](graph-history-repair-protocol-2026-09-29.md), [metadata-only results](../../eval/reader-pilot/graph-history-repair-2026-09-29.json). The earlier [failed lineage trial](native-curator-lifecycle-recovery-2026-09-29.md) is preserved. No official scores, holdouts or competitor runs were changed.

## Implementation

- `src/graph-navigation.mjs` checks resolved targets against the supplied document inventory before current-graph eligibility. Existing scope/lifecycle exclusions go into bounded `excludedReferences` and `excludedCounts`; unresolved/ambiguous references remain `issues` and `issueCounts`.
- Current graph nodes, traversal eligibility and stale/superseded filtering are unchanged. Informational exclusions do not authorize deleting a valid history link. These diagnostics do not prove filesystem-wide absence beyond the scanned inventory.
- Installed Curator role and skill preserve predecessor/successor links and use existing `read-notes` with JSON-array paths. Corrected the skill's erroneous wording about marking the replacement superseded: the predecessor is superseded, the successor remains active.
- The knowledge-graph guide documents the new fields, bounds and dual exclusion counts. This explanatory guide edit followed the native package freeze; runtime/guidance source hashes used by the trial are recorded in the result JSON. No change to runtime files occurred after packing.

## Deterministic verification

Luna implemented the graph module and regression cases; root reviewed the diff and independently checked the installed package.

| Check | Observed result |
|---|---|
| Focused graph tests | 10/10, including superseded target, scope/stale exclusion, ambiguity, missing wiki/relative Markdown and bounded summaries |
| Full `npm run check` | 367 tests passed, plus examples/schema and configured deterministic evals |
| Fresh installed CLI fixture | All six checks passed: existing history informational, real missing evidence remains an issue, resolved historical path identified, current search excludes old note, explicit history includes it, audit/recall do not change note bytes |
| Private vault status | `SYNC_CONFIG_NOT_FOUND`; private config/notes were not changed |

These checks do not establish general semantic answer quality.

## Actual native execution

Codex CLI `0.146.0`; Lead `gpt-5.6-sol` low; actual runtime child `graphmory_curator` using `gpt-5.6-luna` low, `fork_turns=none`. One child handled two sequential tasks: approved Helios E2 consolidation and exact patch replay with current/historical recall. This is one known synthetic scenario, not two independent samples.

The first launch did not start because automatic permission review exceeded its deadline. Its explicitly permitted single retry launched one model workflow. There were no repeated model experiments or inline fallback. The process exited 0 after 155.791 seconds; this time is trace metadata, not evidence of a latency improvement.

### Verified final state

All 16 independent physical/state checks passed:

- Original approval record is byte-identical to baseline; prior E1 claim and source link remain.
- Predecessor is superseded and points forward; active successor retains `Supersedes [[Release Policy]]` and E2.
- Runbook points to the active successor; the exact revalidation event is retained.
- All five Markdown files match the parent's post-first-apply snapshot after replay; no duplicate note.
- Installed lifecycle postcheck passes its limited status/event fields.
- Graph audit reports no broken-reference issues and one informational `lifecycle:superseded` history reference. The backlink remains present.
- Current recall omits the predecessor; explicit historical recall includes it. Returned paths alone do not prove a complete supported answer.

Eight trace checks also passed: actual runtime binding, fresh-context spawn, two terminal child tasks, valid preflight before first write, successful original reading before first write, postcheck before first completion, snapshot ordering and no `curate-plan` call.

First child completion: 14:22:33.824 UTC; parent snapshot: 14:22:41.231; retry dispatch: 14:22:50.141; second child completion: 14:23:16.791. Root re-ran the installed postcheck, graph/lifecycle audits and current/historical queries independently. Final lifecycle audit has zero findings; that does not substitute for source/history checks. The audit helper initially requested lifecycle output with `--agent`, then used the supported `--json` output before recording its final result.

### Failed read and protocol deviation

The child invented separate `Approval Record E1.md`/`Approval Record E2.md` source files and `Release Runbook.md`, although the actual evidence file contains E1/E2 sections and the target is `Runbook.md`. `read-notes` failed with `ENOENT` before any write. A bounded fixture file listing supplied the actual names, then `read-notes` successfully returned the original approval record and target notes, with hashes, before the edit.

This is a source-path handoff/tool-selection gap, not the prior whitespace-splitting error or a failure to preserve history. Recovery was safe on this fixture, but continuing after the failed read deviated from the frozen protocol. Therefore `acceptancePassed=false`; physical success cannot erase execution deviations. No extra model run was started to obtain a cleaner result.

## Next action and limits

Carry the path-grounding gap into Phase 2: give the Curator exact resolved original paths and distinguish file paths from section/evidence IDs. Preregister bounded safe read recovery explicitly for the complete write → new-session → recall sequence, while prohibiting writes until actual originals have been read and support/authorization verified. Preserve this trial's stricter protocol and result unchanged.

Fresh-session recall, later-page evidence, graph-engine multi-hop, cross-host reliability, full patch semantics, crash recovery, official benchmarks and comparative cost/latency are not established by this trial. Graph/guidance changes are bundled; their independent contributions are not isolated.

Exact terminal native sessions were archived through the app and archive states confirmed. After evidence capture, the temporary installed package, project, vaults and raw local copies were removed; global archived rollouts were preserved. Public artifacts contain synthetic paths/hashes and runtime metadata only.
