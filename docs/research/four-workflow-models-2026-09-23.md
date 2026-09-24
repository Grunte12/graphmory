# Four coexisting memory workflows and local model candidates

Date: 2026-09-23. This is a product and evaluation plan, not a claim that every workflow has passed a live-vault benchmark. The user chooses a workflow according to their existing agent subscription, willingness to pay for the Jev API, privacy needs, language, and available RAM. No workflow replaces the others.

## Product modes

| Mode | Runtime decision maker | Who pays / where data goes | Current Graphmory status |
| --- | --- | --- | --- |
| 1. Subscription curator | A cheap subagent in the user's host, such as Luna or Haiku, judges bounded retrieval evidence | Uses the host's existing plan or quota; no Jev API call | `curator` retrieval exists. Host subagent/model registration is manual; `graphmory config` stores routing metadata only. |
| 2. Hosted Jev | TypeSafe Jev scores candidate passages after local retrieval | Separate TypeSafe API key and usage charge; shortlisted note excerpts leave the machine after explicit opt-in | `hosted-jev` exists; vault-specific quality, latency, and cost are not measured yet. |
| 3. Local decision | OpenThai-SystemOne or a Laya checkpoint judges candidate passages through a local System One-compatible endpoint | Local compute and RAM; no hosted Jev charge | `local-decision` exists for a compatible server. Presets exist for OpenThai and Laya; actual model weights and RAM are not benchmarked in Graphmory yet. |
| 4. Local light | A genuinely small local relevance model reranks a bounded candidate list; the lead still verifies evidence | Local compute with a strict RAM target | Research candidate only. Do not display as an available Graphmory workflow until its runner and quality/RAM checks are implemented. |

The CLI should continue to do lifecycle/scope filtering, bounded lexical recall, and deterministic RRF candidate fusion before any of these decision makers. A model should see a small candidate set rather than the whole vault. Mode 1 can be the only model the user needs; modes 2–4 are optional choices, not mandatory fallbacks or a tournament for one universal winner.

## What “local Jev” means

[TypeSafe's current model catalog](https://docs.typesafe.ai/models) lists Jev 1.13 and aliases for `POST /v1/systemone`. I found no official downloadable Jev weights or supported local deployment in that catalog. OpenThai and Laya are independent models with a similar typed-decision interface; they are not TypeSafe Jev weights. Avoid labeling them “local Jev” in the console.

## Local candidates, size, and limits

| Candidate | Published size / language | Fit for MPH | Caveat |
| --- | --- | --- | --- |
| [OpenThai-SystemOne](https://huggingface.co/iapp/OpenThai-SystemOne) | 0.8B parameters, BF16; approximately 1.6 GB of weights by arithmetic, before runtime overhead; Thai + English | Mode 3 candidate when Thai quality matters | Its model card reports weakness on summary relevance. No MPH vault benchmark or measured resident RAM. |
| [Laya English](https://huggingface.co/convaiinnovations/laya) | 421M parameters; publisher says about 808 MB checkpoint; 512-token question context | Mode 3 candidate for English decision tasks | Short context and English focus. Do not route Thai to this checkpoint. |
| [Laya multilingual](https://huggingface.co/convaiinnovations/laya-multilingual) | 322M parameters; publisher says about 647 MB checkpoint; 1024-token context; includes Thai | Mode 3 candidate for multilingual vaults and a smaller alternative to OpenThai | Published checkpoint size is not process RAM. Its own model card reports weak zero-shot typed-decision results on some tasks. |
| [MiniLM-L6 MS MARCO cross-encoder](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2) with [ONNX INT8](https://huggingface.co/Xenova/ms-marco-MiniLM-L-6-v2/tree/main/onnx) | 22.7M parameters; about 23 MB ONNX weight file; English | Best concrete candidate to prototype Mode 4 as a relevance *ranker* | Not a Jev/System One model. Scores are not calibrated yes/no probabilities. English training makes Thai suitability unproven. Need a separate local runner, threshold calibration or curator review, and measured resident RAM. |

Model file size is not a RAM guarantee. Record peak resident memory of the full server or Node process, cold-load time, and warm p50/p95 latency on the target hardware before labeling a preset “lightweight.” Avoid preloading multiple Laya checkpoints when RAM is the priority; its [publisher documents](https://huggingface.co/convaiinnovations/laya) that preloading trades memory for language-switch speed.

## Evaluation and release gates

Use the same labeled query set and candidate list for each workflow. Include Thai, English, mixed-language queries, paraphrases, stale/deprecated traps, and genuine no-answer cases. Measure Hit@3, Recall@3, nDCG@3, false acceptance, abstention, p50/p95 end-to-end latency, cold-start latency, peak resident RAM, and paid API cost per 100 queries. Record whether a curator used an existing subscription quota; do not describe it as zero cost. Calibrate each model's threshold separately on a development split, then evaluate on held-out questions.

For Mode 4, require a user-set RAM ceiling and document that the MiniLM candidate is English-first. A Thai-capable ultra-light decision or reranking model has not yet been validated. Until it is, Thai users who need local judging should use Mode 3 or Mode 1. Do not silently treat a ranking score as a Jev `noul` probability or make an unsupported confidence claim.

## Implementation order

1. Preserve all three existing workflows and describe them as coexisting choices in the console and docs.
2. Pin exact local checkpoint identifiers and verify the Laya/OpenThai server contract with live smoke calls. Keep full local mode configurable rather than assuming one model is best.
3. Prototype Mode 4 behind an explicit experimental flag with the 23 MB MiniLM ONNX ranker; preserve the lead/curator evidence check and never use its raw rank score as an admission probability.
4. Measure real RAM and retrieval quality on the same labeled vault queries before adding Mode 4 to the normal console menu.
