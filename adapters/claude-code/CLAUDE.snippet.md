# Claude Code CLAUDE.md Snippet

Copy the sections you want into your own `<CLAUDE_HOME>/CLAUDE.md` and fill in
the placeholders (`<path-to-your-vault>`, `<your-memory-scope>`, `<CLAUDE_HOME>`).
This is not a drop-in file — it is a menu of durable memory-lifecycle sections
extracted from a working Claude Code + memory-patch-harness setup. Skip any
section that does not fit your workflow. This snippet is memory-only: it does
not prescribe model routing, task orchestration, or automatic transcript
capture. Bring your own workflow for everything outside memory.

## Memory Mechanism

- The active memory vault is `<path-to-your-vault>` (set as `OBSIDIAN_VAULT`).
- The harness memory scope is `<your-memory-scope>` (set as `MEMORY_PATCH_HARNESS_SCOPE`).
- The memory harness CLI is `<CLAUDE_HOME>/bin/memory-patch-harness.mjs`.
- At session start, use a Brain Brief recall instead of reading broad memory. Search the scope first, then read only returned note paths.
- Save durable memory only when it will change future work.
- A memory item needs: claim, why it matters, scope, provenance, confidence, lifecycle status, and revalidation trigger.
- The lead session authors the meaning. The `memory-curator` subagent may organize, validate, link, and store; it must not invent missing facts.
- Prefer one lesson per Markdown file in your vault or a local `<CLAUDE_HOME>/memory/inbox`.
- Keep startup memory tiny: 1-7 relevant items and 0-3 exact note paths, not the whole vault.

Useful commands (env-var placeholders already generic):

- Recall: `node "%USERPROFILE%\.claude\bin\memory-patch-harness.mjs" recall --vault "%OBSIDIAN_VAULT%" --query "<question>" --scope "%MEMORY_PATCH_HARNESS_SCOPE%" --json`
- Health: `node "%USERPROFILE%\.claude\bin\memory-patch-harness.mjs" health --vault "%OBSIDIAN_VAULT%" --json`
- Lifecycle audit: `node "%USERPROFILE%\.claude\bin\memory-patch-harness.mjs" lifecycle-audit --vault "%OBSIDIAN_VAULT%" --json`

## Lead-Authored Memory Patch

- New durable knowledge must be sent to `memory-curator` as a Memory Patch containing `claim`, `why_it_matters`, `scope`, `provenance`, `confidence`, and `suggested_type`.
- The curator may retrieve, deduplicate, merge, link, normalize minimally, and lint. It must not invent facts, causes, rationale, policy, or confidence.
- A conflict returns `TENSION`. Missing meaning or evidence returns `BLOCKED`. Otherwise return `APPLIED`.
- Do not save secrets, raw transcripts, routine summaries, or low-confidence speculation.

## Curator Placement

- Raw evidence is the evidentiary source of truth and must not be rewritten. Markdown notes are canonical operational memory and must stay traceable to evidence. Search, vector, and graph indexes are rebuildable derived views.
- Never restructure an existing Obsidian vault without explicit user approval.

## Handoff Before Switch

- Before stopping, compacting, or switching tasks, use the `claude-memory-handoff` skill (or `scripts/new-handoff.ps1`) to save a compact handoff: goal, decisions, files touched, next steps, risks, and verification — explicitly, not automatically.
- A handoff is task state, not durable memory. Only a complete lead-authored Memory Patch should go to `memory-curator` for placement.

## Optional Recall Hook

If you want a bounded, read-only Brain Brief injected on relevant prompts
instead of asking for recall explicitly, wire the single hook in
`settings.snippet.json` (`scripts/brain-brief-hook.ps1` on `UserPromptSubmit`).
It fails closed: if `OBSIDIAN_VAULT` or `MEMORY_PATCH_HARNESS_SCOPE` is not
set, it injects nothing and never guesses or creates a vault path. This hook
is entirely optional — the adapter works with zero hooks.
