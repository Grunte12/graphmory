# Claude Code Adapter

**Transport: Filesystem (via a skill, a subagent, and an optional hook; no MCP currently)**

This adapter configures Memory Patch Harness for [Claude Code](https://claude.com/claude-code),
Anthropic's official CLI coding agent. Claude Code supports custom subagents,
skills, and lifecycle hooks. This adapter uses only the memory-relevant slice
of that surface — it does not add task orchestration, model routing, or
automatic transcript capture.

## Transport

| Property | Value |
|---|---|
| Method | **Filesystem** via a Claude Code skill + one subagent + one optional hook |
| Optional extension | None currently — an MCP server could expose memory operations in the future |
| Requirements | Harness cloned/installed locally; `<CLAUDE_HOME>/agents/`, `skills/`, `scripts/`, `CLAUDE.md` updated |
| Startup setup | None required. Optionally: `brain-brief-hook.ps1` on `UserPromptSubmit` injects a Brain Brief when the prompt looks memory-relevant and the vault is configured |
| Install | `node adapters/claude-code/install.mjs --vault <path> --scope <scope>` (or manual steps in `INSTALL.md`) |

## How Memory Access Is Established

1. `adapters/claude-code/install.mjs --vault <path> --scope <scope>` installs the harness core via `scripts/install.mjs`, deploys the `memory-curator` subagent, the `claude-memory-handoff` skill, and the helper scripts, and renders `CLAUDE.snippet.md` / `settings.snippet.json` with real paths filled in. It never edits an existing `CLAUDE.md` or `settings.json` directly — both stay rendered snippets for manual review and merge. See `INSTALL.md` for the manual, file-by-file equivalent.
2. The lead agent's `CLAUDE.md` references the Memory Curator and the harness CLI commands, following the pattern in `CLAUDE.snippet.md`.
3. A single subagent, `agents/memory-curator.md` (`model: haiku`), turns lead-authored lessons into Memory Patches and places them without inventing meaning.
4. The `skills/claude-memory-handoff/SKILL.md` skill saves a compact, explicit handoff or Memory Patch into the vault before stopping, compacting, or switching tasks — it is invoked by the lead agent or user, never automatically.
5. `scripts/memory-recall.ps1` and `scripts/new-handoff.ps1` are plain helper scripts you or the lead agent can run directly — no hook wiring required.
6. Optionally, `settings.snippet.json` wires a single `UserPromptSubmit` hook (`scripts/brain-brief-hook.ps1`) that injects a bounded, read-only Brain Brief when the prompt looks memory-relevant. It fails closed: with `OBSIDIAN_VAULT` or `MEMORY_PATCH_HARNESS_SCOPE` unset, it injects nothing and never guesses or creates a vault path.

The `memory-curator` skill itself is not duplicated here — it already lives at
the repository's top-level `skills/memory-curator/` and is deployed by the
existing `scripts/install.mjs`. This adapter only adds the Claude-Code-specific
layer around it: one subagent, one handoff skill, two helper scripts, and one
optional recall hook.

## Files in This Adapter

| File | Purpose |
|---|---|
| `README.md` | This file — adapter overview and transport |
| `INSTALL.md` | Automated installer usage plus the manual, file-by-file equivalent |
| `BRAIN-DESIGN.md` | Design rationale: two-layer memory model, read/write paths, evaluation gate |
| `install.mjs` | Automated installer — deploys adapter files and renders both snippets without touching `CLAUDE.md`/`settings.json` |
| `CLAUDE.snippet.md` | Memory-lifecycle sections to copy into your `CLAUDE.md` |
| `settings.snippet.json` | `env` + the single optional hook to merge into your `settings.json` |
| `agents/memory-curator.md` | Subagent: turns lead-authored lessons into bounded Memory Patches |
| `skills/claude-memory-handoff/SKILL.md` | Skill: saves a compact handoff or Memory Patch into the vault |
| `scripts/memory-recall.ps1` | Runs a Brain Brief recall via the harness CLI |
| `scripts/new-handoff.ps1` | Creates a local `HANDOFF.md` from a template |
| `scripts/brain-brief-hook.ps1` | Optional `UserPromptSubmit` hook: injects a Brain Brief when relevant, fails closed on missing config |

## Platform Assumption

This adapter assumes Windows + PowerShell — the hook and helper scripts are
`.ps1`. Cross-platform ports (bash/zsh equivalents for macOS/Linux) are a
documented future gap, not solved here.

## See Also

- `CLAUDE.snippet.md` — Copy these sections into your lead agent's `CLAUDE.md`.
- `settings.snippet.json` — Merge into your `settings.json` (optional).
- `INSTALL.md` — Step-by-step installation for this adapter.
- `../generic-agent/INSTALL.md` — General harness installation this adapter builds on.
