# Semantic cache reuse: correctness and measured resource experiment

## Scope

Follow the [frozen protocol](semantic-cache-optimization-protocol-2026-09-29.md). This experiment tests process-local reuse of an already parsed vector-cache file, retaining the same embedding model, document text, fusion, output order and public cache format. It does not modify personal vaults or evaluate final Curator answers.

**Decision: reject the runtime patch.** The cache-hit microbenchmark improved by 80.77%, but the actual API missed the predeclared 15% median-latency reduction and observed peak RSS increased. Restore the unchanged retrieval implementation; retain the benchmark runner, failure evidence and rejected patch for reproducibility. Do not try another cache variant on these outputs.

## Diagnostic baseline

The existing whole-note BGE hybrid passed the earlier quality screen, but its 300-query process reached approximately 2.12 GiB peak RSS. A separate nine-call cache-hit diagnostic on the same 5,183 notes measured first call 110.42 ms and subsequent median 79.01 ms; no embeddings were allowed or generated.

A Node CPU profile of the first 30 frozen queries contained 19,065 samples. Self samples included cachedDocumentVectors 7.84%, garbage collection 8.51%, and three tokenize frames totaling 20.42%. Reading files, frequency construction and other retrieval work also appeared. This profile includes initial source validation, corpus parse, model load and final validation; self samples are not isolated phase durations or a causal allocation analysis. It supports investigating repeated cache parsing, while showing that keyword-index work is a larger remaining target.

The reproducible runner's baseline cache measurement gave first call 107.12 ms and eight-call warm median 80.56 ms. These measurements are distinct from the earlier diagnostic/profile and from the original 300-query screen. An unmodified baseline bracket was run before and after treatment in separate persistent processes, with the same corpus, model/cache and first 30 frozen queries.

## Completed comparison and gates

| Measured scope | Baseline before | Parsed-cache treatment | Baseline after |
| --- | ---: | ---: | ---: |
| Cache-only first call, ms | 107.12 | 155.62 | Not repeated |
| Cache-only warm p50, ms (8 calls) | 80.56 | 15.49 | Not repeated |
| API first call, ms | 1,009.65 | 1,154.57 | 1,007.01 |
| API warm p50, ms (29 calls) | 781.99 | 774.52 | 830.69 |
| API warm p95, ms (29 calls) | 842.67 | 879.44 | 939.68 |
| API process peak RSS, KiB | 2,052,880 | 3,321,296 | 2,141,632 |
| API final RSS, bytes | 1,851,932,672 | 2,977,726,464 | 1,981,906,944 |

Warm p50 is the median; p95 uses NumPy's linear quantile, excluding the first call. API first calls include model loading with existing disk caches and are not cold installations/index builds. No forced garbage collection or profiler was used in these gated runs.

- **Cache speed gate: PASS.** Warm median decreased 80.77%, exceeding the required 50%.
- **API median gate: FAIL.** Improvement was only 0.96% versus the opening bracket and 6.76% versus the closing bracket; neither reaches 15%. Baseline drift is visible and must not be hidden by choosing the more favorable bracket.
- **API p95 gate: PASS.** Treatment was below 1.1 times the slower baseline bracket; this does not rescue the failed median gate.
- **Observed RAM: worse.** Treatment peak was about 3.17 GiB versus 1.96/2.04 GiB in the two baseline brackets. This is a process observation, not proof of the precise allocation/GC cause or universal RAM requirements.
- **30-query output comparison: PASS.** Every complete result row, including order, paths, scores, titles, lifecycle status and lanes, was identical across the three arms.
- **Full 300-query treatment equality and BEIR re-scoring: NOT RUN.** Stop after the failed speed gate instead of spending more CPU on an already rejected treatment. The existing 300-query baseline scores are preserved; this experiment does not establish full-corpus treatment equality or final-answer quality.

Targeted prototype tests passed 6/6, covering returned-vector mutation isolation, changed-note digest re-embedding, external atomic replacement, deleted/malformed cache files and scope/model separation. Other proposed invariants, including injected write/permission failures and concurrent replacement races, were not fully tested because the performance gate rejected this candidate. Do not describe all correctness gates as satisfied.

## Evidence preserved

- [Rejected two-file prototype and tests](experiments/semantic-cache-rejected-2026-09-29.patch), based on commit `7ac2917`; it is evidence, not shipped runtime code.
- [Aggregate measurements and raw-artifact hashes](experiments/semantic-cache-measurements-2026-09-29.json).
- Private raw cache measurements: `/private/tmp/graphmory-semantic-cache-baseline-micro-v2.json` and `/private/tmp/graphmory-semantic-cache-treatment-micro-v1.json`.
- Private complete API rows: `/private/tmp/graphmory-semantic-cache-baseline-before-api-v2.json`, `/private/tmp/graphmory-semantic-cache-treatment-api-v1.json`, `/private/tmp/graphmory-semantic-cache-baseline-after-api-v1.json`.
- Private CPU profile: `/private/tmp/graphmory-semantic-baseline-30-v1.cpuprofile`; analysis: `/private/tmp/graphmory-semantic-cache-analysis-v1.json`.

## Correctness design

The rejected prototype uses the following design. The existing cache filename already separates resolved vault, scope, model and maximum document characters. One retained parsed file can be invalidated by an absolute-path plus filesystem signature including dev, ino, size, mtimeNs and ctimeNs. Markdown semantic-text digests must still be computed on each request: the filesystem signature controls reparsing the vector JSON, not trusting changed note content.

Re-stat around a disk read before retaining it; clear the retained entry on malformed/missing data and cache writes. Return defensive vector copies so callers cannot mutate a retained cache through the exported Map. Keep generated rows separate until successful disk writes. Do not mask permission/read failures with stale cache contents.

Node documents [BigInt stat fields and nanosecond timestamps](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html#fsstatsyncpath-options), [CPU profiling](https://nodejs.org/api/cli.html#--cpu-prof), and [resourceUsage peak RSS in KiB](https://nodejs.org/api/process.html#processresourceusage). RSS bytes and disk model-file sizes are different quantities. This uses a conventional cache-invalidation mechanism, not a new semantic retrieval method.

## Reproduction

Use a pinned prepared corpus and an already built vector/model cache. The cache-hit mode intentionally fails rather than start embedding documents when cached vectors are absent. Each output is preserved; errors retain an incomplete ledger. The API mode measures actual recall calls in one persistent process, with the first call reported separately.

```sh
node scripts/benchmark-semantic-cache.mjs \
  --prepared <prepared-scifact> --model-cache <existing-model-cache> \
  --out <new-cache-timing.json> --mode cache --count 9
node scripts/benchmark-semantic-cache.mjs \
  --prepared <prepared-scifact> --model-cache <existing-model-cache> \
  --out <new-api-timing.json> --mode api --count 30
```

For a preserved baseline module, add `--module <baseline-module.mjs>`; preserve its SHA and resolve its existing relative imports to the unchanged repository modules and Transformers.js package. This relocates import paths only; do not alter the baseline algorithm. Full quality equality uses `scripts/export-beir-existing-semantic.mjs` and unchanged BEIR scoring from the previous report.

To reproduce the rejected candidate, apply its preserved zero-context patch with `git apply --unidiff-zero` to an isolated checkout of `7ac2917` and run the same benchmark script against that module; do not apply it to a user's installed runtime or personal vault. Baseline raw v2 manifests preceded the addition of planned-call metadata and a cache-vector-count assertion to the runner. The timed API loop is unchanged; treatment and closing runs record planned slots. This bookkeeping difference is preserved rather than rewriting raw outputs.

## Limitations and next decision

Process-local reuse cannot remove initial JSON parsing from a new CLI process. A persistent-process gain is not evidence of cold CLI, install, Curator/Lead or user-visible latency improvement. Independent holdout contents remain unopened. Even a passing cache experiment does not establish supported complete answers, citation correctness, abstention or cross-tool superiority.

The larger tokenization/index cost needs a separate frozen reuse experiment if it remains a bottleneck; do not repeatedly tune the model or ranking on these exposed questions to manufacture quality gains.

Grok for codex was assigned a source-linked research brief in the existing Grok Bot session: maintained reusable indexing implementations, incremental invalidation, cold CLI versus persistent-process evidence, and up to five Reddit/X practitioner threads, using its own browser. Its research is pending; no recommendation or benchmark claim from that work is adopted yet.

The first acknowledgement proposed HTTP reads and a social API. A follow-up explicitly corrected it to the user's browser-based method, prohibited social API calls for this task, and supplied the rejected experiment's measurements. Do not describe the pending social evidence as browser-verified before receiving and checking its report.

## Delivery verification

After restoring runtime and its prototype-only tests, `npm run check` passed all 338 repository tests and the configured example/evaluation gates. The runner failure fixture proves that an empty vector cache records an incomplete attempt rather than accidentally starting model indexing. The preserved rejected patch passes `git apply --unidiff-zero --check` against the unchanged source. Read-only personal-vault status returned `SYNC_CONFIG_NOT_FOUND`; no personal vault writes occurred. The runtime diff is empty.
