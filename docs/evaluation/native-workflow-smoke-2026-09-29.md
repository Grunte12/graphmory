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

## Attempt 2: host-discovery follow-up, before execution

Retain attempt 1. Repeat the same installed package, original vault, explicit lifecycle patch and configured models in the existing temporary project. Use a per-invocation trusted-project setting and load normal user configuration; no global file is edited. Ask for the named Curator through the host's actual interface rather than imposing a tool parameter name in the task. This is a host integration diagnostic, not an answer-tuning trial. Require observed native sub-agent activity, a child response, supported original-preserving edits and subsequent recall/audits. A model's statement that it dispatched remains insufficient. Do not substitute a generic worker or change models to count a pass.


## Attempt 2: observed result

The native Lead exited normally. Exact parent-child runtime metadata independently identifies the named `graphmory_curator`, configured `gpt-5.6-luna` with low reasoning, and a completed child task. The child trace records reading the installed skill/protocol, installed recall commands, three successful host patch operations and graph/lifecycle audits. This establishes real configured Curator dispatch and file editing, beyond the Lead's self-report. Public evidence omits host IDs and private runtime paths.

Actual postconditions were independently checked: all five seeded original paths still exist; approval evidence is byte-for-byte unchanged; a current Ownership note cites `Evidence/Approval.md#E1`; Legacy Ownership preserves the old claim with explicit supersession; project links reach the new owner. Subsequent installed managed recall includes current Ownership and excludes Legacy Ownership. The cited Lead answer identifies rebuilding the derived view and the frontend implementer's visible-chart verification responsibility.

Graph audit reports five active graph notes, seven edges and no issues, with one isolated approval-evidence note. Lifecycle audit still reports **two medium stale-language warnings**, concerning approval wording about replacement and Display's stale-chart symptom; critical/high findings are zero. These warnings are retained for review, not automatically rewritten or counted as a clean audit. Curator followed linked originals across notes; the saved explore output contains lexical depth-zero hits, so this is not proof of measured two-hop retrieval-engine traversal.

One avoidable detour occurred: normal Curator invoked `curate-plan`, which rejected this workflow because that command requires a decision engine. It subsequently used host file tools successfully. The installer/skill follow-up clarifies normal patch-writing responsibility and named-role verification; no new memory writer or service is introduced.

[Sanitized attempt 2 evidence](../../eval/reader-pilot/native-installed-workflow-attempt-2-2026-09-29.json) preserves checks and trace fingerprints. Attempt 1 remains a failed integration attempt. Loading normal config, project trust and dispatch wording changed together; their separate causal contributions are unknown. This single synthetic Codex scenario proves the core installed workflow ran, not general correctness, cross-host compatibility or superiority. The follow-up guidance is verified separately by repository checks; no second live generation of that guidance is claimed.

## Integration follow-up verification

Updated generated Curator instructions and shipped skill guidance distinguish host file edits from optional decision-only `curate-plan`, retain provenance/history and require explicit graph/lifecycle review. A packaged manual smoke guide separates installation, discovery, native dispatch, evidence integrity and audit findings; its release example is a replay recipe, not an additional measured run. `npm run check` passed, followed by 13/13 focused installer/package tests after guide review. Private-vault status remained `SYNC_CONFIG_NOT_FOUND`; no private config or note was created.
