# Codex Adapter

**Transport: Filesystem (Codex shell tool, native skills, and optional custom
subagents; no MCP required)**

This adapter configures Memory Patch Harness for [Codex](https://openai.com/codex/)
— the OpenAI Codex CLI / Codex-as-a-coding-agent runtime. Codex reads a
merged `AGENTS.md` instruction file for durable, cross-session rules and
supports **Agent Skills** — reusable, on-demand workflow files with `name`/
`description` frontmatter that Codex loads only when relevant, rather than
paying their token cost on every turn. This adapter uses both surfaces: a
slim `AGENTS.md` snippet for durable memory rules and safety, native skills for
recall, intake, and lead-owned updates, and optional read-only custom agents for
cheap recall and ingestion.

The complete design is in [BRAIN-DESIGN.md](BRAIN-DESIGN.md). Its central
boundary is: intake prepares evidence, the lead authors meaning, and only a
verified Memory Patch or Learning Packet changes canonical memory.

## Transport

| Property | Value |
|---|---|
| Method | **Filesystem** — Codex CLI executes harness scripts through its shell tool |
| Optional extension | None — no MCP server required |
| Requirements | Harness installed locally; global and/or repo `AGENTS.md` updated; adapter skills and optional custom agents installed under Codex home |
| Startup setup | Lead agent runs `brain-sync auto-pull --json` at session start when shared memory may have changed |

## How Memory Access Is Established

1. Codex reads `AGENTS.md` files natively: the global file
   (`~/.codex/AGENTS.md`) is concatenated first, then `AGENTS.md` files from
   the Git root down to the working directory. More specific files appear
   later in the combined prompt, so instructions closer to the working
   directory override global ones. (`~/.codex/AGENTS.override.md`, if
   present, takes precedence over the global base file; per-file content is
   capped by `project_doc_max_bytes`, 32 KiB by default.) That injection
   point is where the durable-memory-and-safety instruction block goes — see
   `AGENTS.snippet.md`.
2. The harness is cloned or installed locally via
   `node scripts/install.mjs --target <dir>` (e.g.
   `~/.codex/tools/memory-patch-harness`), which deploys the harness CLI and
   its source modules.
3. The adapter installs three **native Codex skills** rather than embedding
   their full prompts in `AGENTS.md`: `memory-curator` for bounded recall,
   `brain-ingest` for evidence preparation, and `brain-update` for a
   lead-owned canonical write. Optional custom agents keep recall and intake
   isolated from the lead context.
4. The harness CLI is invoked directly through Codex's shell tool from
   inside the skill or directly by the lead agent, e.g.:

   ```sh
   node <harness>/bin/memory-patch-harness.mjs recall --vault "$OBSIDIAN_VAULT" --query "<question>" --scope "$MEMORY_PATCH_HARNESS_SCOPE" --json
   node <harness>/bin/memory-patch-harness.mjs health --vault "$OBSIDIAN_VAULT" --json
   ```

   Set `OBSIDIAN_VAULT` and `MEMORY_PATCH_HARNESS_SCOPE` as environment
   variables (see `INSTALL.md`) so commands do not need repeated flags.
5. Decision gates and never-do rules are identical to every other adapter and
   are not restated here — they live in this repository's root `AGENTS.md`
   (`Human Judgment Gates`, `Never Do`, `Shared Brain Sync`). Point Codex at
   that file rather than duplicating the rules per adapter.

## Read-Only Reviewer Mode

**Important:** when Codex runs as a review lane inside another orchestrator
(for example, as the review agent behind Claude Code's `codex` plugin doing
`/codex:review` or `/codex:adversarial-review`), it must treat the memory
vault as **read-only**. `recall`, `health`, and `lifecycle-audit` are fine to
run for context; `bootstrap`, `push`, `restructure-apply`, or any command
that writes to the vault belongs to the lead agent of that session, not to
Codex acting as a reviewer. A reviewer that writes memory can silently
launder unverified findings into durable memory the lead agent never
authored. If a review surfaces something worth remembering, hand the finding
back to the lead agent to write the Memory Patch — do not write it directly
from the reviewer role.

## Files in This Adapter

| File | Purpose |
|---|---|
| `README.md` | This file — adapter overview, transport, and the read-only-reviewer rule |
| `BRAIN-DESIGN.md` | Retrieval, ingestion, update, structure, and evaluation design |
| `AGENTS.snippet.md` | Durable-memory-and-safety instruction block to merge into a Codex `AGENTS.md` |
| `agents/*.toml` | Optional low-cost read-only curator and ingestion agents |
| `skills/memory-curator/SKILL.md` | Bounded sparse-plus-semantic recall protocol |
| `skills/brain-ingest/SKILL.md` | Raw-source Evidence Digest and significance gate |
| `skills/brain-update/SKILL.md` | Lead-owned canonical update workflow |
| `install.mjs` | Safe installer that renders paths/models without modifying `AGENTS.md` |
| `INSTALL.md` | Step-by-step installation for this adapter |

## See Also

- `AGENTS.snippet.md` — Copy these instructions into `~/.codex/AGENTS.md` or the repo-root `AGENTS.md`.
- `skills/memory-curator/SKILL.md` — Install this under Codex's skills directory (see `INSTALL.md`).
- `BRAIN-DESIGN.md` — Read the rationale and eval gates before expanding the memory stack.
- `INSTALL.md` — Step-by-step installation for this adapter.
- `../generic-agent/INSTALL.md` — General harness installation this adapter builds on.
- `../../skills/memory-curator/` — The source-of-truth Memory Curator role/protocol this skill is derived from.
