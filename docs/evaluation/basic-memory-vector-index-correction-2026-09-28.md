# Basic Memory vector-index correction — 2026-09-28

## Question and controls

Does Basic Memory's *actual* local hybrid search improve evidence retrieval over its text-only mode on the same exposed LongMemEval development cases? The 14 selected case IDs, original Markdown sessions, question-only queries, answerability labels, and top-3/top-12 evidence scoring were held fixed. Basic Memory 0.23.2 used an isolated per-case local project; reranking stayed disabled. This is retrieval-only, not answer or Curator quality.

## Invalid rounds preserved

The first [14-case `--hybrid` run](../../eval/competitor-pilot/hybrid-development-2026-09-28.json) requested hybrid search but called `bm reindex --search`, which builds only the full-text index. Its ordered top-12 paths matched the [text run](../../eval/competitor-pilot/question-only-results.json) in all 14 cases. It is **invalid as a semantic comparator** and excluded from the result table. The installed Basic Memory CLI's `reindex` implementation explicitly runs embeddings only with `--embeddings` or the no-flag default.

Two [vector-only](../../eval/competitor-pilot/vector-three-preflight-2026-09-28.json) [diagnostics](../../eval/competitor-pilot/vector-three-title-smoke-2026-09-28.json) exposed two separate evaluator problems: an FTS-specific known-item smoke test unsuitable for vector search, and then zero vector candidates because the embedding index was empty. The first two [embedding-enabled](../../eval/competitor-pilot/vector-indexed-one-preflight-2026-09-28.json) [attempts](../../eval/competitor-pilot/vector-indexed-one-fixed-2026-09-28.json) actually embedded 50 entities but were marked failed by a parser that did not allow the CLI's wrapped summary lines. These remain infrastructure failures, not zero-recall observations.

The evaluator now calls `bm reindex --search --embeddings --project pilot` in semantic modes and requires a parsed, nonzero embedded count with zero errors in *each* case. It records index/model/counts. Its vector smoke checks the exact title separately from target ranking. A [three-case vector-only diagnostic](../../eval/competitor-pilot/vector-indexed-three-2026-09-28.json) then ran 3/3 cases with 46–53 embedded entities, zero errors, and nonempty target candidates. In its answerable case, top-3 evidence recall was 1; two cases are abstention probes without recall labels.

## Valid paired 14-case result

| Treatment | Successful cases | Complete evidence @3 | Mean evidence recall @3 | Complete evidence @12 | Median ingest | Median warm CLI search | Median warm output |
|---|---:|---:|---:|---:|---:|---:|---:|
| Basic Memory text | 14/14 | 8/12 | 0.7917 | 12/12 | 4.826 s | 2.007 s | 53,749 B |
| Basic Memory hybrid, vector index verified | 14/14 | 10/12 | 0.9375 | 12/12 | 35.462 s | 1.978 s | 84,328 B |
| Graphmory BM25, question-only | 14/14 | 10/12 | 0.8958 | 12/12 | separate harness | in-process | separate format |
| Graphmory baseline, question-only | 14/14 | 10/12 | 0.9167 | 12/12 | separate harness | in-process | separate format |

The valid [hybrid report](../../eval/competitor-pilot/hybrid-indexed-fourteen-2026-09-28.json) records `sqlite-vec`, `FastEmbedEmbeddingProvider:bge-small-en-v1.5:384`, 46–53 embedded entities per case, and zero embedding errors. Versus Basic Memory text, hybrid improved top-3 recall in three answerable cases, worsened none, and changed ordered top-12 paths in 13/14 cases. Two of those improvements turned incomplete @3 into complete @3. Both modes retained all evidence by @12. The median ingestion time was about 7.3× text-only; warm CLI query time was similar. A single-machine serial development pilot does not give a reliable cost or p95 claim.

Graphmory rows come from the existing [matched question-only report](../../eval/competitor-pilot/graphmory-question-only.json). They share case IDs/query format, but ingestion and timing implementations differ. Complete @3 ties between Graphmory and Basic Memory hybrid; mean recall differs on just 12 answerable cases. This does **not** establish superiority or noninferiority of complete memory workflows. Both abstention cases returned candidates; that is neither a correct nor incorrect answer judgment. No gold answer was sent to a model, and no personal Obsidian vault was used.

The tie hides different misses: Graphmory's `baseline` was incomplete @3 on `945e3d21` and `gpt4_d84a3211`; Basic Memory hybrid was incomplete on `67e0d0f2` and `gpt4_d84a3211`. This suggests complementary ranking signals, but no fusion result or unseen-set gain is claimed. Since all answerable evidence was already present by @12, the observed benefit is ranking early evidence rather than rescuing missing evidence in this slice.

## Decision

Keep Graphmory's default unchanged. The competitor's real semantic lane can move evidence into the first three results on some cases, so semantic retrieval is worth a controlled Graphmory prototype. First test a lightweight semantic candidate lane behind an opt-in flag with the same cases and a new independent holdout; count installation size, initial indexing, warmed query time, and actual Curator source reads. Promote only if supported-complete answer quality improves or is at least preserved while whole-workflow cost/latency meets the [acceptance gates](optimization-goal-2026-09-28.md). Do not use this exposed set as unseen validation.
