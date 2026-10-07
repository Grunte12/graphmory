# Generic Agent Install Guide

Use this guide when an AI coding agent is asked to install or connect Graphmory for a user.

## Agent-Guided Setup

You are the installer on the user's machine. This Markdown guide is the source of truth; `graphmory-setup` is an optional file-writing helper for known hosts, not the universal installation interface. Use the host's native multiple-choice question UI when available. If it is unavailable, ask one concise numbered-choice question in chat at a time. Never block setup merely because the host lacks a named question tool.

These UIs have different names and availability: Claude Code documents `AskUserQuestion`, Cursor's ACP documents `cursor/ask_question`, and Codex may expose a user-input tool in the current client. Use the tool actually available in the session; do not call a guessed name. [Claude reference](https://code.claude.com/docs/en/agent-sdk/permissions) · [Cursor reference](https://cursor.com/docs/cli/acp)

Inspect the host, OS, available models, existing agent files, and candidate vault paths before asking. Ask only for decisions you cannot reliably infer. Keep answers in the conversation until the requirements below are complete; do not write a config containing guessed answers.

1. **Scope:** If not stated, ask `Install Graphmory for all projects or this project only?` Choices: `All projects` / `This project`.
2. **Vault location and layout:** Ask for the intended Markdown/Obsidian vault path if unknown, then run `detect`. If it contains notes, ask `Keep this vault's layout` / `Use a dedicated Graphmory folder inside it` / `Choose another vault`. If it is missing or empty, ask `Create a dedicated vault here` / `Choose another location`. Resolve the Graphmory `--vault` path from that choice; for a dedicated folder, point `--vault` at that folder. Ask for an initial project name only if creating a project area. Do not move or adopt existing notes on this answer alone. Follow [vault architecture](../../docs/guides/vault-setup.md) and show a small path tree before writing.
3. **Sync:** Ask `Local only` / `Sync through a private GitHub memory repo` only if the user has not expressed a preference. Local use needs no GitHub repo. For sync, collect the exact `OWNER/REPO` and ask before creating a remote.
4. **Curator model:** Set up the Curator only for the host you are running in; another host's agent sets up its own. Run `graphmory-setup --host <your host> --choices` for the models that host reports (Codex reads its model cache, Cursor runs `cursor-agent models`, Claude Code offers its model aliases). Follow the `guidance` in that output: suggest 2-4 models with the newest fast, low-cost tier first, and ask in the host's question UI with a free-text answer. The user decides; never pick for them. If the host cannot enumerate models, offer `Try the recommended inexpensive model` / `Choose another model`; verify the selected model in that host before calling setup complete. Never silently inherit the main agent's expensive model or require a nontechnical user to know a model ID.
5. **Existing host configuration:** If a skill or agent with the same name exists, show the affected path and ask whether to `Keep existing` or `Review a proposed update`. Do not overwrite it.

The user's install request plus these answers authorize ordinary, reversible setup files. Summarize the exact paths, selected model, and vault before writing; a second generic confirmation is unnecessary. Ask separately before existing-vault adoption, restructuring, remote creation, or other decisions listed under Human Judgment Gates in `AGENTS.md`.

Install the CLI with npm from this checkout, then use the host's current documented agent and skill format. For Codex, Claude Code, and Cursor, `graphmory-setup --host <host>` can preview known paths and `--apply` can write them when its output matches the detected host. If it does not match, create the host files from the same curator role and skill using the host's current documentation. Do not use an unverified model ID or claim the helper supports an unfamiliar host. See `docs/guides/agent-hosts.md` for current examples.

Ask `Download the local meaning model now (about 130 MB, once)?` Choices: `Yes, download` / `Later`. On yes, run `graphmory semantic-warmup`; on later, say that meaning search downloads on the first recall and keyword search works meanwhile. A legacy config without `retrievalMode` stays keyword-only: offer `graphmory config` and switch to `hybrid` only if the user chooses it. After installation, run `graphmory doctor` (add `--vault "<vault>"` and `--json` as needed). The first lines should read `vault ok`, `curator model ok (<model>)` and `mcp tools: recall · read · remember · status · sync`; relay any `needs attention` line and its fix instead of calling setup complete. Verify the skill and named curator appear in the host if the host exposes that check; then ask the main agent to delegate one read-only recall against a disposable or known vault. Report `CLI installed`, `skill discovered`, and `curator dispatched` separately. If a host cannot verify discovery or dispatch, report that limit instead of claiming the setup is complete.

## Minimum Safe Flow

1. Verify this repository:

   ```sh
   npm test
   ```

2. Use the vault path chosen during the setup interview. If it is still unknown, ask for it. Ask for a GitHub brain repo in `OWNER/REPO` format only when sync is requested. Do not guess silently.

   Diagnose the machine first:

   ```sh
   node scripts/brain-sync.mjs doctor --vault "<vault-path>" --json
   ```

   Use `--require-github` only when GitHub sync is requested. Follow `docs/guides/troubleshooting.md` if a required check fails.
   For an undocumented or partially applied failure, follow its `Unknown Failure Protocol`; do not invent a recovery command.

3. Detect the vault:

   ```sh
   node scripts/brain-sync.mjs detect --vault "<vault-path>" --json
   ```

4. If the result is `missing` or `empty-directory`, use the reviewed layout from [vault architecture](../../docs/guides/vault-setup.md). For local-only use, create the chosen vault directory and minimal project folders; do not run `bootstrap` or create a remote. If private GitHub sync was chosen and remote creation was authorized, bootstrap:

   ```sh
   node scripts/brain-sync.mjs bootstrap --vault "<vault-path>" --repo "<owner/repo>" --create-remote
   ```

5. If the result is `existing-obsidian-vault`, `custom-markdown-memory`, `generic-git-repo`, or `non-empty-directory`, keep existing notes in place. For an as-is vault, map its current project folders to retrieval scopes. For a dedicated subfolder, create only that new folder and its reviewed minimal layout. If the user wants to adopt the existing vault into private Git sync or restructure it, generate an adoption plan outside the vault first:

   ```sh
   node scripts/brain-sync.mjs adoption-plan --vault "<vault-path>" --out "<outside-path>/adoption-plan.md"
   ```

   Show the plan path and ask the user before running the following command for private Git sync. Do not run it for local-only use:

   ```sh
   node scripts/brain-sync.mjs bootstrap --vault "<vault-path>" --repo "<owner/repo>" --adopt-existing
   ```

   If the user wants structural migration, generate a machine-readable plan outside the vault:

   ```sh
   node scripts/brain-sync.mjs restructure-plan --vault "<vault-path>" --out "<outside-path>/restructure-plan.json"
   ```

   Read affected notes, set exact targets, and show the proposed batch to the user. Generated entries are unapproved. After explicit approval, mark only accepted entries `approved: true`, run `restructure-apply --dry-run`, then `restructure-apply --approve`. Run `restructure-verify` on the emitted record and repair links before committing.

6. Install the CLI and named Graphmory Curator agent for the chosen host. On a supported host, the helper may preview the files before applying:

   ```sh
   npm install -g .
   graphmory-setup --host codex --choices
   graphmory-setup --host codex --model <chosen model> --apply
   ```

   Pass the model the user chose with `--model <id>` (and `--effort <level>` for Codex). Use `claude` or `cursor` in place of `codex` where appropriate. If an older Curator is installed (doctor shows `curator: update available`), run the same command with `--apply --update`: it keeps the chosen model and effort and backs up the old files. For OpenCode use `node scripts/install.mjs --target "<agent-config-root>"` and its adapter. See `docs/guides/agent-hosts.md`.

7. Connect the MCP server. Register `graphmory-mcp` in the host's MCP configuration with `GRAPHMORY_VAULT` set to the chosen vault path, using the snippet for the user's host in [MCP host configuration](../../docs/guides/mcp-hosts.md). Run `graphmory doctor` to confirm the server starts (`mcp tools: recall · read · remember · status · sync`), then restart the host and confirm the agent lists the Graphmory `recall`, `read`, `remember`, `status` and `sync` tools, or ask it to run one `recall`. The tools are `recall`, `read`, `remember`, `status` and `sync`; the CLI remains available when a host cannot run an MCP server.

8. Add this boundary to the user's main agent instructions:

   ```text
   The main agent authors Memory Patches after verified work.
   When durable memory is warranted, dispatch the named Graphmory curator agent to retrieve, link, deduplicate, and validate the main-agent-authored patch without inventing facts. If the host cannot dispatch, run the skill in the main agent.
   Use Brain Briefs for bounded recall. Do not save secrets, raw logs, or full transcripts.
   ```

   The host agent definition pins the curator model. Graphmory's saved model name alone does not pin a host sub-agent.

## Do Not

- Do not restructure an existing memory vault without an adoption plan and user approval.
- Do not treat filename-based destination suggestions as semantic truth.
- Do not push memory to a public repo unless the user explicitly requests it.
- Do not call every note a Memory Patch. Save only durable lessons that affect future work.
- Do not let a weaker memory agent invent missing rationale.
- Do not repair setup by deleting data, resetting Git, using administrator/root by default, or silently installing system software.

## Verify

```sh
npm run check
node scripts/brain-sync.mjs audit --vault "<vault-path>" --json
node scripts/brain-sync.mjs graph-audit --vault "<vault-path>" --json
```

Run `status --vault "<vault-path>"` only if private Git sync was configured. Audit findings are review items; an empty new vault cannot demonstrate recall quality. Verify one bounded recall after real notes exist.

Report what changed and what remains manual for the user's agent harness.

## Shared Brain Hook

For Hermes, OpenCode, or another agent sharing one private brain repo, give each runtime a separate local clone. Add an event-driven instruction to its main-agent/session-start surface:

```text
At session start and before shared-memory recall, call the Graphmory MCP tool `sync` with action "pull". Do not loop retries or auto-merge. Push in batches with `sync` action "push"; the owner approves each push in the host's question UI. If `diverged` or `REMOTE_CHANGED` appears, preserve local work and tell the user; they review it with `graphmory conflict-assist` in a terminal.
Call `status` before relying on old time-sensitive memory, after vendor/API/policy changes, and during periodic brain hygiene. Its lifecycle findings are review items, not permission to rewrite memory automatically.
Recall goes through the Curator and the MCP `recall` and `read` tools. Never run the `graphmory` command or read the vault with file tools instead.
```

Do not push every remembered item. Ask the main agent to batch pushes until a healthy threshold is reached: session end, account/machine/runtime handoff, 3-7 small verified patches, one high-value/risky patch, or before restructure/conflict work. Raw inbox notes, partial drafts, and unresolved `TENSION`/`BLOCKED` memory should stay local until curated.

Do not point independent writers at the same working directory unless the host harness guarantees a single writer. Separate clones plus the shared private remote are safer.
