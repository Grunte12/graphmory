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

Reject low-confidence patches unless the uncertainty itself is the durable fact being recorded. Over MCP a low-confidence `remember` is decided by the owner: the server asks them in the host's question UI. Report the result (`APPLIED` with `approvedBy: owner`, `OWNER_REJECTED`, or queued with `reviewId` and `step: owner_review`); never retry it, raise its confidence, or approve it yourself. `status` with `ask: "reviews"` puts queued items to the owner again.

Raw evidence is immutable or independently verifiable evidentiary truth. The Markdown note is operational synthesis. A patch may update the synthesis but must never rewrite, conceal, or supersede its evidence.

## MCP write envelope

The patch is not the tool argument by itself. Supply outer `claim` and `scope` matching the patch, `evidence: [{path, hash}]` for vault originals or `[{quote}]` for trusted user statements, and:

```javascript
{
  claim: patch.claim,
  scope: patch.scope,
  evidence,
  curation: {
    patch,
    target,
    targetHashes,
    supportVerified: true,
    conflictsReviewed: true,
    authorized: true
  }
}
```

Here `patch` is the complete lead-authored object, `target` is the exact authorized vault-relative Markdown path, and `targetHashes` maps every target to its reviewed hash. `null` means an explicitly authorized new note; existing targets and superseded notes require their current MCP-read hashes. Quote evidence must exactly match attributed user-statement provenance. File evidence must be an original in the configured vault; the lead verifies external project files and supplies supported meaning rather than asking this vault-only server to read them. Record such a file as one `file` provenance item whose value is the absolute path, `#sha256=` and its 64-character lowercase hex hash, optionally followed by a space and the supported meaning (for example `/repo/docs/RUNBOOK.md#sha256=<hex> hotfix section`). It needs no outer evidence item; vault files still require hash-checked evidence.

The three booleans attest to distinct checks: evidence supports the patch (`supportVerified`), relevant existing notes were checked for conflict (`conflictsReviewed`), and the owner authorized the meaning and exact placement (`authorized`). They are not defaults. Return missing evidence or authorization to the lead, rather than trying an incomplete write. Use the default one-call stage; explicit prepare/apply is only for a task that requires a split handoff. `REVIEW_REQUIRED` identifies missing attestations in `missingFields`; report them, not a speculative server-state cause. A refusal is not a saved memory or a reason to retry unchanged input.

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
- `stop_reason`: `nothing-relevant-left`, `evidence-sufficient`, `budget` or `scan-limit` (stop rule: `graphmory://guide/curator`)
- `pages_read`: recall pages read before stopping

A `no-evidence` brief is a valid answer. The main agent must tell the user there is no supporting note; it must not fill the gap with a guess or an unsupported memory.
