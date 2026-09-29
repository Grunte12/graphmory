# Matched Markdown workflow protocol: Graphmory and Obsidian Memory for AI

Status: preregistered development fixture; no runs have been conducted under this protocol. This is not an official benchmark, a holdout set, or evidence that either tool is better.

## Scope and pinned arms

Compare the same six-turn synthetic Cedar CLI memory task through each tool's documented native workflow. Graphmory source checkout: 1c000d1c2ecc2747b8cddd97f2c4ae77b7202e93. Obsidian Memory for AI: v4.1 source revision f87548aad314ab385d4784a618297e363b859238. See the bounded, deterministic upstream capability smoke and its limitations in [the feasibility report](../research/obsidian-memory-workflow-feasibility-2026-09-29.md) and [offline smoke report](obsidian-memory-offline-smoke-2026-09-29.md).

The fixture in eval/competitor-pilot/shared-markdown-workflow-2026-09-29.json contains separate model-visible inputs and evaluator-only gold. The runner must project only model_visible into the seed vault, tool inputs, and prompts. Never copy evaluator_only, this protocol, or scoring rubrics into an agent prompt, memory repository, or retrieval context. Gold fact IDs, accepted values, and source mappings are for the evaluator only. The corpus contains fictional business facts and prompts, not private or real customer data.

## Frozen sequence

Run all six events in order against a fresh copy of the same initial Cedar CLI state for each trial:

1. Baseline recall of release verification command and approval policy.
2. Owner-authorized command migration with a signed source, preserving the previous command as historical.
3. Exact replay of event 2, including the same source and authorization text.
4. Request to store a production-ready claim supported only by an unverified “I think it passed” message.
5. Request to store a single current timeout despite two same-authority, same-period sources that disagree.
6. Query current command, command as of 2026-09-15, and timeout status after the prior events.

Both arms receive the same initial facts, raw evidence text, source identifiers, timestamps, and exact event messages. A deterministic fixture adapter may translate those facts into each tool's native Markdown/frontmatter layout. Do not require identical files or schemas. Do not let a model author the seed differently between arms. Add event evidence only at its specified event. Do not add clarifying evidence, aliases, or extra notes during a trial.

The required output contract is in the fixture. Score the final response and resulting canonical state together. Native proposal, review, transaction, inbox, index, and journal files are operational artifacts; report their behavior separately from canonical semantic facts.

## Arm and trial controls

- Use three fresh-state trials per arm. Each trial is one complete six-event sequence; total planned workload is 3 x 2 sequences and 36 event interactions. Randomize which arm runs first for each paired trial. Reset agent/session state between trials.
- Use the same Lead model, gpt-5.6-sol at low reasoning, and the same named Curator role bound to gpt-5.6-luna at low reasoning in both arms. Keep the same session limits: at most 10 tool/agent rounds per event and a 300,000-byte input cap. Record actual model, reasoning setting, role binding, and observed limits for every trial. If either tool cannot preserve this setup or dispatch the named Curator, record the mismatch as a comparability limitation; do not silently substitute a direct writer or another model.
- Use the same human reviewer identity and deterministic review rule wherever a tool requires approval. The reviewer may approve only the exact owner-authorized migration when source, value, effective date, and requested historical preservation agree. The reviewer must not approve event 4's unsupported readiness claim or choose a side in event 5's unresolved conflict. This synthetic authorization is a workflow fixture, not evidence of independent human judgment. Record required review and reviewer time separately from model time and outcome scores. A tool that does not require an equivalent approval gate is not penalized; report the difference.
- Record installation, fixture materialization, indexing/rebuild, and other offline setup time separately. Do not compare those command times with model-workflow latency.
- Keep run outputs and raw model prompts in local evaluation storage. The checked-in fixture is the frozen development input and gold only; do not add outputs to it after execution.

## Outcome checks

Evaluate each event independently and the final state after event 6:

- **Answer correctness:** compare each requested fact/value/status and its effective date with evaluator-only gold. Require all requested fields; additional unsupported claims count as incorrect.
- **Evidence precision and recall:** normalize citations to the visible source IDs, then score claim–source pairs against the evaluator-only gold map. Precision = supported cited claim–source pairs divided by all cited pairs. Recall = required gold claim–source pairs cited divided by required gold pairs. Missing citations are omissions; a provenance field or graph edge alone is not a supporting citation.
- **Stale/current error:** flag the old command as current after the migration, the new command as active before its effective date, or any single timeout represented as settled after event 5.
- **Duplicate creation:** after event 3, count semantically duplicate active records for the current release-command fact. The target is one active fact; preserve the old command as history without counting that historical record as a duplicate.
- **No-unsupported-write invariants:** event 4 must not activate a canonical production-ready claim from the weak message. Event 5 must not activate one selected timeout as settled. A clearly labeled unresolved tension that preserves both source claims is allowed. Draft proposals or raw inbox capture do not count as canonical activation; report them separately. These checks concern semantic claims, not whether a workflow emits a proposal or journal.
- **Latency and tokens:** record wall time per event and per complete sequence from the same start/stop boundaries. Record input/output token counts by role only when the host reports them; use null when unobserved, never estimate. Record reviewer approval time and offline setup/indexing time in separate fields.

A tool-specific mechanism without a semantic counterpart is N/A, not an automatic failure. In particular, a file revision/hash conflict is not the unresolved factual conflict in event 5; optional provenance metadata does not establish truth; a graph index is not itself evidence. Record such mechanisms in a capability-notes field, not in semantic scores.

## Reporting and stopping

Before any run, preserve this protocol and fixture unchanged and have an independent reviewer audit that evaluator-only material cannot reach either tool. Any later fixture or rubric change creates a new version and requires a new preregistration before execution.

Report per-arm, per-trial, and per-event observations, missing telemetry, protocol deviations, and capability N/A items. Show the raw counts before any aggregate. With six synthetic events and three trials, treat the result as a workflow/debugging pilot only: do not make superiority claims, do not infer general quality, and do not convert these development cases into holdout evidence after inspecting results.
