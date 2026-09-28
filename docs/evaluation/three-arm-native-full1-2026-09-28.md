# Three-arm native retrieval: first full diagnostic

## Frozen run and scope

Manifest SHA-256: `93b418112c257b829d13169e2b00cc76aa0c5362167431291a0c5897ae4729b1`. Dataset SHA-256: `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`. All 14 exposed development cases ran three times per arm: 126/126 recorded attempts, zero failed attempts, zero reported setup or integrity failures. Two abstention cases do not enter recall denominators. Raw source-bearing reports remain private under `/private/tmp/graphmory-three-arm-full1-*`.

The [pre-run protocol](three-arm-native-retrieval-protocol-2026-09-28.md) used actual Graphmory, Basic Memory 0.23.2 native hybrid search with local BGE embeddings, and the native `rg` helper. This is not an official answer-quality benchmark. Repeats are not independent questions.

## Per-case evidence result

Each cell is Complete Evidence@3 / Complete Evidence@10 across three repeats. Gold labels stayed outside tool inputs.

| Case | Graphmory | Basic Memory | Native file |
|---|---:|---:|---:|
| 09ba9854_abs | N/A (abstention) | N/A (abstention) | N/A (abstention) |
| a96c20ee_abs | N/A (abstention) | N/A (abstention) | N/A (abstention) |
| 50635ada | 3/3 / 3/3 | 3/3 / 3/3 | 0/3 / 0/3 |
| 945e3d21 | 0/3 / 3/3 | 3/3 / 3/3 | 0/3 / 0/3 |
| 67e0d0f2 | 3/3 / 3/3 | 0/3 / 3/3 | 0/3 / 0/3 |
| gpt4_d84a3211 | 0/3 / 3/3 | 0/3 / 3/3 | 0/3 / 0/3 |
| a40e080f | 3/3 / 3/3 | 3/3 / 3/3 | 0/3 / 0/3 |
| c7cf7dfd | 3/3 / 3/3 | 3/3 / 3/3 | 0/3 / 0/3 |
| 07b6f563 | 3/3 / 3/3 | 3/3 / 3/3 | 0/3 / 0/3 |
| caf03d32 | 3/3 / 3/3 | 3/3 / 3/3 | 0/3 / 0/3 |
| d52b4f67 | 3/3 / 3/3 | 3/3 / 3/3 | 0/3 / 0/3 |
| 29f2956b | 3/3 / 3/3 | 3/3 / 3/3 | 0/3 / 0/3 |
| gpt4_6ed717ea | 3/3 / 3/3 | 3/3 / 3/3 | 0/3 / 0/3 |
| gpt4_cd90e484 | 3/3 / 3/3 | 3/3 / 3/3 | 0/3 / 0/3 |

## Aggregates

| Arm | Complete@10 attempts | Mean Recall@10 | Median search wall ms | Median CLI stdout bytes |
|---|---:|---:|---:|---:|
| graphmory-recall-loop | 36/36 | 1.000 | 94.07 | 1016 |
| basic-memory-hybrid | 36/36 | 1.000 | 2060.73 | 84020 |
| native-file-search | 0/36 | 0.125 | 250.27 | 60276 |

Graphmory and Basic Memory each achieved 12/12 answerable cases at @10 in every repeat, and 10/12 at @3. File search is OR keyword matching in chronological filename order, without relevance ranking. Its poor @10 is specific to that baseline, not all file search.

Native-file complete evidence across all candidates: 36/36 answerable attempts. It re-runs rg on each page; its search wall column includes all pages. Graphmory and Basic columns represent bounded lists. Raw byte contracts differ substantially; no full-workflow speed or monetary-cost ratio is justified.

## Integrity and missing protocol metrics

Before/after original body hashes were checked. A separate after-run comparison of all 14 Basic post-index versus post-search hash maps found zero drift. Basic native ingestion normalizes Markdown, so its indexed hashes differ from original bodies and were tracked separately.

Audit found that the first runner did not enumerate extra Markdown files, did not treat every native pagination integrity error as fatal, and did not automatically compare the Basic post-search hashes. The run observed no failure, but these missing safeguards weaken its gate coverage. Original-read timing is also absent: no Curator/source-reading phase was executed. Therefore this report is a diagnostic, not a complete acceptance-gate pass. Preserve artifacts unchanged; corrected runs need new manifests.

## Decision

Do not tune ranking on these exposed cases: Graphmory already ties native Basic Memory at the primary retrieval measure. The next research and evaluation should identify source reading, exhaustive aggregation, citation support, or semantic candidate discovery failure on distinct data before selecting an architecture. No defaults are promoted. Supported-complete answer quality, abstention, calibrated judging, independent holdout, and end-to-end token/latency gates remain open.

## Post-run runner repair and verification

After this run, the source verifier was changed to enumerate the exact Markdown inventory and reject symlinks; pagination/snapshot/path invariant errors now stop the planned run; Basic indexed bodies and inventory are compared against their post-index baseline after search. These repairs are for future runs and do not retrofit the original manifest. No second full batch was run. Focused tests passed 7/7, module syntax checks passed, and repository `npm run check` passed 331/331 tests plus configured gates. Read-only user-vault status returned `SYNC_CONFIG_NOT_FOUND`; no personal vault content was modified. Original-read timing remains absent until a separately frozen reader workflow is evaluated.
