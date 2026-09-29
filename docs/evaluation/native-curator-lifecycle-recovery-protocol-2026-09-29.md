# Native Curator lifecycle recovery protocol

Freeze before execution: source baseline `1c000d1` plus the documentation packaging correction, one freshly installed isolated package, existing synthetic three-vault fixture generator, one native Codex Lead (`gpt-5.6-sol` low), and one named Curator (`gpt-5.6-luna` low). Use the source-supported V2 spawn shape `agent_type=graphmory_curator`, `fork_turns=none`, no model override or `fork_context`. Persist parent and child rollouts. This new experiment preserves all earlier success, omission and dispatch-failure records.

## Four sequential tasks

1. Apply the approved Helios E2 update. Validate the patch before a vault write, read original evidence and current policy, preserve historical claim/E1, mark old policy superseded, update Runbook and write the canonical replacement. Persist every lifecycle event and run `verify-patch-persistence` before returning `APPLIED`.
2. Parent captures a full Markdown SHA-256 snapshot outside the vault, then delegates the identical patch once. Require every Markdown file byte-identical after retry and no duplicate note.
3. The independent missing-provenance vault returns `BLOCKED` with failed preflight and no writes.
4. The independent unresolved 30/60-second source conflict returns `TENSION`, reads both originals and leaves all vault bytes unchanged.

Reuse the named child if supported. Stop on dispatch failure; no generic fallback, prompt variants or hidden retries. The retry in task 2 is itself a declared idempotency test, not retrying a failed model run.

## Independent gates

- Runtime metadata binds the actual child role/model; recorded actual spawn arguments select fresh context.
- Child trace proves preflight result precedes first durable write, original source reading, and a valid child postcheck before `APPLIED` completion.
- Parent installed-CLI postcheck independently agrees, and canonical note contains approved claim, E2 link and exact event trigger. Existing supported history/replacement/navigation links remain.
- Immutable source hashes match baseline; tasks 3/4 match complete vault baselines, including Obsidian metadata.
- Retry snapshot captured after first child completion and before second task; final Markdown hashes match it.
- Record graph/lifecycle audits separately, including informational event-without-date warnings. High/critical unresolved audit findings fail acceptance.

Record every gate and failure in metadata-only JSON and Markdown. Do not claim full patch-field persistence: this postcheck verifies lifecycle metadata, not confidence/scope fields, factual authority or supersession semantics. Whole-workflow generalization, cross-host reliability, provider caching and comparative latency/cost remain unproven. This is a development acceptance case, not an official benchmark or holdout.

Archive exact terminal test sessions through the app and remove temporary package/project/vault/raw-trace copies after evidence capture. Leave official scores, holdouts, unrelated/global rollouts and private vault untouched.
