# Full-history count-label review gate

## Why this gate exists

The [compact-prefetch live A/B](prefetch-compact-live-ab-2026-09-28.md) showed that reading only LoCoMo's annotated evidence turns can miss events elsewhere in the same conversation. `conv-50:47` has reference `two` but at least three distinct, explicit car-show visits. The raw official QA metric must remain unchanged for benchmark comparability; this gate decides whether an item can additionally enter Graphmory's **strict supported-complete** evaluation set.

## Implemented review workflow

`scripts/prepare-count-label-audit.mjs` accepts explicit development question IDs and the pinned corpus. It refuses the three sealed histories, requires a simple numeric reference, and writes every original session Markdown note and a hash/turn inventory into a private temporary packet. No top-k selector or annotated evidence path can remove a turn from this packet. `scripts/validate-count-label-audit.mjs` checks the packet hash, every original source hash, turn IDs, event identities and the reviewer record.

A reviewer records distinct events with turn IDs, whether each is counted, excluded or still uncertain, and which sessions were inspected. A **valid** count requires every session reviewed, no unresolved candidate, and counted events equal to the reference. An **invalid undercount** can be established early once distinct counted events already exceed the reference; more scanning cannot restore the smaller count. A provisional or ambiguous item is ineligible. The validator checks structure and arithmetic; it cannot certify that the reviewer understood every passage or that two mentions are truly distinct. Independent semantic adjudication remains necessary for the final acceptance set.

## Retrospective check on the failed live cases

Public-corpus packet manifests and sanitized review records: [Joanna rejection manifest](../../eval/reader-pilot/count-label-audit/conv-42-49-manifest.json), [review](../../eval/reader-pilot/count-label-audit/conv-42-49-review.json); [Dave car-show manifest](../../eval/reader-pilot/count-label-audit/conv-50-47-manifest.json), [review](../../eval/reader-pilot/count-label-audit/conv-50-47-review.json). Full source packets stayed outside the repo; each session hash and turn inventory is recorded for reproduction.

| Case | Reference | Counted events found | Reviewed sessions | Gate result |
| --- | ---: | ---: | ---: | --- |
| `conv-42:49` | 2 | 2; one repeated mention grouped with its event | 2/29 | **Provisional:** cannot certify valid from annotated sessions alone |
| `conv-50:47` | 2 | 3 explicit distinct car shows; one additional possible event | 4/30 | **Invalid undercount:** already exceeds reference |

This is a retrospective tool check, not a new randomized experiment or a completed full-history semantic audit. No case was relabeled in LoCoMo, removed from the earlier frozen A/B, or promoted into a new strict set. The invalid case remains visible as a failed evaluation-label assumption. The next useful step is independent full-session review of candidate answerable items before any held-out live comparison. Reviewers should separately look for paraphrases, repeated mentions of one event, scope/date qualifiers and possible contradictions; the script's arithmetic cannot resolve those judgments.

`node --test test/count-label-audit.test.mjs` checks that partial review cannot pass as valid, unknown evidence IDs fail and a clear undercount can be flagged early. Both real packet reviews pass structural validation and both are ineligible for the strict set for their stated reasons. The user's Obsidian vault was not used or modified.

Diff review additionally tightened the gate: events must cite turns in sessions marked reviewed, and non-simple count references such as a range or decimal are refused. The full repository check passed 312/312 tests and configured gates. Read-only user-vault sync status remains `SYNC_CONFIG_NOT_FOUND`. The packet source notes are disposable; sanitized review records and inventories remain in the repository for reproducibility.
