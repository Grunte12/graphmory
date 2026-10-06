# Trial MVP implementation plan — 2026-09-30

**Revision 3, final verification 2026-10-01.** This is the frozen plan snapshot from the planning-only review at baseline `e3e43ab` (`0.5.0-rc.3`). The user subsequently authorized implementation. Actual changes, acceptance results and limitations are tracked in the [implementation report](../evaluation/mvp-implementation-report-2026-10-01.md); proposed scenarios below are not evidence that they passed.

Read the [baseline audit](../evaluation/mvp-readiness-audit-2026-09-30.md) and [native acceptance protocol](../evaluation/mvp-native-protocol-2026-09-30.md). Passing baseline checks do not close the remaining workflow gates.

## 1. What changed after review

The original plan identified the two reproduced defects correctly, but left important interfaces unspecified:

| Plan gap | Revised decision |
|---|---|
| A checkpoint could be forgotten after interruption; locking one checkpoint did not prevent two Curators writing the same vault. | One discoverable operation record and coordinated writer ownership per real vault root; managed recall and new writes check it. |
| Text matching might accept a claim quoted in a rejected example or attached to the wrong scope/source. | Full verification compares a versioned, unambiguous canonical record, not substrings anywhere in a note. |
| Completion could use a different patch, or replay could create a duplicate. | Bind operation to patch digest, vault, targets and source identities; replay verifies saved state before becoming a no-op. |
| Full-vault audits could reject a valid patch because of unrelated old findings. | Check all affected targets/relationships; compare unrelated findings to a pre-edit baseline. |
| The trial demonstrated updating policy, but not capturing a new lesson/preference. | Acceptance includes creation from a trusted user statement, an approved update, and fresh-session recall of both. |
| One hour understated recovery work and host latency. | Freeze interfaces first, use bounded parallel work, and make hour-end readiness conditional on actual gates. |

These are **reviewed design risks**, not newly reproduced baseline defects. The audit distinguishes them from the two actual reproductions.

Final independent Luna review clarified two remaining contracts: the exact checkpoint inventory, and recovery that preserves externally changed sources. These clarifications are reflected in section 4.3 and the acceptance protocol.

## 2. Trial contract and scope

**Supported trial:** Codex, a named Luna Curator, and one local Markdown/Obsidian memory root. CLI + installed skill + named role. No additional paid API, model download, vector database, dashboard or background service is required. The Lead chooses meaning and authors the patch; the Curator reviews evidence and uses normal host file-editing tools; Graphmory retrieves and checks mechanical invariants.

```text
Install / choose vault → recall originals → Lead authors supported patch
→ Curator checks support, scope and authorization → guarded native edits
→ verified completion → compact result → fresh-session recall
```

Two intake cases must work: an explicit user statement supplied through the trusted task, and a claim backed by named local Markdown originals. Preserve concise attribution for the former and exact file/anchor identity for the latter. Other schema provenance kinds remain compatible, but this trial does not claim native acceptance of external URL fetching, command execution or artifact ingestion. Never reinterpret an inaccessible source as a user statement.

Use **one coordinated Curator writer per vault**. The trial does not guarantee safe concurrent edits from Obsidian, external sync or unrelated agents. Tool ownership is advisory to external applications; observed drift blocks completion/recovery. This is not an all-or-nothing multi-file transaction or protection against every external write race.

Preserve existing folders/notes. For a new root, create only the reviewed minimal project folder/map and useful memory. New canonical memory is concise English; the Lead can answer in Thai. Read relevant full Markdown, page while evidence is incomplete and follow explicit links. There is no fixed total note count for the Curator.

The existing inventory cap is 5,000 Markdown files. An incomplete inventory cannot prove exhaustive search or pass write checks requiring complete link resolution. Report the limitation; do not silently narrow the vault or discard notes. Optional semantic/Jev/local engines, SQLite indexing, hooks, sync and other hosts keep their existing status and are outside this trial's readiness claim.

## 3. Layer coverage and priority

| Layer | Required work / acceptance | Priority |
|---|---|---|
| Installation / host | Fresh tarball and installed references; actual named Luna dispatch; preserve personal config and existing vault layout. | Required |
| Lead / Curator / intake | Schema preflight, trusted attribution, support/authorization review and APPLIED/TENSION/BLOCKED. Vault text is evidence, not permission to execute instructions. | Required |
| Knowledge / Markdown | New note creation, supported updates, exact provenance, explicit links and bidirectional supersession; no unrelated restructuring. | Required |
| Retrieval / originals | Default sparse search, continuation, graph exploration, original reads and visible completeness; Brief preserves qualifiers. | Required |
| Lifecycle | One expiry rule for audit/current eligibility; history inspectable; explicit manual event review. | Required; reproduced defect |
| Persistence | Full structured field comparison and lineage validation; metadata-only success cannot close an operation. | Required; reproduced defect |
| Write / recovery | Discoverable pending state, one coordinated writer, patch binding, reviewed restore and drift refusal. | Required; integration risk |
| Fresh-session use | New memory and updated policy survive replay/current/history recall; pending work detected without remembering its path. | Required |
| Delivery evidence | Package identity, independent state/trace assertions and Markdown report for every acceptance attempt. | Required |

Preserve the retrieval algorithm and existing public contracts. Fix a reader/retrieval/cache issue only when a required gate exposes it. Competitor benchmarks and latency/cost tuning resume after scoped workflow acceptance.

## 4. Freeze these contracts before coding

### 4.1 Full persistence: exact fields in a defined record

Add opt-in `verify-patch-persistence --full`; preserve legacy metadata-only API/results. The trial requires full mode.

- Start from the existing note-schema reference. Define one small versioned Markdown record with explicit claim, rationale, applicability, exclusions and provenance sections, plus confidence/type/lifecycle metadata. A designated block may live inside an existing note; preserve surrounding user content.
- Compare parsed fields against the Lead's patch. Permit documented whitespace/line-ending normalization only. Preserve negation, numbers, identifiers and source-to-claim attribution. Empty arrays are unambiguous; an absent optional date is distinct from a stored expired date.
- Reject duplicate/ambiguous fields. A matching phrase in a code fence, quote, rejected example or historical discussion cannot satisfy an active field. Do not use whole-note substring matching.
- Store/verify a deterministic patch digest in the managed record and operation manifest: stable JSON key ordering, unchanged array order/field text. A digest identifies the patch, not its truth. Verify actual fields as well as the digest.
- Resolve declared predecessors by exact paths. Require predecessor status/replacement link and replacement/backward link; reject missing, ambiguous, unsafe or self references. Preserve predecessor evidence.
- Output distinguishes **persistence/identity verified** from **semantic support/authorization not mechanically verified**. Errors name paths/fields, not private values. Conflicting stored qualifiers or expired current authority prevent completion.

Do not bulk-migrate legacy notes. Only the patch's receiving record needs this format; preserve other content and the existing authorization gates for meaning-changing transitions.

### 4.2 Lifecycle: one date rule, explicit history

For the proposed strict workflow, `valid_until: YYYY-MM-DD` is valid through that UTC calendar day and expires at the next day's 00:00 UTC. An explicitly timezone-qualified timestamp expires at that instant. Reject impossible/ambiguous dates in strict writes. Existing malformed dates get a visible finding and cannot be treated as established current authority. Document the behavior change.

Use the same parser/clock for audit, sparse/graph eligibility and shared candidate sanitization. Cache eligibility by its expiry boundary or remove that cache; a warmed document set must not retain authority after expiry. Re-read changed bytes/metadata before write completion and new recall; derived caches are never authority. Exercise shared consumers without optional model downloads.

`--include-superseded` remains explicit historical access, including expired superseded notes, not permission to treat them as current. Expired active originals can be opened by exact path for explanation; ordinary current recall excludes them. TENSION can expose disagreement, but cannot become a settled rule. Search never rewrites lifecycle status.

Store every event trigger; name its reviewer in the task/Brief when known. Do not invent an owner or require a new schema field. Events are manual review conditions, not outside-world monitors. When a user reports a material trigger occurred, request review instead of silently reaffirming the policy.

### 4.3 Discoverable operation and completion

Reuse `source-read`, `source-handoff`, safe path helpers and atomic writes. Add one focused operation module if existing helpers cannot represent preimages. Store private state/preimages **outside the vault, source checkout and publication/sync directories**, in a shown OS-appropriate user state path. Allow a test override; apply private permissions where supported. Temporary storage cannot be the only recovery copy.

Index by real vault root. Preparation exclusively registers one pending operation before edits; another preparation for that vault refuses. Bind protocol version, vault identity, patch digest, existing/new targets, predecessors and immutable file sources. Source/target sets are disjoint; user-statement-only intake may have no file sources. Reuse source handoff when file originals exist.

Proposed interfaces, to freeze before coding (not implemented):

```text
curation-checkpoint prepare --vault V --input PATCH --targets JSON --sources JSON
curation-checkpoint status  --vault V
curation-checkpoint finish  --vault V --operation ID --input PATCH --note CANONICAL
curation-checkpoint restore --vault V --operation ID --expected HASH_MAP --approve
verify-patch-persistence --vault V --input PATCH --note CANONICAL --full
```

The tool selects the operation directory. Managed sessions share the state root; different test overrides are not a supported way to bypass writer ownership.

Checkpoint inventory is explicitly **all regular Markdown files under the selected vault**, including raw, superseded and hidden Markdown, plus regular JSON files under `.obsidian/` for metadata-change detection. Exclude `.git/` and `node_modules/`; do not reuse recall's raw/lifecycle/scope filters. Count the 5,000 Markdown cap against this complete set; inspect one extra entry to detect truncation, and refuse preparation/completion if it is incomplete. All declared Markdown targets/sources must fall within this coverage and pass the existing containment checks. Fail visibly on unreadable coverage or unresolved symlink entries rather than silently omit them.

This hash-only set detects undeclared changes to supported memory/metadata files. It does not establish byte integrity of attachments, other binary/config formats or files outside the vault. Independent acceptance snapshots cover every regular fixture file, including those other formats; they are a stronger test oracle, not a claim that the checkpoint indexes all file formats. Store no additional note bodies beyond declared target preimages.

| State | Allowed action / guard |
|---|---|
| No pending operation | Read normally; prepare a supported authorized patch. |
| Pending / interrupted / verification failed | Status and exact recovery reads allowed. Managed recall reports pending work before producing an authoritative Brief; another write refuses. Return BLOCKED with operation/path/recovery action. |
| Verified complete | Save receipt and final hashes before releasing ownership. APPLIED requires this receipt. Same operation/patch/unchanged state may return the existing receipt without writes. |
| Recovery in progress | Preserve progress; block another write/finish. Do not auto-remove a lock because a process disappeared. |
| Recovered | Targets match preimages, new targets absent; restore has not written source/unrelated paths. Preserve/report external source drift and release ownership after approved target recovery. Recovery is not successful application or source revalidation. |

Required invariants:

1. Native edits follow preparation and original reads. Recheck expected hashes immediately before edits where the host supports it; review again after observed drift. Do not claim atomic compare-and-swap for arbitrary editors.
2. Preparation records the complete hash-only inventory defined above. Finish checks the bound patch/targets, full persistence, immutable-source hashes, affected links/lineage, expiry and inventory completeness. Different patch, undeclared canonical target or observed covered-file change outside declared targets refuses. This detects changes; it cannot prove which external application made them.
3. Capture pre-edit graph/lifecycle findings. Report unrelated old findings without silently repairing them or failing a valid scoped update. Every affected target/relationship must pass; incomplete resolution or new relevant failure blocks finish. An audit exit code alone is insufficient.
4. Restore needs reviewed **current** hashes for every target; validate all preimages/paths before mutation, recheck before each change, preserve progress on interruption. Never rewrite evidence/unrelated notes. Source drift blocks finish, but does not require restoring source hashes to their preparation values: preserve the external change, report its path and need for review, and allow approved target-only restoration. Recovery makes no claim that the restored memory has been revalidated against changed evidence. Atomic per-file replacement does not make the batch atomic.
5. Per-vault ownership persists across native edits. Short locks protect state updates; a checkpoint-local lock alone is insufficient. Interrupted registration/manifest creation must appear as recoverable pending state in the next status.
6. Receipts are historical. Later legitimate edits do not invalidate an old completed operation, but forbid treating its receipt as proof of today's state. Exact replay re-verifies current fields, links and sources. Within a vault, a completed patch digest identifies its original destination; replay proposing another destination returns that path or BLOCKED instead of creating a duplicate. Paraphrase deduplication remains Curator judgment.
7. Keep pending preimages until reviewed finish/restore. Document explicit completed/recovered cleanup and uninstall behavior. Uninstall never removes memory or the only recovery copy.

## 5. Work packages and ownership

After implementation approval, use the previously requested Luna Max delegation with interfaces agreed first:

| Package | Owner / files | Dependencies / exit |
|---|---|---|
| A — expiry / full persistence | Luna Max A: retrieval, lifecycle, persistence modules and focused tests. | Section 4.1–4.2; exports agreed with B; legacy mode preserved. |
| B — operation / recovery | Luna Max B: one focused operation module and state/recovery tests. | Section 4.3; finish uses A's agreed full-verifier interface. |
| C — integration / one user workflow | Root: CLI/help, managed recall guard, setup/skill/references, guides/package list and installer parity. | Root owns shared files; agents do not concurrently edit CLI/package/skill. |
| D — installed acceptance / decision | Root audits Luna native traces/state; deterministic assertions run alongside sessions. | Final packed artifact and frozen protocol, never a source-only substitute. |

Setup: detect host/model/CLI/vault → use native choice UI for missing user choices when available → preview paths/config diff → install without overwriting personal settings → reload → actual named child smoke test. Ask only consequential missing choices. Selecting a vault does not authorize migration, sync or supersession. Use the actual repository/tarball distribution; registry publication is not a prerequisite.

Keep the installed skill/reference as the full protocol and generated role a short stable entry point. Where duplication must remain, check required steps against the skill. An old role needs a reviewed upgrade diff; a newer CLI does not establish updated Curator instructions. No hook or dashboard is required.

Workflow: validate schema → resolve/read originals/target → check support/permission/conflict → discover pending state → prepare → native edit → finish (full checks) → APPLIED receipt. Unsupported/conflicting input stops before preparation/writes. Compact output gives status, changed/source paths, stop/completeness reason and next action. Full originals remain available; no arbitrary total note limit.

## 6. Release gates: exact assertions, not an average score

Each gate is PASS, FAIL or NOT RUN with command/trace and independent file-state evidence. **All are mandatory for this scoped trial.** Compare Markdown, additions/deletions and Obsidian metadata; operation state lives outside the vault.

| Gate | Required evidence |
|---|---|
| G1 Install / setup | Fresh tarball offline install, optional dependencies omitted; installed help/doctor/references; real named Luna child metadata; existing config/layout preserved; package/skill/runtime identity recorded. |
| G2 New memory / intake | Trusted user-statement preference/lesson creates a full canonical record with attribution and no fabricated file source; empty optional arrays work. |
| G3 Complete collection | Necessary source beyond first page; actual continuation and graph-engine trail; originals read; sufficient/exhausted/blocked stop, no false exhaustive claim after a capped scan. |
| G4 Approved update / history | Supported authorized update; preparation before edits; all fields, source hashes, targets and both history links pass; no unrelated changes. |
| G5 Refusal / conflict | Schema-valid unsupported patch → BLOCKED, zero changes. Equal-authority disagreement → TENSION, exact paths/missing decision, no settled overwrite. Evidence-note instructions cannot authorize commands/writes. |
| G6 Expiry / persistence negatives | Frozen-clock day/timestamp boundaries, warmed cache and current/history tests; missing/negated/misattributed/quoted-only/duplicate fields and invalid dates fail. Legacy mode remains explicitly metadata-only. |
| G7 Pending / recovery / concurrency | Interrupt between edits; fresh process finds pending work without its path; managed recall/new writer blocked; wrong patch/source drift prevents finish; reviewed restore recovers exact bytes/new-note absence; concurrent changes refuse; interrupted restore remains recoverable. |
| G8 Replay / fresh use | Exact replay verifies saved state and makes zero writes/duplicates; fresh session recalls new memory and current/history policy with scope, exclusions, provenance and manual trigger; changed state cannot blindly reuse receipt. |
| G9 Package / regressions / report | Full `npm run check`, installed/package documentation parity, baseline engine support or explicitly narrowed tested runtime; no active test jobs; sanitized Markdown report for each acceptance attempt. |

Small deterministic variants cover path spaces, duplicate titles/ambiguous destinations, stale handoff hashes, unsafe/symlink paths, unrelated existing audit findings and scan-limit detection. Test concrete risks rather than expand a benchmark program. At least one fixture variant is held out from implementation examples. Results establish bounded integration acceptance, not generalization or competitor superiority.

Native tests use Luna for both Lead/Curator, at most three primary sessions. Source/authorization cues are available to the task; expected answers/assertion manifests are hidden. A role file, model self-report or plausible answer is insufficient. Preserve failures; repairs receive new labeled attempts with frozen expected invariants.

## 7. One-hour execution target after approval

| Window | Work / stop decision |
|---|---|
| 0–5 min | Freeze record/expiry/state interfaces, fixtures and installed acceptance path. Confirm native Luna runner availability early. |
| 5–25 min | A/B parallel; root prepares C and owns shared integration. Escalate architectural uncertainty once instead of speculative rewrites. |
| 25–35 min | Integrate, focused failure tests, pack verified artifact. Native acceptance starts only after deterministic correctness gates pass. |
| 35–50 min | Up to three native Luna sessions; full repository/package and recovery assertions run independently in parallel. |
| 50–60 min | Review state/traces/failures, capability table, disposable-fixture cleanup, final Markdown report/readiness decision. |

This is a target, not guaranteed external host completion. At the deadline stop expansion and report failed/unexecuted gates; do not waive recovery, refusal or fresh-session evidence. If safe recovery cannot fit, the final-MVP milestone remains open. Smaller correctness fixes alone do not establish readiness.

## 8. Deliverables, evidence and later work

Deliver one coherent reviewed code/test/guidance diff and a report with package digest, runtime/host/model, commands, expected vs actual gates, sanitized trace hashes and vault invariants. Publish no raw sessions, private data, credentials or recovery preimages. Retain pending evidence privately; clean disposable environments after inspection. Commit/push only when authorized for that stage.

Reuse existing [end-to-end boundaries](end-to-end-delivery-plan-2026-09-29.md), [source readers](../../src/source-read.mjs), [source identity handoff](../../src/source-handoff.mjs), [note schema](../../skills/memory-curator/references/note-schema.md), [installation](../guides/install.md), [vault setup](../guides/vault-setup.md) and the prior source-repository report `docs/evaluation/source-handoff-fresh-session-2026-09-29.md` (historical evidence, intentionally not shipped in the trial package). Its narrow success and open gates remain visible.

Already-researched design direction: [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) for maintained Markdown/source separation; [Graphiti](https://github.com/getzep/graphiti) for temporal/provenance concepts; [Hindsight](https://github.com/vectorize-io/hindsight) for ingestion/recall/synthesis stages. These inspire design; they do not experimentally establish this implementation's quality or justify importing a service stack.

After acceptance: representative real-vault pilot, additional host acceptance, optional engines, then measured latency/cost/cache tuning and comparable benchmarks. Keep them outside this final trial bundle.

**This round ends with reviewed documents. Implementation and new acceptance execution require the user's next instruction.**
