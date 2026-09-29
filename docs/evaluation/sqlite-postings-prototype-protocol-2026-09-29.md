# SQLite postings prototype: frozen development screen

## Why this experiment

The 30-query stage profile measured a 474 ms median for focused-section BM25F and 224 ms to load/parse the 5,183-note SciFact Markdown vault. An exact persisted posting index could avoid doing that work on every cold CLI call. The prior JSON-vector process cache failed the whole-API speed gate. This experiment tests a different, research-supported storage idea without changing the production retriever.

## Treatment and invariant

Implement one **experimental Node 24 `node:sqlite` script**, outside the packaged runtime. Store existing section IDs, field lengths and per-field token frequencies. Query with the same JS token expansion, stopword list, BM25F formula, field weights, field-average normalization, stable tie order and first-scoring-section-per-note deduplication as `src/retrieval.mjs`. SQLite is a posting store, not a replacement relevance formula. Retain original note ID, section order and source hash. No semantic model, FTS5 scoring or section embedding is part of this treatment.

This prototype must be labeled Node 24 only. Graphmory currently advertises Node >=20; no engine/package/dependency/runtime change is allowed in this experiment. A production design must later either keep a Node 20 path or make an explicit version-support decision.

## Frozen screens and gates

1. Run first on the first **500 documents** in the prepared SciFact sort order and the first **30 frozen queries**. If any query's complete ranked original-ID list or scores differ from the current focused-section BM25F method, stop and record failure. Section-level ranking can also be compared for diagnosis. Do not adjust corpus, queries or scoring to pass.
2. If the 500-document screen passes, run all **5,183 documents and 300 queries**. Require exact original-ID order and scores per query. The official BEIR score remains a separate check after mapping; equal original-ID runs should give equal scores. Check source and implementation hashes before and after.
3. Measure index build wall time, DB file bytes and peak RSS; query medians/p95 for first call and warm persistent process separately. For a subset of 30 queries, alternate fresh baseline CLI and fresh SQLite CLI process order on one host; include startup, source loading/index open, ranking and output. Preserve stdout and failure ledgers. Minimum performance screen for further work: fresh-process p50 at least **15% lower**, p95 no worse, peak RSS no worse, with **zero** output regressions. A failure rejects the prototype as a promotion candidate; it may still identify a bottleneck.
4. Before any product integration, prove add/edit/delete/rename incremental updates equal a full rebuild and that all paginated candidates remain reachable. This initial prototype is read-only after a full build and **cannot** pass product promotion without those follow-up checks.

## Limits and stop rules

SciFact is exposed retrieval development data, not a coding-agent memory answer benchmark or independent holdout. A 500-document pass is only a correctness smoke screen. A 5,183-document pass would establish lexical parity and local performance, not supported-complete answers, citations, abstention, semantic quality or cost. Do not compare this experimental script's lookup time with Basic Memory or qmd end-to-end time. No default change follows from a positive result. Keep every failed attempt and raw measurements; stop after a failed correctness gate instead of tuning thresholds or selecting easier questions.

Primary sources supporting only the storage hypothesis: [SQLite FTS5 formula](https://www.sqlite.org/fts5.html#the_bm25_function), [Node SQLite API and runtime availability](https://nodejs.org/api/sqlite.html), and [BM25S mmap approach](https://github.com/xhluca/bm25s). Graphmory's measured profile, not external throughput claims, motivates this specific experiment.
