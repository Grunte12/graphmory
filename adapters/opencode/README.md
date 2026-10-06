# OpenCode Adapter

**Transport: MCP, with filesystem as a fallback**

This adapter configures Graphmory for the [OpenCode](https://opencode.ai/)
coding agent platform. OpenCode supports custom agent definitions, skills, and
permission rules.

## Transport

| Property | Value |
|---|---|
| Method | **CLI** via Graphmory scripts and OpenCode `bash` permission (fallback) |
| Recommended | **MCP** — register `graphmory-mcp` under `mcp` in `opencode.json` |
| Requirements | Graphmory cloned locally; OpenCode agent config updated |
| Startup setup | Lead agent runs `graphmory auto-pull --json` at session start |

## How Memory Access Is Established

1. The Graphmory repository is cloned to the local machine.
2. The lead agent's instructions reference the Memory Curator and related commands.
3. Memory Curator is configured as a sub-agent with filesystem read/edit/glob/grep
   permissions (see `opencode.agent.example.json`).
4. The Graphmory scripts (`scripts/brain-sync.mjs`, `scripts/render-hot-context.mjs`)
   are invoked through OpenCode's `bash` tool permission.
5. Memory Patches are written as Markdown notes in the vault directory.
6. `AGENTS.snippet.md` provides the durable-memory section for the lead agent.

## Switched Transport

OpenCode can use the `graphmory-mcp` server directly: add it under `mcp` in `opencode.json` as shown in [MCP host configuration](../../docs/guides/mcp-hosts.md). A future adapter could use Obsidian CLI or REST.

| Transport | When to use |
|---|---|
| `filesystem` | Fallback — direct Graphmory scripts with `bash` permission |
| `mcp` | Recommended — the `graphmory-mcp` server is registered in `opencode.json` |
| `obsidian-cli` | When the vault is an Obsidian vault and Obsidian CLI is available |

## Files in This Adapter

| File | Purpose |
|---|---|
| `README.md` | This file — adapter overview and transport |
| `AGENTS.snippet.md` | Durable-memory instruction block for the lead agent |
| `memory-curator-prompt.md` | Full prompt for the Memory Curator sub-agent |
| `opencode.agent.example.json` | Example sub-agent configuration with permissions |

## See Also

- `AGENTS.snippet.md` — Copy these instructions into the lead agent prompt.
- `memory-curator-prompt.md` — The Memory Curator role prompt.
- `opencode.agent.example.json` — Example agent-definition JSON.
