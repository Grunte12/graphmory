# Claude Adapter Work Review

Date: 2026-07-10
Status: Review complete; changes are not ready to merge or publish
Scope: Uncommitted Claude-authored work in `adapters/claude-code/`, `adapters/codex/`, `README.md`, and `docs/install.md`

## Executive Summary

The work contains a useful starting point for Claude Code and Codex integration, but it currently mixes two different products:

1. a portable Memory Patch Harness adapter; and
2. a personal multi-agent orchestration framework with model routing, mandatory research lanes, context-budget enforcement, and automatic transcript capture.

The second part is too broad for this repository. It increases installation complexity, token cost, runtime coupling, and privacy risk without improving the core memory-layer contract. The adapter should be reduced to memory-specific integration: bounded recall, lead-authored Memory Patches, curator placement and validation, lifecycle/health checks, optional handoffs, and human-governed sync.

The existing harness test suite passes, but it does not exercise the new adapters. Passing `npm run check` therefore does not establish that the Claude Code or Codex integration works correctly.

## Verification Performed

- Inspected the full Git working tree and all new adapter files.
- Parsed `settings.snippet.json` successfully as JSON.
- Parsed all Claude adapter PowerShell scripts successfully with the PowerShell parser.
- Ran `npm run check`: 184 tests passed, examples validated, and deterministic evals passed.
- Ran `npm pack --dry-run`: the new adapters would be included in the published package.
- Compared model, skill, subagent, and hook configuration with current official Claude Code documentation.
- Compared the Codex capability claims with current official OpenAI documentation and the current Codex runtime.

## Findings

### HIGH-1: Automatic capture can store secrets and conversation content

Affected files:

- `adapters/claude-code/scripts/save-session-end-to-obsidian.ps1`
- `adapters/claude-code/scripts/save-compact-to-obsidian.ps1`
- `adapters/claude-code/scripts/memory-trigger-hook.ps1`
- `adapters/claude-code/scripts/context-budget-guard.ps1`

The hooks automatically write user prompts, assistant messages, compact summaries, working directories, and transcript paths into the vault. They do not run the harness secret scanner before writing and do not require a user or lead-agent durability decision.

This conflicts with the harness contract:

- durable memory is not a diary;
- raw conversations are not canonical memory;
- secrets and private logs must never be stored;
- the lead agent authors meaning before the Memory Curator places it.

The text `Do not store secrets` inside the generated note is not a control. The potentially sensitive content has already been written by that point.

Recommendation:

- Remove automatic transcript and last-message persistence from the default adapter.
- Keep `PostCompact` and `SessionEnd` as optional signals only, not writers.
- If automatic intake remains as an opt-in feature, write only a minimal event marker, run secret detection first, and require a later lead-authored Memory Patch before promotion.

### HIGH-2: The adapter hijacks ordinary Claude Code work

Affected files:

- `adapters/claude-code/scripts/task-routing-hook.ps1`
- `adapters/claude-code/scripts/routing-pretool-guard.ps1`
- `adapters/claude-code/scripts/routing-stop-guard.ps1`
- `adapters/claude-code/settings.snippet.json`

The task router treats common words such as `check`, `find`, `why`, `how`, `review`, `design`, `fix`, `test`, and `plan` as reasons to require `cheap-researcher`. The pre-tool guard then blocks normal tools, and the stop guard blocks the final answer until that route is fulfilled.

This behavior is unrelated to memory retrieval or consolidation. It turns the adapter into a mandatory orchestration framework and can increase token use and latency on simple work.

Recommendation:

- Remove generic task routing and mandatory subagent routing from this repository.
- Trigger memory integration only when prior memory can change the task, when the user requests recall or remembrance, or when a durable verified lesson exists.
- Keep general model routing and coding-agent orchestration in a separate optional project or personal Claude configuration.

### HIGH-3: `model: fable` is not a portable Claude Code model value

Affected files:

- `adapters/claude-code/agents/fable-architect.md`
- `adapters/claude-code/agents/fable-refuter.md`
- `adapters/claude-code/skills/important/SKILL.md`
- `adapters/claude-code/skills/fable-plan/SKILL.md`
- `adapters/claude-code/skills/fable-review/SKILL.md`

Official Claude Code subagent configuration accepts `sonnet`, `opus`, `haiku`, `inherit`, or a full model identifier. `fable` is not a portable official alias. It may be meaningful in one private setup, but public users cannot rely on it.

Recommendation:

- Remove Fable-specific agents and skills from the memory harness adapter.
- If an advanced model slot is genuinely needed, use `inherit` or a documented placeholder that the installer requires the user to resolve.
- Prefer capability-based role descriptions over fixed premium-model branding.

### HIGH-4: One session can satisfy another session's handoff gate

Affected file:

- `adapters/claude-code/scripts/routing-state.ps1`

`Test-RoutingMemoryHandoffArtifact` accepts any recently modified Markdown file with `type: session-handoff`. It does not require the expected `session_id`, exact `note_path`, routing epoch, or a matching request identifier.

With parallel Claude sessions, a handoff created by session A can satisfy session B's pending memory requirement.

Recommendation:

- If the routing system is retained outside this repo, bind completion to an exact request ID, session ID, epoch, and artifact path.
- Never satisfy a gate by scanning for any recent file of the right type.

### MEDIUM-1: Parallel hooks race on shared routing state

Affected files:

- `adapters/claude-code/settings.snippet.json`
- `adapters/claude-code/scripts/routing-state.ps1`
- `adapters/claude-code/scripts/memory-trigger-hook.ps1`
- `adapters/claude-code/scripts/context-budget-guard.ps1`

Claude Code runs matching hooks in parallel. The adapter starts five `UserPromptSubmit` hooks, while multiple hooks read and write the same per-session routing state. The last writer can overwrite another hook's reason, epoch, or note path.

Recommendation:

- Prefer one memory preflight hook that performs ordered, deterministic decisions.
- Avoid shared mutable routing files when a read-only context injection is sufficient.
- Add concurrency tests before enabling any shared-state hook.

### MEDIUM-2: Codex adapter capability claims are outdated

Affected files:

- `adapters/codex/README.md`
- `adapters/codex/AGENTS.snippet.md`

The adapter says Codex has no built-in skills mechanism. Current Codex supports skills as a first-class reusable workflow surface. Treating Memory Curator only as a temporary role embedded in `AGENTS.md` underuses the runtime and creates unnecessary prompt weight.

Recommendation:

- Install and expose `memory-curator` as a Codex skill.
- Keep only durable routing and safety rules in `AGENTS.md`.
- Avoid categorical claims about subagents across all Codex surfaces; document the exact supported surface and version instead.

### MEDIUM-3: New adapters have no behavioral tests

The existing 184 tests cover the core harness, schemas, retrieval, sync, lifecycle, conflict handling, packaging, and evals. No tests were found for the new Claude Code or Codex adapters.

Missing coverage includes:

- hook input/output contracts;
- secret filtering;
- missing environment configuration;
- parallel sessions;
- routing-state concurrency;
- model/frontmatter validation;
- adapter installation smoke tests;
- Codex skill discovery;
- fail-closed behavior when the vault or CLI is unavailable.

Recommendation:

- Do not treat the current green test suite as adapter verification.
- Add synthetic hook fixtures and adapter-specific smoke tests before publishing either adapter.

### MEDIUM-4: Missing configuration can create an unintended vault

Some scripts fall back to `$HOME/ObsidianVault` and a fixed Claude Code memory scope. Writer hooks can create directories there even when the user never configured the adapter.

Recommendation:

- Writer hooks must fail closed when `OBSIDIAN_VAULT` or the memory scope is missing.
- `doctor` should validate the adapter configuration before hooks are enabled.
- Never guess a memory destination for a write operation.

## What Should Be Kept

The following ideas fit the Memory Patch Harness and are worth preserving in a smaller adapter:

- Claude Code skill installation for `memory-curator`.
- A bounded Brain Brief recall command.
- Lead-agent ownership of durable meaning.
- Memory Curator placement, linking, deduplication, and validation.
- `health`, `lifecycle-audit`, `sync-plan`, and conflict-assist commands.
- Optional compact task handoff before an intentional session switch.
- Read-only reviewer mode for external review lanes.
- Human approval for adoption, restructure, conflict resolution, and publishing.

## What Should Be Removed Or Moved Elsewhere

- Fable, Opus, Sonnet, and Haiku orchestration policy unrelated to memory.
- Generic task router and mandatory `cheap-researcher` gate.
- General coding worker, architect, and verifier agents.
- Automatic last-message and transcript capture.
- Fixed context-window thresholds tied to one model generation.
- Broad pre-tool and stop guards for normal coding work.
- Cross-provider review policy and AGY/Codex orchestration.

These can live in a separate optional coding-agent orchestration project, but they should not be dependencies of the memory layer.

## Suggested Target Architecture

```text
User task
  -> optional bounded recall hook or explicit Memory Curator skill
  -> lead agent performs the task
  -> deterministic verification
  -> lead agent decides whether a durable lesson exists
  -> lead-authored Memory Patch
  -> Memory Curator places, links, deduplicates, and validates
  -> optional human-governed sync
```

The adapter should not decide which coding model implements the task. It should only provide the memory lifecycle around whichever agent or model the user already chose.

## Recommended Remediation Order

1. Quarantine the current Claude and Codex adapter additions from release.
2. Remove automatic transcript/session-content writers.
3. Remove generic orchestration, Fable-specific configuration, and mandatory routing gates.
4. Rebuild a minimal Claude Code adapter around the official skill and hook surfaces.
5. Rebuild the Codex adapter around native skills plus a concise `AGENTS.md` snippet.
6. Add adapter-specific synthetic tests and an install smoke test.
7. Run the full release gate and inspect `npm pack --dry-run` again.

## Official References

- Claude Code subagents: https://code.claude.com/docs/en/sub-agents
- Claude Code hooks reference: https://code.claude.com/docs/en/hooks
- Claude Code skills: https://code.claude.com/docs/en/slash-commands
- Claude Code feature overview: https://code.claude.com/docs/en/features-overview
- OpenAI Codex use cases and skills: https://developers.openai.com/codex/use-cases

## Review Decision

**NOT READY TO MERGE**

The core harness remains healthy, but the new adapter work is over-scoped, insufficiently tested, and contains privacy, portability, concurrency, and correctness risks. Preserve the useful memory-specific ideas and rebuild the adapters as thin, optional integration layers.

No files were staged, committed, or pushed as part of this review.
