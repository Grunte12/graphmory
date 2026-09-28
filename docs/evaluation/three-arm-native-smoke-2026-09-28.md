# Three-arm native retrieval: smoke chronology through smoke3

## Frozen setup and result

The [protocol](three-arm-native-retrieval-protocol-2026-09-28.md) was committed before this run. The new runner wrote a private manifest before preparing one case. It selected the first of the 14 pinned LongMemEval-S development IDs, an **abstention case** with 50 original Markdown notes. It planned three repeats of each actual CLI arm, rotating their order: nine attempts. Source text, complete CLI stdout and local paths remain in the private smoke artifact under `/private/tmp/graphmory-three-arm-smoke1-*`; none is committed.

The smoke **failed**. Basic Memory 0.23.2 indexed zero of 50 embeddings and reported 50 errors, with `Could not load model BAAI/bge-small-en-v1.5 from any source.` Its project-add command succeeded; offline embedding reindex returned exit 1. The dedicated Hugging Face cache recorded in the frozen manifest contained cache metadata but no model weights. The runner preserved three failed Basic Memory search attempts. Graphmory and the native `rg` helper each completed three attempts. All nine planned attempt identities were recorded; no missing or replacement trial. The failed report and checkpoint remain available privately.

| Arm | Completed attempts | Failed attempts | Candidate paths shown or enumerated |
|---|---:|---:|---:|
| Graphmory `recall-loop` | 3 | 0 | 10 per run |
| Basic Memory hybrid | 0 | 3 | none; embedding preflight failed |
| Native file search | 3 | 0 | 50 across 5 pages per run |

This case is unanswerable in the pinned labels. Evidence-recall and QA metrics are intentionally null. The 50 path-ordered `rg` matches show the OR token policy is broad on this question; they do **not** show answer quality. First-page process wall times were approximately 89–97 ms for Graphmory and 41–78 ms for the native-file helper in this smoke. They are one-case diagnostics with different output contracts, and Basic Memory has no valid paired latency. No quality, cost or speed winner is declared.

## Smoke 1 correction gate

At the time of smoke1, the model cache still needed to be populated and verified in the dedicated Basic Memory environment before the next pre-run manifest. The measured phase was to run offline and require exactly one embedding per original note, zero skipped notes and zero embedding errors. The failure also needed its own smoke manifest/report path, without overwriting or reinterpreting smoke1. Separately, the runner needed to distinguish three failed attempts from one failed setup case in its accounting to avoid a misleading combined `failureCount=4` field. A second successful one-case smoke was required before the 14-case batch.

Synthetic helper tests passed 5/5 and the runner passed syntax checks before this smoke. These do not substitute for the failed integration result. The user's vault and sealed holdouts were not used.

## Smoke 2 — indexing succeeded, report parsing failed

Smoke2 used a new manifest and retained its own private report: `/private/tmp/graphmory-three-arm-smoke2-manifest.json` and `/private/tmp/graphmory-three-arm-smoke2-report.json`. Its manifest SHA-256 was `c3efae76d876cc52ef71176d413d5cbe236ba8c0934e7cfe1ccda78f217fac02`.

The report status is **failed**, but the failure was in parsing Basic Memory's Rich-wrapped reindex summary. The reindex process itself exited successfully and reported 50 notes indexed, 50 embedded, 0 skipped and 0 embedding errors. The regex did not tolerate a line break between the skip count and its label. The runner consequently classified all three Basic Memory search attempts as failed. Graphmory and native file search each completed all three attempts. All **9/9** planned attempts are accounted for; the report records `failedAttemptCount=3`, `setupFailedCaseCount=1`, and `plannedAccountingComplete=true`.

## Smoke 3 — complete one-case smoke

Smoke3 used another fresh manifest and report: `/private/tmp/graphmory-three-arm-smoke3-manifest.json` and `/private/tmp/graphmory-three-arm-smoke3-report.json`. Manifest SHA-256: `7ae621ffeb631dd8736ee43444c711fb076b5db8995b70c80dfe13351ee0963d`.

The report status is **complete**. Each of the three arms completed all three attempts, with **9/9** planned attempts accounted for and no failed attempts or setup failures. Basic Memory indexed all **50/50** notes and embedded **50/50**, with **0** skipped and **0** embedding errors.

The selected case is still labeled **abstention** and `answerable=false`; retrieval-quality metrics remain null. Smoke3 confirms the one-case run and its accounting completed, but it provides no evidence about answer quality. The private reports and manifests remain under `/private/tmp`; this note contains aggregate metadata only.

The ensuing [full diagnostic](three-arm-native-full1-2026-09-28.md) completed all 14 cases. Its later runner audit identified integrity safeguards and original-read metrics still missing from the acceptance gate; that limitation is preserved in its report.
