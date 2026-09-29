# Index reuse research: evidence and pending decisions

## Research provenance

Grok for codex supplied a research report on 2026-09-29, then a five-post X supplement through the user's authorized twitterapi.io channel. Reddit sources were read through the browser; X sources through that API. The saved original reports are local experiment evidence, not shipped full quotations. Community claims below have not been independently reproduced and do not establish Graphmory performance.

The earlier prohibition on social APIs was superseded by the user's explicit authorization for Grokbot's twitterapi.io access. No credentials are recorded here.

## Community observations

| Source | Observation reported by Grok | Use in our decision |
|---|---|---|
| [BM25S author, 2024-10-17](https://x.com/xhluca/status/1846624251643564043) | Memory-mapped loading reduced memory and load time in the author's MSMarco setup. | Investigate mmap; do not transfer those numbers to our Node CLI. |
| [qmd vault report, 2026-01-26](https://x.com/andrarchy/status/2015783856087929254) | Describes a 600-plus-note vault and argues that an individual retrieval lane can suffice. Post reportedly attributed to an AI assistant. | Anecdote, not evidence that hybrid or reranking hurts our quality. |
| [Memory-stack failure report, 2026-08-12](https://x.com/fucckt332/status/2087394552004948386) | Reports a remote semantic recall failure without a useful error. | Reinforces explicit lane-failure reporting; not a sqlite-vec failure. |
| [OpenClaw memory design, 2026-02-14](https://x.com/StevenDarlow/status/2022481842365174111) | Describes richer local embeddings and a lower-RAM lexical alternative, without measured RAM. | Keep optional retrieval components and a working lexical default. |
| [BM25S agent-memory post, 2026-02-08](https://x.com/fujikanaeda/status/2020361079927500961) | Describes a file-watcher approach without measured persistence/update behavior. | A watcher is an integration option, not proof of index consistency. |

## Candidate next experiment

Grok recommends a persistent SQLite index to avoid retokenizing the entire corpus and reparsing JSON vectors for each query. That is a hypothesis to validate, not an approved implementation. Primary references are [SQLite FTS5](https://www.sqlite.org/fts5.html), [Node SQLite](https://nodejs.org/api/sqlite.html), [BM25S](https://github.com/xhluca/bm25s), [sqlite-vec](https://github.com/asg017/sqlite-vec) and [MiniSearch](https://github.com/lucaong/minisearch).

A store-only experiment must preserve Graphmory's current tokenizer, per-field scoring, whole-note vectors, note identifiers and fusion. Using FTS5's built-in ranking would change the algorithm; switching whole-note vectors to section vectors would change representation. Neither can be called a pure cache optimization. The report's section-vector schema therefore needs correction before implementation.

Compatibility with the advertised Node 20 minimum, incremental edit/delete/rename equivalence, external vault changes, complete pagination, source hashes and cold-process model initialization all require measurement. A fast index lookup alone is not a fast Curator workflow. Do not introduce a native extension or raise the runtime floor based solely on community anecdotes.

## Current action

First repair the explicit semantic option that the Curator branch ignored, with the [frozen correctness protocol](../evaluation/curator-semantic-integration-protocol-2026-09-29.md). Further index implementation requires its own frozen protocol and measured defect/performance evidence. No holdout has been opened for this research.

## Luna primary-source validation

The read-only validation confirmed the following architectural constraints:

- [Node SQLite](https://nodejs.org/api/sqlite.html) was added in Node 22.5; it cannot implement the advertised Node 20 runtime without a fallback or an explicit support change. Do not change the package engine as a side effect of an experiment.
- [FTS5's BM25 function](https://www.sqlite.org/fts5.html#the_bm25_function) uses hardcoded k1/b and whole-row length normalization. Its column weighting and tokenizer are not equivalent to Graphmory's per-field BM25F implementation. Stored custom postings would need to preserve every field, token form, eligible corpus, tie-break and note-level score.
- [sqlite-vec source](https://github.com/asg017/sqlite-vec/blob/main/sqlite-vec.c) sets a 4096 maximum for vec0 KNN queries. Scalar distance scans are possible but still require full vector computation to enumerate a larger pool. QMD's scalar scan is illustrative, not a promise of unrestricted Graphmory access or latency.
- [BM25S mmap documentation](https://github.com/xhluca/bm25s) supports the large-corpus loading rationale. The [maintainer's incremental-add discussion](https://github.com/xhluca/bm25s/issues/5) documents a rebuild limitation. This Python stack does not preserve the existing dependency-free Node install experience automatically.
- The proposed `vectors(section_id)` schema changes the current whole-note representation and invalidates a storage-only equality claim. Use original note IDs and unchanged vectors for that experiment; section embeddings require a separate arm and protocol.

Recommendation: instrument current stage costs before selecting a persistent store. Measure cold **process** startup with filesystem-cache conditions stated, not an unverified cold OS-cache claim. Any subsequent store prototype must compare unchanged note-level outputs, transactional add/edit/delete/rename consistency, complete reachability and actual whole-command latency/RAM. No component benchmark supplies an end-to-end win.
