# Basic Memory hybrid preflight — 2026-09-28

> Correction, 2026-09-28: this preflight requested hybrid search but its evaluator called `bm reindex --search`, which built only full-text search. The prior statement that semantic indexing was enabled described configuration, not a verified vector index. Its candidate and timing results are diagnostic only, not a valid hybrid comparison. See [the indexed rerun](basic-memory-vector-index-correction-2026-09-28.md).

## Setup and preserved failures

The installed Basic Memory CLI reports 0.23.2. Its local package exposes explicit `search-notes --hybrid` and defaults to FastEmbed `bge-small-en-v1.5`; FastEmbed, ONNX Runtime and sqlite-vec are installed in the isolated venv. At the time of this preflight, the evaluator supported `--hybrid` and requested semantic retrieval but did not build embeddings. Reranking was disabled. Existing text results remain preserved. The output path must be new.

One already exposed LongMemEval development case `09ba9854_abs` was run on identical original Markdown input and question-only text. The [first preflight](../../eval/competitor-pilot/hybrid-preflight-2026-09-28.json) failed parsing search stdout; a separate [diagnostic attempt](../../eval/competitor-pilot/hybrid-diagnostic-2026-09-28.json) retained [raw public-fixture stdout](../../eval/competitor-pilot/hybrid-diagnostic-2026-09-28.json.invalid-search-0.txt). A Hugging Face Xet error could not write its log under the user's cache, and wrote JSON logging before the search JSON. These are preserved infrastructure failures, not zero-recall scores.

The next attempt set HF_HOME and HF_XET_CACHE to an experiment-owned workspace cache. It did not strip arbitrary stdout or modify global user config. [Isolated-cache result](../../eval/competitor-pilot/hybrid-isolated-cache-2026-09-28.json) confirmed all 50 notes indexed, a known-item smoke search, and three successful target searches yielding 12 unique session paths. Reported median warm CLI search was 2.214 s and output 156,004 bytes; ingestion was 4.609 s. This abstention case has no answerable recall metric, and returned candidates do not measure answer abstention. Requested hybrid execution alone does not prove how much vectors contributed or that no backend fallback occurred.

## Decision

Verification after the runner changes: `npm run check` passed 284/284 tests and configured gates. `git diff --check` passed. User vault status remains `SYNC_CONFIG_NOT_FOUND`.

The hybrid harness now has a working one-case infrastructure preflight. No competitor quality or efficiency claim follows. Expand to the existing shared 14-case development slice and inspect embedding/index mode evidence before scoring a hybrid competitor treatment. Keep ingestion, CLI startup, output bytes and failures separate from end-to-end Curator answer quality. No user vault was used or changed.
