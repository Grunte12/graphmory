# Memory workflow patterns: Hindsight, Basic Memory, Letta

Date: 2026-09-29  
Scope: Primary documentation and targeted Graphmory source inspection. This is a workflow comparison, not a leaderboard or a live product evaluation.

## Patterns and fit

| Tool | Documented workflow pattern | Graphmory comparison |
| --- | --- | --- |
| Hindsight | A stable `document_id` lets a client replace a revised source by retaining the updated full content again; asynchronous ingestion returns operation IDs that clients can poll. This gives source-level update consistency and visible ingestion status. | Graphmory keeps original files canonical and sends a lead-authored patch through a Curator that reads the originals. Its Markdown lifecycle and audits provide a simpler local write path; it does not need a background extraction service for this workflow. [Hindsight retain API](https://github.com/vectorize-io/hindsight/blob/main/hindsight-docs/docs/developer/api/retain.mdx) |
| Basic Memory | Its assistant guide says to search and build context before answering, and edit an existing note instead of creating duplicates. This favors incremental updates to the canonical note set. | Graphmory already requires targeted retrieval, original-source review, and edits to the strongest canonical note. The manual read/verify/edit sequence is a fit for local Markdown. [Basic Memory AI Assistant Guide](https://docs.basicmemory.com/reference/ai-assistant-guide) |
| Letta | Attached memory blocks persist across interactions and stay in context; blocks can be writable or read-only and shared. This is useful for small, maintained summaries and shared working state, with explicit edit controls. | Graphmory already has derived hot-context rendering, but its canonical source remains Markdown and its Curator applies evidence-backed patches instead of directly self-editing a persistent summary. [Letta memory blocks](https://docs.letta.com/v1-sdk/memory/memory-blocks) |

Graphmory’s existing Curator contract requires a lead-authored patch, direct inspection of cited evidence and target notes, preservation of prior evidence, explicit lifecycle handling, and post-write graph/lifecycle audits ([Curator skill](../../skills/memory-curator/SKILL.md)). The existing `validateMemoryPatch` implementation in [`src/contracts.mjs`](../../src/contracts.mjs) checks patch shape, required fields, supported provenance kinds, and lifecycle fields. The curated workflow did not expose this check as an obvious pre-edit command.

## One small reliability improvement

Expose the existing schema check as `graphmory validate-patch --input <patch.json> --agent`, and require it before host edits. This reuses current validation logic and adds no new schema or storage layer. It should report only `valid`, `schemaOnly`, and field-level `errors`; it must not echo patch contents. A valid result checks shape only. The Curator must still verify source support and explicit authorization, especially for policy changes and supersession.

Acceptance is narrow: a valid example patch exits 0; missing provenance and malformed JSON exit nonzero with controlled JSON errors; missing input/file fails clearly; output contains no claim or source text; a sentinel vault remains unchanged. These are deterministic CLI checks. Native host sub-agent dispatch is a separate manual integration gate in `docs/guides/curator-workflow-smoke.md`; this source comparison did not invoke a model or rerun that host check.

## Evidence limits

The three product rows describe their published documentation, not independently tested feature behavior. Graphmory behavior above comes from code and installed-skill instructions, not from this comparison alone. No installs, provider calls, private-vault reads, or benchmark runs were performed for this note.
