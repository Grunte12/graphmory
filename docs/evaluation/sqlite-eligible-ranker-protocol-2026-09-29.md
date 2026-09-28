# SQLite ranker after governance: frozen development screen

## Motivation and treatment

The preceding precomputed-lane test failed because it replaced a section result with a note object. Test a different integration boundary: let Graphmory first choose its eligible documents, then call an **experimental index-backed focused BM25F ranker** on that exact eligible set. Reconstruct each winning section from the current loaded Markdown, including title and chunk ID; never accept display metadata from the index. Keep BM25, graph navigation, fusion, preview and final response code unchanged. The original path remains the control. Neither product CLI nor default selects the experimental ranker.

## Frozen correctness gates

1. On the six existing generic mutation-vault states and the same 12 queries, compare full managed Curator JSON for four contexts per state: default, include superseded, scope `Projects`, and scope `Archive`. That is **288 paired responses**. Require byte-for-byte equality, including no-hit cases, candidate order, scores, titles, lifecycle and preview flags. If a scope contains no notes, both arms must still return the same valid empty response.
2. On the exposed SciFact Markdown fixture, use the first **5,000** Graphmory-loaded notes and first **30 frozen queries**. Require exact full managed Curator JSON for every pair, with `k=10`, adaptive bundle and no semantic model. The 5,000-note screen is not a full-corpus BEIR score.
3. Pass one changed-source vault to the index-backed arm and require explicit refusal rather than stale evidence. Verify the indexed database itself is unchanged.

Stop at the first mismatch and retain its query ID, output hashes, differing fields and all attempted rows. Do not ignore metadata differences or change questions to pass.

## Matched performance gate

Only after all correctness gates pass, launch fresh Node processes for both SciFact arms, alternating order by query. Time the **whole managed response** including startup, vault parse, lexical methods, SQLite work, graph/fusion/previews and JSON output. Record response bytes and child RSS. OS file cache is warm/uncontrolled. Require at least 20% lower p50, no p95 or RSS regression, exact response parity and no output-byte increase. Report index build time and bytes separately. A failed performance gate means no product promotion.

Even a pass remains development evidence: Node 24-only SQLite, no Curator/Lead model answer or cost, no independent holdout and no matched competitor workflow. Those gates stay open.
