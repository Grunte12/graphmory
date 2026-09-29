# BM25F scoring optimization

## Evidence and change

The previous v0.5 latency gate failed twice on the 5,000-note seed-29 scenario.
A CPU profile then identified candidate scoring as a hot path. BM25F computed
term IDF for every candidate and field length normalization for every query term.
The change computes IDF once per matched query term and normalization once per
candidate field, preserving the formula, term addition order and tie-breaking.
No model, dependency, retrieval limit or acceptance threshold was added/changed.

## Paired development experiment

Both implementations ran in the same Node process on the stress fixture:
5,000 synthetic notes, seed 29, 50 query variants. The baseline source came from
Git revision `d6b61f8`. Every governed result, including floating-point scores,
matched exactly before timing. Six warm rounds alternated implementation order.

| Warm scoring measure | Before | After |
|---|---:|---:|
| Median average query latency | 5.145 ms | 4.137 ms |

This is a **19.6% reduction** for this synthetic warm scoring workload.
[Raw paired timings](../../eval/bm25f-optimization/paired-warm-results.json)
record every round and the candidate source hash. Three frozen-score tests
also cover default weights and customized `b`, `k1` and field weights.

`npm run check` subsequently passed all 252 tests, example validation and the
complete deterministic evaluation chain, including the unchanged latency gate.

The pre-change standalone profiled run also passed the latency gate, despite
two earlier failures. Absolute machine timings varied substantially. Therefore
passing that gate alone does not prove the patch resolved every latency problem;
the alternating paired experiment is the evidence for the scoring improvement.
This does not measure cold index construction, model latency, p95 host latency,
billed cost or superiority over another memory product. External acceptance
criteria remain unfulfilled.
