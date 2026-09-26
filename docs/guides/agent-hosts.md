# Codex, Cursor, and Claude Code

The same `graphmory` CLI and `memory-curator` skill work across hosts that can run shell commands. Each host discovers skills in a different directory. This guide uses the CLI for retrieval and leaves model and subagent registration in the host's own configuration.

## 1. Install the CLI once

From a checkout of this repository with Node.js 20 or newer:

```sh
npm install -g .
graphmory doctor --json
```

`npm install -g .` installs a copy of the current checkout, not a published registry package. If a global install is undesirable, keep the checkout and call `node /absolute/path/to/graphmory/scripts/brain-sync.mjs` wherever this guide says `graphmory`.

## 2. Install the skill for your host

Copy the entire `skills/memory-curator` directory, including `references/` and `agents/`. Choose a project path for one workspace or a user path for all local workspaces:

| Host | Project skill directory | User skill directory |
| --- | --- | --- |
| Codex | `<project>/.agents/skills/memory-curator/` | `~/.agents/skills/memory-curator/` |
| Cursor | `<project>/.cursor/skills/memory-curator/` | `~/.cursor/skills/memory-curator/` |
| Claude Code | `<project>/.claude/skills/memory-curator/` | `~/.claude/skills/memory-curator/` |

For example, from this repository checkout:

```sh
mkdir -p "<project>/.agents/skills"
cp -R skills/memory-curator "<project>/.agents/skills/"
```

Substitute the Cursor or Claude Code project directory from the table when appropriate. Restart or reload the agent session after copying. In curator mode, confirm the agent can discover `memory-curator` before configuring a sub-agent. The default workflow needs no Jev account or additional model API key. Jev/local decision modes remain optional advanced setups.

The host locations follow [Codex's repository skill convention](https://developers.openai.com/blog/skills-agents-sdk), [Cursor's skill directories](https://prod.cursor.com/help/customization/skills), and [Claude Code's directory reference](https://code.claude.com/docs/en/claude-directory). Cursor also discovers `.agents/skills/`, but use its native `.cursor/skills/` path when testing Cursor by itself. Keep only one installed copy per host scope to avoid duplicate discovery.

## 3. Configure retrieval

Run the human-facing menu once. Choose `1 Curator sub-agent` for the host-managed setup:

```sh
graphmory config
```

Then give the agent the vault path and this noninteractive call:

```sh
graphmory recall-managed --vault "<vault-path>" --query "<question>" --k 3 --agent
```

The result is one compact JSON line. The agent should open only relevant returned Markdown notes before answering, preserve provenance, and abstain when evidence is insufficient. Use `--scope` when the project or domain folder is known. See [managed retrieval](managed-retrieval.md) for the curator, hosted Jev, and local decision workflows. Hosted Jev needs explicit consent to send candidate excerpts; local decision needs a compatible server.

## 4. Register a curator subagent only if desired

The skill works with the lead agent alone. For a dedicated curator, use `adapters/opencode/memory-curator-prompt.md` as the role prompt and give the curator filesystem read access plus permission to run `graphmory`. Keep the lead agent responsible for authoring Memory Patches. Configure the curator's model in the host's own agent settings: the model identifier saved by `graphmory config` is routing metadata and does not create or select a Codex, Cursor, or Claude subagent automatically. Start with a low-cost model available in that host (for example Luna in Codex or Haiku in Claude Code), then check Brain Brief and patch-placement quality. The host may expose a model alias rather than a full model ID; use the name its own agent settings accept. Cursor and OpenCode users can choose any supported curator model.

For a Memory Patch, the lead agent supplies the claim, scope, and source IDs. The curator searches only likely destinations and checks current note contents before applying an edit. This second search is for placement and conflict detection, so it can reuse candidate paths found earlier but must not trust stale excerpts. Keep the curator's stable instructions ahead of the changing patch and excerpts to preserve any prompt caching the host/provider offers; compare reported cache usage and actual cost before claiming savings.

## 5. Smoke check

Use a disposable Markdown vault or a known existing vault in read-only recall mode:

```sh
graphmory doctor --vault "<vault-path>" --json
graphmory recall-managed --vault "<vault-path>" --query "<known-memory-question>" --k 3 --agent
```

Confirm the host invokes the CLI once, receives one JSON line, and reads only the returned notes it needs. Do not treat an empty result as permission to broaden into the full vault.
