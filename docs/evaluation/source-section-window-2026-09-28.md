# Source-section window screen — 2026-09-28

## Decision

Reject all three candidates as substitutes for full original reads. Even the widest tested window loses at least one gold turn in **61/1,099** questions. Multi-hop category 1 retains all gold turns in only **138/180** at that setting. Raw-byte savings do not compensate for missing evidence. No live model trial, production CLI/default change, or sealed-history opening follows this failed screen.

Previous goal turn produced a committed six-run intervention and rejection evidence; it was progress. This turn tests a tool-side alternative rather than adding another Curator reminder.

## Predeclared method

[Corrected manifest](../../eval/reader-pilot/source-section-window-corrected-manifest-2026-09-28.json) freezes corpus/code hashes, 1,099 eligible development questions and three context widths (zero, one, two neighboring heading sections). Selector input is original Markdown, query and fixed context only. Evaluation gold is consulted only afterward.

The experimental selector keeps every section whose body matches a non-stopword query term (with simple singular/plural forms), symmetric neighbors, the first document block and complete ancestor context. No selected section is truncated and no top-k is imposed. No-match or stopword-only queries return the complete source. Code fences do not create false heading boundaries. Exact line ranges and original SHA-256 accompany excerpts; omitted sections set `sourceReadRequired=true`, and `semanticCompleteness` always remains `not_assessed`.

This is **source-compression opportunity over all original notes**, not actual CLI retrieval ranking or autonomous Curator source choice. Complete immutable histories are the reference; no candidate receives gold paths/turns. ATX heading sections are the implemented units; other Markdown syntax is retained as body content, not a promise of a full Markdown parser.

Frozen screen acceptance: zero questions with lost gold-turn opportunity, plus at least 20% median raw-byte reduction. Passing would only authorize a preregistered live experiment, never production promotion. Primary answer correctness, calibrated support and efficiency gates remain separate.

## Results

[Corrected per-question measurements](../../eval/reader-pilot/source-section-window-corrected-results-2026-09-28.json), [corrected replay audit](../../eval/reader-pilot/source-section-window-corrected-replay-audit-2026-09-28.json).

| Neighbor sections | Complete gold turns | Questions losing evidence | Mean per-question gold-turn recall | Median selected/raw-original byte fraction | Median selected / serialized excerpt bytes |
|---:|---:|---:|---:|---:|---:|
| 0 | 780/1,099 | 319 | 0.7734 | 0.3070 | 28,400 / 44,039 |
| 1 | 1,005/1,099 | 94 | 0.9494 | 0.5796 | 52,430 / 75,897 |
| 2 | 1,038/1,099 | 61 | 0.9707 | 0.7296 | 66,368 / 92,638 |

Median raw full-history bytes are 99,258. Byte fractions are medians of per-question ratios, not ratios of independent medians. Serialized excerpts include range/hash/partial-state metadata; the table does not establish provider-token savings or a matched serialized-full-source savings figure.

Gold-turn recall is the proportion of annotated evidence turns present; complete gold-turn opportunity requires all annotated turns. Each selected range contains exact whole source sections, so turn availability is audited without a character truncation. This is still opportunity, not proof that an agent reads, understands or cites it. Full-source reference opportunity is complete for all eligible resolved evidence IDs.

### Category breakdown (complete questions)

| Raw LoCoMo category | Cases | Width 0 | Width 1 | Width 2 |
|---|---:|---:|---:|---:|
| 1 (multi-hop) | 180 | 58 | 128 | 138 |
| 2 | 236 | 188 | 224 | 231 |
| 3 | 64 | 26 | 50 | 53 |
| 4 | 619 | 508 | 603 | 616 |

Width-two losses occur in every development conversation (conv-26:10, conv-30:2, conv-42:13, conv-43:11, conv-47:10, conv-48:14, conv-50:1). Thus the failure is not a single source-family anomaly. Wider context improves availability, but does not make lexical section selection a safe general replacement. A strong aggregate recall hides substantial incomplete multi-hop answers.

No official QA score was run or modified, because no model answer was generated. Category 5 has no comparable gold-evidence target and is excluded by the frozen eligibility rule, not counted as a success. No p95, API billing, actual prompt-cache or whole-workflow latency conclusion is supported.

## Verification and reproduction

`node scripts/eval-source-section-window.mjs --input <pinned corpus> --manifest eval/reader-pilot/source-section-window-corrected-manifest-2026-09-28.json --out <new result>` reproduces the screen. The manifest verifies all selector/evaluator/parser source hashes and the dataset hash; expected count and unique case IDs are checked. Selector ranges are byte-identical to source line slices and source hashes agree. A second actual run produces a byte-identical report.

Three controlled regression tests check CRLF identity, parent negation/scope, neighboring correction, fenced fake headings, no-match/full fallback, heading-only speaker matches and unknown semantic completeness, and duplicate gold-turn annotation accounting. `npm run check` passes **304/304** tests and configured deterministic gates. User-vault status remains `SYNC_CONFIG_NOT_FOUND`; no user-vault files were read for this screen or changed. Only seven development conversations are prepared in memory; three sealed conversations remain unrendered. Temporary replay and test logs are cleaned; pinned shared corpus remains.

## Accounting repair preserved

A post-screen full-reference audit finds one repeated annotation: `conv-50:5` lists D4:5 twice alongside D5:5. The initial evaluator compares a distinct visible-ID set against raw annotation length, falsely marking this fully available question incomplete in all variants. The original [manifest](../../eval/reader-pilot/source-section-window-manifest-2026-09-28.json), [invalid results](../../eval/reader-pilot/source-section-window-results-2026-09-28.json), [original replay audit](../../eval/reader-pilot/source-section-window-replay-audit-2026-09-28.json) and [exact invalid evaluator snapshot](../../eval/reader-pilot/source-section-window-invalid-evaluator-v1.txt) are retained. The snapshot hash matches the original manifest; it is archived source, not the recommended evaluator.

Corrected screening uses unique evidence IDs and separately records raw annotation count; it also checks full-source availability of every unique ID. No case, annotation, source, query, selector or context width is removed or changed. All three loss counts decrease by one (320/95/62 to 319/94/61), and the rejection decision is unchanged. A synthetic duplicate-annotation integration test catches the bug. The corrected manifest links the invalid manifest hash and freezes repaired evaluator hashes before rerunning; corrected results replay byte-identically. This is an evidence-opportunity accounting correction, not modification of any official QA answer/reference scorer.

## Next candidate

Test full-source batching for broad recall: return the same immutable original Markdown in the initial Curator evidence response when the tool already chooses a complete broad candidate pool. This could remove one model round without clipping source content. Narrow questions must retain selective reads; pagination, corpus hashes and omitted/complete flags stay explicit. Freeze an A/B before generation and measure actual correctness, calls, prompt/cache tokens and wall time. Do not infer savings merely from fewer calls, and do not promote without independent support/holdout and matched comparator gates.

The empirical decision uses this exposed [pinned LoCoMo dataset](https://github.com/snap-research/locomo/tree/3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376), not an inherited paper score. Results do not establish competitor superiority. Goal remains active.
