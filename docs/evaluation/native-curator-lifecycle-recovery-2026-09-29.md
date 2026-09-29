# Native Curator lifecycle recovery: evidence closeout

**Overall result: FAILED.** The synthetic workflow reached the requested outcomes and byte checks passed, but the lineage-preservation gate failed: the Curator removed the successor’s `Supersedes [[Release Policy]]` link after graph audit treated its superseded target as excluded-or-missing. The final clean graph-audit output therefore does not establish preserved lineage.

This closeout covers the single synthetic acceptance run for `graphmory@0.5.0-rc.3`. It is not an official benchmark, holdout, or general performance claim. The run exited 0 and recorded 192.582 seconds wall time.

## Task outcomes

| Task | Outcome | Evidence |
| --- | --- | --- |
| Approved E2 update | `APPLIED` | The active policy note contains the approved claim and E2 evidence link; the Runbook points to it; the prior policy retains E1 and is marked superseded. The event-based revalidation trigger is present. |
| Identical retry | `APPLIED/no-op` | The child reported no Markdown writes or duplicate note. Independent final SHA-256 values for all five Markdown files match the snapshot captured after the first apply. |
| Missing provenance | `BLOCKED` | Installed CLI preflight rejected the patch with `provenance must contain at least one evidence item`. The complete vault file map, including `.obsidian` metadata, matches baseline. |
| Conflicting 30/60-second sources | `TENSION` | Both original evidence notes were read and the disagreement was reported without choosing a value or writing to the vault. The complete vault file map, including `.obsidian` metadata, matches baseline. |

## Acceptance gates

| Gate | Result | Finding |
| --- | --- | --- |
| Native child binding and fresh-context spawn | PASS | The host binding record identifies one `graphmory_curator` child using `gpt-5.6-luna` at low reasoning effort. The parent trace records `agent_type=graphmory_curator`, `fork_turns=none`, and no model override. Child session metadata confirms the child ID and role; it does not repeat the model fields. |
| Preflight before first durable write | PASS | The child trace shows valid `validate-patch` output before the first patch edit. The missing-provenance case stopped at invalid preflight. |
| Original source reading | PASS WITH REPAIR | The approved update’s E1/E2 evidence was read before edits. In the conflict case, an unquoted `find` loop split paths containing spaces and its `sed` reads failed; subsequent reads using individually quoted paths succeeded for both source notes. |
| Child persistence postcheck | PASS, LIMITED | `verify-patch-persistence` returned valid with `metadataOnly=true`. It checked only `lifecycle.status` and `lifecycle.revalidate_when[0]`; it does not establish persistence of confidence, scope, provenance quality, factual authority, or supersession semantics. |
| Independent installed-CLI postcheck during closeout | PASS, LIMITED | Root ran the installed package against the final replacement and patch during closeout: exit 0, `valid=true`, `metadataOnly=true`, status/event fields only. This was an independent after-run check, not a call in the native Lead trace. |
| Immutable source files | PASS | All four source-file hash assertions across the three fixture cases match their recorded baselines. |
| Missing-provenance and conflict vault preservation | PASS | Both complete file maps match their baselines, including Obsidian metadata. |
| Retry byte idempotency | PASS | Final hashes for all five Markdown files equal the post-first-apply snapshot; the only added Markdown path is the intended replacement policy note. |
| Lifecycle lineage preservation | **FAIL** | The first successor version included `Supersedes [[Release Policy]]`. Graph audit reported one `excluded-or-missing` edge because the target was superseded and excluded from that audit view. The child removed the successor backlink; the final successor has no `Supersedes` link. The predecessor still points forward with `superseded_by`, but the required reverse lineage link was lost. |

The final graph audit reported no issues after the backlink was removed, and lifecycle audit reported no findings. Those results do not cure the lineage failure. The final replacement policy still contains the approved claim, E2 link, and revalidation trigger; the limited persistence postcheck does not verify the broader patch fields.

## Runtime and evidence record

The host binding record names one child, role `graphmory_curator`, model `gpt-5.6-luna`, reasoning effort `low`; the child was reused sequentially for all four tasks. Parent and child thread IDs are recorded in the companion JSON for archive traceability. The child rollout confirms the role and task sequence. Model and reasoning fields are present in the host binding record rather than repeated in the child session metadata.

All fixture vaults and evidence are synthetic. This run does not establish cross-host reliability, general workflow performance, full patch-field persistence, factual authority, or comparative cost/latency. No official score or holdout was used.

## Independent root closeout

Root independently rechecked all fixture source hashes, both refusal/conflict full-vault file maps, final Markdown hashes against the retry snapshot, the retained event trigger and missing backward history link. Trace timestamps establish first child completion at 05:45:11.282 UTC, parent snapshot capture at 05:45:21.477 UTC, and retry dispatch at 05:45:30.371 UTC. The snapshot falls between completion and retry as required. Root ran the installed lifecycle postcheck after the native run; it passed its limited metadata fields. No model run was repeated. Exact terminal parent/child sessions were archived through the app and their archive states independently confirmed. Temporary package/project/vault copies were removed after evidence capture; global archived rollouts were preserved.
