# Guarded memory writes through MCP

The main agent owns supported meaning and authorization. The Curator selects and verifies evidence and reviews placement. `remember` does not call a provider, invent a Memory Patch, infer conflict resolution or choose an arbitrary destination. Persistence checks verify exact saved fields and source identity; they do not judge semantic truth or grant permission.

Supply `claim`, `scope: {applies: [...], excludes: [...]}`, and `evidence`: either `{path, hash}` with the original's SHA-256 or `{quote}` for a trusted, attributed user statement. A bare call returns `BLOCKED`, `code: NEEDS_CURATION`, `step: needs_curation`, without writing: the full patch and reviewed placement are missing.

After reviewing originals and permission, add `curation`:

```json
{
  "patch": {
    "claim": "Production releases require an independent approver.",
    "why_it_matters": "Independent approval preserves the reviewed release boundary.",
    "scope": {"applies": ["production releases"], "excludes": ["development deployments"]},
    "provenance": [{"kind": "user-statement", "value": "Owner approved independent production release review."}],
    "confidence": "high",
    "suggested_type": "decision",
    "lifecycle": {"status": "active", "revalidate_when": ["release process changes"], "supersedes": []}
  },
  "target": "Project/Release Decision.md",
  "targetHashes": {"Project/Release Decision.md": null},
  "supportVerified": true,
  "conflictsReviewed": true,
  "authorized": true
}
```

The outer claim/scope must match the patch. Quote evidence must exactly match its user-statement provenance; file provenance must resolve to a listed path (an optional `#section` suffix is allowed). Every source is immutable and disjoint from targets. Every target needs a reviewed current hash, or null for an explicitly authorized new path. These booleans attest to host review; they are not an independent semantic judge. Never set them without the evidence and permission. Secret-like values are refused and never stored.

A low-confidence patch that passes every other check is not written and is not lost: the server queues the full request in the private state root (outside the vault, so it is never recalled) and returns `BLOCKED`, `code: LOW_CONFIDENCE`, `step: owner_review` and a `reviewId`. Tell the user the memory waits for their review and do not retry or raise the confidence. Only the owner can decide, in a terminal: `graphmory review list`, `review show <id>`, `review approve <id>` (interactive; re-checks every source and target hash, reports `STALE` and writes nothing on drift; the receipt records `approvedBy: owner`) and `review reject <id>`. There is no MCP tool to approve.

The target can be a reviewed new path or an existing note. For an existing note, pass its current hash in `targetHashes`; the engine places the record and keeps everything the owner wrote: it replaces only the owned frontmatter keys (`type`, `confidence`, `status`, `patch_digest`, `graphmory_record_format`, `revalidate_when`, `valid_until`, `supersedes` and their aliases) and the one record block, which goes right after the first `#` heading when the note has none yet. Other frontmatter keys, headings and text stay. A note with two record blocks or unterminated frontmatter returns `NEEDS_CURATION` and is not touched. A target that changed since review returns `TARGET_CHANGED`. To replace a note's meaning rather than update it, use a new successor and explicitly authorized `lifecycle.supersedes` for replacement; include each predecessor and its current hash in `targetHashes`. Finish preserves predecessor content, sets top-level `superseded_by`, verifies backward lineage, affected links, lifecycle, patch fields, source hashes and covered-file drift, then issues a receipt. No autonomous interpretation or conflict resolution is provided.

The default stage runs prepare → bound placement → full finish in one call. `curation.stage: "prepare"` supports a reviewed two-call handoff: it returns `BLOCKED/NEEDS_CURATION` with a `checkpoint` id after prepare, and blocks reads. Complete using the same `remember` claim, scope, evidence, patch, targets and hashes, with `curation.operation` set to that id and `stage: "apply"`. The server verifies the exact checkpoint binding before any source read or write. It will not accept another patch/target/source set, skip prepare, finish an unrelated operation, or erase a failed checkpoint. This family completes only the bound placement; native recovery is documented in the CLI protocol.

Before placement the engine checks, without any provider call, whether an active note of the same declared type (or no type) has a title about the claim's subject and strongly overlaps its wording (at least three shared terms and 60% of the claim's terms). It ignores the target, cited evidence, stale/superseded notes and notes the patch lists in `lifecycle.supersedes`. If one exists and `curation.reviewedConflicts` does not map its path to its current hash, `remember` returns `TENSION`, `code: CONFLICT` and `conflictingNotes: [{path, hash}]` and writes nothing. The Curator reads those notes and the main agent decides: replace (list it in `lifecycle.supersedes` with its hash in `targetHashes`), keep both (repeat the call with `reviewedConflicts`), or drop the change. A note that changes after review asks again. The check cannot tell agreement from contradiction and can miss a conflict worded differently; it only stops the host from skipping the question.

For unresolved conflicting authority the host has seen but the engine did not flag, call with `curation: {conflictPath: "Project/Policy.md"}`; it returns `TENSION` with that original's path/hash and performs no writes. The host must inspect and name the actual conflicting note. Otherwise a successful finish returns `APPLIED` with a compact receipt (operation, patch digest, canonical path, target/source hashes). Any failed check returns `BLOCKED` and, if prepared, its checkpoint id. An interrupted multi-file finish remains pending; there is detection and reviewed recovery, not automatic rollback. Exact replay is independently reverified and cannot create a duplicate.

Read `graphmory://guide/curator` for Memory Patch rules, permission gates, evidence review, lifecycle, receipts and CLI recovery. Script interfaces (`curation-checkpoint prepare/finish`, `render-patch`, `read-notes`) remain supported. Hosted/local decision `curate-plan` is advisory and is not called by the MCP server.
