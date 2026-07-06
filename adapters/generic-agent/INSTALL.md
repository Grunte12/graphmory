# Generic Agent Install Guide

Use this guide when an AI coding agent is asked to install or connect Memory Patch Harness for a user.

## Minimum Safe Flow

1. Verify this repository:

   ```sh
   npm test
   ```

2. Ask the user for the memory vault path and optional GitHub brain repo in `OWNER/REPO` format. Do not guess silently.

   Diagnose the machine first:

   ```sh
   node scripts/brain-sync.mjs doctor --vault "<vault-path>" --json
   ```

   Use `--require-github` only when GitHub sync is requested. Follow `docs/troubleshooting.md` if a required check fails.
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

6. Install the Memory Curator skill or copy its instructions into the user's agent harness:

   ```sh
   node scripts/install.mjs --target "<agent-config-root>"
   ```

7. Add this boundary to the user's main agent instructions:

   ```text
   The lead agent authors Memory Patches after verified work.
   The memory curator retrieves, links, deduplicates, and validates memory without inventing facts.
   Use Brain Briefs for bounded recall. Do not save secrets, raw logs, or full transcripts.
   ```

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
