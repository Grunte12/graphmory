# Guarded memory writes through MCP

The Lead owns supported meaning and authorization. The Curator selects and verifies evidence and reviews placement. `remember` does not call a provider, invent a Memory Patch, infer conflict resolution or choose an arbitrary destination. Persistence checks verify exact saved fields and source identity; they do not judge semantic truth or grant permission.

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

The outer claim/scope must match the patch. Quote evidence must exactly match its user-statement provenance; file provenance must resolve to a listed path (an optional `#section` suffix is allowed). Every source is immutable and disjoint from targets. Every target needs a reviewed current hash, or null for an explicitly authorized new path. These booleans attest to host review; they are not an independent semantic judge. Never set them without the evidence and permission. Low-confidence patches and secret-like values are blocked.

The deterministic placement path creates a complete canonical record at a reviewed new path. Existing target content cannot be overwritten or merged. Use a new successor and explicitly authorized `lifecycle.supersedes` for replacement; include each predecessor and its current hash in `targetHashes`. Finish preserves predecessor content, sets top-level `superseded_by`, verifies backward lineage, affected links, lifecycle, patch fields, source hashes and covered-file drift, then issues a receipt. For a broader existing-note merge, retain the CLI/host Curator editing workflow. No autonomous interpretation or conflict resolution is provided.

The default stage runs prepare → bound placement → full finish in one call. `curation.stage: "prepare"` supports a reviewed two-call handoff: it returns `BLOCKED/NEEDS_CURATION` with a `checkpoint` id after prepare, and blocks reads. Complete using the same `remember` claim, scope, evidence, patch, targets and hashes, with `curation.operation` set to that id and `stage: "apply"`. The server verifies the exact checkpoint binding before any source read or write. It will not accept another patch/target/source set, skip prepare, finish an unrelated operation, or erase a failed checkpoint. This family completes only deterministic new-note placement; native recovery is documented in the CLI protocol.

For unresolved conflicting authority, call with `curation: {conflictPath: "Project/Policy.md"}`; it returns `TENSION` with that original's path/hash and performs no writes. The host must inspect and name the actual conflicting note. Otherwise a successful finish returns `APPLIED` with a compact receipt (operation, patch digest, canonical path, target/source hashes). Any failed check returns `BLOCKED` and, if prepared, its checkpoint id. An interrupted multi-file finish remains pending; there is detection and reviewed recovery, not automatic rollback. Exact replay is independently reverified and cannot create a duplicate.

Read `graphmory://guide/curator` for Memory Patch rules, permission gates, evidence review, lifecycle, receipts and CLI recovery. Script interfaces (`curation-checkpoint prepare/finish`, `render-patch`, `read-notes`) remain supported. Hosted/local decision `curate-plan` is advisory and is not called by the MCP server.
