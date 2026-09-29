# Graphmory: complete the integrated memory workflow

Status: active delivery plan, authorized 2026-09-29. This changes the execution priority of the earlier optimization goal and [full-layer evaluation plan](../evaluation/full-layer-evaluation-plan-2026-09-28.md). Historical experiments and benchmark scores remain unchanged.

## Revised objective

Deliver a simple, installable Markdown memory tool for coding agents whose supported workflow works across installation, native Curator dispatch, evidence retrieval, original reading, supported writes, lifecycle/history, subsequent recall, and optional sync. Prove the connections with actual installed-package workflows and failure recovery, not only module tests. Optimize latency, provider caching, token cost and comparative benchmark scores after this acceptance gate.

“Done” means the declared release scope passes documented acceptance cases. It does not mean perfect behavior on arbitrary data, every host/model, or superiority over all tools. Unknown and unsupported capabilities remain visible.

## Product scope

- **Default:** host Lead + named inexpensive subscription Curator + Graphmory CLI/skill + user-owned Markdown vault. No separate model API, database service or embedding download required.
- **Canonical structure:** evidence, linked operational notes and derived views remain separate; preserve English canonical notes, exact identifiers, original evidence and user-selected response language. Preserve an existing vault layout unless its owner approves migration.
- **Retrieval:** candidate paging, original-note reads and explicit graph navigation. A response budget is not a fixed total three-note cap. Record why evidence collection stops.
- **Optional paths:** hosted Jev, local decision/reranker, semantic search, hooks and Git sync retain separate capability/status labels. They do not become mandatory prerequisites for the default workflow. Ship an optional path as verified only after its own integration check; otherwise document it as experimental or unsupported in the release matrix.
- **Setup:** agent-guided interview plus optional deterministic setup helper. Preview configuration, preserve existing files and verify actual host discovery. Do not build another general configuration UI before demonstrating that the existing flow cannot meet these requirements.

## Layers and boundaries

| Layer | Input → output | Existing implementation | Integration acceptance |
|---|---|---|---|
| 1. Installation and host adapter | package + user choices → CLI, skill, named Curator | `scripts/install.mjs`, `scripts/setup-curator-agent.mjs`, `adapters/` | Fresh package works; linked instructions present; existing config preserved; real named child dispatched. Record each host/version separately. |
| 2. Lead/Curator handoff | task or lead-authored patch → explicit Curator task | Curator skill, host role templates, contract schemas | Model/role binding observed; context and authority passed; malformed input blocked before durable writes; no silent inline replacement. |
| 3. Vault and knowledge structure | evidence + canonical notes → resolvable source/relationship paths | `src/brain-sync.mjs`, `src/retrieval.mjs`, `src/graph-navigation.mjs` | Existing history stays linked; missing/ambiguous references distinguished from intentionally excluded historical targets; graph connectivity never substitutes for evidence. |
| 4. Retrieval and evidence delivery | query/scope → candidates → full originals | `src/memory-recall.mjs`, `src/adaptive-recall.mjs`, `src/source-read.mjs` | Multi-hop and later-page evidence reaches the Curator; spaced paths work; missing/changed files produce explicit outcomes; no outside-vault read. |
| 5. Curation and durable writes | supported authorized patch + originals → verified note changes | contracts, Curator file edits, `src/patch-persistence.mjs` | Required facts, scope, provenance, lifecycle and historical links survive; exact replay creates no duplicate; unsupported claim/conflict cannot become settled memory. Lifecycle postcheck alone is insufficient. |
| 6. Lifecycle and maintenance | current/history/tension + date/event → review state | `src/memory-lifecycle-audit.mjs`, recall lifecycle filters | Current retrieval excludes superseded authority while explicit historical lookup retains access; event conditions persist; unresolved disagreement remains visible. Distinguish stored event triggers from automatic detection of real-world events. |
| 7. Brain Brief and subsequent use | inspected evidence → supported summary → Lead answer | Brain Brief/EvidencePacket contracts and Curator skill | Fresh session can recall the actual saved change; required qualifiers and contradictions survive summary; unanswered questions are explicit. |
| 8. Optional portability and recovery | verified local state → sync/reload or explicit blocker | sync/conflict/restructure/rollback commands | Temporary local remotes exercise update/reload, remote change, dirty state and divergence; no silent overwrite or automatic semantic conflict resolution. Local-only use stays functional. |
| 9. Evaluation and release evidence | expected cases + actual traces/state → acceptance report | tests, workflow protocols, release gate | Every expected case has an outcome; gold isolated; state/hashes independently checked; measured and unmeasured capabilities separated. |

These are dependency boundaries, not nine new subsystems to build.

## Evidence already available and known gaps

Baseline: `1c000d1`; a packaging correction is in progress. The [I-MEM inventory](../research/imem-memory-tools-inventory-2026-09-29.md) supplies related systems, not comparative scores. Existing deterministic tests do not prove all native integrations.

- Actual Codex named-role dispatch is established by the [dispatch probe](../evaluation/native-dispatch-probe-2026-09-29.md), a read-only doctor task, not a full workflow proof. Earlier dispatch failures remain part of the record.
- The earlier [native preflight trial](../evaluation/native-curator-preflight-live-2026-09-29.md) omitted an approved `revalidate_when` trigger despite reporting `APPLIED` and a clean lifecycle audit. The subsequent metadata verifier addresses that mechanical gap; actual use before `APPLIED` must be proved separately.
- The completed four-task [lifecycle recovery trial](../evaluation/native-curator-lifecycle-recovery-2026-09-29.md) shows an observed graph/history defect: the Curator removed the new note's backward history link after an `excluded-or-missing` graph warning about an existing superseded target. Preserve this failure; do not report complete lineage acceptance.
- The same trial contains a failed unquoted shell read of spaced paths followed by a successful quoted repair. The existing `read-notes` command is the supported mechanical alternative; a new reader API is unnecessary.
- The lifecycle postcheck verifies selected metadata, not whole-patch meaning, source authority, multi-file transactions or crash recovery.
- Codex evidence does not establish Cursor, Claude Code or OpenCode workflow success. A installed role file and mocked tests are weaker than actual host dispatch.
- Agent-followed wikilinks do not establish graph-engine traversal. Record actual `recall-explore` depths/trails separately from manual navigation, later-page retrieval and final answer support.
- An earlier native smoke unnecessarily used `curate-plan` in default Curator mode. Guidance was corrected; the default command sequence still needs explicit trace verification in the complete acceptance run.
- Real-world event-trigger detection, crash behavior during multiple Curator file edits, and fresh-session post-write recall need explicit acceptance coverage or a documented limitation.

## Implementation sequence

### Phase 0 — freeze evidence and acceptance scope

**Deliverable:** close the completed native report with physical hashes and actual trace ordering; preserve failed history-link gate. Maintain a capability matrix with statuses `implemented`, `regression-verified`, `native-verified`, `experimental`, `unsupported`, `not-tested`. Audit existing guides against the default scope above.

**Exit gate:** no discarded failures, no unexecuted comparison described as a result, and each release claim has an evidence link or explicit gap. The predeclared [matched competitor pilot](../evaluation/matched-markdown-workflow-protocol-2026-09-29.md) remains deferred, not run.

### Phase 1 — repair graph/history and reliable original access

**Implementation bundle:** distinguish nonexistent/ambiguous targets from existing but lifecycle/scope-excluded targets in graph diagnostics. Keep current-recall exclusion intact. Preserve explicit supersession lineage rather than deleting references for audit cleanliness. Put the existing JSON-array `read-notes` recipe in the installed Curator guidance so spaces do not require shell path iteration.

**Acceptance:** regression fixtures cover historical backlink, actual missing link, ambiguous title and outside-scope reference; current recall still excludes superseded authority. A fresh installed native trial preserves both old→new and new→old history links, immutable evidence and retry identity. No prompt-only workaround for a graph classification bug.

### Phase 2 — complete write → restart → recall

**Implementation bundle:** connect preflight, original reads, authorized update, independent post-state checks and source-backed subsequent recall. Extend existing workflow fixtures/runners rather than invent another framework. Close observed failures only; do not replace native Curator editing with a general autonomous write engine without evidence it is needed.

**Acceptance sequence:** initial multi-hop recall → approved update → exact replay → unsupported-write refusal → equal-authority conflict → new session → current and historical recall. Check required facts/qualifiers, source references, no duplicate active fact, no source mutation, no unauthorized settled claim, preserved history and an accurate Brain Brief. Account for every expected event and every error. Independently verify final files and actual tool traces.

Include a question whose necessary evidence is beyond the first candidate page. Verify continuation and its stop reason, actual original reads and supported qualifiers in the final brief. Separately inspect graph-engine trails so manual link-following is not mislabeled engine multi-hop success. Confirm default Curator traces do not route through proposal-only `curate-plan`.

### Phase 3 — maintenance, failure recovery and optional sync

**Implementation bundle:** verify edit/delete/rename invalidation in derived views; clarify event-trigger versus date-trigger lifecycle behavior. Exercise existing sync/recovery mechanics with synthetic repos. Define recoverable outcomes for interrupted multi-file curation before considering a transaction mechanism.

**Acceptance:** source change is reflected in subsequent recall; stale data is not silently authoritative; interrupted write cannot be reported `APPLIED`; missing evidence and divergence return actionable blockers; replay/recovery does not silently erase supported history. If crash rollback is not provided, document the limitation and prove detection/recovery instead of claiming transactionality.

### Phase 4 — installation and supported-host readiness

**Implementation bundle:** fresh package installation, setup interview/template parity, troubleshooting and optional-mode capability labels. Verify all locally referenced packaged guides exist. Preserve existing host configuration.

**Acceptance:** deterministic package/config checks for all adapters, plus actual end-to-end smoke on every host claimed native-verified. Unavailable credentials/hosts are `not-tested`, not assumed success. The release may explicitly support a smaller verified host set while retaining experimental adapters. Optional engines require their own credential/config/error and workflow checks to graduate from experimental.

### Phase 5 — release acceptance, then optimization

**Deliverable:** one integration report, capability matrix, reproducible commands, known limitations and install guide. Run the repository release gate and independent native acceptance; record source revision and environment.

**Exit gate:** all mandatory default-path cases satisfy their required post-state and safety invariants; no unresolved critical default-path defect; each declared optional/native-host capability passes its own cases or is clearly experimental/unsupported. A percentage averaged across easy cases cannot hide a failed required invariant.

After this gate, resume latency/cost/cache experiments, matched tool comparisons and official benchmark answer evaluation under their separately frozen protocols. Keep raw correctness/coverage and standard benchmark metrics; do not invent an overall “better than every tool” score.

## Meaningful delivery rules

1. One coherent user-visible workflow repair per implementation bundle, with code, relevant regression coverage, installed guidance and a Markdown evidence report together.
2. Luna Max does scoped independent inventory/implementation tasks. Parallelize only disjoint files or read-only audits. Root checks the diff and independently verifies acceptance. Use Astra for one architecture review if a concrete design ambiguity or repeated failure needs it.
3. Reuse existing commands and validated mechanisms. Consult the [Hindsight workflow study](../research/hindsight-workflow-reference-2026-09-29.md), [A-MEM feasibility](../research/amem-workflow-feasibility-2026-09-29.md) and [Obsidian Memory workflow study](../research/obsidian-memory-workflow-feasibility-2026-09-29.md) for stage visibility, lineage and review/replay ideas. Do not import their service stacks simply to imitate them.
4. Each experiment is preregistered and reported; failed attempts remain visible. Do not repeat a finished run just to get a cleaner score. Re-run only for a concrete repaired acceptance defect or required host coverage.
5. Before committing: inspect the complete diff, run relevant checks and required repo verification; commit/push meaningful bundles under the user's existing authorization. Never publish private vault contents, raw session logs or secrets.

## Immediate next work

Phase 0 native evidence closeout is recorded, including the failed lineage gate and the independent limited postcheck. The Phase 1 implementation and its open native execution gap are documented below; next connect the complete Phase 2 workflow. Defer benchmark expansion, new embedding/reranking models, provider cache tuning and comparator installations until the default end-to-end acceptance sequence is complete.

### Phase 1 follow-up

The [graph/history repair report](../evaluation/graph-history-repair-2026-09-29.md) records the implemented diagnostic fix, 367 passing tests, six installed CLI checks and preserved bidirectional history/retry identity in one native scenario. Native execution had a recovered guessed-path read error and violated that trial's strict stop-on-tool-failure instruction, so it is not full protocol acceptance. Keep this gap open during Phase 2: ground exact source paths, declare safe recovery rules before running, then verify the complete write → new-session → recall flow and later-page evidence. Do not rerun the same narrow scenario merely to remove the error from its record.

The [exact source handoff and fresh-session report](../evaluation/source-handoff-fresh-session-2026-09-29.md) records one passing native synthetic write → new-session → recall with actual named Luna Curator dispatch, source identity checks, immutable evidence and read-only subsequent recall. This closes the specific guessed-source-path handoff gap for that case; it does not close the unsupported-write, equal-authority conflict, later-page continuation, graph-engine trail or other-host Phase 2 gates. Stop for user review after this bounded bundle.

### Goal bookkeeping

This is the authoritative revised execution plan. The available goal tools can read the active objective or change its status, but cannot edit an unfinished objective. Do not falsely mark the old goal complete to replace its text. The work remains active under this user-authorized priority change.

### Plan review and repository checks

Luna Max performed a focused read-only layer/integration inventory; root reviewed the plan and added the missing distinction between manual links and graph-engine traces, prior trigger omission and the corrected-but-unretested default command path. No Astra architecture escalation was required for this scope change. This is a plan, not a new performance experiment.

`npm run check` passed (363 tests plus schema/examples and configured deterministic evals). Package dry-run contained the delivery plan, Curator skill and previously missing dispatch diagnostic (104 files). The private-vault status check returned `SYNC_CONFIG_NOT_FOUND`; no configuration or private notes were changed. These checks establish repository consistency, not completion of the integration phases.
