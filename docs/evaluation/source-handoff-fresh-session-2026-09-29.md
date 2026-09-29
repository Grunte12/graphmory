# Exact source handoff and fresh-session recall: native result

**Status:** one synthetic development case passed its bounded write → fresh-session recall gates on 2026-09-29. This is not a general benchmark, comparator result, or full Phase 2 acceptance. The [preregistered protocol](source-handoff-fresh-session-protocol-2026-09-29.md) was frozen before execution; the earlier [path-guessing deviation](graph-history-repair-2026-09-29.md) remains in the record.

## Change and environment

The Lead can create a body-free `graphmory-source-handoff-v1` manifest containing exact vault-relative source paths, SHA-256 hashes, and byte counts. The Curator opens that manifest with `read-notes --manifest`; it checks all three originals and their identities before returning any source text. This grounds the E1/E2 evidence *sections* in the actual `Approval Record.md` file instead of inviting guessed filenames. The installed Curator guidance now describes that handoff and stops on a failed identity/read check.

The package was packed and installed offline in a disposable project. The single write session and the separate read session each used a real Codex CLI Lead (`gpt-5.6-sol`, low) and a project-scoped named `graphmory_curator` child (`gpt-5.6-luna`, low). Both native `spawn_agent` calls specified `fork_turns: none`; there was no inline fallback or model rerun. Parent/child session IDs are in the [machine-readable record](../../eval/reader-pilot/source-handoff-fresh-session-2026-09-29.json). These models were locked before the user's later preference to use Luna for future Codex tests. Future tests must follow that preference.

## Observed sequence

1. The Lead created and inspected the manifest. It contained exactly `90 Evidence/Approval Record.md`, `01 Projects/Helios/Release Policy.md`, and `01 Projects/Helios/Runbook.md`, each with `path`, `sha256`, and `bytes`, with no note bodies.
2. The named child validated the authorized E2 patch, read the three originals through the manifest, then applied the approved successor policy. No guessed source path or source-read failure occurred in this run. The child ran the persistence postcheck and graph/lifecycle audits before reporting `APPLIED`; it did not call proposal-only `curate-plan`.
3. Independent file inspection found the active successor with the independent-approver claim, rationale, Helios production scope, two exclusions, revalidation event, and E2 citation. The old policy retained E1 and became `superseded` with a forward replacement link. The successor linked backward; the Runbook pointed at the current policy. The immutable approval record remained byte-identical to its baseline. The graph audit reported zero issues; the superseded lifecycle exclusion was informational.
4. After the write session ended, all vault file hashes were captured. A **new** Codex session dispatched a newly created named child. It ran current recall without `--include-superseded`, historical recall with that flag, and opened original notes. Its Brain Brief and the Lead's final answer distinguished the current independent-approver rule from the superseded self-approval rule, cited E2/E1 and the canonical paths, and preserved scope, exclusions, and revalidation. Independent hashing found all six vault files unchanged during this fresh read.

The write and read parent executions exited 0 and took 125.583 s and 66.507 s respectively. These wall times describe one run, including model/tool overhead; they are not a latency comparison. The synthetic fixture, installed CLI, and role were checked in this disposable project only. The private `/Users/grunte/Obsidian` vault was not used or modified.

## Gate result and limits

The exact-path manifest, native parent/child bindings, preflight → original read → first write order, postcheck, file invariants, fresh reader, and read-only second session passed for this case. `npm run check` passed with 368 tests, five example validations, and configured deterministic evaluations. The existing private-vault status check returned `SYNC_CONFIG_NOT_FOUND` and made no private writes.

**Still open:** the full Phase 2 sequence also requires unsupported-write refusal, equal-authority conflict, and a case whose necessary evidence lies beyond the first candidate page, plus explicit continuation/stop-reason and graph-engine trail checks. This run proves neither those cases nor general retrieval quality, multi-host support, low cost, or superiority over other tools. The earlier trial's recovered guessed-path failure is not erased by this successful new trial.

## Reproduction and evidence handling

Focused regression: `node --test test/source-handoff.test.mjs test/setup-curator-agent.test.mjs`; repository gate: `npm run check`. Source entry points: `src/source-handoff.mjs`, `scripts/brain-sync.mjs`, `skills/memory-curator/SKILL.md`. The machine-readable record saves gate outcomes and session bindings, not private Markdown or raw model rollouts. The disposable test vault and sessions were cleaned/archived after recording the result.
