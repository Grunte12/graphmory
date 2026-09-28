---
name: memory-curator
description: Retrieve compact Brain Briefs from a Markdown or Obsidian memory wiki and apply lead-agent-authored Memory Patches without inventing facts. Use for durable agent memory, prior-decision recall, project preferences, root causes, workflow lessons, contradiction handling, provenance, MOC/index maintenance, or stale, duplicate, and orphan note cleanup.
---

# Memory Curator

Treat durable memory as a governed knowledge base, not a diary.

Write new canonical memory in concise English, including titles, claims, rationale, and summaries. Keep exact identifiers, paths, commands, and source references unchanged. Do not create a Thai translation of the same note. The lead agent answers the user in the user's language; a Thai reply does not require a Thai memory copy. Do not rewrite existing notes or raw evidence merely to enforce this convention.

Read `references/protocol.md` before applying a Memory Patch. Read `references/note-schema.md` only when creating, reshaping, or auditing canonical notes.

## CLI recall

When `mph` is on PATH and the vault path is known, start with a compact machine-readable lookup:

```sh
mph recall-managed --vault "<vault-path>" --query "<question>" --agent
```

In curator mode, each call returns up to ten candidate **paths**, not ten full Markdown notes. Pass `--scope "<known-project-or-domain-path>"` when the scope is known. Inspect headings and relevant sections of returned notes. If evidence is incomplete and `hasMore` is true, call the same query and scope again with `--offset <nextOffset>`; continue until evidence is sufficient or `hasMore` is false. Keep track of inspected paths so you do not reread them. There is no fixed total candidate count for the curator. If `scanLimitReached` is true, do not claim the vault was fully searched. The scores rank candidates; they do not establish that a claim is true or current. If candidates are exhausted without sufficient evidence, reformulate the query or use an appropriate alternate retrieval lane; abstain if evidence is still missing. Never dump the full vault into agent context. Use `mph config` in a terminal for human setup; do not run its interactive menu in an agent loop.

For an explicit question about a previous state, add `--include-superseded` to `recall-managed`. It admits superseded notes without admitting raw, stale, archived, or deprecated notes. Keep it off for current-state questions. Read the originals and compare attribution, dates, and scope; inclusion alone does not prove a historical claim.

For a question that compares two known projects, retrieve within each project scope and page through the candidate paths as needed. Check that evidence supports both sides. Inspect relevant lines, cite all notes needed for the comparison, and say when one side has no supporting note. Do not choose a note merely because it ranks first.

## Recall

1. Start from the project map or index.
2. Search only the task-relevant neighborhood.
3. Inspect as many relevant notes as needed to compare evidence, resolve duplicates, and notice conflicts. Do not copy every candidate into the brief. Return a concise synthesis of the supported memory items, constraints, watchouts, and source paths; include more items when the task genuinely needs them. Keep each claim tied to its source path; include excerpts only when the lead needs exact wording.
4. Do not edit in recall mode.

For questions about implementation, runtime behavior, or provider configuration, distinguish historical designs/comparisons from current operational evidence. Check the relevant runtime guide or implementation note before claiming a feature is wired, absent, or uncached. An API/module's existence does not prove it is connected to the default workflow. For comparisons, verify the same material status questions on both sides. If sources conflict, report their dates/status and the conflict; a newer date alone does not prove correctness. Cite exact vault-relative paths (and section or line when available), not invented short source labels. Stop only after the material claims have supporting evidence, not because the first retrieved note appears to answer the question.

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
