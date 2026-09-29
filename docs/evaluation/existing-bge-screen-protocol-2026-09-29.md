# Existing BGE hybrid: frozen development screen

Completed results and the next integration gates are recorded in [the result report](existing-bge-screen-results-2026-09-29.md). The settings and decision bar below were preserved before the run.

Before the 300-query semantic run, preserve the current implementation rather than invent another retriever. `scripts/export-beir-existing-semantic.mjs` calls actual `recallVaultSemantic`; no scoring labels enter its query work list. This is a diagnostic of an existing optional lane, not yet an integration into the Curator.

## Inputs and settings

- Same complete 5,183-note SciFact Markdown corpus, all 300 exposed test queries, and pinned archive/query hashes in [the baseline report](beir-markdown-baseline-2026-09-29.md).
- Existing Transformers.js 3.8.1 and `Xenova/bge-small-en-v1.5`; default pipeline dtype (observed fp32/CPU), mean pooling, normalized vectors.
- Unchanged whole-note representation, at most 8,000 body characters; cached document vectors; query encoder; existing cosine ranking, BM25F-section lane and RRF (constant 60).
- Existing 20 candidates per sparse/vector lane; output depth ten. Preserve these limits as part of the tested baseline; they are not a desired universal Curator evidence cap.
- Model files: four cached files, 133,805,935 bytes. Private model-file hash manifest `/private/tmp/graphmory-beir-bge-model-files-v1.json`, SHA-256 `ff3aeb9d98aa209a5121814c3133a52bfaa9867c06fceff69ad6f9474caef888`. These file bytes are **not peak RAM**.

The initial preflight calls the same API on the first query in the frozen sorted book. It completed in **638.795 seconds**, scanning all 5,183 notes without a scan-limit flag and returning ten results. The finished cache contains 5,183 vectors in a 60,396,377-byte JSON file. Preserve its output/log under `/private/tmp/graphmory-beir-bge-preflight-v1.*`. Its runtime includes model download and initial indexing and must not be described as query latency. No first-query quality result is used to choose or alter the 300-query screen.

## Run and decision rules

Run all 300 once in the same order, preserving completed slots and any failure without replacements. Score with unchanged BEIR using only @1/@3/@5/@10, because semantic output is ten results. Compare @10 to preserved lexical runfiles. Record first-call versus subsequent API time separately; this includes vault/vector-cache IO and inference. This warm persistent-process screen does not establish cold CLI or Curator/Lead workflow latency. External process inspection was unavailable; record Node's own `process.resourceUsage()` and final `process.memoryUsage()` in the subsequent 300-query runner. The original preflight lacks those fields; report that missing rather than substituting model-file size.

Do not tune weights, model/dtype, candidate limits or question selection after outputs. A mean Recall@10 gain of at least 0.02 with no mean nDCG@10 loss is the preregistered bar to justify a subsequent optional integration experiment; examine per-query losses and paired uncertainty regardless. This is a development-screen decision, not a default-promotion gate. If it fails, do not retrofit the same run; evaluate section granularity as a distinct architecture only if the error audit supports that gap.

Any default change still requires matched supported-complete memory answers, citation support, abstention and latency/token gates plus independently frozen confirmation. NFCorpus contents remain unopened and unused. Its source overlap with development has not yet been checked, so it is a reserved confirmation corpus, **not a proven source-disjoint holdout**. Verify overlap at confirmation time without tuning from its results.

## Runtime and upstream usage checkpoint

At one permitted process snapshot, the original preflight was live after 09:22, using 486.2% CPU and 839,904 KiB RSS (about 820 MiB). This is one instantaneous measurement, not peak RAM or a completed indexing time. It confirms ongoing local computation rather than a missing process; no restart was launched.

Checked [the Xenova ONNX model card](https://huggingface.co/Xenova/bge-small-en-v1.5) and [BAAI's original model card](https://huggingface.co/BAAI/bge-small-en-v1.5). Xenova's example uses mean pooling as Graphmory does, so do not label that a confirmed bug from BAAI's separate CLS example. Both recommend a query instruction for short-query passage retrieval; BAAI also states v1.5 works without instructions and recommends deciding by task evaluation. The current Graphmory query has no instruction. Preserve this baseline, then consider a separately frozen model-card query-instruction comparison using the same document cache; do not alter prompts midway through the current run or assume a gain.
