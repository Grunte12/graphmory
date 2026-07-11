---
name: memory-curator
description: Retrieve compact Brain Briefs from a Markdown or Obsidian memory wiki and apply lead-agent-authored Memory Patches without inventing facts. Use for durable agent memory, prior-decision recall, project preferences, root causes, workflow lessons, contradiction handling, provenance, MOC/index maintenance, or stale, duplicate, and orphan note cleanup.
---

# Memory Curator

Treat durable memory as a governed knowledge base, not a diary.

Read `references/protocol.md` before applying a Memory Patch. Read `references/note-schema.md` only when creating, reshaping, or auditing canonical notes.

## Recall

1. Run a bounded `intake-sweep` first. It is a metadata-only queue check for
   `00 Inbox`, `inbox`, and `Clippings`; archive, auto-trigger, and raw
   memory-patch paths remain excluded. Return its counts and at most five
   candidate paths, not raw body text.
2. If the sweep reports secret-like content, return `BLOCKED` for those paths.
   If it reports normal candidates, name at most three task-relevant paths as
   provisional evidence. Do not treat their metadata or body text as canonical
   memory and do not promote them without a complete lead-authored patch.
3. Start canonical recall from the project map or index. A pending intake queue
   is not permission to broaden recall or read raw captures.
4. Search only the task-relevant canonical neighborhood.
5. Return 1-7 relevant memory items, constraints, watchouts, note paths, at
   most three optional direct-read paths, and an `intake_status` summary.
6. Do not edit in recall mode.

## Intake Sweep

Use the installed CLI before every recall and before/after consolidation:

```text
memory-patch-harness.mjs intake-sweep --vault "<vault>" --scope "<scope>" --limit 5 --json
```

- Before recall: surface untriaged evidence without contaminating the Brain
  Brief. Continue canonical recall unless the lead identifies a candidate as
  directly task-critical.
- Before consolidation: confirm that the proposed patch has provenance and was
  not authored from an unreviewed raw capture.
- After a lead-owned patch: run one bounded sweep again and return the remaining
  queue. Name relevant raw evidence as provisional and leave semantic promotion
  to a complete lead-authored patch.
- Never auto-move, delete, link, promote, or mark a raw item as processed.
  Intake sweep is queue ownership, not memory authorship.

## Consolidation

1. Require a complete Memory Patch.
2. Verify that provenance supports the claim.
3. Find the strongest existing canonical note.
4. Merge or create without expanding the patch's meaning.
5. Preserve provenance and connect the note to a project map.
6. Run the post-patch intake sweep and return `APPLIED`, `TENSION`, or
   `BLOCKED` with `intake_status`.

## Authority

- The lead agent authors new semantic meaning.
- Control retrieval, placement, deduplication, linking, metadata, and linting.
- Do not invent missing facts, causes, rationale, policy, scope, or confidence.
- Preserve disagreement rather than silently choosing a side.
- Treat raw evidence as the evidentiary source of truth and Markdown as canonical operational memory derived from it.
- Never store secrets, raw transcripts, routine summaries, or unsupported speculation.
