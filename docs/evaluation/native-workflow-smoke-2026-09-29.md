# Native installed workflow smoke

User priority: finish a usable complete workflow before further small benchmark tuning. This is a functional acceptance exercise, not a leaderboard comparison.

## Setup already executed

Packed the current npm package with scripts disabled, installed that tarball offline into a fresh temporary prefix with optional dependencies omitted, ran its actual `graphmory doctor --json` successfully, and installed the project-scoped named Codex curator plus complete skill from the installed package. Global host config and the private vault were not changed. The first npm-pack attempt could not write the default cache; retry used a fresh temporary npm cache, without changing permissions or ownership.

CLI-compatible configured models: `gpt-5.6-sol` Lead and `gpt-5.6-luna` Curator. This is not a model-quality comparison with the desktop's newer models.

## Live functional gate, declared before native generation

Use a real isolated synthetic Markdown vault with `.obsidian`, a project index, a Display → Refresh → Ownership graph, immutable dated approval evidence and an explicit lead-authored patch superseding a prior policy. Require:

1. Native Lead discovers and dispatches the configured **named** curator. A generic-worker fallback is a failure, and self-reported model identity alone is insufficient evidence of model selection.
2. Curator uses the installed retrieval CLI and reads supporting originals across the graph.
3. Curator applies only the lead-authored supported claim, preserves immutable evidence and old history, connects the current note, and explicitly supersedes the old policy.
4. Current-state recall supplies the repair action and current owner with original note citations.
5. Lead verifies actual files, then returns the cited answer and patch/audit status. Graph/lifecycle issues remain visible; incomplete outcomes must not become a pass.

The npm installation and generated config alone prove neither native dispatch nor lifecycle completion. General patch application intentionally uses host file tools under the Curator skill; `curate-plan` is read-only and alias-only `curation-apply` is not a general patch writer. Keep raw host traces local and publish only sanitized execution evidence. No private personal notes or external messages are involved.

## Result

Attempt 1 exited normally but the Lead returned `BLOCKED` before any observed dispatch tool call. An agent-message item and a nonfatal skill-description-budget notice were recorded; no dispatch tool call, Curator call, patch edit, graph audit or lifecycle audit occurred. All seeded original notes remained byte-for-byte unchanged. Therefore this attempt fails the end-to-end functional gate.

The Lead attributed this to unavailable custom-role/model dispatch. That is a model self-report, not independently verified host-capability evidence. The invocation enabled `multi_agent`, used an ephemeral workspace-write session and ignored user config; the temporary project had no Git repository. Investigate role registration/discovery and project trust against official host documentation before retrying. Preserve this failed attempt and never substitute a generic worker to report named-role success.

[Sanitized attempt record](../../eval/reader-pilot/native-installed-workflow-attempt-1-2026-09-29.json) contains package/role/trace hashes, event types and the explicit incomplete result. Raw host traces remain local while diagnosis is active.
