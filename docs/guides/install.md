# Installation

Graphmory is file-first. For Codex, Cursor, and Claude Code, its setup script can install a named curator agent and skill after a path/model preview. The OpenCode installer still uses adapter snippets and does not rewrite `opencode.json`.

For Codex, Cursor, or Claude Code, follow the [cross-host setup guide](agent-hosts.md). The steps below describe the existing OpenCode installer and vault setup.

## Where installation instructions live

- [README Quick Start](../../README.md#quick-start) is the first path for a person arriving from GitHub; its agent-guided setup is recommended.
- This guide explains setup and vault choices; [host setup](agent-hosts.md) gives exact commands and agent paths.
- [Vault setup and architecture](vault-setup.md) explains the minimal Markdown layout, existing-vault choices, and graph links.
- [Generic agent install guide](../../adapters/generic-agent/INSTALL.md) is the checklist for a coding agent doing setup for someone.
- [AGENTS.md](../../AGENTS.md) guides agents working in this repository; [`memory-curator/SKILL.md`](../../skills/memory-curator/SKILL.md) defines curator behavior after installation. Neither is a substitute for installing the CLI.

For now, clone the GitHub repository and run `npm install -g --omit=optional .` from it. A fork is needed only if you intend to maintain your own changes. The npm registry package name is not published yet, so `npm install -g graphmory` is a future distribution path, not a current command.

## Requirements

- Node.js 20 or newer
- A Markdown memory folder or Obsidian vault
- A coding agent that can read files and run the CLI; install a named memory-curator sub-agent for consistent curator mode

## Install The Skill

```sh
git clone https://github.com/Grunte12/graphmory.git
cd graphmory
npm run check
node scripts/install.mjs --target "$HOME/.config/opencode"
```

The installer copies `skills/memory-curator/`, `src/` modules, and the `brain-sync.mjs` CLI binary (`bin/graphmory.mjs`). It does not edit `opencode.json`.

To verify the CLI works after install:
```sh
node "<target>/bin/graphmory.mjs" doctor --json
# or, after adding <target>/bin/ to PATH:
graphmory.mjs doctor --json
```

Use `--check` to preview what would change during an upgrade:
```sh
node scripts/install.mjs --target "$HOME/.config/opencode" --check
```

## Initialize A Project Memory Area

```sh
node scripts/init-project.mjs --vault "/path/to/ObsidianVault" --project "my-project"
```

This creates the fuller project template under the vault. For a minimal new vault, follow [vault setup](vault-setup.md) and create only the needed folders and notes. Keep project-specific facts there; keep global harness rules in this repository.

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

After the installer has copied the skill, CLI, and src modules to `<target>`, apply the adapter files under `adapters/opencode/` to your OpenCode runtime:

1. **Merge `AGENTS.snippet.md` into your lead agent instructions.**
   Open `adapters/opencode/AGENTS.snippet.md` and insert its durable-memory rules into the main agent or orchestrator prompt. This gives the lead agent the memory protocol (auto-pull, Brain Briefs, Memory Patches, health checks, conflict assist, etc.).

2. **Use `memory-curator-prompt.md` as the `memory_curator` sub-agent prompt.**
   Set this file's full content as the prompt for your `memory_curator` sub-agent. It defines the three recall/synthesis/consolidation modes and the `APPLIED`/`TENSION`/`BLOCKED` return contract.

3. **Use `opencode.agent.example.json` as a sub-agent configuration template.**
   Copy the agent definition from this file and adjust the `prompt` field to paste the contents of `memory-curator-prompt.md`. The example grants `read`, `edit`, `glob`, `grep`, `list`, and `external_directory` permissions while denying `bash`, `task`, `webfetch`, and `websearch`.

4. **Add `<target>/bin/` to your `PATH`** so you can run `graphmory.mjs` from any directory without `node <target>/bin/...`.

5. **Verify the CLI works from the installed location:**
   ```sh
   node <target>/bin/graphmory.mjs doctor --json
   ```

The core mapping is:

```text
Main agent / orchestrator -> authors Memory Patch
memory_curator -> retrieves Brain Briefs and applies patches
Markdown / Obsidian -> canonical operational memory
Derived Index / Hot Context Pack -> rebuildable views
```

The installer intentionally does not edit `opencode.json` or any agent prompt. All adapter changes are manual review-and-apply steps so you control exactly what gets configured.

## Any-Agent Adapter

For coding agents that are not OpenCode, start with:

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
