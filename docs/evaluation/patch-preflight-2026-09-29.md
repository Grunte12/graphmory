# Patch preflight integration acceptance

## Decision and limits, before implementation acceptance

User authorized adapting effective existing tool strategies to finish Graphmory's usable workflow. The bounded three-tool comparison recommends a mechanical pre-apply check using Graphmory's existing `validateMemoryPatch`, exposed through the installed CLI. This reuses the existing contract rather than inventing a write engine or adopting a service stack.

## Declared acceptance

- A complete synthetic patch passes schema validation with exit 0.
- Missing required provenance and malformed JSON return compact failure and a nonzero exit.
- Missing input/file is a controlled failure; malformed JSON must not expose an input snippet.
- The command needs no vault, model key, host dispatch, network or optional dependencies and performs no writes.
- Responses do not echo private claim/provenance values. The result states schema-only scope.
- Generated normal Curator guidance invokes the preflight before host edits, reports invalid input as BLOCKED, and still checks original evidence and explicit lifecycle authority.
- Preserve existing retrieval, patch schema and curator outcomes; run focused CLI/installer tests and the required repository check.

Schema success is **not** factual grounding, supersession approval, conflict resolution or an automatic block on direct host edits. This manual host workflow uses instructions to invoke the check; no enforced tool intercept is introduced. Do not claim a native model followed the new preflight without observing a new live run. This phase is a functional integration check, not an accuracy/token/latency comparison.

## Results

Implemented `validate-patch` using the existing validator. Focused CLI/installer/contract tests passed **22/22**. A separate five-case CLI execution verified complete input (exit 0), missing provenance (exit 1), malformed JSON (exit 1), unreadable file (exit 1) and missing input (usage exit 2). Every result was compact JSON with `schemaOnly: true`; the synthetic private-content sentinel was absent from stdout/stderr, and the sentinel Markdown note hash was unchanged.

The first manual runner assumed exit 1 for missing input and stopped at that assertion. The command correctly returned a controlled usage exit 2; the declared gate required a nonzero exit, so the runner expectation was corrected and all five cases repeated. No implementation change or narrowed safety criterion was needed.

`npm run check` passed after implementation. Private-vault status remained `SYNC_CONFIG_NOT_FOUND`; no private note/config was written. The [sanitized CLI evidence](../../eval/reader-pilot/patch-preflight-2026-09-29.json) records each case. Generated Curator instructions place validation before edits, but no new live native Curator run has verified it follows this step. Existing native workflow evidence predates this preflight and is kept separate.

Primary-source [workflow comparison](../research/memory-workflow-patterns-2026-09-29.md) explains what was adapted and what already exists. No latency, token-cost, retrieval-quality or comparator superiority gain is claimed.
