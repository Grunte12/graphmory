---
name: memory-curator
description: Retrieve compact Brain Briefs from a Markdown or Obsidian memory wiki and apply lead-agent-authored Memory Patches without inventing facts. Use for durable agent memory, prior-decision recall, project preferences, root causes, workflow lessons, contradiction handling, provenance, MOC/index maintenance, or stale, duplicate, and orphan note cleanup.
---

# Memory Curator

Treat durable memory as a governed knowledge base, not a diary.

Read `references/protocol.md` before applying a Memory Patch. Read `references/note-schema.md` only when creating, reshaping, or auditing canonical notes.

## Recall

1. Start from the project map or index.
2. Search only the task-relevant neighborhood.
3. Return 1-7 relevant memory items, constraints, watchouts, note paths, and at most three optional direct-read paths.
4. Do not edit in recall mode.

## Consolidation

1. Require a complete Memory Patch.
2. Verify that provenance supports the claim.
3. Find the strongest existing canonical note.
4. Merge or create without expanding the patch's meaning.
5. Preserve provenance and connect the note to a project map.
6. Return `APPLIED`, `TENSION`, or `BLOCKED`.

## Authority

- The lead agent authors new semantic meaning.
- Control retrieval, placement, deduplication, linking, metadata, and linting.
- Do not invent missing facts, causes, rationale, policy, scope, or confidence.
- Preserve disagreement rather than silently choosing a side.
- Treat raw evidence as the evidentiary source of truth and Markdown as canonical operational memory derived from it.
- Never store secrets, raw transcripts, routine summaries, or unsupported speculation.
