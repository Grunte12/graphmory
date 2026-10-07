# Changelog

This project follows a lightweight changelog format inspired by Keep a Changelog, but versioning is still pre-1.0.

## Unreleased

### Added

- `graphmory-mcp`, a Model Context Protocol server with three tools, `recall`, `read` and `remember`, over stdio or bearer-authenticated Streamable HTTP. It runs the same engine as the CLI, with cited recall, guarded writes and signed cursor paging. See `docs/guides/mcp-hosts.md`.
- Brain Brief gains `outcome` (`answered`, `partial`, `no-evidence`), `stop_reason`, `pages_read` and a per-finding `hash`; a `no-evidence` brief is valid with no items, and older briefs still validate. `graphmory doctor` now checks the Curator model, the MCP tool list (recall, read, remember) and the semantic backend, and prints short summary lines first; the new checks are warnings and the JSON output only gains check ids. MCP tool descriptions name the APPLIED, TENSION and BLOCKED outcomes.
- MCP `recall` returns `recheck: [{path, changedSources}]` on the first page for summaries dropped because a source changed, and `lifecycle-audit` reports `summary-source-changed` (both read-only). Low-confidence `remember` requests are queued in the private state root instead of being lost: `BLOCKED/LOW_CONFIDENCE` now carries `reviewId` and `step: owner_review`, and the owner decides with `graphmory review list|show|approve|reject` (approve needs an interactive terminal, re-checks hashes and records `approvedBy: owner`). There is no MCP approve tool.
- One Curator stop rule for MCP and CLI replaces the contradictory "page once more" text: keep paging while a page had a relevant item, stop at the first page with none (`nothing-relevant-left`), budget of 8 pages / 80 candidates. MCP `recall` now returns its `page` number and, at the budget, `budgetReached: true` with no `nextCursor`; the server enforces only the budget. New `npm run eval:deep-paging` (synthetic vault, oracle relevance, in `npm run eval`) shows needed notes ranked below page 1 are reached, the shallow and no-evidence cases stop early, and the budget cuts at 8 pages.
- `remember` now checks for overlapping active notes itself (title about the claim's subject plus strong wording overlap; no provider call) and returns `TENSION` with `conflictingNotes: [{path, hash}]` unless `curation.reviewedConflicts` maps each to its current hash. Previously it trusted the host's `conflictsReviewed` flag alone. Probe on the bundled eval vault: 0 of 54 first-line claims flagged another note; the small self-referential demo workspace flags 1 of 6.
- New explicit `graphmory semantic-warmup` downloads the local meaning model once (about 130 MB) so the first recall does not wait; guided setup asks first and doctor warns if the dependency or model is missing. `graphmory config` now states that a legacy config is keyword-only and keeps it that way unless the user types `hybrid`.
- New `docs/guides/mcp-hosts.md` with MCP config for common MCP hosts, with links to vendor docs where they exist. README Quick Start and launch-film link added.
- README rewritten: shorter, structured around what Graphmory does, how it works, Quick Start and the three tools. Two new diagrams (`docs/assets/graphmory-architecture.png` for the whole system, `graphmory-engine.png` for how recall and remember work) replace the old architecture SVG and HTML. Detailed material moved, not removed: `docs/guides/cli-reference.md`, `mcp-http.md`, `memory-contracts.md` and `docs/research/positioning.md`. Corrected two outdated statements: the default retriever is hybrid (keyword + meaning + links), and a Brain Brief is not capped at seven items.

### Changed

- The Curator is now a specialist sub-agent with its own prompt (`skills/memory-curator/references/curator-agent.md`): one job, the MCP `recall`, `read` and `remember` tools, and the memory-curator skill. On Claude Code its tool list includes the three Graphmory MCP tools. `graphmory-setup` gains `--update` (replaces an older install, keeps the chosen model and effort, backs up the old files), `--choices` and `--effort`. Setup no longer picks a default model: `--choices` lists the models the host reports (Codex model cache, `cursor-agent models`, Claude Code aliases) with guidance for the installing agent to suggest a few, and the user chooses. In an interactive terminal it shows the same list. `graphmory doctor` warns `curator: update available` when the installed copies are older than the package.
- `graphmory --help` now groups commands for the vault owner (setup and health, owner review, Git sync, vault maintenance) and lists agent and evaluation commands under an Advanced section that points agents to the MCP tools. No command was removed or renamed.
- The memory-curator skill and the OpenCode adapter now state MCP as the default path: the stop rule sits with the MCP section, the CLI section is titled "CLI fallback", and Consolidation says `remember` creates new notes while merges into existing notes and recovery keep the CLI checkpoint workflow.

### Removed

- The legacy `memory-patch-harness` and `mph` commands were removed. Use `graphmory`. Per-vault sync metadata is still stored under `.memory-patch-harness/`.

## 0.5.0-rc.6 - 2026-10-02

- New Curator setups combine keyword, local semantic embeddings and authored graph navigation. Legacy configs remain explicit compatibility paths; missing semantic support blocks hybrid instead of silently downgrading.
- Semantic indexing uses overlapping Markdown-section windows with per-note output, source-content invalidation, and an outside-vault rebuildable cache. No vector server is added.
- Evidence-linked summaries carry tool-generated source fingerprints. Changed/missing/inactive sources, stale transitive summaries and dependency cycles prevent normal summary reuse. New summary source/check commands remain read-only and checkpoint guarded.
- Checkpoint finish applies approved predecessor lifecycle fields deterministically after successor/binding preflight; existing conflicting replacement metadata still blocks. Full verification and receipts remain mandatory.
- Installed Curator tests with a low-cost model pass approved lifecycle update, summary creation and fresh-session hybrid recall. Source revision invalidates summaries; pending CLI content routes refuse reads. Code checks and scope limits are recorded in `docs/evaluation/push-eval-2026-10-02.md`; broader host/MVP acceptance and competitor comparisons remain separate.
- Lifecycle auditing masks non-prose examples for stale/conflict language while preserving real metadata/prose findings.

## 0.5.0-rc.5 - 2026-10-01

### Fixed

- Lifecycle auditing distinguishes narrowly verified references to superseded history, including prior/previous/earlier rule and policy wording, from a note's own stale claim. Exact reciprocal links and complete relationship context are required; broken or ambiguous chains retain findings.
- Bare or negated decision keywords no longer satisfy a tension note's affirmative decision-path check.
- Agent-facing content reads share checkpoint authority checks before retrieval/provider work and before output. Pending operations block ordinary original reads as well as managed recall; retained operation records detect state changes during a read.
- Completion failures identify affected finding paths and kinds without printing note bodies.
- Curator setup and workflow guidance distinguish an explicitly authorized new target from a missing required original, and require checkpoint preparation before creating that target.

### Added

- Operation-bound `read-notes --purpose recovery --operation <id>` for non-authoritative repair reads, with exact path bindings, source-drift handling and current target hashes.

### Scope

- Correctness repair candidate. Installed acceptance and preserved failures are tracked in repository evaluation reports. The CLI is a cooperative workflow boundary, not native filesystem isolation or an atomic multi-file publication mechanism. Use one fixed state root; other hosts, deliberate root substitution and concurrent state cleanup remain outside this trial's guarantees.

## 0.5.0-rc.4 - 2026-10-01

### Changed

- Renamed the product, GitHub repository, npm package, and primary CLI command to Graphmory. Per-vault sync metadata stays under `.memory-patch-harness/`.
- Added curator, hosted decision-engine (Jev) and local decision workflows with compact managed retrieval. Decision-engine and local evidence goes directly to the lead agent without a curator sub-agent.
- Added an optional hosted decision route through Vercel AI Gateway, a local reranker workflow with distinct raw rank scores, and a managed retrieval eval runner. Benchmarked the local vault without writing notes; see `docs/evaluation/managed-modes-2026-09-23.md`.
- Fixed graph expansion for section-ranked notes, switched managed recall to a measured two-lane sparse default, and cached semantic vectors by note content outside the vault. This earlier sparse-only experiment is superseded by the rc.6 hybrid Curator setup above; independent generalization remains unproven.

### Added

- Full patch rendering and opt-in persistence verification covering claim, scope, provenance, optional fields, and declared predecessor links.
- Private curation checkpoints with declared targets, immutable source hashes, discoverable interrupted operations, strict completion receipts, exact replay checks, and explicitly reviewed target restoration.
- Default managed-recall blocking while a curation operation remains unresolved, plus an installed-skill workflow and trial guide.

### Fixed

- Date-only and timestamp expiry boundaries now share strict parsing between retrieval and lifecycle audit; warmed retrieval eligibility updates when notes expire.

### Scope

- Release candidate for a local Codex Curator trial. Source evidence and user authorization remain agent responsibilities. Multi-file native edits use recovery checkpoints rather than an atomic vault transaction; optional engines and other hosts require their own acceptance runs.

## 0.5.0-rc.3 - 2026-07-06

### Added

- Research-backed improvement roadmap covering stale-memory lifecycle audits, structured conflict decisions, curation-first retrieval improvements, optional reranking, live-agent evals, and initializer/resume artifacts.
- Read-only `lifecycle-audit` command for expired `valid_until`, due `revalidate_when`, obsolete notes without replacement markers, active notes with stale language, raw memory outside Inbox, and tension notes without a decision path.
- Structured `decisionOptions` in `conflict-assist` so agents can present clear human lifecycle choices without merging or rewriting memory.
- Deterministic lifecycle-audit and conflict-assist evals, plus a `release:gate` script that runs the core check suite, report eval, and npm pack dry-run before a release checkpoint.
- Retrieval stress benchmark that measures misses, stale/raw pollution, estimated context tokens, and latency across exact, alias, paraphrase, conflict, and multi-hop cases.
- FAMA-inspired current-memory accuracy in stress/gate evals: a run must retrieve current canonical memory and avoid stale/raw/superseded top-k contamination.
- Lifecycle-aware governed retrieval with bounded `recall` output and explicit low-confidence escalation guidance.
- Optional scoped recall via `--scope` so agents can search a known project/domain instead of the whole vault.
- Field-weighted section BM25 recall that gives structured Obsidian path, title, frontmatter, and heading signals more influence than long body text.
- Diagnostic `recall-loop` command that compares field-weighted and ordinary section BM25 lanes without calling an external model.
- Optional `recall-semantic` and semantic retrieval eval commands for measured paraphrase/vocabulary failures; this lane uses local Transformers.js only when the user installs the optional dependency.
- `curation-recommend` CLI flow that classifies retrieval misses, then converts them into alias, frontmatter, MOC-link, scope, and grouped-gold review actions.
- Review-only Curation Plan contract with machine-readable alias, MOC-link, scope-fix, and grouped-gold candidates; every candidate preserves miss evidence and forbids automatic application.
- Atomic harness-owned file writes plus worst-case coverage for interrupted replacement, adversarial raw clippings, stale exact-match dominance, alias collisions, and Unicode/Windows paths.
- Real-vault eval support for `relevant_groups`, allowing human-reviewed alternate canonical notes without weakening flat gold labels.
- Read-only `sync-plan` decisions for batching, handoff, health blockers, remote divergence, and human approval.
- Fresh-package installation test that verifies the published agent command surface outside the source tree.

### Changed

- Portable sync guidance now emphasizes autonomy-first detect-act-verify-repair loops with human decisions only at real memory/sync gates.
- npm package surface is narrowed to runtime scripts, source modules, schemas, examples, adapters, skills, and essential docs; tests/eval/internal planning docs stay in the source repo instead of the installed package.
- Raw inbox/clipping roots are marked as noncanonical even when deliberately included for benchmark/debug runs.
- Obsidian-aware section chunking now indexes heading hierarchy while avoiding frontmatter-as-body duplication, reducing deterministic retrieved context without lowering recall.
- Retrieval ranking now caches section splits, token frequencies, eligible document sets, BM25/BM25F corpus indexes, wikilink reference indexes, and scoped vault subsets to reduce repeated pure work during eval and multi-lane recall.

## 0.4.0 - 2026-07-06

### Added

- Portable Brain Sync command for Git-backed memory portability across accounts and machines.
- Private-by-default brain repo initialization with GitHub CLI support.
- Secret-like value scan before memory push.
- Portable Brain Sync guide and install instructions.
- Reviewed memory restructure manifests with explicit per-note approval, dry-run, clean-Git and batch-size gates, local backup branches, locking, verification records, and rollback.
- Cross-machine `doctor` diagnostics, stable input/command error codes, platform guidance, and an agent-safe recovery playbook.
- Event-driven shared-brain auto-pull for multiple agents, fast-forward-only synchronization, local sync locking, and safe `REMOTE_CHANGED` push refusal instead of automatic rebase.
- Read-only `conflict-assist` reports for diverged shared memory, including local/remote/dirty change summaries, same-note semantic conflict hints, and user-approved lifecycle decision guidance.

## 0.3.0 - 2026-06-28

### Added

- Learning Packet contract, JSON schema, example, and validator support.
- Learning-loop eval with token ceiling and score-per-token proxy metrics.
- Future-task utility eval for downstream routing, stale checks, noise rejection, and contradiction handling.
- Generated eval report command (`npm run eval:report`).
- Live-model run template for scoring real model outputs without committing private transcripts.
- Thai strategy guide covering mechanics, architecture, use cases, evals, trade-offs, and extension boundaries.

### Changed

- Expanded evaluation docs to separate deterministic proxy confidence from future live-model benchmarks.
- Added structured selectors to Learning Packet examples for retrieval/routing hints.
- Ignored `.opencode/` artifacts to keep external-review bundles out of public commits.
- Added an explicit npm package `files` allowlist and updated citation metadata for the 0.3.0 package surface.

### Notes

- This release still does not claim live-model superiority. The new gates make cost, token ceilings, and downstream decision utility measurable before publishing live results.

## 0.2.0 - 2026-06-28

### Added

- Memory Patch lifecycle metadata.
- Derived Index contract and schema.
- Hot Context Pack contract, schema, and renderer.
- Memory Curator naming and OpenCode adapter prompt.
- Curator behavior eval and proxy comparison.
- Patch-quality eval.
- Live-agent incident dataset and scoring wrapper.
- Public docs for installation, architecture, RAG positioning, demo workflow, live-model evaluation, and repository patterns.
- Community health files for open-source readiness.

### Changed

- Renamed the old archivist adapter concept to Memory Curator.
- Clarified that Markdown notes are canonical operational memory while indexes, graphs, reports, and hot-context packs are derived views.

### Notes

- Live model results are not published yet. Current proxy evals validate the harness contract but do not prove model superiority.
