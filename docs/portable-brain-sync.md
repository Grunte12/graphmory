# Portable Brain Sync

Portable Brain Sync is an optional Memory Patch Harness workflow for keeping the same curated Markdown memory across accounts, machines, and coding agents.

It does not replace the harness repository. It creates or connects a separate GitHub repository that stores only memory notes.

## Repository Roles

| Repository | Contains | Should be public? |
|---|---|---|
| `memory-patch-harness` | tools, schemas, evals, docs, skills | public is fine |
| personal brain repo | curated Markdown memory, inbox candidates, project notes | private by default |

The brain repo is a portable vault, not a second copy of the tool. A new desktop or account installs Memory Patch Harness, clones/pulls the same brain repo, and starts with the same durable memory.

## Why This Helps

1. Account switching: when one model/account hits a limit, another model can continue from the shared memory.
2. Machine switching: a new laptop can pull the same memory before the agent starts work.
3. Auditability: Git history shows what changed, when, and why.
4. Recovery: bad memory patches can be reverted with normal Git tools.
5. Safety: sync is gated by secret-like value scanning, dirty-worktree checks, and human judgment for important decisions.

The goal is not full automatic synchronization. The goal is controlled portability: agents can keep memory current across machines and accounts while humans still decide setup, adoption, conflict resolution, and meaning-changing memory lifecycle choices.

## Setup

Install the harness first, then initialize a brain repo.

```powershell
git clone https://github.com/Grunte12/memory-patch-harness.git
cd memory-patch-harness
npm test
```

Diagnose local requirements before setup:

```powershell
node scripts/brain-sync.mjs doctor --vault "C:\Users\you\YourBrain" --json --require-github
```

See [Troubleshooting and Agent Recovery](troubleshooting.md) when a required check fails.

Create or connect a private GitHub memory repo:

```powershell
node scripts/brain-sync.mjs bootstrap `
  --vault "C:\Users\you\YourBrain" `
  --repo "your-github-user/your-brain" `
  --create-remote
```

The command uses GitHub CLI when `--create-remote` is present. GitHub CLI documents that `gh repo create OWNER/REPO --private` creates a private repo non-interactively, and `gh repo clone OWNER/REPO <directory>` clones an existing repository. Memory Patch Harness requires explicit `OWNER/REPO` format to avoid creating or cloning the wrong repo.

## Daily Flow

### Multiple agents: Hermes + OpenCode

Use the same private GitHub brain repo but separate local clones:

```text
Private brain repo
|- Hermes local clone
`- OpenCode local clone
```

Each lead agent runs event-driven auto-pull at session start and before current shared recall:

```powershell
node scripts/brain-sync.mjs auto-pull --vault "C:\Users\you\HermesBrain" --json
node scripts/brain-sync.mjs auto-pull --vault "C:\Users\you\OpenCodeBrain" --json
```

This is intentionally not a background polling daemon. It uses no idle process, avoids repeated network traffic, and reduces overlapping Git operations. The command fast-forwards only. It never merges, rebases, discards dirty files, or overwrites diverged memory.

### Sync thresholds

Do not push every time an agent remembers something. Small immediate pushes create more remote churn, more conflicts, and more low-value Git history. Prefer batching until the memory update is worth sharing.

Recommended push thresholds:

| Trigger | Push? | Reason |
|---|---|---|
| Session ends with verified durable Memory Patches | Yes | Keeps the shared brain useful for the next agent/account |
| Switching account, machine, or runtime | Yes | Prevents context loss across handoff |
| 3-7 small APPLIED patches accumulated | Yes | Batches routine learning without letting local memory drift too far |
| One high-value or risky patch | Yes | Important operational truth should travel quickly |
| Before restructure, conflict resolution, or long handoff | Yes | Creates an audit checkpoint |
| Raw inbox/clippings, drafts, partial notes | No | Avoids polluting shared memory |
| Unresolved TENSION/BLOCKED without user decision | No | Prevents spreading uncertain memory as truth |

`auto-pull` can run often because it is read-oriented and fast-forward-only. `push` should be deliberate because it publishes durable memory to the shared brain.

| Status | Meaning | Agent action |
|---|---|---|
| `up-to-date` | Local and remote match | Continue |
| `updated` | Local clone fast-forwarded | Continue with refreshed memory |
| `local-ahead` | Local commits are not pushed | Continue locally; push after review |
| `skipped-dirty` | Uncommitted memory exists | Preserve it; review before sync |
| `offline-or-auth-failed` | Network, remote, or auth unavailable | Continue local-only if stale context is acceptable |
| `blocked-restructure` | Structural migration is active | Wait; do not read midway through migration |
| `diverged` | Both agents committed from an older common state | Run conflict assist; resolve memory semantics with user approval |

Use `--strict` when the task must not continue with stale shared memory. Default mode reports degraded status without crashing the whole agent session.

Pull before a work session:

```powershell
node scripts/brain-sync.mjs pull --vault "C:\Users\you\YourBrain"
```

Check status and secret-like findings:

```powershell
node scripts/brain-sync.mjs status --vault "C:\Users\you\YourBrain"
```

Check memory health before publishing durable changes:

```powershell
node scripts/brain-sync.mjs health --vault "C:\Users\you\YourBrain" --json
```

Push after a durable memory patch:

```powershell
node scripts/brain-sync.mjs push `
  --vault "C:\Users\you\YourBrain" `
  --message "memory: update project routing lessons"
```

`push` never auto-rebases shared memory. If another agent changed the remote, it returns `REMOTE_CHANGED` and preserves local work for review.

Run `health` after conflict resolution, restructure, large intake triage, and before a push that publishes durable memory. Critical findings block push decisions; warnings become curator cleanup work. This keeps mechanical checks out of the LLM's context and leaves the human/agent judgment loop focused on meaning.

### Conflict assist

When shared memory diverges, do not treat it like ordinary code conflict cleanup. Memory can conflict even when Git can merge it mechanically: one agent may have learned a newer truth while another preserved an older but still useful caveat.

Run:

```powershell
node scripts/brain-sync.mjs conflict-assist --vault "C:\Users\you\OpenCodeBrain" --json
```

The command is read-only. It fetches remote state, compares the common base, local HEAD, remote HEAD, and local dirty files, then reports:

- same-note conflicts that require semantic review,
- local-only and remote-only memory changes,
- dirty local drafts that must be committed/stashed before pull,
- lifecycle hints such as APPLIED, TENSION, BLOCKED, SUPERSEDED, STALE, rollback, and provenance,
- a next-decision prompt for the user or lead agent.

Resolution remains a human-approved Memory Patch decision:

1. merge both sides when they are compatible,
2. prefer local or remote when one is clearly stale/wrong,
3. mark the older truth as SUPERSEDED/STALE,
4. create TENSION when both facts may be true but context differs,
5. leave BLOCKED when evidence is missing.

After resolution, run vault health/secret checks and push only after the durable note is correct.

## Scenario Matrix

Portable Brain Sync should assist setup, not silently decide where your memory lives. The safe default is: create or connect when the target is empty or already configured; ask for explicit adoption when the target contains existing knowledge.

| Scenario | Example | Default behavior | Why |
|---|---|---|---|
| No local vault, no remote repo | New user on first machine | Create local vault skeleton and private GitHub repo when `--create-remote` is used | Fresh setup has no existing memory to protect |
| No local vault, remote repo exists | New laptop/account | Clone repo, then write harness config only if compatible or explicitly adopted | Keeps memory portable |
| Local vault already configured | `.memory-patch-harness/brain-sync.json` exists | Connect/status/pull/push normally | The repo already opted into this harness |
| Local vault has harness-like folders | `00 Inbox`, `02 Projects`, `03 Reference` | Add sync config and continue | Compatible structure, low overwrite risk |
| Existing Obsidian vault | `.obsidian/` plus notes | Require explicit adoption | User may have a personal second brain, not a harness brain |
| Existing custom agent-memory repo | `MEMORY.md`, `CLAUDE.md`, many `.md` notes | Require explicit adoption | Do not overwrite or reorganize another memory system |
| Generic git repo | `.git/` but no memory signals | Require explicit adoption | Could be source code or unrelated data |
| Non-empty random folder | Files exist but no known structure | Require explicit adoption | Avoid writing harness folders into the wrong place |
| Public repo requested | `--visibility public` | Refuse unless `--allow-public` is present | Memory is private by default |
| Local dirty state before pull | Uncommitted note edits | Refuse pull | Prevent accidental merge/conflict corruption |
| Secret-like value detected before push | API key/token/private key pattern | Refuse push | Cloud memory must not leak secrets |

Adoption means the user has reviewed the existing repo/vault and intentionally wants Memory Patch Harness to add its sync config and compatible folders. Use:

```powershell
node scripts/brain-sync.mjs bootstrap `
  --vault "C:\Users\you\ExistingBrain" `
  --repo "your-github-user/existing-agent-memory" `
  --adopt-existing
```

Adoption does not rewrite existing notes into Memory Patch format. It only connects sync metadata and creates missing neutral folders. A Memory Curator should later triage old notes gradually.

If the user wants to reshape an existing memory repo into the Memory Patch Harness structure, generate a plan first:

```powershell
node scripts/brain-sync.mjs adoption-plan `
  --vault "C:\Users\you\ExistingBrain" `
  --out "C:\Users\you\ExistingBrain\.memory-patch-harness\adoption-plan.md"
```

The plan inventories current folders, counts Markdown notes, proposes target harness folders, and buckets files into likely inbox/project/reference/template/review groups. It does not move files. The user or lead agent should approve a small migration step before any broad restructuring.

### Reviewed Restructure Flow

Generate a JSON manifest outside the vault so creating the plan does not dirty the memory repo:

```powershell
node scripts/brain-sync.mjs restructure-plan `
  --vault "C:\Users\you\ExistingBrain" `
  --out "$env:TEMP\memory-restructure-plan.json"
```

The generated destinations are suggestions only. Every entry starts with `approved: false`. The lead agent or Memory Curator should read the affected notes, correct each target, and show the exact batch to the user. After approval, set `approved: true` only on accepted entries.

Validate without changing files:

```powershell
node scripts/brain-sync.mjs restructure-apply `
  --vault "C:\Users\you\ExistingBrain" `
  --plan "$env:TEMP\memory-restructure-plan.json" `
  --dry-run
```

Apply and verify:

```powershell
node scripts/brain-sync.mjs restructure-apply `
  --vault "C:\Users\you\ExistingBrain" `
  --plan "$env:TEMP\memory-restructure-plan.json" `
  --approve

node scripts/brain-sync.mjs restructure-verify `
  --vault "C:\Users\you\ExistingBrain" `
  --record "<record-path printed by apply>"
```

Safety behavior:

- Requires a Git repo with a baseline commit and clean worktree.
- Creates a local backup branch without pushing it.
- Moves only approved Markdown notes.
- Rejects path traversal, protected folders, collisions, secret-like vault content, and batches above 20 by default.
- Uses an exclusive lock and rolls back already-applied moves if a later move fails.
- Writes an exact migration record for verification and rollback.

`restructure-verify` confirms that source and target paths match the record. It does not prove that links or note meaning remain correct. The Memory Curator must repair wikilinks/Markdown links, check duplicates and conflicts, and run vault health checks before commit or push.

Rollback before further edits if the migration is wrong:

```powershell
node scripts/brain-sync.mjs restructure-rollback `
  --vault "C:\Users\you\ExistingBrain" `
  --record "<record-path>" `
  --approve
```

## Agent Use

The lead agent should:

1. Pull memory before important work when the machine/account may be stale.
2. Work from a Brain Brief and exact note paths, not the whole vault.
3. Author the Memory Patch after verified work.
4. Ask the Memory Curator to place, link, and validate it.
5. Run `status`, then `push` only if the memory update is safe and durable.

The Memory Curator should not invent facts to make sync succeed. If the patch lacks evidence or conflicts with existing notes, it should return `BLOCKED` or `TENSION`.

## Agent-Assisted Setup

For coding agents, prefer a detect-then-ask flow instead of running an interactive wizard:

```powershell
node scripts/brain-sync.mjs detect --vault "C:\Users\you\YourBrain" --json
```

The agent should show the detected kind, signals, and recommended action to the user. If adoption is required, the agent must ask before running `bootstrap --adopt-existing`.

When the user asks whether to refactor, redesign, or restructure memory into this harness, the agent should run:

```powershell
node scripts/brain-sync.mjs adoption-plan --vault "C:\Users\you\YourBrain" --json
```

Then ask the user whether to:

1. connect sync only,
2. generate a human-readable migration plan,
3. migrate a small sample manually,
4. postpone restructuring.

The tool performs only manifest-approved mechanical moves. It does not infer semantic truth or rewrite note contents. Broad migration remains opt-in and should follow a successful small batch.

## Safety Rules

- Keep brain repos private unless there is a deliberate public publishing reason.
- Never store secrets, tokens, private keys, raw chat transcripts, or raw logs.
- Do not auto-resolve Git conflicts in memory notes. Conflicts are semantic, not just text.
- Do not push every turn. Push only after durable memory changes.
- Treat inbox/clippings as temporary evidence, not canonical memory.

## Current Limits

Portable Brain Sync is intentionally simple. It uses Git and GitHub CLI instead of a vector database or hosted memory service. It is best for local-first agent memory, not high-concurrency customer-facing retrieval.
