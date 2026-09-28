# Human reference for source-support calibration

## Research decision

Luna reviewed primary sources and recommends **RAGTruth** for external support-judge calibration. Its paper describes roughly 18,000 naturally generated RAG responses with manual hallucination annotations. This addresses a limitation of our author-created synthetic controls. [Official paper](https://arxiv.org/abs/2401.00396).

The author repository supplies response annotations joined to source contexts by `source_id`, train/test split metadata, quality flags and span labels. Several model responses share each source: sample unique sources to avoid sibling dependence. Pin the reported dataset-update commit `1d52a81c9e28e79e252a1945d858eb8dfd975c23`; implementation must validate the actual pinned files and their schema before judging. [Pinned author repository](https://github.com/ParticleMedia/RAGTruth/tree/1d52a81c9e28e79e252a1945d858eb8dfd975c23).

Use a small, frozen train-only pilot, balanced by task and annotated-span presence. Under strict supplied-context support, an annotated span with `implicit_true` still lacks contextual support. Preserve the annotation policy and report agreement with human span labels, not independently certified truth of every claim. Absence of annotated spans does not establish answer completeness. The corpus has no claim-to-citation labels, so it cannot calibrate citation coverage or prove Graphmory retrieval quality.

The repository declares MIT. Embedded upstream corpus redistribution rights were not verified; keep downloaded texts and source-containing review packets local. Publish adapter code, synthetic tests, selection identifiers/hashes and aggregate results. [Repository license](https://github.com/ParticleMedia/RAGTruth/blob/main/LICENSE).

## Boundaries

No corpus or test examples were downloaded for this research step. Actual adapter preparation and model calibration are separate experiments, each requiring a frozen protocol and report. Preserve the original Graphmory LoCoMo/LongMemEval sealed histories. This source audit is not a benchmark result or an acceptance claim.
