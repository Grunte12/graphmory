# MCP host configuration

Graphmory is a standard stdio MCP server, so any MCP client can use it: Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Antigravity, Windsurf, OpenCode, Cline, Zed and others. The command is `graphmory-mcp` and the vault is set at startup by `GRAPHMORY_VAULT`. Replace `/path/to/vault` below. Install the CLI first (`npm install -g .` from the checkout) so `graphmory-mcp` is on `PATH`, then run `graphmory doctor`.

## Entries

**Claude Code** ([docs](https://code.claude.com/docs/en/mcp-quickstart)): user `~/.claude.json`, project `.mcp.json`. One line: `claude mcp add graphmory -- graphmory-mcp` (then set `GRAPHMORY_VAULT` in the entry's `env`).

```json
{"mcpServers":{"graphmory":{"type":"stdio","command":"graphmory-mcp","env":{"GRAPHMORY_VAULT":"/path/to/vault"}}}}
```

**Codex** ([docs](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)): user `~/.codex/config.toml`, project `.codex/config.toml`. One line: `codex mcp add graphmory -- graphmory-mcp`.

```toml
[mcp_servers.graphmory]
command = "graphmory-mcp"

[mcp_servers.graphmory.env]
GRAPHMORY_VAULT = "/path/to/vault"
```

**OpenCode** ([docs](https://opencode.ai/docs/mcp-servers)): user `~/.config/opencode/opencode.json`, project `opencode.json`. Different keys from the others: root `mcp`, `command` is an array, and the variables go in `environment`.

```json
{"mcp":{"graphmory":{"type":"local","command":["graphmory-mcp"],"environment":{"GRAPHMORY_VAULT":"/path/to/vault"}}}}
```

**Cline** ([docs](https://docs.cline.bot/mcp/adding-and-configuring-servers)): VS Code extension `cline_mcp_settings.json`; CLI `~/.cline/data/settings/cline_mcp_settings.json`.

```json
{"mcpServers":{"graphmory":{"command":"graphmory-mcp","args":[],"env":{"GRAPHMORY_VAULT":"/path/to/vault"}}}}
```

**GitHub Copilot in VS Code**: project `.vscode/mcp.json`. The root key is `servers`, not `mcpServers`; the vault is passed with `--vault`.

```json
{"servers":{"graphmory":{"command":"graphmory-mcp","args":["--vault","/path/to/vault"]}}}
```

**Cursor**: user `~/.cursor/mcp.json`, project `.cursor/mcp.json`.

```json
{"mcpServers":{"graphmory":{"command":"graphmory-mcp","args":[],"env":{"GRAPHMORY_VAULT":"/path/to/vault"}}}}
```

**Windsurf**: `~/.codeium/windsurf/mcp_config.json`, or Command Palette `Windsurf: Configure MCP Servers`. Same JSON as Cursor.

**Zed**: `~/.config/zed/settings.json`, root key `context_servers`.

```json
{"context_servers":{"graphmory":{"command":"graphmory-mcp","args":[],"env":{"GRAPHMORY_VAULT":"/path/to/vault"}}}}
```

**Gemini CLI, Antigravity and any other MCP client**: add a stdio server in the host's MCP settings with command `graphmory-mcp` and `GRAPHMORY_VAULT` in its environment, or run `graphmory-mcp --vault /path/to/vault`.

## Curator sub-agent

MCP discovery and the Curator sub-agent are separate. `graphmory-setup` installs a Curator agent only for Codex, Claude Code and Cursor ([agent-hosts.md](agent-hosts.md)). Other hosts can call the four tools, but dispatching a cheap Curator model is up to that host.
