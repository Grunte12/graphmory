# Codex, Cursor, and Claude Code

The same `graphmory` CLI and `memory-curator` skill work across hosts that can run shell commands. Each host discovers skills in a different directory. Codex and Cursor can dispatch curator work themselves from the lead-agent instruction below; a dedicated global subagent is optional.

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

## 3. Recall memory

The default workflow is already `curator`; Codex and Cursor can dispatch a sub-agent when the lead agent is given the curator guide. No Graphmory config step is required for this path. Use the terminal menu only to change retrieval settings or opt into an advanced model workflow:

```sh
graphmory config
```

Then give the agent the vault path and this noninteractive call:

```sh
graphmory recall-managed --vault "<vault-path>" --query "<question>" --k 3 --agent
```

The result is one compact JSON line. The agent should open only relevant returned Markdown notes before answering, preserve provenance, and abstain when evidence is insufficient. Use `--scope` when the project or domain folder is known. See [managed retrieval](managed-retrieval.md) for the curator, hosted Jev, and local decision workflows. Hosted Jev needs explicit consent to send candidate excerpts; local decision needs a compatible server.

## 4. Give the lead agent a curator instruction

Codex and Cursor can spawn a sub-agent for a bounded curator task without Graphmory creating one. Add this instruction to your host's agent guidance:

> After completing and verifying a task, if durable knowledge should be saved, author a Memory Patch with evidence IDs and delegate its placement, duplicate/conflict check, and validation to a curator sub-agent using the `memory-curator` skill. The lead owns the claim. The curator returns `APPLIED`, `TENSION`, or `BLOCKED` with affected note paths. Ask for a compact Brain Brief when prior memory is needed. Use an inexpensive available sub-agent model and read only the relevant notes.

The skill also works directly with the lead agent if delegation is unavailable. For a reusable dedicated curator, use `adapters/opencode/memory-curator-prompt.md` as its role prompt and grant only the tools it needs. Pinning Luna, Haiku, or another model is a host setting; Graphmory's `curator.model` is routing metadata and does not override the host's model. Cursor custom sub-agents inherit the parent model unless their host configuration selects another, so a guide alone does not guarantee a cheaper model. If you want a pinned Cursor curator across projects, create a user-scoped agent under `~/.cursor/agents/` with a specific supported `model` in its frontmatter; [Cursor's subagent guide](https://prod.cursor.com/docs/subagents) documents this location and behavior. OpenCode requires its own adapter configuration.

For a Memory Patch, the lead agent supplies the claim, scope, and source IDs. The curator searches only likely destinations and checks current note contents before applying an edit. This second search is for placement and conflict detection, so it can reuse candidate paths found earlier but must not trust stale excerpts. Keep the curator's stable instructions ahead of the changing patch and excerpts to preserve any prompt caching the host/provider offers; compare reported cache usage and actual cost before claiming savings.

## 5. Smoke check

Use a disposable Markdown vault or a known existing vault in read-only recall mode:

```sh
graphmory doctor --vault "<vault-path>" --json
graphmory recall-managed --vault "<vault-path>" --query "<known-memory-question>" --k 3 --agent
```

Confirm the host invokes the CLI once, receives one JSON line, and reads only the returned notes it needs. Do not treat an empty result as permission to broaden into the full vault.
