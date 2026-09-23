# Changelog

This project follows a lightweight changelog format inspired by Keep a Changelog, but versioning is still pre-1.0.

## Unreleased

### Changed

- Renamed the product, GitHub repository, npm package, and primary CLI command to Graphmory. Kept `memory-patch-harness`, `mph`, and existing vault metadata paths as compatibility interfaces.
- Added curator, hosted Jev, and local decision workflows with compact managed retrieval. Jev/local evidence goes directly to the lead agent without a curator sub-agent.
- Added Vercel AI Gateway as a TypeSafe-compatible Jev route, a local reranker workflow with distinct raw rank scores, and a managed retrieval eval runner. Benchmarked the local vault without writing notes; see `docs/evaluation/managed-modes-2026-09-23.md`.
- Fixed graph expansion for section-ranked notes, switched managed recall to a measured two-lane sparse default, and cached semantic vectors by note content outside the vault. Semantic search remains an optional escalation pending independent labels.

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
