# SQLite mutation parity: frozen development screen

## Question

Can the experimental focused-section BM25F posting index be updated after ordinary Markdown changes while returning exactly the same complete ranked original paths, section IDs and scores as a clean rebuild and the current scorer? This screen tests a possible index-update mechanism. It does not authorize production integration.

## Fixed synthetic fixture and sequence

Create a disposable, generic Markdown vault with **12 notes** in multiple folders, including repeated query vocabulary, equal-score sections and one note marked `status: superseded`. Query the index before and after each of these fixed steps:

1. add a two-section note;
2. edit the body and metadata of an existing note;
3. delete an existing note;
4. rename a note across folders;
5. edit one section of the newly renamed note.

For every state, use the same 12 frozen queries covering exact names, body terms, two-term order reversal, metadata, no hit and a broad term matching at least 11 notes. Rebuild a fresh index from the new snapshot. Separately apply the detected file changes to a copy of the prior index. Compare both indices to `rank(documents, query, 'bm25f-focused-sections')` on **every full ranked result and score**. Stop at first mismatch; preserve the failure row. For the broad query, concatenate fixed 3-result pages until exhaustion and require exact equality to the complete ranking, with no duplicates or skipped candidates. Do not change the fixture or query book to improve the result.

The index updater must verify that the prior vault snapshot matches stored source hashes before applying a single transaction, and record the changed paths, source hashes and before/after DB hashes. A failed update must leave the DB unchanged. This is an isolated lexical-index test; it does not test Graphmory's managed multi-lane fusion, lifecycle/scope filtering, semantic recall, Curator answers or agent cost. Those require separate end-to-end gates. The synthetic fixture is not an independent answer-quality benchmark.

## Promotion bar

Every state and query must match the current scorer and clean rebuild exactly; every broad-query candidate must be reachable by pagination; invalid prior-source state must be rejected without an index change. Even a pass only permits a later opt-in product design that preserves Node 20 support and proves real-vault freshness, governance and end-to-end quality/latency.
