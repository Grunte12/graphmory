# MVP read-authority repair report — 2026-10-01

## Scope

This change closes the CLI-managed `CURATION_PENDING` read bypass exposed by the October 1 holdout. It adds one shared authority decision for agent-facing content routes, a narrowly bound recovery reader, and output gates around those routes. Low-level source and vault readers remain ungated for checkpoint preparation, verification, and recovery internals. `graph-audit` remains available as a body-free, explicitly non-authoritative diagnostic.

The authority token fingerprints the resolved vault and state roots, the per-vault state presence, lock status and owner digest, and the sorted operation records including each manifest byte hash. A corrupt, wrong-vault, missing, symlinked, or inaccessible operation manifest is unresolved; a missing operations directory under an existing per-vault state directory fails closed. A genuinely absent per-vault state remains clear. The token detects a clear-to-pending-to-clear transition when the persistent state changed, without adding a counter or changing the rc.4 checkpoint manifest schema.

Agent-facing content routes perform a pre-read check and compare the token before returning buffered stdout. Decision-provider calls, semantic/index cache writes, and deferred file publishers receive an immediate current-authority check. The CLI cannot sandbox host-native filesystem tools, and the checks do not provide atomic isolation from concurrent editors. In particular, an external state change can race after the check immediately before a publisher begins; a later check can suppress stdout but cannot retract an arbitrary file publication or other side effect. The CLI makes no rollback or transaction guarantee for that race.

Recovery reads require one current unlocked `pending` or `recovery-in-progress` operation and an exact nonempty subset of its recorded source/target paths. Target bytes are labeled `recovery-only` and carry their current hash. Source Markdown is disclosed only while its hash matches the recorded source hash; changed or unavailable sources return metadata without Markdown. The selected files and authority token are checked again before response. Recovery output cannot establish current-memory authority or satisfy APPLIED receipt acceptance.

Successful clear legacy reads require no historical receipt. A write is accepted as APPLIED only after full persistence and lifecycle/graph verification produce a matching completion receipt; a prior receipt alone does not prove that current bytes remain valid. On an affected-audit failure, the checkpoint stores and returns a bounded, sorted list of exact paths, finding kinds, severity, and next action, without note body text.

## Routes and compatibility

The shared CLI gate covers `recall`, `recall-loop`, `recall-managed`, `recall-explore`, `recall-rerank`, `recall-semantic`, `curate-plan`, `source-handoff`, and normal `read-notes` modes. Recovery `read-notes` uses its operation-bound reader. JSON routes emit one body-free blocked envelope with a nonzero exit; scalar routes keep stdout empty and report the block on stderr. Existing success JSON shapes remain unchanged. Missing-vault and `--verbose` error behavior remain covered by regression tests.

Checkpoint status uses an additive `authorityToken` field. The persisted rc.4 operation/receipt schema is unchanged. `auditDocuments(..., { inventoryComplete: true })` is used only after checkpoint inventory has completed its exhaustive vault scan; arbitrary/filtered inventories keep the lifecycle API's conservative default.

## Verification

Focused Node tests passed **104/104** after adding the controlled deferred-publication case. Coverage includes first-use reads without receipts, pending blocks across all routed content commands, scalar/JSON output behavior, missing or corrupt state, wrong-vault terminal manifests, exact recovery path/hash rules, source drift suppression, clear-to-pending transition detection, managed retrieval and provider rechecks, and deferred file publication when pending registration appears during a source read.

This report records focused implementation verification only. It does not claim the full package checks, installed-package acceptance, or a repaired native workflow passed. The earlier native holdout failure and linked-repair failure remain the evaluation result until the root task completes its independent integrated acceptance.
