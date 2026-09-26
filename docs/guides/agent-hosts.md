# Codex, Cursor, and Claude Code

The same `graphmory` CLI and `memory-curator` skill work across hosts that can run shell commands. For broad compatibility, have the user's coding agent follow the [guided install interview](../../adapters/generic-agent/INSTALL.md#agent-guided-setup). The agent inspects its host, asks for missing choices, and installs one named curator with a consistent role, skill, and inexpensive model. The lead agent still decides when to delegate and authors every new Memory Patch.

## 1. Install the CLI once

From a checkout of this repository with Node.js 20 or newer:

```sh
npm install -g --omit=optional .
graphmory doctor --json
```

The npm package is not published yet. `npm install -g --omit=optional .` may link this checkout and leaves out the optional local embedding dependency; normal retrieval needs no model download. Keep the checkout in place while using this local install. A future registry release can remove the clone step. If a global install is undesirable, keep the checkout and call `node /absolute/path/to/graphmory/scripts/brain-sync.mjs` wherever this guide says `graphmory`.

## 2. Install the curator agent and skill

For a supported host, the agent may use this helper after confirming the host format and model. Preview first, then apply. The setup command does not overwrite existing agent or skill files:

```sh
graphmory-setup --host codex
graphmory-setup --host codex --apply
```

Replace `codex` with `claude` or `cursor`. Codex defaults to `gpt-6-luna`; Claude Code defaults to `haiku`. Cursor requires `--model <model-id>` because `inherit` may use the lead model. Choose an ID available to your host and subscription. Use `--scope project --project <path>` for one workspace rather than the default user scope. Run this once per host you use. Restart a session if it does not see the new agent. The script installs the skill and a `graphmory_curator` (Codex) or `graphmory-curator` (Claude/Cursor) agent definition. It does not set up the vault or change existing global lead instructions.

| Host | User agent file | User skill directory |
| --- | --- | --- |
| Codex | `~/.codex/agents/graphmory_curator.toml` | `~/.agents/skills/memory-curator/` |
| Cursor | `~/.cursor/agents/graphmory-curator.md` | `~/.cursor/skills/memory-curator/` |
| Claude Code | `~/.claude/agents/graphmory-curator.md` | `~/.claude/skills/memory-curator/` |

The locations and model fields follow the [Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents), [Claude Code](https://code.claude.com/docs/en/sub-agents), and [Cursor](https://prod.cursor.com/docs/subagents) subagent documentation. Claude preloads the skill. Codex points to its installed skill in the agent definition. Cursor's agent prompt points to the installed skill because its documented subagent frontmatter does not specify a `skills` field. Tool/file restrictions vary by host; the prompt is a behavioral boundary, not a filesystem sandbox. Configure host permissions separately if you need a hard boundary.

Choose the Markdown/Obsidian vault as part of the same setup. Run `graphmory detect --vault "<vault-path>" --json` and follow the [vault layout guide](vault-setup.md) and [agent-guided questions](../../adapters/generic-agent/INSTALL.md). Local-only memory needs no GitHub repo. For an established vault, keep its folders unless the user approves a reviewed adoption or restructure plan. `node scripts/init-project.mjs --vault "<vault-path>" --project "<project-name>"` creates the fuller optional project template; the minimal layout needs only the project folder and notes that are useful now. Pass the chosen `--vault` path to the lead agent; the curator must receive it with each delegated task. The agent installer never edits the vault.

### Manual skill copy

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

## 3. Recall memory

The default workflow is already `curator`. Use the terminal menu only to change retrieval settings or opt into an advanced model workflow:

```sh
graphmory config
```

Then give the agent the vault path and this noninteractive call:

```sh
graphmory recall-managed --vault "<vault-path>" --query "<question>" --k 3 --agent
```

The result is one compact JSON line. The agent should open only relevant returned Markdown notes before answering, preserve provenance, and abstain when evidence is insufficient. Use `--scope` when the project or domain folder is known. See [managed retrieval](managed-retrieval.md) for the curator, hosted Jev, and local decision workflows. Hosted Jev needs explicit consent to send candidate excerpts; local decision needs a compatible server.

## 4. Give the lead agent a curator instruction

Add this instruction to your host's lead-agent guidance, then reload the host:

> After completing and verifying a task, if durable knowledge should be saved, author a Memory Patch with evidence IDs and delegate its placement, duplicate/conflict check, and validation to the named Graphmory curator agent. The lead owns the claim. The curator returns `APPLIED`, `TENSION`, or `BLOCKED` with affected note paths. Ask the same curator for a compact Brain Brief when prior memory is needed. Do not spawn an unconfigured generic memory agent.

If delegation is unavailable, the lead may follow the skill directly. Pinning Luna, Haiku, or another model is a host setting; Graphmory's `curator.model` is routing metadata and does not override the host's model. OpenCode requires its own adapter configuration.

For a Memory Patch, the lead agent supplies the claim, scope, and source IDs. The curator searches only likely destinations and checks current note contents before applying an edit. This second search is for placement and conflict detection, so it can reuse candidate paths found earlier but must not trust stale excerpts. Keep the curator's stable instructions ahead of the changing patch and excerpts to preserve any prompt caching the host/provider offers; compare reported cache usage and actual cost before claiming savings.

## 5. Smoke check

Use a disposable Markdown vault or a known existing vault in read-only recall mode:

```sh
graphmory doctor --vault "<vault-path>" --json
graphmory recall-managed --vault "<vault-path>" --query "<known-memory-question>" --k 3 --agent
```

Confirm the host invokes the CLI once, receives one JSON line, and reads only the returned notes it needs. Do not treat an empty result as permission to broaden into the full vault.
