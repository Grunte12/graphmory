---
name: claude-memory-handoff
description: Prepare a compact, evidence-based handoff or Memory Patch for lead-owned storage in the user's Obsidian-backed Claude Code memory.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# Claude Memory Handoff

Create durable memory without dragging a long session forward.

## Storage

- Vault: `<path-to-your-vault>` (set via `$env:OBSIDIAN_VAULT`)
- Scope: `<your-memory-scope>` (set via `$env:MEMORY_PATCH_HARNESS_SCOPE`)
- Harness CLI: `<CLAUDE_HOME>\bin\memory-patch-harness.mjs`

## Workflow

1. Run `intake-sweep` before preparing a handoff; it lists only bounded candidate metadata.
2. If raw evidence is relevant, name only the task-relevant paths as provisional evidence. Read a raw body only when the lead selects it as provenance; do not read or promote the whole queue.
3. Do not save secrets, raw logs, full transcripts, prompts, transcript paths, or routine chatter.
4. If saving durable behavior-changing knowledge, author a complete Memory Patch with:
   - claim
   - why it matters
   - scope applies/excludes
   - provenance
   - confidence
   - suggested type
   - lifecycle status and revalidation trigger
5. The lead authors verified durable meaning, then delegates the complete Memory Patch
   to `memory-curator` for placement, merging, linking, lifecycle updates, and linting.
   The curator may write canonical notes but must never invent or expand meaning.
6. For temporary task state, return a compact handoff to the lead; store it only when the lead explicitly decides it is useful and safe.

## Useful Commands

```powershell
node "$HOME\.claude\bin\memory-patch-harness.mjs" recall --vault "$env:OBSIDIAN_VAULT" --query "<question>" --scope "$env:MEMORY_PATCH_HARNESS_SCOPE" --json
node "$HOME\.claude\bin\memory-patch-harness.mjs" intake-sweep --vault "$env:OBSIDIAN_VAULT" --scope "$env:MEMORY_PATCH_HARNESS_SCOPE" --limit 5 --json
node "$HOME\.claude\bin\memory-patch-harness.mjs" health --vault "$env:OBSIDIAN_VAULT" --json
node "$HOME\.claude\bin\memory-patch-harness.mjs" lifecycle-audit --vault "$env:OBSIDIAN_VAULT" --json
```

## Handoff Note Shape

```markdown
---
type: session-handoff
status: inbox
created: <iso timestamp>
source: claude-code
---

# Handoff

## Goal

## Current State

## Decisions

## Files And Evidence

## Verification

## Next Steps

## Risks

## Memory Patch Candidates
```
