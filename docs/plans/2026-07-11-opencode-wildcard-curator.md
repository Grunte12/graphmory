# OpenCode Wildcard Curator Alignment

## Objective

Align the runtime-independent harness and OpenCode adapter around one primary
interface:

```text
lead/orchestrator <-> wildcard memory curator <-> Markdown/Obsidian Brain
```

`brain-ingest` and `brain-update` may remain in runtime-specific compatibility
adapters, but the core installer, core skill, Claude adapter, and OpenCode adapter
must not require them.

## Verified constraints

- OpenCode discovers global Markdown agents under
  `~/.config/opencode/agents/`; the filename becomes the agent name.
- Markdown agents support `mode: subagent` and granular `permission` rules.
- `tools` is deprecated; new agent definitions must use `permission`.
- External Brain access requires an explicit `external_directory` allow rule.
- The worktree contains unrelated modified and untracked work. Only the files
  named below may be changed for this packet; no reset, commit, or push.

Primary references:

- <https://opencode.ai/docs/agents/>
- <https://opencode.ai/docs/permissions/>

## Change packet

1. Reconcile core and adapter language.
   - Keep the lead as semantic author.
   - Keep curator recall read-only by contract.
   - Let curator consolidation place a complete lead-authored patch.
   - Remove mandatory routing through `brain-ingest` or `brain-update` from the
     core, OpenCode, and Claude flows.
   - Preserve raw Inbox/Clippings as provisional evidence, never canonical truth.
2. Add an OpenCode Markdown agent template at
   `adapters/opencode/agents/memory_curator.md`.
   - Exactly three modes: recall, synthesis, consolidation.
   - Deny task spawning and web access.
   - Deny arbitrary shell; allow only the installed harness CLI command.
   - Allow reads/search and edits only within the configured Brain path.
3. Update `scripts/install.mjs`.
   - Install only the core `memory-curator` skill, `src/`, CLI, and one global
     OpenCode agent.
   - Render exact target and Brain paths into the agent.
   - `--check` reports exact add/update/preserve operations without writing.
   - `--dry-run` reports the same plan without writing.
   - Preserve an existing agent by default.
   - `--upgrade` may replace only an unchanged installer-managed agent.
   - A locally modified or unmanaged agent requires explicit `--force`.
4. Update installation documentation and adapter overview.
5. Add deterministic tests for fresh install, preservation, managed upgrade,
   dry-run/check behavior, single-skill install, prompt authority, and narrow
   permissions.

## Acceptance checks

- Fresh install creates exactly one discoverable `memory_curator.md` agent.
- Default install does not install `brain-ingest` or `brain-update`.
- Existing curator content survives a normal install attempt.
- `--upgrade` preserves modified/unmanaged curator content.
- `--force` is required to replace modified/unmanaged curator content.
- Recall is explicitly no-write; consolidation can apply complete patches.
- `BLOCKED` and `TENSION` require no canonical mutation.
- Agent permissions deny task spawning, web access, and unrestricted shell.
- External access is limited to the configured Brain and harness target.
- Targeted tests and the full `npm test` suite pass.

## Out of scope

- Installing or changing a model alias.
- Mutating `opencode.json`.
- Creating a global shared workspace.
- Implementing project workspace bootstrap.
- Writing canonical Brain memory before source and tests agree.
