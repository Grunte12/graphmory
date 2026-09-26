# Explicit graph structure evaluation — 2026-09-26

## Scope and sources

This update improves deterministic graph mechanics: typed Markdown properties, relative Markdown links, query-aware frontier selection, traversal through an already retrieved bridge, conservative entity-name resolution, bounded graph diagnostics, and path provenance. It adds no model calls or dependencies. It is not HippoRAG or a learned entity extractor.

Primary motivation: [HippoRAG (NeurIPS 2024)](https://arxiv.org/abs/2405.14831) evaluates associative multi-hop retrieval; [HippoRAG 2 (ICML 2025)](https://arxiv.org/abs/2502.14802) addresses factual-memory regressions from earlier graph retrieval; [Microsoft GraphRAG indexing methods](https://microsoft.github.io/graphrag/index/methods/) describes cost/noise tradeoffs. These support testing graph assistance, not assuming universal superiority or transferring their benchmark gains to Graphmory.

## Measured results

Compared revision `881b7ec` with this implementation, same candidate cap (12) and automatic graph-intent gate. No gold labels in existing fixtures changed.

| Set | Previous graph Hit@3 | New graph Hit@3 | Previous → new complete evidence@3 |
| --- | ---: | ---: | ---: |
| Research fixture, 34 questions | 97.1% | 97.1% | 97.1% → 97.1% |
| Public fixture, 15 questions | 93.3% | 93.3% | 93.3% → 93.3% |
| Existing adversarial, 6 answerable + 2 no-answer | 100% | 100% | 100% → 100% |
| New structure fixture, 7 answerable + 4 no-answer | 85.7% (6/7) | 100% (7/7) | 42.9% (3/7) → 57.1% (4/7) |

On the new structure fixture Recall@3 increased 66.7% → 81.0%. Ordinary sparse fusion also gets 100% Hit@3, 57.1% complete@3, and 81.0% Recall@3. Thus the change improves the previous graph implementation, but does not establish that graph traversal beats ordinary recall. Both old and new graph methods reach 100% Hit@12. All four new no-answer cases still return candidates; these remain explicitly unverified. The graph route remains optional.

The new fixture was authored during development and then used to refine traversal. It is a mechanics/regression test, not independent generalization evidence. It includes typed edges, a Markdown relative link, a two-hop chain, hubs, duplicate names, direct facts, and no-answer cases. Raw per-query results are in `eval/graph-structure/results.json`.

Unit tests additionally reproduce a late relevant branch under a one-neighbor round budget, assert a two-hop provenance trail, prevent code examples from creating edges, retain lifecycle/scope exclusions, and cap noisy diagnostics. These demonstrate correctness, not a benchmark quality percentage.

## Reproduce

```sh
node --test test/graph-structure.test.mjs test/adaptive-recall.test.mjs test/retrieval.test.mjs
node scripts/eval-adaptive-graph.mjs --vault eval/graph-structure/vault --queries eval/graph-structure/queries.json
node scripts/eval-adaptive-graph.mjs --vault eval/real-vault/vault --queries eval/real-vault/queries.json
node scripts/eval-adaptive-graph.mjs --vault eval/fixtures/notes --queries eval/fixtures/queries.json
node scripts/eval-adaptive-graph.mjs --vault eval/adaptive-graph/vault --queries eval/adaptive-graph/queries.json
```

For the previous graph arm, extract `src`, `scripts`, and `package.json` from revision `881b7ec` into a temporary directory and run that revision's evaluation script against the same current fixture paths. Do not overwrite a working checkout. Timing fields are single-pass observations with fixed arm order and are not evidence of a speedup.

## Release interpretation

Ship as an opt-in graph improvement with a read-only audit and structure guide. Keep ordinary recall as default. No personal notes were moved or rewritten. A future stronger routing policy needs held-out real questions with complete evidence groups, answer correctness, no-answer precision, and comparable token/cost measurements before becoming the default. Graph connectivity cannot create a missing fact or repair a semantic vocabulary mismatch by itself.
