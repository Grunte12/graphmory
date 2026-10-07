## Durable Memory

- Use the Graphmory MCP tools `recall`, `read`, `remember`, `link`, `status` and `sync` from `graphmory-mcp`. Do not run the `graphmory` command (it is the owner's CLI) or read the vault with file tools instead.
- Write new canonical vault notes in concise English. Keep exact technical identifiers and provenance intact. Do not duplicate notes by language or translate existing notes solely for consistency. Answer the user in their chosen language, including Thai. Keep routine replies short while preserving decisions, evidence, uncertainty, and next actions.

- At session start and before current shared memory is required, the main agent calls `sync` with `action: "pull"`. Graphmory Curator does not run Git sync.
- The main agent owns the meaning of new memory.
- Before non-trivial work where prior decisions could change the plan, ask the memory curator for a compact Brain Brief.
- After verified work, save only knowledge that can change future work.
- New durable knowledge must be sent as a Memory Patch containing `claim`, `why_it_matters`, `scope`, `provenance`, `confidence`, and `suggested_type`.
- The curator may retrieve, deduplicate, merge, link, normalize minimally, and lint. It must not invent facts, causes, rationale, policy, or confidence.
- A conflict returns `TENSION`. Missing meaning or evidence returns `BLOCKED`. Otherwise return `APPLIED`.
- Raw evidence is the evidentiary source of truth and must not be rewritten. Markdown notes are canonical operational memory and must stay traceable to evidence. Search, vector, and graph indexes are rebuildable derived views.
- Do not save secrets, raw transcripts, routine summaries, or low-confidence speculation.
- If pull reports dirty, offline, restructure-active, or diverged state, preserve local memory and surface the status; never auto-merge or retry-loop.
- If pull reports `diverged` or push reports `REMOTE_CHANGED`, explain it to the user; they review it with `graphmory conflict-assist` in a terminal and choose a lifecycle decision before resolving.
- Call `status` at session start, after conflict resolution or large intake triage, before relying on old time-sensitive memory and before publishing. Critical health findings block a push; lifecycle findings are review items, not permission to rewrite memory.
- Graphmory Curator calls `recall`, then `read` on the cited paths, and pages with `nextCursor` under the stop rule in the graphmory-curator skill. For a prior-state question, say so in the query and compare dates and scope in the originals. If retrieval still misses, reformulate or follow the linked neighborhood; never dump the vault into context. `scanLimitReached` or `budgetReached` means the vault was not fully searched.
- Low-confidence memory, recovery of an interrupted write and every push are decided by the owner in the host's question UI (`status` with `ask`, `sync` with `action: "push"`). Never decide them for the owner.
- Before publishing a memory batch, the main agent checks `status` (`sync.plan`) and calls `sync` with `action: "push"`. A `push-ready` plan is never approval by itself.
