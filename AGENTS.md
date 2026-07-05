# Memory Patch Harness Agent Instructions

Use this file when a user gives this repository to an AI coding agent and asks it to install, connect, or use the harness.

## Goal

Memory Patch Harness adds a durable Markdown memory layer for coding agents. The tool repo is not the memory repo. A user's brain repo or Obsidian vault stores the memory.

## First Actions

1. Run `npm test` to verify the repo works.
2. Read `docs/install.md` for installation steps.
3. If the user wants portable memory across machines/accounts, read `docs/portable-brain-sync.md`.
4. If setup or a command fails, run `doctor --json` and follow `docs/troubleshooting.md`.
5. Do not edit the user's agent config until you know which adapter they use.

## Safe Setup Flow

Use deterministic commands. Do not guess paths or GitHub repositories.

```sh
node scripts/brain-sync.mjs doctor --vault "<vault-path>" --json
```

```sh
node scripts/brain-sync.mjs detect --vault "<vault-path>" --json
```

If the vault is missing or empty, you may run:

```sh
node scripts/brain-sync.mjs bootstrap --vault "<vault-path>" --repo "<owner/repo>" --create-remote
```

If the vault already contains Markdown, Obsidian data, or another memory system, stop and ask the user before adoption:

```sh
node scripts/brain-sync.mjs adoption-plan --vault "<vault-path>" --out "<vault-path>/.memory-patch-harness/adoption-plan.md"
```

Only after user approval:

```sh
node scripts/brain-sync.mjs bootstrap --vault "<vault-path>" --repo "<owner/repo>" --adopt-existing
```

If the user also wants the existing memory restructured, keep the decision in the agent conversation and the mechanics in a reviewed manifest:

```sh
node scripts/brain-sync.mjs restructure-plan --vault "<vault-path>" --out "<path-outside-vault>/restructure-plan.json"
```

Inspect note meaning, choose exact targets, and show the proposed batch to the user. Every generated entry starts with `approved: false`. Set `approved: true` only for the exact entries the user accepts. Then run:

```sh
node scripts/brain-sync.mjs restructure-apply --vault "<vault-path>" --plan "<plan-path>" --dry-run
node scripts/brain-sync.mjs restructure-apply --vault "<vault-path>" --plan "<plan-path>" --approve
node scripts/brain-sync.mjs restructure-verify --vault "<vault-path>" --record "<record-path>"
```

The apply command requires a clean Git worktree and baseline commit, creates a local backup branch, limits the default batch to 20 notes, and records exact moves. Verification proves path state only. Repair and validate wikilinks/Markdown links before committing. Use `restructure-rollback --approve` if the result is wrong.

## Memory Roles

- Lead agent: decides what was learned and writes the Memory Patch.
- Memory Curator: retrieves, places, links, deduplicates, and validates memory without inventing missing facts.
- Markdown/Obsidian vault: canonical operational memory.
- GitHub brain repo: optional private sync target for portable memory.

## Tool-Assisted Memory Work

Use deterministic tools for mechanical checks so the LLM spends judgment on meaning:

```sh
node <harness-path>/scripts/brain-sync.mjs health --vault "<vault-path>" --json
```

Run `health` after conflict resolution, restructure, large intake triage, and before a sync push that publishes durable memory. It checks unresolved links, duplicate titles, orphan notes, missing provenance/lifecycle markers, stale memory without revalidation, inbox backlog, raw captures outside Inbox, and secret-like values. Treat critical findings as blockers before push. Do not ask the Memory Curator to manually rediscover these checks from scratch.

## Human Judgment Gates

The harness keeps humans in control of durable memory. Agents may automate detection, summaries, checks, and safe fast-forwards, but important memory decisions require human judgment.

Ask the user before:

- first setup chooses or creates a brain repo,
- adopting an existing Obsidian vault or custom memory repo,
- restructuring or moving existing notes,
- publishing or changing repo visibility,
- resolving memory conflicts, `diverged` histories, or `REMOTE_CHANGED`,
- discarding, superseding, or overwriting existing memory,
- storing low-confidence or sensitive operational knowledge.

If the user decision is not available, return `BLOCKED` with the smallest decision needed. Do not silently downgrade memory quality to keep automation moving.

## Shared Brain Sync

When multiple agents use the same private brain repo, each runtime should use its own local clone. At session start and before a Brain Brief that depends on current shared state, the lead agent runs:

```sh
node <harness-path>/scripts/brain-sync.mjs auto-pull --vault "<vault-path>" --json
```

Treat `up-to-date`, `updated`, and `local-ahead` as safe local states. For `skipped-dirty`, `offline-or-auth-failed`, `blocked-restructure`, or `diverged`, do not retry in a loop or merge automatically. Continue local-only only when stale shared context is acceptable; otherwise stop and resolve the named state. After a verified durable Memory Patch is curated, run `push`. `REMOTE_CHANGED` means another agent updated memory; preserve the local commit/changes and review both histories.

When histories diverge or `push` reports `REMOTE_CHANGED`, use conflict assist before proposing a resolution:

```bash
node <harness-path>/scripts/brain-sync.mjs conflict-assist --vault "<vault-path>" --json
```

Conflict assist is read-only. It fetches remote state, compares local/remote/dirty memory, names same-note semantic conflicts, and returns a decision report. It must not merge, rebase, reset, discard, or rewrite notes. Ask the user to choose the memory lifecycle decision when both sides changed the same meaning: merge both, prefer one side, supersede stale memory, create TENSION, or leave BLOCKED pending evidence.

Do not run a polling daemon by default. Event-driven pulls avoid unnecessary network/RAM use and reduce concurrent Git operations.

Do not push after every remembered item. Batch memory sync when it keeps the brain healthier than immediate pushing:

- Push at session end after verified durable Memory Patches.
- Push before switching accounts, machines, or agent runtimes.
- Push after 3-7 small APPLIED patches or one high-value/risky patch.
- Push before any restructure, conflict resolution, or long multi-session handoff.
- Do not push raw inbox/clipping noise, partial notes, unresolved conflicts, or unverified facts.
- If local commits are `local-ahead`, it is safe to keep working locally until one of the thresholds above is reached.

## Never Do

- Do not save secrets, tokens, raw private logs, credentials, or full chat transcripts.
- Do not restructure an existing memory repo without an adoption plan and user approval.
- Do not approve inferred destinations without reading the affected notes. Do not use `--allow-large-migration` unless the user explicitly approves a larger reviewed batch.
- Do not push public brain repos unless the user explicitly asks and accepts the risk.
- Do not auto-resolve Git conflicts in memory notes.
- Do not delete user data, reset Git history, elevate to administrator/root, install system software, or remove a lock without explaining the evidence and obtaining any required approval.
- Do not claim live-model superiority from deterministic evals.

## Unknown Failures

If a failure is not covered by a known error code, follow the `Unknown Failure Protocol` in `docs/troubleshooting.md`. Freeze writes, preserve sanitized operational evidence, protect the only copy of the vault, classify Git/migration state, and prefer reversible recovery. If state is contradictory, stop and return the Safe Escalation Report instead of guessing.

## Verification

Before reporting done:

```sh
npm run check
node scripts/brain-sync.mjs status --vault "<vault-path>"
```

For repository changes, report modified files and tests run. Do not commit or push unless the user explicitly approves.
