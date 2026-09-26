# Vault structure ablation — 2026-09-26

## Decision question

Does a project/category folder hierarchy or a map-of-content (MOC) index improve Graphmory's default note retrieval enough to justify making either mandatory during installation?

## Research that shaped the test

- [Karpathy's LLM Wiki idea file](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) separates immutable raw sources, maintained Markdown wiki, and agent schema. It calls the exact directory structure domain-dependent, and presents index-first navigation as useful at moderate scale. This is a design proposal and personal practice, not a controlled Graphmory benchmark.
- [Andy Matuschak's evergreen notes](https://notes.andymatuschak.org/About_these_notes) motivate focused notes and meaningful links. These are thinking and navigation principles, not measured retrieval gains for this corpus.
- [Martin Fowler on architecture decision records](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html) supports short, individually statused decisions and supersession links. It does not prescribe the `00 Inbox`/`02 Projects` naming convention.
- [Zhou et al., *Filesystem-Based Memory for LLM Agents*](https://arxiv.org/abs/2607.26637) varies memory organization. Its abstract reports that organization roughly halves retrieval cost for large material, but does not by itself improve answer quality in their measured agents. This is a warning against equating tidy folders with better answers.

## Reproducible A/B design

`node scripts/eval-vault-structure.mjs` runs a 2×2 comparison on the committed 54-note research fixture and its 34 pre-existing, path-labeled questions. It changes only the note IDs/paths for the flat versus grouped comparison; Markdown bodies and gold labels stay the same. The index comparison adds or removes the fixture's 10 existing MOC notes; none are gold answers. All arms use the same governed BM25F section retriever, `k=3`, and unscoped queries. Filename uniqueness is asserted before flattening. No personal vault is read or written.

| Arm | Notes | Hit@3 | Recall@3 | MRR | nDCG@3 | Mean returned context characters |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Flat, no MOC | 44 | 91.2% | 89.7% | 0.875 | 0.862 | 315 |
| Grouped, no MOC | 44 | 88.2% | 86.8% | 0.868 | 0.847 | 314 |
| Flat, with MOC | 54 | 88.2% | 86.8% | 0.865 | 0.843 | 345 |
| Grouped, with MOC | 54 | 88.2% | 86.8% | 0.865 | 0.847 | 345 |

Grouped minus flat without indexes: Hit@3 and Recall@3 each **−2.9 percentage points** (one query). Paired query bootstrap 95% interval: **−8.8 to 0 points**. Adding indexes to the grouped corpus changed neither Hit@3 nor Recall@3, lowered MRR by 0.003, and increased mean returned context by 31 characters. The changed hit is `link-recovery-cranimem`: flat/no-index retrieves a gold neighbor at rank 3; grouped/no-index retrieves a different, non-gold paper there; both index arms retrieve an MOC there. The index still may help a human or a browsing agent navigate; this test only measures direct retrieval candidates.

Earlier [graph-structure evaluation](graph-structure-2026-09-26.md) found improvements over an older graph implementation on a development fixture, but ordinary sparse fusion matched its new structure fixture's Hit@3 and complete-evidence@3. It does not establish that adding links to this vault improves the default retrieval path.

## Interpretation and limits

This corpus is almost entirely papers in one reference area. It has no project-routing questions, no user tasks that browse an index, no held-out agent answers, and no no-answer cases. The 34 questions were already used during retrieval development; the one differing case was deliberately authored to probe linked-note recovery. This ablation therefore establishes only that **the current fixed folder/MOC layout has no measured retrieval advantage on this fixture**. The one-query flat advantage and its interval are too weak to recommend flattening existing vaults. Do not present these percentages as a universal ranking of vault structures.

Keep local Markdown and evidence-backed note links as the architectural substrate. During installation, preserve an existing vault layout. For a new vault, create only the inbox and project area that the user needs. Add a project home or MOC when it helps navigation, and keep it concise; do not claim it boosts direct retrieval. Keep graph traversal optional and evidence-gated. Do not migrate existing notes for a speculative retrieval gain.

The next release-level test needs a frozen multi-project vault with real task queries, project-scope choices, cross-project and multi-hop questions, answer/no-answer labels, and agent-visible context budgets. Compare flat, scoped project folders, and selective indexes on the same content and lead/curator workflow. Measure Recall@3, MRR, complete evidence@3, answer correctness, unsupported claims, p50/p95 latency, and tokens. Freeze labels before tuning; use a separate held-out set for a default change.

## Reproduce

```sh
node scripts/eval-vault-structure.mjs
node scripts/eval-vault-structure.mjs --json > /tmp/graphmory-vault-structure.json
```

The JSON includes per-query results, category summaries, and deterministic paired bootstrap intervals. No personal paths or note content appear in the script or this report.
