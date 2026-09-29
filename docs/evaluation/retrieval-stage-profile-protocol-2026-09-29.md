# Retrieval-stage profile: preregistration

## Question

The rejected in-process JSON-cache prototype sped up a cache-hit microbenchmark but did not materially improve the whole semantic API. Before designing a SQLite backend, isolate which existing stages consume query time on the pinned SciFact Markdown corpus. This is measurement only; no runtime behavior or dependency changes.

## Frozen inputs and methods

- Use the already prepared 5,183-note SciFact vault, original 300-query order and original query/source hashes from its manifest. Profile the first 30 queries, matching the prior CPU profile and API timing screen. Exposed development data; never open the sealed NFCorpus archive.
- One persistent Node 24 process and the existing `Xenova/bge-small-en-v1.5` fp32 CPU model cache. Verify model cache and every source file exist before running. No downloads, model update or new embeddings. A cache miss is a failed experiment.
- For each query time `loadVaultDocuments`, current `governedRank` BM25 and focused BM25F separately, `cachedDocumentVectors` with a throw-on-miss embedding stub, query embedding with the same existing model/pooling/normalization, and the dense dot-product scan/sort. Report model pipeline initialization separately. This decomposed sequence is diagnostic; it is not a substitute for the public `managedRecall` or `recallVaultSemantic` API.
- Record every planned/attempted query, source/code hashes, per-stage milliseconds, process peak RSS, and success/failure. Refuse existing output; write an incomplete ledger before work. Recheck source and code hashes on completion.

## Decision rule and limits

Use median and p95 by stage to identify one dominant stage and the plausible backend optimization. Do not claim speedup from a profile. FTS5 scoring would change BM25F and is not a storage-only optimization; section vectors would change the model input. Preserve current Node 20 compatibility unless a separate product decision changes it. A subsequent index prototype requires its own A/B protocol, complete rank parity, mutation correctness and cold/warm whole-CLI latency gates.

The profiler does not measure Curator or Lead answer quality, full command startup, source reads, prompt caching or monetary cost. OS file cache is warm and uncontrolled. Garbage collection and sequential stage order may shift timings. Report these limits with results. The existing 30-query whole-API before/after bracket remains the latency baseline, not a comparison arm for this profile.
