# Progress review: stop incremental tuning and inspect evidence

## Latest actual run

The first full three-arm native retrieval batch finished with 14 exposed LongMemEval-S cases, three repeats per arm, 126/126 recorded successful attempts. Frozen manifest SHA-256: `93b418112c257b829d13169e2b00cc76aa0c5362167431291a0c5897ae4729b1`. Raw source-bearing artifacts remain private at `/private/tmp/graphmory-three-arm-full1-*`.

The [full source-free report](three-arm-native-full1-2026-09-28.md) records every selected case; the [smoke chronology](three-arm-native-smoke-2026-09-28.md) preserves both setup failures and the successful smoke. They must be read with the run's missing safeguards below.

| Arm | Complete Evidence@10 | Complete Evidence@3 | Mean Recall@10 | Median search process wall time |
|---|---:|---:|---:|---:|
| Graphmory recall-loop | 12/12 cases in each repeat | 10/12 in each repeat | 1.000 | 94.07 ms |
| Basic Memory native hybrid | 12/12 cases in each repeat | 10/12 in each repeat | 1.000 | 2060.73 ms |
| Native file search, OR tokens, path order | 0/12 cases in each repeat | 0/12 in each repeat | 0.125 | 250.27 ms, all pages |

Repeats are not 36 independent questions. The two abstention cases are excluded from evidence scores. The file baseline has no relevance ranking: its @10 result is not representative of all ordinary file-search workflows. Graphmory/Basic times are bounded-list searches; the file number includes all pagination. Serialization contracts differ, Basic CLI includes Python/model startup, and no answer model, token cost, or original-read timing is measured. Do not infer full-workflow speed or answer superiority from this table.

Audit found missing safeguards in the runner: added Markdown files were not enumerated by source checks, native pagination integrity failures were not all fatal, and Basic post-search hashes were recorded but not automatically compared. A separate after-run comparison found zero Basic indexed-body drift in all 14 cases. These missing checks and absent original-read timing keep this run a diagnostic, not a full acceptance-gate pass. Preserve it unchanged; any corrected rerun must have a new frozen manifest.

## What the recent work actually covered

- Retrieval scoring/latency: [BM25F optimization](bm25f-optimization-2026-09-27.md), which preserves rankings in its controlled development check.
- Evidence delivery: previews, pagination, source reads, wide full-source prefetch and compact prefetch. [Live three-arm prefetch](prefetch-three-arm-2026-09-28.md) used actual Luna Curator/Sol Lead and native Basic Memory, but only three exposed questions. Prefetch remains opt-in.
- Evaluation validity: [full-history count-label review](full-history-label-review-2026-09-28.md), support rubric/calibration and [RAGTruth results](ragtruth-support-pilot-results-2026-09-28.md). Some reference labels and the support judge were unreliable; their failures were retained, not corrected to favor a treatment.
- Reproducible comparators: native Basic Memory hybrid index and native `rg` helper, matched datasets, frozen attempts and source hashes; [protocol](three-arm-native-retrieval-protocol-2026-09-28.md).

## Process correction

Recent work has concentrated on evidence delivery and evaluation plumbing, with many small variants and audits. It has not demonstrated a new generally superior semantic retrieval architecture. Too much iteration before a concise cumulative decision report slowed movement toward the full objective. More subagents do not shorten sequential ingestion or strengthen weak samples.

Pause new experiment variants at this checkpoint. First consolidate retained/rejected changes and the actual correctness bottleneck. Then compare distinct research-backed alternatives under one preregistered evaluation, with at most one controlled implementation revision per alternative before deciding to retain or reject it. Do not tune on the sealed holdout. Supported-complete answers, abstention and citation support remain the primary gates; retrieval recall and latency are secondary diagnostics. No claim of superiority over untested tools is justified.
