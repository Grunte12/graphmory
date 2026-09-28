# Semantic cache optimization: frozen correctness and resource gates

## Problem and allowed change

The complete existing-BGE screen found improved retrieval but approximately 2.12 GiB peak RSS and 813 ms subsequent-query median. Inspect the existing path before changing it. Reuse the current model, representation, fusion and cache format; this experiment may change only parsed vector-cache reuse. Do not change document/query text, scores, candidate limits, pooling, dtype or corpus filtering.

Hypothesis: parsing the same 60 MB vector JSON repeatedly creates avoidable IO, CPU work and allocations. Verify it with an isolated cache-hit measurement and a Node CPU profile of the first 30 queries in the already frozen SciFact query order. Profiler timings are diagnostic, not the performance gate.

## Gates fixed before implementation

- Existing full-corpus baseline is the complete 300-query run at commit `7ac2917`. Require exact original-ID ranking equality for all 300 optimized outputs. Re-score with unchanged BEIR; no missing query, scan truncation or source drift.
- Verify changed Markdown is re-embedded, removed notes disappear, and scope/model/text limits stay isolated. External cache replacement, deletion and malformed JSON must invalidate the process cache. Permission/read errors must not silently reuse prior content.
- Retain at most one parsed vector-cache file in process memory. Verify empty and alternating vault caches. A failed embedding/write must not publish a partially updated process cache.
- Cache-hit microbenchmark: same documents and existing disk cache, first call reported separately, no embedding or mutation; at least eight subsequent calls. Target median reduction of at least 50% versus the preserved implementation.
- Main API performance: compare first 30 frozen queries in separate persistent Node processes with the same prebuilt vector/model cache, excluding the first call from warm p50/p95. Preserve an unmodified baseline module for a before/after bracket. Target warm p50 reduction of at least 15%, with p95 no more than 10% worse than the slower baseline bracket. Report resourceUsage peak RSS and final RSS; do not claim a RAM gain unless observed. No forced GC in timed API runs.
- A failed performance gate is recorded as failed even if output correctness passes. A passing cache gate alone does not establish overall latency improvement.

## Limits

SciFact is exposed development data. First-30 timing order is frozen for convenience, not an independent sample. Baseline brackets reduce temporal confounding but do not provide randomized multi-machine evidence. These are local retrieval API measurements, not cold installs, Curator/Lead latency or memory-answer quality. No independent holdout will be opened or used to tune this optimization.

## Basis

This is the conventional reuse of a parsed cache with filesystem invalidation, not a new retrieval strategy. Node documents [CPU profiling](https://nodejs.org/api/cli.html#--cpu-prof) and [process resource measurements](https://nodejs.org/api/process.html#processresourceusage). The existing Markdown-text digest remains the authority for vector reuse; a filesystem signature only controls when to reparse the cache file.
