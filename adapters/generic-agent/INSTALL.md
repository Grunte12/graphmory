# Generic Agent Install Guide

Use this guide when an AI coding agent is asked to install or connect Graphmory for a user.

## Agent-Guided Setup

You are the installer on the user's machine. This Markdown guide is the source of truth; `graphmory-setup` is an optional file-writing helper for known hosts, not the universal installation interface. Use the host's native multiple-choice question UI when available. If it is unavailable, ask one concise numbered-choice question in chat at a time. Never block setup merely because the host lacks a named question tool.

These UIs have different names and availability: Claude Code documents `AskUserQuestion`, Cursor's ACP documents `cursor/ask_question`, and Codex may expose a user-input tool in the current client. Use the tool actually available in the session; do not call a guessed name. [Claude reference](https://code.claude.com/docs/en/agent-sdk/permissions) · [Cursor reference](https://prod.cursor.com/docs/cli/acp)

Inspect the host, OS, available models, existing agent files, and candidate vault paths before asking. Ask only for decisions you cannot reliably infer. Keep answers in the conversation until the requirements below are complete; do not write a config containing guessed answers.

1. **Scope:** If not stated, ask `Install Graphmory for all projects or this project only?` Choices: `All projects` / `This project`.
2. **Vault:** Ask for the intended Markdown/Obsidian vault path if unknown. If the detected path already has notes, ask whether to `Use as-is and make an adoption plan` or `Choose another vault`. Offer `Create a new vault` only when its location is clear. Do not restructure or adopt existing notes on this answer alone; follow the separate reviewed adoption flow below.
3. **Curator model:** Show inexpensive models actually available in the host and ask which one to assign. If the host cannot enumerate models, offer `Try the recommended inexpensive model` / `Choose another model`; verify the selected model in that host before calling setup complete. Never silently inherit an expensive lead model or require a nontechnical user to know a model ID.
4. **Existing host configuration:** If a skill or agent with the same name exists, show the affected path and ask whether to `Keep existing` or `Review a proposed update`. Do not overwrite it.

The user's install request plus these answers authorize ordinary, reversible setup files. Summarize the exact paths, selected model, and vault before writing; a second generic confirmation is unnecessary. Ask separately before existing-vault adoption, restructuring, remote creation, or other decisions listed under Human Judgment Gates in `AGENTS.md`.

Install the CLI with npm from this checkout, then use the host's current documented agent and skill format. For Codex, Claude Code, and Cursor, `graphmory-setup --host <host>` can preview known paths and `--apply` can write them when its output matches the detected host. If it does not match, create the host files from the same curator role and skill using the host's current documentation. Do not use an unverified model ID or claim the helper supports an unfamiliar host. See `docs/guides/agent-hosts.md` for current examples.

After installation, run `graphmory doctor --json`; verify the skill and named curator appear in the host if the host exposes that check; then ask the lead agent to delegate one read-only recall against a disposable or known vault. Report `CLI installed`, `skill discovered`, and `curator dispatched` separately. If a host cannot verify discovery or dispatch, report that limit instead of claiming the setup is complete.

## Minimum Safe Flow

1. Verify this repository:

   ```sh
   npm test
   ```

2. Use the vault path chosen during the setup interview. If it is still unknown, ask for it. Ask for an optional GitHub brain repo in `OWNER/REPO` format only when sync is requested. Do not guess silently.

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

4. If the result is `missing` or `empty-directory`, bootstrap:

   ```sh
   node scripts/brain-sync.mjs bootstrap --vault "<vault-path>" --repo "<owner/repo>" --create-remote
   ```

5. If the result is `existing-obsidian-vault`, `custom-markdown-memory`, `generic-git-repo`, or `non-empty-directory`, generate an adoption plan first:

   ```sh
   node scripts/brain-sync.mjs adoption-plan --vault "<vault-path>" --out "<vault-path>/.memory-patch-harness/adoption-plan.md"
   ```

   Show the plan path and ask the user before running:

   ```sh
   node scripts/brain-sync.mjs bootstrap --vault "<vault-path>" --repo "<owner/repo>" --adopt-existing
   ```

   If the user wants structural migration, generate a machine-readable plan outside the vault:

   ```sh
   node scripts/brain-sync.mjs restructure-plan --vault "<vault-path>" --out "<outside-path>/restructure-plan.json"
   ```

   Read affected notes, set exact targets, and show the proposed batch to the user. Generated entries are unapproved. After explicit approval, mark only accepted entries `approved: true`, run `restructure-apply --dry-run`, then `restructure-apply --approve`. Run `restructure-verify` on the emitted record and repair links before committing.

6. Install the CLI and named Memory Curator agent for the chosen host. On a supported host, the helper may preview the files before applying:

   ```sh
   npm install -g --omit=optional .
   graphmory-setup --host codex
   graphmory-setup --host codex --apply
   ```

   Use `claude` or `cursor` in place of `codex` where appropriate; Cursor also requires `--model <supported-cheap-model-id>`. For OpenCode use `node scripts/install.mjs --target "<agent-config-root>"` and its adapter. See `docs/guides/agent-hosts.md`.

7. Add this boundary to the user's main agent instructions:

   ```text
   The lead agent authors Memory Patches after verified work.
   When durable memory is warranted, dispatch the named Graphmory curator agent to retrieve, link, deduplicate, and validate the lead-authored patch without inventing facts. If the host cannot dispatch, run the skill in the lead agent.
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
node scripts/brain-sync.mjs status --vault "<vault-path>"
```

Report what changed and what remains manual for the user's agent harness.

## Shared Brain Hook

For Hermes, OpenCode, or another agent sharing one private brain repo, give each runtime a separate local clone. Add an event-driven instruction to its lead-agent/session-start surface:

```text
At session start and before shared-memory recall, run:
node <harness-path>/scripts/brain-sync.mjs auto-pull --vault "<this-agent-vault>" --json
Do not loop retries or auto-merge. After a verified durable Memory Patch, push once. If `diverged` or `REMOTE_CHANGED` appears, preserve local work and run:
node <harness-path>/scripts/brain-sync.mjs conflict-assist --vault "<this-agent-vault>" --json
node <harness-path>/scripts/brain-sync.mjs lifecycle-audit --vault "<this-agent-vault>" --json
node <harness-path>/scripts/brain-sync.mjs recall --vault "<this-agent-vault>" --query "<memory question>" --scope "<known project-or-domain path>" --json
node <harness-path>/scripts/brain-sync.mjs recall-loop --vault "<this-agent-vault>" --query "<memory question>" --scope "<known project-or-domain path>" --json
node <harness-path>/scripts/brain-sync.mjs sync-plan --vault "<this-agent-vault>" --json
Explain the report to the user and ask for a semantic memory decision before resolving.

Use `recall-loop` only after normal `recall` is low-confidence or misses repeatedly. For eval misses, run `brain-sync.mjs curation-recommend` to classify miss patterns and propose alias/link/scope improvements before broad manual vault search.

Use `lifecycle-audit` before relying on old time-sensitive memory, after vendor/API/policy changes, and during periodic brain hygiene. It is read-only and returns revalidation/replacement/tension actions; do not treat it as permission to rewrite memory automatically.
```

Do not push every remembered item. Ask the lead agent to batch pushes until a healthy threshold is reached: session end, account/machine/runtime handoff, 3-7 small verified patches, one high-value/risky patch, or before restructure/conflict work. Raw inbox notes, partial drafts, and unresolved `TENSION`/`BLOCKED` memory should stay local until curated.

Do not point independent writers at the same working directory unless the host harness guarantees a single writer. Separate clones plus the shared private remote are safer.
