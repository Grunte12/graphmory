# OpenCode Adapter

**Transport: MCP**

This adapter configures Graphmory for the [OpenCode](https://opencode.ai/)
coding agent platform. OpenCode supports custom agent definitions, skills, and
permission rules.

## Transport

| Property | Value |
|---|---|
| Method | **MCP**: register `graphmory-mcp` under `mcp` in `opencode.json` ([MCP host configuration](../../docs/guides/mcp-hosts.md)) |
| Requirements | Graphmory installed; OpenCode agent config updated |
| Startup setup | The main agent calls `sync` with `action: "pull"` at session start |

## How Memory Access Is Established

1. `graphmory-mcp` is registered in `opencode.json` with `GRAPHMORY_VAULT` set.
2. The main agent's instructions reference the Graphmory Curator (`AGENTS.snippet.md`).
3. Graphmory Curator is configured as a sub-agent that works through the MCP tools; it has no edit or shell permission (see `opencode.agent.example.json`).
4. Memory Patches are filed with `remember`, which writes the Markdown notes in the vault.
5. Owner decisions (low-confidence memory, recovery, every push) appear as questions in OpenCode's UI when it supports MCP elicitation; otherwise the owner decides in a terminal.

## Files in This Adapter

| File | Purpose |
|---|---|
| `README.md` | This file — adapter overview and transport |
| `AGENTS.snippet.md` | Durable-memory instruction block for the main agent |
| `graphmory-curator-prompt.md` | Full prompt for the Graphmory Curator sub-agent |
| `opencode.agent.example.json` | Example sub-agent configuration with permissions |

## See Also

- `AGENTS.snippet.md` — Copy these instructions into the main agent prompt.
- `graphmory-curator-prompt.md` — The Graphmory Curator role prompt.
- `opencode.agent.example.json` — Example agent-definition JSON.
