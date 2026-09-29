# Full-source prefetch eligibility screen — 2026-09-28

## Decision

Keep full-source prefetch opt-in and low priority as a general performance lever. It activates for **30/1,439 (2.1%)** development questions under the current adaptive policy. That rarity does not invalidate the prior one-question [live A/B](prefetch-ab-2026-09-28.md), but it makes a global latency or token saving claim implausible without a different treatment. The feature should be evaluated specifically on broad multi-hop/enumeration questions; default behavior stays unchanged.

The previous goal turn was progress: it implemented and measured an actual six-workflow Luna Curator/Sol Lead A/B, then committed the opt-in treatment. This screen tests how often its preconditions hold across all seven development conversations, including adversarial questions, before spending more host calls.

## Frozen protocol and measurement

[Manifest](../../eval/reader-pilot/prefetch-eligibility-manifest-2026-09-28.json) freezes the 2.805 MB pinned LoCoMo corpus hash, current Graphmory sources, seven development conversations, 1,439 question identities and eligibility metrics. Three sealed conversations are excluded before preparing any Markdown. Each source session is written as immutable Markdown in a temporary vault and removed after the run. The evaluator calls the actual `managedRecall` code twice per query on the same vault: `--auto` equivalent, then `--auto --prefetch-wide-originals` equivalent. It checks exact ranked result/page parity before measuring the opt-in status. There are no model calls, output-answer scores, source mutations or user-vault reads.

The evaluator checks exact path/order/Markdown/SHA-256 parity for every attached original. Gold paths are consulted only after both tool outputs to measure *opportunity*: whether annotated sources are present in an eligible full-source packet. Gold never influences ranking or eligibility. Repeated gold path IDs are deduplicated; unresolved evidence turns are excluded from the answerable complete-path denominator. The tool reports `semanticCompleteness: not_assessed`; a source path in the packet does not prove its answer was found or understood.

The [per-question result](../../eval/reader-pilot/prefetch-eligibility-results-2026-09-28.json) contains IDs/categories/status, page/size metrics and gold-path counts, without question text, original Markdown, model traces or private vault paths.

## Results

| Measure | Result |
|---|---:|
| Development questions checked | 1,439 |
| Prefetch ready | 30 (2.1%) |
| Focused query, normal reads | 1,409 (97.9%) |
| Ready, answerable with resolved gold paths | 28 |
| Those with every gold path prefetched | 28/28 |
| Ranking/page parity with ordinary `--auto` | 1,439/1,439 |
| Exact original byte/order/hash parity when ready | 30/30 |
| Median ready tool response | 124,410 bytes |
| Largest ready tool response | 145,487 bytes |
| Median added tool response over baseline among ready | 100,460 bytes |

The measured ready cases include 20 category-1 multi-hop questions, five category-4, two adversarial category-5, two category-2 and one category-3. They occur in all seven development conversations, but 13/30 are from `conv-42`; this concentration limits how much can be inferred from a single family. The complete-path 28/28 result follows a broad full-candidate packet: it is evidence delivery, not an autonomous success rate. It does not cover category-5 abstention quality or unannotated relevant facts.

The 256,000 raw-original-byte cap did not trigger in this corpus. That does not establish safe request sizes for other vaults. Actual JSON tool response bytes include metadata and previews; provider tokens and cache charges may differ. This in-process screen omits CLI launch overhead, Curator decisions, Lead answers, p95 latency and any comparator. It cannot be used as a cost or answer-quality result.

## Validation and next experiment

The evaluator refuses a changed corpus/runtime hash, missing/duplicate identities, ranking/page drift, prefetch state mismatches or changed original content. Its exact outputs are replayed independently into a new path and compared byte for byte; [the replay audit](../../eval/reader-pilot/prefetch-eligibility-replay-audit-2026-09-28.json) records the resulting hash. Existing deterministic prefetch tests cover the actual CLI packet, canonical/scope boundaries, focused/paginated/oversized skips, source-change failure and full-read fallback. `npm run check` passes 308/308 tests and configured deterministic gates; `git diff --check` passes. User-vault status is `SYNC_CONFIG_NOT_FOUND`; the user's Obsidian vault remains untouched. Temporary rendered vaults, replay output and test logs are removed after recording sanitized results.

Next live comparison should stratify the 30 eligible questions across source families and categories, choose labels/protocol before generation, and include matched Graphmory ordinary reads plus native Basic Memory on identical source histories. The primary metric remains independently graded supported-complete answer success with official raw QA beside it. Until that larger comparison, no quality, speed or cost promotion is justified. The full optimization goal remains active.
