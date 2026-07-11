# OpenCode Adapter

**Transport: Filesystem (with MCP as optional extension)**

This adapter configures Memory Patch Harness for the [OpenCode](https://opencode.ai/)
coding agent platform. OpenCode supports custom agent definitions, skills, and
permission rules.

## Transport

| Property | Value |
|---|---|
| Method | **Filesystem** via harness scripts and OpenCode `bash` permission |
| Optional extension | **MCP** — an MCP server can be defined to expose memory operations |
| Requirements | Harness cloned locally; configured Brain path |
| Startup setup | Lead agent runs `brain-sync auto-pull --json` at session start |

## How Memory Access Is Established

1. The harness repository is cloned to the local machine.
2. `scripts/install.mjs --target <opencode-home> --vault <brain>` installs one
   discoverable `agents/memory_curator.md` Markdown subagent.
3. The agent has bounded filesystem read/search, Brain-only edit, exact harness
   CLI, and external-directory permissions. Task spawning, web access, and
   arbitrary shell are denied.
4. The lead agent's instructions reference the Memory Curator and related commands.
5. Memory Patches are written as Markdown notes in the vault directory.
6. `AGENTS.snippet.md` provides the durable-memory section for the lead agent.

## Switched Transport

If your OpenCode runtime gains an MCP server that wraps the harness, you may
change the transport to `mcp`. A future adapter could use Obsidian CLI or REST.

| Transport | When to use |
|---|---|
| `filesystem` | Default — direct harness scripts with `bash` permission |
| `mcp` | When a harness MCP server is running and accessible |
| `obsidian-cli` | When the vault is an Obsidian vault and Obsidian CLI is available |

## Files in This Adapter

| File | Purpose |
|---|---|
| `README.md` | This file — adapter overview and transport |
| `AGENTS.snippet.md` | Durable-memory instruction block for the lead agent |
| `agents/memory_curator.md` | Installer-rendered global Markdown agent template |
| `memory-curator-prompt.md` | Full prompt for the Memory Curator sub-agent |
| `opencode.agent.example.json` | Legacy JSON configuration example |

## See Also

- `AGENTS.snippet.md` — Copy these instructions into the lead agent prompt.
- `agents/memory_curator.md` — Runtime-native agent template used by the installer.
- `memory-curator-prompt.md` — Standalone version of the role prompt.
- `opencode.agent.example.json` — Legacy JSON example only.
