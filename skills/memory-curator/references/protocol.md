# Memory Protocol

## Memory Patch

Require:

- `claim`
- `why_it_matters`
- `scope.applies`
- `scope.excludes`
- `provenance`
- `confidence`
- `suggested_type`
- `lifecycle.status`
- `lifecycle.revalidate_when`

`lifecycle.valid_until` is optional and represents a separate date expiry. Preserve event-based `revalidate_when` conditions as a YAML list; a date does not satisfy an event trigger.

Reject low-confidence patches unless the uncertainty itself is the durable fact being recorded. Over MCP a low-confidence `remember` is not written: it is queued for the owner (`reviewId`, `step: owner_review`). Report that it waits for review; never retry it, raise its confidence, or approve it yourself.

Raw evidence is immutable or independently verifiable evidentiary truth. The Markdown note is operational synthesis. A patch may update the synthesis but must never rewrite, conceal, or supersede its evidence.

## Result States

### APPLIED

Use when evidence supports the patch and no unresolved conflict prevents canonical storage.

Return the verified completion receipt, changed paths, links added and provenance retained. APPLIED requires full persistence and successful checkpoint finish; schema or metadata agreement alone is insufficient.

### TENSION

Use when the patch disagrees with active memory.

Do not overwrite either position. Return the conflicting paths and missing decision without writes in the default trial. Create a tension note only when separately authorized as a supported patch through the same checkpoint workflow.

### BLOCKED

Use when claim meaning, scope, or provenance is insufficient.

Do not write a speculative note. Return the exact missing field or evidence.

## Brain Brief

Return:

- `outcome`: `answered`, `partial` (some claims have no supporting note), or `no-evidence` (nothing supports an answer). Omitted means `answered`.
- `relevant_memory`: supported items with summary, path and optional `hash` (the SHA-256 recall returned, so each finding's source can be checked); keep concise, but include every material finding needed for the task. Empty only when `outcome` is `no-evidence`.
- `constraints`
- `watchouts`
- `note_paths`: empty only when `outcome` is `no-evidence`
- `direct_read_paths`: 0-3 exact paths (none when `no-evidence`)
- `stop_reason`: `nothing-relevant-left`, `evidence-sufficient`, `budget` or `scan-limit` (stop rule: `graphmory://guide/curator`, CLI section)
- `pages_read`: recall pages read before stopping

A `no-evidence` brief is a valid answer. The Lead must tell the user there is no supporting note; it must not fill the gap with a guess or an unsupported memory.
