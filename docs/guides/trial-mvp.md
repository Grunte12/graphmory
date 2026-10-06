# Local Curator trial

Graphmory's trial workflow uses a named inexpensive coding-agent Curator, local Markdown memory and deterministic CLI checks. The scoped acceptance target is Codex with Luna. Existing optional engines and other host adapters remain separate capabilities.

1. Follow [agent-guided installation](agent-hosts.md) and choose the [vault layout](vault-setup.md).
2. Verify the installed CLI and an actual named Curator dispatch; keep existing user config and notes.
3. Follow the [packaged Curator workflow](../../skills/memory-curator/references/trial-workflow.md) for recall, supported writes, replay and recovery. The installer copies that reference with the skill, so the Curator does not depend on the source checkout for instructions.

`render-patch` produces canonical Markdown; it does not write your vault. `curation-checkpoint` records a pending operation, verifies completion and offers reviewed target restoration. Existing metadata-only checks remain available for compatibility; the trial requires full persistence and a completion receipt.

Agent-facing content commands block while an operation is pending and recheck the checkpoint authority before returning output. A successful clear read does not require a historical receipt. After BLOCKED, do not use native filesystem access or another route to turn pending memory into an authoritative answer; the CLI cannot sandbox host-native file tools. For repair, `read-notes --purpose recovery --operation <id> --paths '<exact JSON paths>' accepts only source/target paths bound to that pending operation. Its response is tagged recovery-only and never proves current authority. Keep the same `GRAPHMORY_STATE_DIR` or `--state-root` across all sessions.

This is a release candidate. The [latest integration report](../evaluation/hybrid-summary-integration-2026-10-02.md) records code checks, local BGE tests and remaining native-host gates. The historical native acceptance was for an earlier candidate; it does not certify this version. One frozen rc.6 installed named Luna update and fresh-session hybrid recall passed. Later review fixes and the broader native acceptance matrix remain distinct checks before claiming complete MVP readiness. New hybrid setups need a local model download and Transformers.js, but no embedding API or separate vector database. See [setup and summary workflow](hybrid-summary.md).

## Pending checkpoints

The candidate CLI blocks agent-facing content reads while checkpoint state is pending or unreadable and checks authority again before returning output. This does not sandbox native filesystem tools. After a block, do not use those tools or switch state roots to produce a current answer. Keep one state root across sessions; use the exact-operation recovery read only to repair that operation.
