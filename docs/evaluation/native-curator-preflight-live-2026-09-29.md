# Native Curator preflight and lifecycle acceptance

## Frozen setup, before native execution

Follow the [declared protocol](native-curator-preflight-protocol-2026-09-29.md). Latest production revision `e34cfa7` is packed and installed offline in an isolated prefix with optional dependencies and scripts omitted. Installed doctor passes. Project-scoped `graphmory_curator` uses CLI-supported `gpt-5.6-luna` with low reasoning; Lead uses `gpt-5.6-sol` low. No global file or private vault edit. One Lead session, four sequential tasks (approved first apply, same-patch retry, missing provenance, unresolved conflict), reusing the named child where supported. No generic fallback or answer-tuning retries.

The pre-generation schema baseline is `[valid, invalid, valid]`. Sources and complete failure-vault snapshots are hashed. Current recall must omit superseded policy, historical note must remain, and audit warnings remain separate. A post-first-apply snapshot is collected before the duplicate retry. Native binding/model and ordered preflight-before-vault-edit evidence must come from runtime metadata and traces, not the Lead's assertion.

## Setup corrections before model execution

The local pack helper initially expected npm JSON as an array; this machine returned a package-keyed object. Parsing was corrected and the same successfully generated artifact installed. The first fixture generator accidentally passed the approved patch into the missing-provenance case. Independent installed-CLI preflight found all three inputs valid. The case was corrected to use the missing-provenance object and a fresh fixture regenerated; baseline is now `[0,1,0]` exits. Neither issue is a model/runtime result, and no live attempt used the invalid fixture. Conflict-source links were added before freezing the fixture. Regression verification must guard the actual negative-case schema and source manifests.

## Result

The Lead completed with exit 0 in 238.308 seconds. Runtime parent-child metadata confirms one named `graphmory_curator`, `gpt-5.6-luna` low, reused across four completed sequential tasks. Child trace ordering records four actual preflight returns `[true, true, false, true]`; the first valid return precedes the first vault patch. Runtime IDs/raw traces are omitted from public evidence.

| Task | Native outcome | Independent physical verification |
| --- | --- | --- |
| Approved update | `APPLIED` | New active policy has the supported separate-approver rule and E2 link; old policy retains its old claim and E1, with superseded status and replacement link; Runbook links new policy. |
| Same-patch retry | Already applied, no-op | Every Markdown file is byte-identical to the independently collected post-first-apply snapshot; no duplicate note is created. The fixed replacement path was supplied for both tasks. |
| Missing provenance | `BLOCKED` | Actual validator returns false; the complete vault, including Obsidian metadata, is identical to baseline. No evidence was invented. |
| Conflicting sources | `TENSION` | Both 30-second and 60-second current source paths are cited; complete vault remains unchanged and no timeout is selected. |

All immutable source hashes match baseline. Installed current-state recall includes Independent Approval Policy and excludes superseded Release Policy. Independent graph/lifecycle audits return zero findings in all three fixtures. These are fixture-specific results: the previous smoke's warnings remain reported in its own record. Original multi-note reading and physical link chains do not establish measured graph-engine traversal.

## Newly exposed persistence gap

Despite the declared navigation/status/source-preservation gates passing, the new canonical policy does **not** retain the input patch's `lifecycle.revalidate_when` trigger (`the production approval policy changes`). The saved note includes only status, canonical flag, claim and E2 source link. Existing lifecycle audit reports zero findings because it checks present date-based signals and explicit status, rather than verifying output against the complete approved patch. Therefore this run does **not** establish complete patch persistence or a finished lifecycle workflow. Input schema preflight alone cannot verify the output. This omission is retained as the next concrete correctness issue, not hidden by a clean audit or the Lead's `APPLIED` label.

Next investigate a small post-write verification using existing note/schema mechanisms and an explicit canonical representation of revalidation triggers. Preserve supported claims, scope and source lineage; keep date-based expiry and event-based revalidation distinct. Do not silently repair this frozen run or count an unobserved corrected prompt as a live pass.

[Sanitized native execution evidence](../../eval/reader-pilot/native-curator-preflight-live-2026-09-29.json) includes package/config/trace hashes, ordered events, full synthetic after-manifests and the persistence gap. One synthetic Codex run, using a supplied fixed replacement path, proves neither general duplication handling, cross-host reliability, provider caching behavior nor comparative speed/quality. Elapsed time describes this workflow only; no matched latency or token-cost comparison was made.

## Repository verification

`npm run check` passed: 358 unit tests passed, zero failed, followed by shipped example validation and deterministic evals. The new fixture regression verifies actual `[true,false,true]` patch validity, SHA-256 manifests and refusal to overwrite an existing output. Source-reading verification inspects the exact child trace: scoped evidence reads returned the approval body and both conflicting 30/60-second original bodies. Private-vault status remains `SYNC_CONFIG_NOT_FOUND`; no private config/note was created. Temporary fixtures and raw traces are removed after sanitized reporting.
