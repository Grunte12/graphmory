# Generic Agent Adapter

**Transport: Filesystem**

This adapter connects any AI coding agent to Graphmory through
direct filesystem access. No plugin, REST API, MCP server, or Obsidian-specific
tooling is required.

## Transport

| Property | Value |
|---|---|
| Method | **Filesystem** (Node.js `fs` via `scripts/brain-sync.mjs`) |
| Requirements | Local clone or checkout of Graphmory repository |
| Fallback | None — filesystem must be available on the runtime machine |
| Lock discipline | Single-writer recommended; see `INSTALL.md` Shared Brain Hook |
| Startup setup | `node scripts/brain-sync.mjs auto-pull --vault "<path>" --json` |

## How Memory Access Is Established

1. The agent has filesystem read/write access to Graphmory repo directory.
2. The user provides a vault path (local directory or Git clone).
3. Commands such as `recall`, `health`, `lifecycle-audit`, and `brain-sync` operate
   directly on that directory via `scripts/brain-sync.mjs`.
4. Memory Patches are written as Markdown files in the vault.
5. Git sync is managed by the lead agent via `sync-plan` / `push` commands.

Write new canonical notes in concise English and let the lead agent answer in the user's chosen language. Keep exact identifiers and provenance. See the [language and token budget guide](../../docs/guides/token-efficient-language.md).

## When to Change Transport

If the agent environment changes (e.g., gains an MCP server, Obsidian CLI, or REST
endpoint), update this section to the new transport. Supported transport values:

| Transport | Description |
|---|---|
| `filesystem` | Direct directory access via Graphmory scripts |
| `mcp` | Model Context Protocol server |
| `obsidian-cli` | Obsidian CLI (e.g., `obsidian vault open`) |
| `obsidian-rest` | Obsidian Local REST API plugin |
| `custom` | Agent-specific mechanism |

## See Also

- `INSTALL.md` — Step-by-step installation for this adapter.
- `docs/guides/install.md` — General Graphmory installation.
- `docs/guides/portable-brain-sync.md` — Multi-machine sync guidance.
