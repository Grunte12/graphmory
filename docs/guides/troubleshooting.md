# Troubleshooting and Agent Recovery

Start with the doctor command instead of guessing:

```sh
node scripts/brain-sync.mjs doctor --vault "<vault-path>" --json
```

Add `--require-github` only when the user wants GitHub-backed portability. Local Memory Patch Harness use requires Node.js and Git, but not GitHub CLI.

## Agent Recovery Loop

1. Run `doctor --json` and retain the complete check IDs and details.
2. Fix one failed required check at a time.
3. Run `doctor` again.
4. Run `detect --json` before bootstrap or adoption.
5. Use `--dry-run` before restructure apply.
6. Run the matching verification command after every state-changing operation.
7. Stop and ask the user when recovery would change permissions, install system software, select a repository, expose memory publicly, discard Git changes, or restructure notes.

Do not delete a vault, `.git`, `.obsidian`, sync config, migration record, or browser/auth profile to make a check pass. Do not use `git reset --hard`, force push, or automatic conflict resolution.

## Doctor Checks

| Check | Meaning | Normal recovery |
|---|---|---|
| `node-version` | Node.js must be 20 or newer | Install a supported Node.js release and reopen the terminal |
| `git-cli` | Git is required for history, safety gates, and rollback | Install Git and verify `git --version` |
| `github-cli` | `gh` is needed only for GitHub repo creation/clone/auth | Install GitHub CLI, or continue local-only |
| `github-auth` | GitHub CLI has no valid authenticated account | Run `gh auth login`, finish browser login, rerun doctor |
| `vault-detection` | Shows how the target was classified | Review the kind and safe action before changing anything |
| `vault-permission` | Agent can read/write the vault or its nearest existing parent | Choose a user-owned path or fix normal user permissions |
| `sync-config` | `brain-sync.json` exists and has valid repo/branch fields | Restore it from Git or regenerate it after confirming values |

## Error Codes

| Code or message | Cause | Recovery |
|---|---|---|
| `COMMAND_NOT_FOUND` | A required executable is absent from PATH | Run doctor; install only the named dependency; reopen terminal |
| `COMMAND_FAILED` | A command ran but returned non-zero | Read its stdout/stderr; do not retry blindly |
| `INPUT_NOT_FOUND` | Plan or migration record path is wrong | Locate the intended file; do not fabricate a replacement record |
| `INVALID_JSON` | Config, plan, or record is truncated/malformed | Restore from Git or repair syntax while preserving fields |
| `SYNC_CONFIG_NOT_FOUND` | The selected clone has no brain sync configuration | Run detect and bootstrap/adopt after confirming the intended repo |
| `REMOTE_CHANGED` | Another agent updated remote memory before this push | Preserve local work, run `conflict-assist`, then reconcile semantically with user approval |
| `SYNC_BUSY` | Another sync process holds the local clone lock | Wait for it to finish; inspect before removing a stale lock |
| `PATCH_NOT_AUTHORITATIVE` | Memory Patch lacks canonical meaning | Lead agent must author the missing claim/delta; curator must not invent it |
| `clean Git worktree` | Local changes exist before restructure | Review and commit/stash intentionally; never discard automatically |
| `baseline commit` | Repo has no rollback point | Review current files and create the first commit with user approval |
| `secret-like values` | Cloud sync/restructure safety scan found sensitive-looking text | Remove or relocate secrets; confirm false positives carefully |
| `may be running` | Restructure lock exists | Check for another process; remove a stale lock only after confirming no operation is active |
| `state has drifted` | Files changed after migration record was created | Stop automatic rollback; compare the record, Git diff, and current notes manually |

## Platform Notes

### Windows

- Use quoted paths, especially under `C:\Users\...` and folders with spaces.
- Reopen PowerShell/Terminal after installing Node.js, Git, or GitHub CLI so PATH refreshes.
- Do not solve permission failures by running the coding agent as Administrator by default.

### macOS

- Verify Command Line Tools or Git availability with `git --version`.
- Avoid placing the vault in a location blocked by privacy permissions unless the user grants access deliberately.

### Linux

- Use a user-owned vault path; avoid running the harness as root.
- Confirm filesystem case sensitivity when moving notes whose names differ only by letter case.

## Safe Escalation Report

If the agent cannot recover, report:

```text
Blocked check/error code:
Exact command:
Exit code:
Relevant stdout/stderr:
Detected platform and versions:
Vault classification:
What was attempted:
What was not changed:
Smallest user decision needed:
```

This gives the next agent enough context to continue without repeating destructive guesses.

## Unknown Failure Protocol

Use this protocol when the failure is not documented, the command stopped halfway, or the agent cannot prove the current state.

### 1. Freeze state

- Stop all write, sync, migration, cleanup, and retry loops.
- Do not rerun the failed state-changing command until its effects are known.
- Do not delete a lock merely because it looks stale.
- Do not commit, push, pull, merge, rebase, reset, or resolve conflicts automatically.

### 2. Preserve evidence without exposing memory

Record only operational metadata:

```sh
node scripts/brain-sync.mjs doctor --vault "<vault-path>" --json
git -C "<vault-path>" status --short --branch
git -C "<vault-path>" log -1 --oneline
```

Also retain:

- exact command and exit code,
- complete stderr and relevant stdout,
- operating system, architecture, Node/Git/gh versions,
- whether the process was interrupted, crashed, or lost network/power,
- migration plan and record paths,
- whether a lock file and local backup branch exist.

Do not attach note contents, credentials, full environment dumps, remote URLs containing tokens, or private vault archives to a public issue.

### 3. Protect the only copy

- If the vault has no remote or recent backup, make a filesystem copy to a new user-owned directory before repair.
- If a healthy private remote exists, prefer a fresh clone into a different directory for comparison. Never clone over the damaged vault.
- Keep the original vault untouched until the copy/clone opens and expected notes are present.
- If storage is full or the filesystem reports I/O errors, stop writing and resolve storage/hardware health first.

### 4. Classify current state

| Observed state | Safe next step |
|---|---|
| No files moved; command failed during validation | Correct the named input/dependency and rerun dry-run |
| Files moved; migration record exists; no later edits | Run `restructure-verify`; rollback only if verification proves the applied state |
| Files moved; record missing or files changed later | Compare Git status/diff and backup branch manually; do not synthesize a record |
| Migration committed locally | Review the commit and use a normal revert only after confirming its scope |
| Push failed after local commit | Verify remote branch and authentication; retry push only after proving the commit is absent remotely |
| Pull/merge/rebase conflict | Preserve both sides and request human semantic resolution |
| Wrong GitHub account or repository | Stop sync; confirm account, repo visibility, and remote URL before changing `origin` |
| Repo accidentally public | Make it private immediately through trusted GitHub controls, rotate any exposed secrets, then audit history |
| Secret scan may be a false positive | Inspect only the named file locally; never bypass globally without user review |
| Lock remains after a crash | Confirm no harness/agent process is active and inspect migration state before removing only that lock |
| Case/Unicode/path-length failure | Move a small reviewed sample to portable names; do not bulk rename |
| Cloud-sync/antivirus file lock | Pause the conflicting tool or move to a normal local working copy; preserve the original |
| Unknown or contradictory state | Stop automation and produce the escalation report below |

### 5. Prefer reversible recovery

Recovery order:

1. verify without writing,
2. compare against migration record and Git,
3. restore from the local backup branch or reviewed Git commit,
4. compare with a fresh clone or filesystem backup,
5. perform manual note-level repair,
6. resume sync only after vault health and Git status are understood.

Never choose the fastest recovery merely to make the command pass. Preserve user memory and provenance first.

### 6. Continue without optional services

If GitHub CLI, network access, or a provider is unavailable, the harness can remain local:

- continue using Markdown/Obsidian memory locally,
- postpone `pull` and `push`,
- keep Memory Patches and migration records local,
- rerun doctor when the external dependency returns.

Do not block local memory work merely because cloud sync is unavailable.

## Conflict Assist Recovery

Use conflict assist when `auto-pull` returns `diverged` or `push` returns `REMOTE_CHANGED`:

```sh
node scripts/brain-sync.mjs conflict-assist --vault "<vault-path>" --json
```

Expected agent behavior:

1. Read the report before raw Git output.
2. Explain local-only, remote-only, dirty, and same-note conflicts in plain language.
3. Ask the user for a lifecycle decision when the same memory meaning differs.
4. Apply the chosen resolution manually and visibly.
5. Run vault health and secret checks before push.

Forbidden recovery behavior:

- no `git reset --hard`,
- no force push,
- no automatic rebase,
- no automatic merge commit for semantic memory,
- no deleting one side merely to make Git clean.
