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
mph recall-managed --vault "<vault-path>" --query "<question>" --agent
```

In curator mode, this returns up to ten candidate **paths** by default; it does not send ten full Markdown notes to the lead agent. Pass `--scope "<known-project-or-domain-path>"` when the scope is known. Inspect headings and query-relevant sections before opening more of a note, and stop reading once the necessary evidence is complete. The JSON scores rank candidates; they do not establish that a claim is true or current. If evidence is still missing, follow the configured retrieval workflow and make at most one bounded expansion before abstaining. Never dump the full vault into agent context. Use `mph config` in a terminal for human setup; do not run its interactive menu in an agent loop.

For a question that explicitly compares two known projects, check whether the candidate notes support both sides. If evidence for one side is missing, make one bounded comparison expansion: run `mph recall-loop --vault "<vault-path>" --query "<question>" --scope "<project-a-path>" --k 5 --agent` and repeat once for `<project-b-path>`. These compact results contain paths, not note bodies. Inspect only relevant lines, select as many directly supported notes as the answer actually needs, and cite them in the Brain Brief. If a side has no supporting note, say that it is unknown. Do not choose a note merely because it ranks first, and do not repeat this expansion for ordinary single-project questions.

## Recall

1. Start from the project map or index.
2. Search only the task-relevant neighborhood.
3. Use the wider candidate list to compare evidence, resolve duplicates, and notice conflicts. Do not copy every candidate into the brief. Return only the memory items needed for the task (at most seven), constraints, watchouts, note paths, and at most three optional direct-read paths. Keep each claim tied to its source path; prefer short supported claims and include excerpts only when the lead needs exact wording.
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
