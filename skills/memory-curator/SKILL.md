---
name: memory-curator
description: Retrieve compact Brain Briefs from a Markdown or Obsidian memory wiki and apply lead-agent-authored Memory Patches without inventing facts. Use for durable agent memory, prior-decision recall, project preferences, root causes, workflow lessons, contradiction handling, provenance, MOC/index maintenance, or stale, duplicate, and orphan note cleanup.
---

# Memory Curator

Treat durable memory as a governed knowledge base, not a diary.

Write new canonical memory in concise English, including titles, claims, rationale, and summaries. Keep exact identifiers, paths, commands, and source references unchanged. Do not create a Thai translation of the same note. The lead agent answers the user in the user's language; a Thai reply does not require a Thai memory copy. Do not rewrite existing notes or raw evidence merely to enforce this convention.

Read `references/protocol.md` before applying a Memory Patch. Read `references/note-schema.md` only when creating, reshaping, or auditing canonical notes.

## CLI recall

When `mph` is on PATH and the vault path is known, start with a bounded machine-readable lookup:

```sh
mph recall-managed --vault "<vault-path>" --query "<question>" --k 3 --agent
```

Pass `--scope "<known-project-or-domain-path>"` when the scope is known. Read only the returned candidate notes needed to prepare the Brain Brief. The JSON scores rank candidates; they do not establish that a claim is true or current. If `needsExpansion` is true, follow the configured retrieval workflow and make at most one bounded expansion before abstaining. Never dump the full vault into agent context. Use `mph config` in a terminal for human setup; do not run its interactive menu in an agent loop.

## Recall

1. Start from the project map or index.
2. Search only the task-relevant neighborhood.
3. Return only the memory items needed for the task (at most seven), constraints, watchouts, note paths, and at most three optional direct-read paths. Prefer paths and short claims; include excerpts only when the lead needs their exact wording.
4. Do not edit in recall mode.

## Consolidation

1. Require a complete Memory Patch.
2. Verify that provenance supports the claim.
3. Find the strongest existing canonical note.
4. Merge or create without expanding the patch's meaning.
5. Preserve provenance and connect the note to a project map.
6. Return `APPLIED`, `TENSION`, or `BLOCKED`.

In hosted Jev or local decision mode, the lead may run `graphmory curate-plan --vault "<path>" --input "<bundle.json>" --agent` after authoring a Memory Patch. The bundle contains `patch`, `sources` with IDs and short evidence excerpts, and optionally up to three `candidate_paths`. Read the returned advice and affected notes before any write. `curate-plan` never edits the vault; `review` is not approval to apply a patch. A local reranker cannot perform this classification.

## Authority

- The lead agent authors new semantic meaning.
- Control retrieval, placement, deduplication, linking, metadata, and linting.
- Do not invent missing facts, causes, rationale, policy, scope, or confidence.
- Preserve disagreement rather than silently choosing a side.
- Treat raw evidence as the evidentiary source of truth and Markdown as canonical operational memory derived from it.
- Never store secrets, raw transcripts, routine summaries, or unsupported speculation.
