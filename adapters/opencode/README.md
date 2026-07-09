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
| Requirements | Harness cloned locally; OpenCode agent config updated |
| Startup setup | Lead agent runs `brain-sync auto-pull --json` at session start |

## How Memory Access Is Established

1. The harness repository is cloned to the local machine.
2. The lead agent's instructions reference the Memory Curator and related commands.
3. Memory Curator is configured as a sub-agent with filesystem read/edit/glob/grep
   permissions (see `opencode.agent.example.json`).
4. The harness scripts (`scripts/brain-sync.mjs`, `scripts/render-hot-context.mjs`)
   are invoked through OpenCode's `bash` tool permission.
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
| `memory-curator-prompt.md` | Full prompt for the Memory Curator sub-agent |
| `opencode.agent.example.json` | Example sub-agent configuration with permissions |

## See Also

- `AGENTS.snippet.md` — Copy these instructions into the lead agent prompt.
- `memory-curator-prompt.md` — The Memory Curator role prompt.
- `opencode.agent.example.json` — Example agent-definition JSON.
