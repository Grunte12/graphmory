# Collection runner integration audit

This is a deterministic integration diagnostic, not an answer-quality benchmark. The map response is supplied by a fixture; no model, paid API or personal vault is used. The existing experimental helper invokes the real `read-notes --collect-state` and `--record-span` CLI against a temporary original Markdown file.

## First observed failure

Helper SHA-256 at execution: `5a4425ae6eeb4f8461e063cdc5f9cfcd52fcc8a8c7602be13256540a1fa06a0d`.

Fixture: `fact.md`, 32 UTF-8 bytes, one factual line followed by newline. Original SHA-256: `63cd3ae885cc1e22dff36a5493ce2c3c16229cce038c88d76b2de9dfdc632525`. The fixture map returns the exact first line, correct original hash and line interval 1–1. Budget: 2,000 response bytes, three pages maximum, 10,000 prompt bytes.

Observed: one page and one map callback; delivery completed, but zero ledger entries and one rejected span with reason `original-span-validation-failed`. The helper returned `complete=true` and an empty synthesis ledger. This is byte-delivery completion, not a successful evidence extraction.

Cause: the map schema uses `source_sha256`, `start_line`, and `end_line`; the original-span CLI API requires `sourceSha256`, `startLine`, and `endLine`. Passing the map object unchanged rejects valid spans. Normalize at the API boundary and verify that the real CLI records the expected ledger entry.

## Additional inspection findings

- A factual line split across transport pages cannot be quoted as a complete original line under the initial fragment-only mapping contract. Preserve bounded boundary text across pages or explicitly stop with incomplete usable evidence. Silent loss of boundary evidence is unacceptable.
- `incomplete()` initially overwrites already-recorded unresolved reasons. Preserve those reasons when adding pending spans.
- Validate fragment text before encoding it, and account for CLI timeouts as incomplete attempts rather than unrecorded crashes.

These findings were sent to the implementing Luna agent. No revised-run success is claimed here. The live three-arm experiment remains unstarted; its source-label and access-parity gates still apply. Temporary fixture files were removed by the test's temporary-directory context.

## Parallel label-audit preparation

The fixed candidate packets use two exposed histories, each with 29 original Markdown notes. An actual rehash of packet 0 (conv-43) and packet 2 (conv-42) found zero mismatches across all 58 notes. Reader-input keys are only `id`, `question`, `vault`, and `sources`; original answers remain in separate label-audit packets. A Luna agent was assigned the finite full-history audit of the eight fixed candidates. Checksums prove source identity, not semantic label validity; no candidate was qualified by this mechanical check.
