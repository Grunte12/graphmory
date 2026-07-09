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

Reject low-confidence patches unless the uncertainty itself is the durable fact being recorded.

Raw evidence is immutable or independently verifiable evidentiary truth. The Markdown note is operational synthesis. A patch may update the synthesis but must never rewrite, conceal, or supersede its evidence.

## Result States

### APPLIED

Use when evidence supports the patch and no unresolved conflict prevents canonical storage.

Return changed paths, links added, and provenance retained.

### TENSION

Use when the patch disagrees with active memory.

Do not overwrite either position. Link both from a tension note and return exact paths.

### BLOCKED

Use when claim meaning, scope, or provenance is insufficient.

Do not write a speculative note. Return the exact missing field or evidence.

## Brain Brief

Return:

- `relevant_memory`: 1-7 items with summary and path
- `constraints`
- `watchouts`
- `note_paths`
- `direct_read_paths`: 0-3 exact paths
