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
- `intake_status`: bounded queue summary with counts, up to five metadata-only
  candidate paths, secret-scan state, and recommended route (`none`,
  `review-provisional-evidence`, or `blocked-secret-scan`)

## Intake Sweep

Every curator task owns a bounded intake check before canonical recall and
before/after a consolidation attempt:

```text
intake-sweep --vault <vault> --scope <active-project-or-domain> --limit 5 --json
```

The sweep lists untrusted raw candidates from Inbox/Clippings and deliberately
excludes archive, automation, and raw patch paths. It must not include raw body
text in the Brain Brief. The curator names at most three task-relevant
candidates as provisional evidence. It may inspect a raw body only when the
lead explicitly names it as provenance. Only the lead may author a Memory Patch
or Learning Packet, and raw evidence never becomes canonical by implication.

Do not auto-move, auto-link, delete, promote, or mark raw evidence triaged.
Health/lifecycle audits run after a meaningful intake or patch batch, not on
every recall.
