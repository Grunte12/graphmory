# Evaluation data

Fixtures, queries, labels and recorded results used by `npm run eval` and by the reports in [`docs/evaluation/`](../docs/evaluation/README.md). Dated files are snapshots and are not edited after a run. See the [evaluation overview](../docs/evaluation/evaluation.md) for how to reproduce them.

| Folder | Contents |
|---|---|
| `adaptive-graph/` | Synthetic vault and queries for the experimental bounded graph retrieval loop |
| `bm25f-optimization/` | Paired warm-run timing results for the BM25F optimization |
| `competitor-pilot/` | Comparison pilot with Basic Memory; has its own README |
| `curator/` | Candidate Memory Patch writers for the patch-quality evaluation |
| `fixtures/` | Small synthetic notes used by tests and evaluations |
| `future-task/` | Scenarios and candidates for the future-task evaluation |
| `graph-hard/` | Hard graph challenge v1; has its own README |
| `graph-structure/` | Synthetic vault, queries and results for graph structure |
| `judge-calibration/` | Labels and manifests for calibrating evaluators |
| `learning-loop/` | Candidates for the learning-loop evaluation |
| `live-agent/` | Anonymized incidents and the 2026-08-01 live pilot; has its own README |
| `local-rerank/` | Script that serves a local cross-encoder for the local rerank workflow |
| `locomo/` | Development split derived from LoCoMo (CC BY-NC 4.0, non-commercial use) |
| `longmemeval/` | Session-retrieval pilot on LongMemEval; has its own README |
| `memory-management-ab/` | Synthetic A/B on store, skip or escalate decisions; has its own README |
| `opencode-curator/` | OpenCode Curator configuration used by evaluation runs |
| `patch-quality/` | Candidate patches of different quality for the patch-quality scorer |
| `ragtruth-support-pilot/` | Public manifest and scores of a source-support pilot |
| `reader-pilot/` | Manifests, fixtures and scores of the reader A/B experiments from September 2026; includes LoCoMo-derived data |
| `real-vault/` | A vault of research-paper notes used as a realistic structure, with queries and reformulated queries. Despite the name it is a fixture, not a personal vault |
