# Generic Agent Adapter

**Transport: MCP**

This adapter connects any AI coding agent that can use MCP to Graphmory. Agents use the `graphmory-mcp` server and its tools `recall`, `read`, `remember`, `link`, `status` and `sync`; see [MCP host configuration](../../docs/guides/mcp-hosts.md). The owner uses Obsidian (or any editor) for the notes and the `graphmory` command only for one-time setup and maintenance.

## Transport

| Property | Value |
|---|---|
| Method | **MCP** stdio (`graphmory-mcp`), or Streamable HTTP behind a bearer token |
| Requirements | Node.js 20+, Graphmory installed, `GRAPHMORY_VAULT` set in the host's MCP config |
| Lock discipline | One coordinated writer per vault; see `INSTALL.md` Shared Brain Hook |
| Startup setup | The main agent calls `sync` with `action: "pull"` |

## How Memory Access Is Established

1. The owner installs Graphmory and runs `graphmory doctor` once.
2. The host's MCP config starts `graphmory-mcp` with the vault path.
3. The Curator sub-agent recalls and reads notes, and files Memory Patches, through the MCP tools.
4. `status` reports pending work, owner reviews, lifecycle and health; `sync` pulls and pushes the private Git remote.
5. Decisions that belong to the owner (low-confidence memory, recovery, every push) appear as questions in the host's own UI.

Write new canonical notes in concise English and let the main agent answer in the user's chosen language. Keep exact identifiers and provenance. See the [language and token budget guide](../../docs/guides/token-efficient-language.md).

A host that cannot run an MCP server is not supported for agents. Developers and evaluations can drive the full CLI from a checkout (`node scripts/brain-sync.mjs`, see `docs/guides/cli-reference.md`).

## See Also

- `INSTALL.md` — Step-by-step installation for this adapter.
- `docs/guides/install.md` — General Graphmory installation.
- `docs/guides/portable-brain-sync.md` — Multi-machine sync guidance.
