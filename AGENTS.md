# Graphmory Agent Instructions

Use this file when a user gives this repository to an AI coding agent and asks it to install, connect, or use Graphmory.

## Goal

Graphmory adds a durable Markdown memory layer for coding agents. The tool repo is not the memory repo. A user's brain repo or Obsidian vault stores the memory.

## First Actions

1. Run `npm test` to verify the repo works.
2. Read `docs/guides/install.md` for full installation steps.
3. Follow the [agent-guided setup](adapters/generic-agent/INSTALL.md#agent-guided-setup): inspect the host and machine, ask the user for missing choices, and keep those answers in the conversation. For Codex, Cursor, or Claude Code, the optional helper can preview and write the named curator agent after the host format and model are confirmed:
   ```sh
   npm install -g .
   graphmory-setup --host codex --choices
   graphmory-setup --host codex --model <chosen model> --apply
   ```
   Set up only the host you are running in. `--choices` lists the models that host reports; suggest 2-4 by the guidance in that output and let the user pick. Replace `codex` with `claude` or `cursor` for that host. Setup never picks the model. If the helper does not fit the host, follow its current agent/skill documentation and create the files manually. For OpenCode, run `node scripts/install.mjs --target "<agent-config-root>"` and follow `docs/guides/install.md#opencode-adapter`. Do not overwrite an existing host agent or skill.
   Choose the Obsidian/Markdown [vault layout](docs/guides/vault-setup.md) in the same interview; show the resolved `--vault` path and minimal path tree before creating files. Local-only memory does not need GitHub sync.
4. Verify the selected CLI works after installation:
   ```sh
   graphmory doctor --json
   # OpenCode's copied launcher: node <target>/bin/graphmory.mjs doctor --json
   ```
5. Apply the adapter for your runtime. For OpenCode, review and apply the files under `adapters/opencode/`:
   - Merge `AGENTS.snippet.md` into the main agent instructions.
   - In curator mode, use `graphmory-curator-prompt.md` as the `graphmory_curator` sub-agent prompt and `opencode.agent.example.json` as its configuration template.
   - In Jev/local decision modes, route managed recall directly to the main agent.
   See `docs/guides/install.md#opencode-adapter` for detailed instructions.
   For Codex, Cursor, or Claude Code, follow `docs/guides/agent-hosts.md` to select a vault and add the short main-agent instruction.
6. If the user wants portable memory across machines/accounts, read `docs/guides/portable-brain-sync.md`.
7. If setup or a command fails, run `doctor --json` and follow `docs/guides/troubleshooting.md`.
8. Do not edit the user's agent config until you know which adapter they use.

## Contributing Guidance

- Public tests, fixtures, examples, and documentation must remain synthetic and generic.

## Safe Setup Flow

Use deterministic commands. Do not guess paths or GitHub repositories.

```sh
node scripts/brain-sync.mjs doctor --vault "<vault-path>" --json
```

```sh
node scripts/brain-sync.mjs detect --vault "<vault-path>" --json
```

If the vault is missing or empty and the user chose local-only memory, create the reviewed minimal folders described in `docs/guides/vault-setup.md`. If private GitHub sync and remote creation were chosen, you may run:

```sh
node scripts/brain-sync.mjs bootstrap --vault "<vault-path>" --repo "<owner/repo>" --create-remote
```

If the vault already contains Markdown, Obsidian data, or another memory system, preserve its layout. If the user wants private Git sync adoption or structural migration, prepare a plan outside the vault:

```sh
node scripts/brain-sync.mjs adoption-plan --vault "<vault-path>" --out "<path-outside-vault>/adoption-plan.md"
```

Only after user approval for private Git sync:

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

## MCP Tools

Graphmory ships `graphmory-mcp`, a Model Context Protocol server. Set `GRAPHMORY_VAULT` to the vault path and register the server in the host as described in `docs/guides/mcp-hosts.md`. It exposes five tools:

- `recall(query, scope?, cursor?)` returns a ranked, paged shortlist with path, heading, excerpt and note hash.
- `read(path, section?, hash?)` returns the original note or one section; a stale hash is refused.
- `remember(claim, scope, evidence, curation?)` is a guarded write that returns `APPLIED`, `TENSION` or `BLOCKED`.
- `status(ask?)` reports pending work, the owner review queue, lifecycle and health, and Git sync state. `ask: "reviews"` or `ask: "recovery"` puts the owner's decision to them through MCP elicitation.
- `sync(action, message?)` pulls (fast-forward only) or pushes the vault's Git remote; a push needs the owner's approval through MCP elicitation.

Read the MCP resources `graphmory://guide/recall` and `graphmory://guide/remember` before citing or writing. Use the CLI only when the host cannot run an MCP server. See `docs/guides/mcp-recall.md`, `docs/guides/mcp-remember.md`, `docs/guides/mcp-status.md` and `docs/guides/mcp-sync.md`.

## Memory Roles

- Write new canonical memory in concise English; the main agent answers the user in their chosen language. Preserve exact identifiers and provenance, and do not create translated duplicate notes. See `docs/guides/token-efficient-language.md`.

- Main agent: decides what was learned and writes the Memory Patch.
- In curator mode, Graphmory Curator retrieves, places, links, deduplicates, and validates memory without inventing missing facts.
- In hosted Jev and local decision modes, the selected decision engine judges bounded retrieval candidates directly. In local rerank mode, a local model only reorders candidates and the main agent checks whether the evidence answers the query. The main agent remains responsible for prose and Memory Patch authorship; no curator sub-agent is dispatched for these recall modes.
- Markdown/Obsidian vault: canonical operational memory.
- GitHub brain repo: optional private sync target for portable memory.

## Using The Graphmory Curator Skill

Graphmory ships an installable `graphmory-curator` skill at `skills/graphmory-curator/SKILL.md`. After the installer copies it to your target directory, load or reference it in your agent runtime:

- **OpenCode**: the runtime's skill system automatically discovers skills under `<target>/skills/`. Load the skill when memory recall or consolidation is needed.
- **Other runtimes**: read `skills/graphmory-curator/SKILL.md` and embed it as a role/function definition.

The installer (`node scripts/install.mjs --target <dir>`) copies these components to the target directory:

| Component | Destination | Purpose |
|-----------|-------------|---------|
| `skills/graphmory-curator/` | `<target>/skills/graphmory-curator/` | Agent skill with protocol, schema, and authority rules |
| `src/` | `<target>/src/` | Reusable runtime modules (recall, sync, lifecycle, contracts, etc.) |
| `bin/graphmory.mjs` | `<target>/bin/graphmory.mjs` | Owner CLI: `doctor`, `health`, `review`, `push`, etc. |
| `bin/brain-sync.mjs` | `<target>/bin/brain-sync.mjs` | Full CLI that `graphmory.mjs` loads; developer and evaluation commands |

Adapters (under `adapters/`) configure the runtime — they do not overwrite agent config, merge prompts, or install system packages. Choose the adapter for your platform and apply the files as documented.

## Tool-Assisted Memory Work

Agents use the MCP tools only. The `graphmory` command is the owner's CLI for setup, health, review and sync; agents do not run it, and they never read the vault with file tools to work around a tool result.

- **What needs attention.** Call `status` at session start and after conflict resolution or a large intake. It reports an interrupted write, memory waiting for the owner, lifecycle findings (revalidation due, replacement markers, tension without a decision path, raw memory outside Inbox) and vault health (unresolved links, duplicate titles, orphans, missing provenance, secrets). Relay its `next` steps; treat critical health findings as blockers before a push. The owner's terminal equivalents are `graphmory health --vault <path>` and `graphmory lifecycle-audit --vault <path>`. Do not ask the Curator to rediscover these checks by hand.
- **Recall.** Ask the Curator for a Brain Brief. It calls `recall` with a specific query and a `scope` when the project or domain is known, `read`s each relevant candidate by path and hash, and pages under the stop rule in the skill. Default recall leaves out raw inbox/clipping notes and stale or superseded notes. If candidates miss the answer, reformulate with project vocabulary or follow the named MOC neighborhood; do not scan the whole vault. Do not infer facts from graph connectivity alone. Optional relation properties and folder guidance are in `docs/guides/knowledge-graph.md`.
- **Retrieval mode.** The server runs keyword, local semantic and authored-link search together. If the local meaning backend is missing, recall returns `BLOCKED` instead of silently downgrading; the owner runs `graphmory doctor` and `graphmory semantic-warmup`. The MCP server requires the curator workflow; hosted Jev, local decision and local rerank modes are evaluation workflows run from a checkout (`node scripts/brain-sync.mjs`, see `docs/guides/cli-reference.md`).
- **Summaries.** The first recall page lists summaries whose sources changed (`recheck`); they are left out of ranking. Freshness proves source identity, not semantic support. Refresh a summary from reviewed sources through a normal `remember`.
- **Writes and owner decisions.** `remember` files a main-agent-authored Memory Patch. Low-confidence memory, recovery of an interrupted write and every push are decided by the owner in the host's question UI (`status` with `ask`, `sync` with `action: "push"`).

Apply clearly reversible curator improvements such as non-sensitive aliases, frontmatter hints or MOC links when the evidence is explicit and the target note is unambiguous. Ask before meaning-changing rewrites, note moves, deletions or conflict resolution.

## Human Judgment Gates

Graphmory keeps humans in control of durable memory without forcing humans into every loop. Default to autonomous loop engineering for reversible, evidence-backed work:

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

When multiple agents use the same private brain repo, each runtime should use its own local clone. At session start and before a Brain Brief that depends on current shared state, the main agent calls the MCP tool `sync` with `action: "pull"`, and publishes with `action: "push"`, which the owner approves in the host's question UI (`docs/guides/mcp-sync.md`). The owner's terminal equivalent is:

```sh
node <graphmory-path>/scripts/brain-sync.mjs auto-pull --vault "<vault-path>" --json
```

Treat `up-to-date`, `updated`, and `local-ahead` as safe local states. For `skipped-dirty`, `offline-or-auth-failed`, `blocked-restructure`, or `diverged`, do not retry in a loop or merge automatically. Continue local-only only when stale shared context is acceptable; otherwise stop and resolve the named state. After verified durable Memory Patches are curated, push (see the batch rules below). `REMOTE_CHANGED` means another agent updated memory; preserve the local commit/changes and review both histories.

When histories diverge or `push` reports `REMOTE_CHANGED`, use conflict assist before proposing a resolution:

```bash
node <graphmory-path>/scripts/brain-sync.mjs conflict-assist --vault "<vault-path>" --json
```

Conflict assist is read-only. It fetches remote state, compares local/remote/dirty memory, names same-note semantic conflicts, and returns a decision report with structured `decisionOptions`. It must not merge, rebase, reset, discard, or rewrite notes. Ask the user to choose the memory lifecycle decision when both sides changed the same meaning: merge compatible facts, prefer one side, supersede stale memory, create TENSION, or leave BLOCKED pending evidence.

Do not run a polling daemon by default. Event-driven pulls avoid unnecessary network/RAM use and reduce concurrent Git operations.

Do not push after every remembered item. Batch memory sync when it keeps the brain healthier than immediate pushing:

- Push at session end after verified durable Memory Patches.
- Push before switching accounts, machines, or agent runtimes.

- Push after 3-7 small APPLIED patches or one high-value/risky patch.
- Push before any restructure, conflict resolution, or long multi-session handoff.

Check `status` (`sync.plan`) before deciding whether to hold, pull first, request conflict review, or push. The plan is advisory and is never push approval.
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

If a failure is not covered by a known error code, follow the `Unknown Failure Protocol` in `docs/guides/troubleshooting.md`. Freeze writes, preserve sanitized operational evidence, protect the only copy of the vault, classify Git/migration state, and prefer reversible recovery. If state is contradictory, stop and return the Safe Escalation Report instead of guessing.

## Verification

Before reporting done:

```sh
npm run check
node scripts/brain-sync.mjs status --vault "<vault-path>"
```

For repository changes, report modified files and tests run. Do not commit or push unless the user explicitly approves.
