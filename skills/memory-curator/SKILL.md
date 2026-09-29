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

Read selected originals with the tool's JSON-array path argument, including filenames containing spaces:

```sh
graphmory read-notes --vault "<vault-path>" --paths '["01 Projects/Example/Policy.md", "90 Evidence/Approval Record.md"]'
```

This returns original Markdown with paths and hashes. Use the exact returned vault-relative paths; do not iterate over whitespace-split shell output. Read only the originals relevant to the task and check any read errors before making a claim or editing.

For a consolidation handoff, the Lead may provide an exact-path source manifest **outside the vault**:

```sh
graphmory source-handoff --vault "<vault-path>" --paths '["90 Evidence/Approval Record.md", "01 Projects/Example/Runbook.md"]' > "<handoff.json>"
graphmory read-notes --vault "<vault-path>" --manifest "<handoff.json>"
```

The manifest has paths, hashes and byte counts, not note bodies. Treat section IDs such as `#E2` as anchors **inside** the named file, never as new filenames. The Lead must select exact paths from known vault paths, not infer them from free-text provenance. Before writing, read every source/target named in the handoff, check hashes and claim support, and stop if any read or hash check fails. If no manifest is supplied, resolve candidate paths through Graphmory and confirm them before a write. Never guess a filename.

For a question that compares two known projects, retrieve within each project scope and page through the candidate paths as needed. Check that evidence supports both sides. Inspect relevant lines, cite all notes needed for the comparison, and say when one side has no supporting note. Do not choose a note merely because it ranks first.

## Recall

1. Start from the project map or index.
2. Search only the task-relevant neighborhood.
3. Inspect as many relevant notes as needed to compare evidence, resolve duplicates, and notice conflicts. Do not copy every candidate into the brief. Return a concise synthesis of the supported memory items, constraints, watchouts, and source paths; include more items when the task genuinely needs them. Keep each claim tied to its source path; include excerpts only when the lead needs exact wording.
4. Do not edit in recall mode.

For questions about implementation, runtime behavior, or provider configuration, distinguish historical designs/comparisons from current operational evidence. Check the relevant runtime guide or implementation note before claiming a feature is wired, absent, or uncached. An API/module's existence does not prove it is connected to the default workflow. For comparisons, verify the same material status questions on both sides. If sources conflict, report their dates/status and the conflict; a newer date alone does not prove correctness. Cite exact vault-relative paths (and section or line when available), not invented short source labels. Stop only after the material claims have supporting evidence, not because the first retrieved note appears to answer the question.

## Consolidation

1. Require a complete lead-authored Memory Patch, including claim, rationale, scope, provenance, confidence, type, and lifecycle. Read `references/protocol.md` for the required fields and outcomes.
2. Materialize the lead-authored patch as a JSON file outside the vault and run `graphmory validate-patch --input "<patch.json>" --agent` before editing. Stop as `BLOCKED` if validation fails. This is schema validation only: it does not establish factual support, user authorization, or that a requested lifecycle transition is supported.
3. Open the cited original evidence and current target notes. Verify that the evidence supports the claim; a ranked candidate or link is not evidence by itself. Confirm explicit user authorization before changing policy or superseding prior memory.
4. Find the strongest existing canonical note. In curator mode, apply the supported patch with the host's normal Edit/Write tools, preserving its meaning, source IDs, and prior evidence. Write each `lifecycle.revalidate_when` event as an item in the canonical note's YAML `revalidate_when` list. Keep optional `valid_until` as its own date field; a date expiry does not replace an event trigger. Keep historical notes; mark the predecessor as `superseded` and link it to the active replacement only when the evidence and explicit authorization support that transition. Preserve the replacement's explicit link back to its predecessor so the original decision remains inspectable.
5. Preserve disagreement. If the patch does not resolve a conflict with active memory, return `TENSION` rather than silently overwriting either position. If provenance or scope is missing, return `BLOCKED` with the smallest missing item.
6. After a write, run `graphmory verify-patch-persistence --vault "<vault>" --input "<patch.json>" --note "<canonical-note.md>" --agent`. If it reports missing lifecycle metadata, repair only that metadata and rerun; if still invalid, return `BLOCKED` with the missing field names. This read-only check verifies metadata persistence only. It does not verify factual support, authorization, claim meaning, or supersession.
7. Then run `graphmory graph-audit --vault "<vault>" --json` and `graphmory lifecycle-audit --vault "<vault>" --json`. The lifecycle audit is date-oriented and may emit informational `revalidation-mentioned-without-date` findings for event triggers; report those separately. Repair supported link/lifecycle metadata issues without changing claim meaning; report remaining findings.
8. Return `APPLIED`, `TENSION`, or `BLOCKED` with the affected paths and provenance status.

Graph audit separates unresolved/ambiguous references (`issues`) from references to existing notes excluded from the current navigation graph (`excludedReferences`, counted by `excludedCounts`). Exclusion for lifecycle or scope is informational, not a broken-link finding or authority to delete a history/evidence link. Open the original target when needed and preserve supported lineage; never remove valid links merely to produce a clean audit. Audit counts cover the loaded inventory and can be incomplete when scan limits are reached.

`validate-patch` returns only `{valid, schemaOnly, errors}` JSON and never accesses the vault. Its result does not attest that evidence supports a claim or authorize an edit.

`verify-patch-persistence` reads one named Markdown note and checks only the patch lifecycle status, every supplied `revalidate_when` event, and `valid_until` when the patch provides it. It returns field paths in `checkedFields`, never the values being checked. When the patch has no event triggers, no `revalidate_when` note field is required. Use the simple multiline YAML list syntax supported by Graphmory's Markdown reader; this command is not a general YAML validator. It returns metadata agreement, not semantic or authorization verification.

`curate-plan` is for hosted Jev or local decision mode only. In those workflows, the lead may run `graphmory curate-plan --vault "<path>" --input "<bundle.json>" --agent` after authoring a Memory Patch. The bundle contains `patch`, `sources` with IDs and short evidence excerpts, and optionally up to three `candidate_paths`. Read the returned advice and affected notes before any write. `curate-plan` never edits the vault; `review` is not approval to apply a patch. Do not call it in the default curator workflow, where the named host sub-agent applies a verified patch with its file-editing tools. A local reranker cannot perform this classification.

## Authority

- The lead agent authors new semantic meaning.
- Control retrieval, placement, deduplication, linking, metadata, and linting.
- Do not invent missing facts, causes, rationale, policy, scope, or confidence.
- Preserve disagreement rather than silently choosing a side.
- Treat raw evidence as the evidentiary source of truth and Markdown as canonical operational memory derived from it.
- Never store secrets, raw transcripts, routine summaries, or unsupported speculation.
