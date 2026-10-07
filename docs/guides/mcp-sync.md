# MCP sync: Git pull and push

`sync` keeps a vault in step with its private Git remote. It needs the one-time setup the owner runs with `graphmory bootstrap`; without it `sync` returns `SYNC_NOT_CONFIGURED`. A pending write (`CURATION_PENDING`) blocks both actions until it is finished or restored through `status`.

## Pull

`sync({ action: "pull" })` fetches and fast-forwards. It never merges, rebases or discards anything.

| `status` | Meaning | What to do |
|---|---|---|
| `up-to-date`, `updated`, `local-ahead`, `remote-branch-missing` | Safe; `safeToContinue: true` | Carry on |
| `skipped-dirty` | Local changes are not committed yet | Push them first, or continue with local memory |
| `offline-or-auth-failed` | The fetch failed | Continue local-only when stale shared memory is acceptable; do not retry in a loop |
| `diverged` | Local and remote histories both moved | Tell the owner; they review it with `graphmory conflict-assist` |
| `blocked-restructure`, `sync-busy`, `local-history-missing` | Another operation or a missing baseline | Tell the owner the named state |

Pull at session start and before a Brain Brief that depends on shared memory. Do not poll.

## Push

`sync({ action: "push", message? })` publishes local memory, and only the owner can approve it:

1. The server lists the changed files and any unpushed commits.
2. Secret-like values anywhere in the vault return `BLOCKED`, `code: SECRET_FOUND` and the `files` to clean. No question is asked and values are never echoed.
3. The host shows the owner a question (MCP elicitation): **Commit and push** or **Not now**, with the repository, branch, files and commit message.
4. On approval the server checks that every listed file still has the bytes the owner saw. Anything newer returns `CHANGED_DURING_REVIEW` and nothing is committed. Then it commits everything and pushes, returning `pushed`, the `commit` and `approvedBy: owner`.

A remote that moved returns `REMOTE_CHANGED`: pull first. `kept` means the owner chose not to push. `no-changes` means there was nothing to publish. If the host cannot show questions the result is `unsupported`, and the owner can push with `graphmory push` in a terminal.

The optional `message` is one line of at most 120 characters; the default is `memory: update brain snapshot <date>`.

## When to push

`status` includes `sync.plan`, the same advice as the batch rules: `push-ready`, `pull-first`, `human-review`, `blocked`, `hold` or `no-changes`. The plan never approves a push by itself. Push at session end after verified memory, before switching machine or runtime, or after 3-7 small `APPLIED` patches, not after every item.
