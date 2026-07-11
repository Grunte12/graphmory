# Memory Patch Harness Agent Instructions

Use this file when a user gives this repository to an AI coding agent and asks it to install, connect, or use the harness.

## Cross-Agent Coordination

- `AGENTS.md` is the single repository-wide instruction source for Codex,
  OpenCode, and other compatible coding agents.
- Claude Code loads the same instructions through the root `CLAUDE.md`, which
  imports this file. Keep `CLAUDE.md` as a thin compatibility file; do not
  duplicate rules there.
- Before continuing substantial or handed-off work, read the root `HANDOFF.md`
  when it exists. Treat it as current working context and verify its claims
  against the repository before making changes.
- Store detailed implementation plans under `docs/plans/`. Keep active status
  and immediate next actions in `HANDOFF.md`.
- Do not create nested agent-output or result directories for project
  coordination. Summarize useful outcomes in `HANDOFF.md`, an appropriate plan,
  or normal project documentation.
- Runtime-specific directories are adapters only. Project state belongs in the
  repository workspace, not in a Claude, Codex, or OpenCode configuration home.

## Goal

Memory Patch Harness adds a durable Markdown memory layer for coding agents. The tool repo is not the memory repo. A user's brain repo or Obsidian vault stores the memory.

## First Actions

1. Run `npm test` to verify the repo works.
2. Read `docs/install.md` for full installation steps.
3. Run the installer to copy the skill, CLI, and source modules:
   ```sh
   node scripts/install.mjs --target "<agent-config-root>" --vault "<brain-path>"
   ```
   Replace `<agent-config-root>` with the target configuration directory (e.g. `~/.config/opencode` for OpenCode). The installer copies `skills/memory-curator/`, `src/` modules, `bin/memory-patch-harness.mjs`, and one bounded global OpenCode Markdown agent. It does **not** edit `opencode.json`.
4. Verify the CLI works after installation:
   ```sh
   node <target>/bin/memory-patch-harness.mjs doctor --json
   # or, after adding <target>/bin/ to your PATH:
   memory-patch-harness.mjs doctor --json
   ```
5. Apply the adapter for your runtime. For OpenCode, review the files under `adapters/opencode/`:
   - Merge `AGENTS.snippet.md` into the lead agent instructions.
   - Review the installer-rendered `agents/memory_curator.md`.
   - Treat `opencode.agent.example.json` as a legacy JSON example only.
   See `docs/install.md#opencode-adapter` for detailed instructions.
6. If the user wants portable memory across machines/accounts, read `docs/portable-brain-sync.md`.
7. If setup or a command fails, run `doctor --json` and follow `docs/troubleshooting.md`.
8. Do not edit the user's agent config until you know which adapter they use.

## Local Development Handoff

- If `docs/development-handoff-obsidian-database.md` exists, read it before continuing local resolver, schema-audit, or real-vault validation work.
- The handoff may contain private local paths and unreleased observations. Do not stage, commit, push, publish, or sync it without explicit user approval.
- Public tests, fixtures, examples, and documentation must remain synthetic and generic.

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

### Curator Intake Sweep

Before every recall and before/after a consolidation attempt, the Memory Curator
runs the read-only bounded command below for the active scope:

```sh
node <harness-path>/scripts/brain-sync.mjs intake-sweep --vault "<vault-path>" --scope "<known-project-or-domain>" --limit 5 --json
```

It returns only an `intake_status` queue: counts, at most five metadata-only
Inbox/Clippings candidates, secret-scan state, and a recommended route. A
nonempty queue is untrusted evidence, not canonical memory and not permission
to broaden raw recall. The curator may name at most three task-relevant paths
as provisional evidence. Only a complete lead-authored Memory Patch or Learning
Packet may promote verified meaning into canonical Markdown. Never auto-move,
link, delete, promote, or mark raw evidence triaged.

Run health/lifecycle after a meaningful intake or patch batch, not every recall.

## Using The Memory Curator Skill

The harness ships an installable `memory-curator` skill at `skills/memory-curator/SKILL.md`. After the installer copies it to your target directory, load or reference it in your agent runtime:

- **OpenCode**: the runtime's skill system automatically discovers skills under `<target>/skills/`. Load the skill when memory recall or consolidation is needed.
- **Other runtimes**: read `skills/memory-curator/SKILL.md` and embed it as a role/function definition.

The installer (`node scripts/install.mjs --target <dir> --vault <vault>`) copies four components to the target directory:

| Component | Destination | Purpose |
|-----------|-------------|---------|
| `skills/memory-curator/` | `<target>/skills/memory-curator/` | Agent skill with protocol, schema, and authority rules |
| `src/` | `<target>/src/` | Reusable runtime modules (recall, sync, lifecycle, contracts, etc.) |
| `bin/memory-patch-harness.mjs` | `<target>/bin/memory-patch-harness.mjs` | CLI entry point for `doctor`, `recall`, `health`, `push`, etc. |
| `agents/memory_curator.md` | `<target>/agents/memory_curator.md` | Discoverable OpenCode wildcard curator with bounded permissions |

Adapters (under `adapters/`) configure the runtime — they do not overwrite agent config, merge prompts, or install system packages. Choose the adapter for your platform and apply the files as documented.

## Tool-Assisted Memory Work

Use deterministic tools for mechanical checks so the LLM spends judgment on meaning:

```sh
node <harness-path>/scripts/brain-sync.mjs health --vault "<vault-path>" --json
```

Run `health` after conflict resolution, restructure, large intake triage, and before a sync push that publishes durable memory. It checks unresolved links, duplicate titles, orphan notes, missing provenance/lifecycle markers, stale memory without revalidation, inbox backlog, raw captures outside Inbox, and secret-like values. Treat critical findings as blockers before push. Do not ask the Memory Curator to manually rediscover these checks from scratch.

When memory may be time-sensitive or recently changed, run the lifecycle audit before relying on it:

```sh
node <harness-path>/scripts/brain-sync.mjs lifecycle-audit --vault "<vault-path>" --json
```

Use it after vendor/API/policy changes, before resurrecting old operational notes, during periodic hygiene, and after conflict resolution. It is read-only and returns review actions such as revalidate, add replacement marker, split/mark tension, add a decision path, or triage raw memory. It must not delete, supersede, or rewrite notes automatically.

For recall, start with the bounded machine-readable path selector instead of broad vault reads:

```sh
node <harness-path>/scripts/brain-sync.mjs recall --vault "<vault-path>" --query "<task-specific memory question>" --json
```

Add `--scope "<known project-or-domain path>"` when the active project/domain is known. Read only the returned paths. Raw inbox/clipping paths and stale/superseded lifecycle states are excluded by default. If `needsExpansion` is true, reformulate once using project vocabulary or inspect the named MOC/backlink neighborhood; do not immediately scan the whole vault.

If bounded recall misses repeatedly, use the diagnostic sparse-fusion loop once before broad manual vault search:

```sh
node <harness-path>/scripts/brain-sync.mjs recall-loop --vault "<vault-path>" --query "<task-specific memory question>" --scope "<known project-or-domain path>" --json
```

Treat `recall-loop` as a fallback, not the default. If eval misses persist, generate a curation recommendation report instead of guessing:

```sh
node <harness-path>/scripts/brain-sync.mjs curation-recommend --report "<eval-report.json>" --queries "<query-set.json>" --method governed-bm25f-sections --json
```

Use the report to classify whether the miss is buried gold, missing scope, no candidates, or vocabulary/gold ambiguity. Apply clearly reversible curator improvements such as adding non-sensitive aliases, frontmatter hints, or MOC links when the evidence is explicit and the target note is unambiguous. Ask before meaning-changing rewrites, grouped-gold changes, note moves, deletions, or conflict resolution.

If frozen evals still show paraphrase or vocabulary misses after scope and curation review, use optional semantic recall as an escalation lane:

```sh
npm install @huggingface/transformers
node <harness-path>/scripts/brain-sync.mjs recall-semantic --vault "<vault-path>" --query "<task-specific memory question>" --scope "<known project-or-domain path>" --json
```

Semantic recall is not the default install path. Do not install optional dependencies in a shared/public project without user approval, do not treat generated embeddings as canonical memory, and do not skip Markdown curation just because semantic search found a match.

## Human Judgment Gates

The harness keeps humans in control of durable memory without forcing humans into every loop. Default to autonomous loop engineering for reversible, evidence-backed work:

1. detect the state with tools,
2. make the smallest safe change,
3. verify with deterministic checks,
4. repair once or twice if checks fail,
5. report the result and caveats.

Do not stop just to ask for permission on routine recall, health checks, sync-plan reports, safe fast-forwards, bounded curation recommendations, or clearly reversible metadata/link improvements. Stop only at decision gates where automation could publish, erase, expose, or change the meaning of durable memory.

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

Conflict assist is read-only. It fetches remote state, compares local/remote/dirty memory, names same-note semantic conflicts, and returns a decision report with structured `decisionOptions`. It must not merge, rebase, reset, discard, or rewrite notes. Ask the user to choose the memory lifecycle decision when both sides changed the same meaning: merge compatible facts, prefer one side, supersede stale memory, create TENSION, or leave BLOCKED pending evidence.

Do not run a polling daemon by default. Event-driven pulls avoid unnecessary network/RAM use and reduce concurrent Git operations.

Do not push after every remembered item. Batch memory sync when it keeps the brain healthier than immediate pushing:

- Push at session end after verified durable Memory Patches.
- Push before switching accounts, machines, or agent runtimes.

Use `sync-plan --json` before deciding whether to hold, pull first, request conflict review, or ask the user to approve a push. The command is advisory and must never be treated as push approval.
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
