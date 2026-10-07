# Codex, Cursor, and Claude Code

The same `graphmory` CLI and `graphmory-curator` skill work across hosts that can run shell commands. For broad compatibility, have the user's coding agent follow the [guided install interview](../../adapters/generic-agent/INSTALL.md#agent-guided-setup). The agent inspects its host, asks for missing choices, and installs one named curator with a consistent role, skill, and inexpensive model. The main agent still decides when to delegate and authors every new Memory Patch.

Hosts that support MCP should also connect the `graphmory-mcp` server, which exposes `recall`, `read` and `remember` as tools; see [MCP host configuration](mcp-hosts.md). The CLI steps below remain available for hosts that cannot run an MCP server.

## 1. Install the CLI once

From a checkout of this repository with Node.js 20 or newer:

```sh
npm install -g .
graphmory doctor --json
```

The npm package is not published yet. `npm install -g .` may link this checkout; keep it in place. Recommended hybrid retrieval requires the optional Transformers dependency and an initial local BGE model download. `--omit=optional` supports explicit lexical diagnostics only; it does not complete hybrid setup. A future registry release can remove the clone step. If a global install is undesirable, keep the checkout and call `node /absolute/path/to/graphmory/scripts/brain-sync.mjs` wherever this guide says `graphmory`.

## 2. Install the curator agent and skill

For a supported host, the agent may use this helper after confirming the host format and model. Preview first, then apply. The setup command does not overwrite existing agent or skill files unless you pass `--update`:

```sh
graphmory-setup --host codex --choices
graphmory-setup --host codex --model <chosen model> --apply
```

The Curator is a specialist sub-agent, not a general one: its prompt (`skills/graphmory-curator/references/curator-agent.md`) gives it one job, a fixed set of tools (the Graphmory MCP `recall`, `read` and `remember`) and the graphmory-curator skill.

Setup never picks the model, and each host's agent sets up only its own Curator: Codex for Codex, Cursor for Cursor. `--host <host> --choices` lists the models that host reports: Codex from `~/.codex/models_cache.json` (with each model's reasoning efforts), Cursor from `cursor-agent models`, and Claude Code its `haiku`, `sonnet` and `opus` aliases (Claude Code has no listing command). The output carries `guidance` for the installing agent: suggest 2-4 models, the newest fast, low-cost tier first, and let the user pick or type another. Pass the answer with `--model <id>` (and `--effort <level>` for Codex). In an interactive terminal, `--apply` without `--model` shows the same list.

Setup copies the skill and prompt, so a newer Graphmory does not change an existing install. `graphmory doctor` shows `curator: update available` when the copies are older. Then run `graphmory-setup --host <host> --apply --update`: it keeps the installed model and reasoning effort unless you pass new ones, and moves the old files to a `graphmory-backups` folder next to the skills folder.

Replace `codex` with `claude` or `cursor`. `inherit` is refused because it would use the main agent's model. Use `--scope project --project <path>` for one workspace rather than the default user scope. Run this once per host you use. Restart or start a fresh session if it does not see the new agent. For project-scoped Codex files, open the project as trusted in Codex; do not change global trust settings just for Graphmory. The script installs the skill and a `graphmory_curator` (Codex) or `graphmory-curator` (Claude/Cursor) agent definition. It does not set up the vault or change existing global lead instructions.

Model catalog visibility does not prove account support. If the host rejects the default, preview setup with an explicitly supported inexpensive model, such as `--model gpt-5.6-luna`, before applying. Verify an actual child run; do not silently fall back to the main agent's model.

| Host | User agent file | User skill directory |
| --- | --- | --- |
| Codex | `~/.codex/agents/graphmory_curator.toml` | `~/.agents/skills/graphmory-curator/` |
| Cursor | `~/.cursor/agents/graphmory-curator.md` | `~/.cursor/skills/graphmory-curator/` |
| Claude Code | `~/.claude/agents/graphmory-curator.md` | `~/.claude/skills/graphmory-curator/` |

The locations and model fields follow the [Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents), [Claude Code](https://code.claude.com/docs/en/sub-agents), and [Cursor](https://cursor.com/docs/subagents) subagent documentation. Claude preloads the skill. Codex points to its installed skill in the agent definition. Cursor's agent prompt points to the installed skill because its documented subagent frontmatter does not specify a `skills` field. Tool/file restrictions vary by host; the prompt is a behavioral boundary, not a filesystem sandbox. Configure host permissions separately if you need a hard boundary.

Choose the Markdown/Obsidian vault as part of the same setup. Run `graphmory detect --vault "<vault-path>" --json` and follow the [vault layout guide](vault-setup.md) and [agent-guided questions](../../adapters/generic-agent/INSTALL.md). Local-only memory needs no GitHub repo. For an established vault, keep its folders unless the user approves a reviewed adoption or restructure plan. `node scripts/init-project.mjs --vault "<vault-path>" --project "<project-name>"` creates the fuller optional project template; the minimal layout needs only the project folder and notes that are useful now. Pass the chosen `--vault` path to the main agent; the curator must receive it with each delegated task. The agent installer never edits the vault.

### Manual skill copy

Copy the entire `skills/graphmory-curator` directory, including `references/` and `agents/`. Choose a project path for one workspace or a user path for all local workspaces:

| Host | Project skill directory | User skill directory |
| --- | --- | --- |
| Codex | `<project>/.agents/skills/graphmory-curator/` | `~/.agents/skills/graphmory-curator/` |
| Cursor | `<project>/.cursor/skills/graphmory-curator/` | `~/.cursor/skills/graphmory-curator/` |
| Claude Code | `<project>/.claude/skills/graphmory-curator/` | `~/.claude/skills/graphmory-curator/` |

For example, from this repository checkout:

```sh
mkdir -p "<project>/.agents/skills"
cp -R skills/graphmory-curator "<project>/.agents/skills/"
```

Substitute the Cursor or Claude Code project directory from the table when appropriate. Restart or reload the agent session after copying. In curator mode, confirm the agent can discover `graphmory-curator` before configuring a sub-agent. The default workflow needs no Jev account or additional model API key. Jev/local decision modes remain optional advanced setups.

The host locations follow [Codex's repository skill convention](https://developers.openai.com/blog/skills-agents-sdk), [Cursor's skill directories](https://prod.cursor.com/help/customization/skills), and [Claude Code's directory reference](https://code.claude.com/docs/en/claude-directory). Cursor also discovers `.agents/skills/`, but use its native `.cursor/skills/` path when testing Cursor by itself. Keep only one installed copy per host scope to avoid duplicate discovery.

## 3. Recall memory

The default workflow is already `curator`. Use the terminal menu only to change retrieval settings or opt into an advanced model workflow:

```sh
graphmory config
```

Then give the agent the vault path and this noninteractive call:

```sh
graphmory recall-managed --vault "<vault-path>" --query "<question>" --agent
```

The result is one compact JSON line. The agent should open only relevant returned Markdown notes before answering, preserve provenance, and abstain when evidence is insufficient. Use `--scope` when the project or domain folder is known. See [managed retrieval](managed-retrieval.md) for the curator, hosted Jev, and local decision workflows. Hosted Jev needs explicit consent to send candidate excerpts; local decision needs a compatible server.

## 4. Give the main agent a curator instruction

Add this instruction to your host's main-agent guidance, then reload the host:

> After completing and verifying a task, if durable knowledge should be saved, author a Memory Patch with evidence IDs and delegate its placement, duplicate/conflict check, and validation to the named Graphmory curator agent. The main agent owns the claim. The curator returns `APPLIED`, `TENSION`, or `BLOCKED` with affected note paths. Ask the same curator for a compact Brain Brief when prior memory is needed. Do not spawn an unconfigured generic memory agent.

Verify that the host actually starts a child named `graphmory_curator`/`graphmory-curator` and that it reads the installed skill; an agent file on disk or the main agent's claim that it delegated is not dispatch evidence. If the host does not expose named-agent dispatch, report that separately and use the skill directly only as a clearly labeled fallback. Pinning Luna, Haiku, or another model is a host setting; Graphmory's `curator.model` is routing metadata and does not override the host's model. OpenCode requires its own adapter configuration.

For Codex CLI 0.146.0's V2 spawn schema, select `agent_type="graphmory_curator"` and `fork_turns="none"`, then send the task, vault path and patch/source paths explicitly. Omitting `fork_turns` uses full-history inheritance, which rejects an explicit named role; that fork inherits the parent's configuration instead of the configured cheap Curator. Do not pass the obsolete `fork_context` field to this V2 schema. Inspect the tool schema exposed by the user's host before selecting parameters; other versions can differ. See the [source-pinned dispatch diagnostic](../research/native-curator-dispatch-diagnostic-2026-09-29.md). A setup file alone does not prove native dispatch works.

### Optional lifecycle reminder hooks

Keep the short main-agent instruction above and the curator's skill/agent definition as the source of the workflow. A hook can restore a **brief reminder** when a session starts or its context is compacted; it should not run retrieval on every prompt or spawn a curator on every task. This avoids unrelated vault reads and repeated prompt tokens. For a local Codex installation, consider a `SessionStart` hook matching `startup|resume|compact` that emits one short instruction pointing to the named curator and vault configuration. Claude Code supports `SessionStart` hooks; Cursor supports `sessionStart` and `preCompact`, but their hook files and output schemas differ. Have the user's agent install a host-specific hook only after previewing its script and configuration. Hooks are optional because some hosts and remote sessions cannot run local scripts, and Codex asks users to review and trust new hooks. Keep the skill and lead instruction so Graphmory works without a hook. See the official [Codex](https://learn.chatgpt.com/docs/hooks), [Claude Code](https://code.claude.com/docs/en/hooks-guide), and [Cursor](https://cursor.com/docs/hooks) documentation.

For a Memory Patch, the main agent supplies the claim, scope, and source IDs. The curator searches only likely destinations and checks current note contents before applying an edit. This second search is for placement and conflict detection, so it can reuse candidate paths found earlier but must not trust stale excerpts. Keep the curator's stable instructions ahead of the changing patch and excerpts to preserve any prompt caching the host/provider offers; compare reported cache usage and actual cost before claiming savings.

The default trial Curator prepares a private checkpoint, applies a supported patch through the host's normal file-editing tools, then requires full persistence and verified completion. Follow the [local trial workflow](trial-mvp.md); interrupted work remains discoverable and blocks agent-facing content routes. After BLOCKED, native filesystem tools are not sandboxed by the CLI: the main agent and Curator must not use them or another route to assemble an authoritative answer. Keep one state root across sessions. The exact-operation recovery read is for repair only and is tagged recovery-only. Do not call `curate-plan` in this workflow; it only produces advice for hosted Jev/local decision workflows and never writes notes. Use the [end-to-end smoke guide](curator-workflow-smoke.md) to verify actual native dispatch, bounded multi-hop recall, patch application, and lifecycle checks in a disposable vault.

## 5. Smoke check

Use the [end-to-end smoke guide](curator-workflow-smoke.md) to exercise the real install and write workflow safely. For a quick read-only check, use a disposable Markdown vault:

```sh
graphmory doctor --vault "<vault-path>" --json
graphmory recall-managed --vault "<vault-path>" --query "<known-memory-question>" --agent
```

Confirm the host invokes the CLI, receives the compact response, and reads only the returned notes it needs. Do not treat an empty result as permission to broaden into the full vault. Treat CLI installation, skill discovery, and native named-agent dispatch as separate checks.
