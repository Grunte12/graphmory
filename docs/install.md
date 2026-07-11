# Installation

Memory Patch Harness is file-first. It installs a skill and gives you adapter snippets, but it does not rewrite your agent configuration automatically.

## Requirements

- Node.js 20 or newer
- A Markdown memory folder or Obsidian vault
- A coding agent that can read files and call a small memory-curator role

## Install The Skill

```sh
git clone https://github.com/Grunte12/memory-patch-harness.git
cd memory-patch-harness
npm run check
node scripts/install.mjs --target "$HOME/.config/opencode" --vault "/path/to/YourBrain"
```

The installer copies `skills/memory-curator/`, `src/` modules, the
`brain-sync.mjs` CLI binary (`bin/memory-patch-harness.mjs`), and a global
Markdown agent at `agents/memory_curator.md`. It does not edit `opencode.json`.
The installed agent uses explicit permissions for the configured Brain and the
installed CLI; it denies task spawning, web access, and arbitrary shell.

To verify the CLI works after install:
```sh
node "$(dirname $(which node))/../lib/node_modules/@memory-patch-harness/bin/memory-patch-harness.mjs" doctor --json
# or, if the target bin/ directory is on your PATH:
memory-patch-harness.mjs doctor --json
```

Use `--check` to preview what would change during an upgrade:
```sh
node scripts/install.mjs --target "$HOME/.config/opencode" --vault "/path/to/YourBrain" --check
```

`--dry-run` prints the same file plan without writing. A normal rerun preserves
existing differing files. `--upgrade` updates harness-managed files and an
unchanged installer-managed curator. An unmanaged or locally modified curator
is preserved even during `--upgrade`; replacing it requires explicit `--force`.

## Initialize A Project Memory Area

```sh
node scripts/init-project.mjs --vault "/path/to/ObsidianVault" --project "my-project"
```

This creates a small project home under the vault. Keep project-specific facts there; keep global harness rules in this repository.

## Optional Portable Brain Sync

If you want the same memory to follow you across accounts or machines, connect the vault to a private GitHub memory repo:

```sh
node scripts/brain-sync.mjs bootstrap \
  --vault "/path/to/YourBrain" \
  --repo "your-github-user/your-brain" \
  --create-remote
```

On a new machine, install the harness and run the same bootstrap command. If the repo already exists and the target vault path is empty, it clones/connects that memory. Then run:

```sh
node scripts/brain-sync.mjs status --vault "/path/to/YourBrain"
node scripts/brain-sync.mjs pull --vault "/path/to/YourBrain"
```

Use `push` only after a durable Memory Patch has been curated and validated:

```sh
node scripts/brain-sync.mjs push --vault "/path/to/YourBrain" --message "memory: update lessons"
```

The memory repo should contain only curated Markdown memory and temporary inbox evidence. Keep the harness code in this repo.

## OpenCode Adapter

After the installer has copied the skill, CLI, source modules, and wildcard
curator to `<target>`, complete the lead-agent integration:

1. **Merge `AGENTS.snippet.md` into your lead agent instructions.**
   Open `adapters/opencode/AGENTS.snippet.md` and insert its durable-memory rules into the main agent or orchestrator prompt. This gives the lead agent the memory protocol (auto-pull, Brain Briefs, Memory Patches, health checks, conflict assist, etc.).

2. **Review the installed `agents/memory_curator.md`.**
   OpenCode discovers global Markdown agents under
   `~/.config/opencode/agents/`; the installer renders this file from
   `adapters/opencode/agents/memory_curator.md` with exact Brain and CLI paths.
   It defines the recall/synthesis/consolidation modes and the
   `APPLIED`/`TENSION`/`BLOCKED` return contract.

3. **Keep `opencode.agent.example.json` only as a legacy JSON example.**
   New installs use the runtime-native Markdown agent and current `permission`
   syntax. Do not mutate `opencode.json` merely to register the curator.

4. **Add `<target>/bin/` to your `PATH`** so you can run `memory-patch-harness.mjs` from any directory without `node <target>/bin/...`.

5. **Verify the CLI works from the installed location:**
   ```sh
   node <target>/bin/memory-patch-harness.mjs doctor --json
   ```

The core mapping is:

```text
Main agent / orchestrator -> authors Memory Patch
memory_curator -> retrieves Brain Briefs and applies patches
Markdown / Obsidian -> canonical operational memory
Derived Index / Hot Context Pack -> rebuildable views
```

The installer intentionally does not edit `opencode.json` or lead-agent
instructions. It creates or safely upgrades only the dedicated Markdown curator
file; merge `AGENTS.snippet.md` manually so project conventions remain yours.

## Claude Code Adapter

For [Claude Code](https://claude.com/claude-code), follow
`adapters/claude-code/INSTALL.md` — it wires the harness into a skill, a
curator subagent, and an optional recall hook instead of a single
`AGENTS.md`-style prompt.

## Codex Adapter

For the OpenAI Codex CLI, follow `adapters/codex/INSTALL.md` — it merges a
slim durable-memory-and-safety block into `~/.codex/AGENTS.md` (global)
and/or the repo-root `AGENTS.md` (per-project), installs `memory-curator` as
a native Codex skill, and invokes the harness CLI through Codex's shell tool.
If Codex is running as a review lane inside another orchestrator, keep it
read-only (`recall`/`health`/`lifecycle-audit` only).

## Any-Agent Adapter

For coding agents that are not OpenCode, Claude Code, or Codex, start with:

- `AGENTS.md`
- `adapters/generic-agent/INSTALL.md`

If you are not using OpenCode, keep the same boundary:

1. The main agent completes and verifies work.
2. The main agent writes a valid Memory Patch.
3. The memory curator finds the target note, checks conflicts, and returns `APPLIED`, `TENSION`, or `BLOCKED`.
4. Future work asks the curator for a bounded Brain Brief before loading broad memory.

The memory curator may be cheap. It should not decide what the system learned; it should place, link, and lint the lead-agent-authored patch.

## Verify

```sh
npm run check
npm run eval:curator:compare
node scripts/render-hot-context.mjs
```

These commands validate the contracts, retrieval baselines, curator behavior, patch quality, and hot-context rendering.
