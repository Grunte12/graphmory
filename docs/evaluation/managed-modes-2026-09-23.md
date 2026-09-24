# Managed retrieval modes: local vault pilot (2026-09-23)

This is a read-only evaluation of a local Obsidian AgentBrain vault on an Apple M5 MacBook Air with 24 GB unified memory. The vault has 55 Markdown notes, including the original 54-note i-mem research fixture and one extra Obsidian `Welcome.md`. We used the 34 frozen, path-labeled questions in `eval/real-vault/queries.json` at `k=3`. These labels were written for the research fixture; the extra note makes this a useful local regression, not an independent held-out test.

| Workflow / model | Questions | Candidate cap | Hit@3 | Recall@3 | MRR | Mean per query |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Curator handoff, lexical fusion (no model call) | 34 | — | 88.2% | 86.8% | 0.853 | 12.6 ms |
| Local typed decision, OpenThai-SystemOne, threshold 0.6 | 34 | 8 | 64.7% | 63.2% | 0.363 | 8,530 ms |
| Local CPU rerank, MiniLM-L-6-v2 | 34 | 4 | 88.2% | 86.8% | 0.833 | 57.0 ms |
| Local CPU rerank, MiniLM-L-6-v2 | 34 | 10 | 88.2% | 86.8% | 0.853 | 114.8 ms |

The Qwen3-Reranker-0.6B CPU pilot used the first two questions from each of seven categories (14 total), candidate cap 4 and 800-character excerpts. On those **same 14 questions**, curator handoff reached 85.7% Hit@3, OpenThai reached 57.1%, and Qwen3 reached 78.6%; Qwen3 averaged 20,558 ms/query. These numbers cannot be compared directly with the 34-question rows. The local CPU server used `sentence-transformers` `CrossEncoder`, batch size 4. The Qwen3 model file is about 1.1 GB and OpenThai's about 1.4 GB. The Python server used for this benchmark is in `eval/local-rerank/serve_cross_encoder.py`.

On this vault, the lexical top four contain a labeled relevant note in 31/34 questions, the same as top eight. Top ten contain one in 32/34. This sets a ceiling for a reranker that only reorders those candidates. MiniLM did not improve aggregate retrieval quality; the no-model path remains the default for this English research vault. OpenThai remains an opt-in Thai-first typed-decision model, requiring evaluation on Thai labels before choosing a threshold. Qwen3-Reranker-4B 4-bit is a candidate for a quality-oriented Apple Silicon local mode, but **was not measured**: the execution sandbox denied access to Metal during MLX model conversion. The small Qwen3 CPU result does not establish the 4B result.

The original local pilot did not measure hosted Jev. A subsequent consented Vercel AI Gateway run is reported below. Agent subscription mode here measures the CLI retrieval that would be passed to Luna/Haiku; it does **not** measure the sub-agent's final answer or curation quality.

Reproduce the deterministic and managed retrieval runs with:

```sh
node scripts/eval-vault-retrieval.mjs --vault /path/to/AgentBrain --queries eval/real-vault/queries.json --k 3
node scripts/eval-managed-recall.mjs --vault /path/to/AgentBrain --queries eval/real-vault/queries.json --k 3
node scripts/eval-managed-recall.mjs --vault /path/to/AgentBrain --queries eval/real-vault/queries.json --config /path/to/runtime.json --k 3
```

For a local CPU reranker, install `fastapi`, `uvicorn`, and `sentence-transformers` in an isolated Python environment, set `RERANKER_MODEL_ID`, and run `uvicorn serve_cross_encoder:app --app-dir eval/local-rerank --host 127.0.0.1 --port 8000`. The benchmark server is optional and intentionally separate from the Node CLI package. Keep `--json` reports private: they include retrieved note paths.

## Retrieval follow-up on the same vault

An Astra review found that section ranking expanded wikilinks from only the winning section. Graphmory now reads links from the full canonical note while retaining the section score. We also compared the production three-lane fusion with a two-lane fusion of whole-note governed BM25 and focused BM25F sections on all 34 labels:

| Candidate generation | Hit@3 | Recall@3 | MRR |
| --- | ---: | ---: | ---: |
| Previous three-lane fusion | 88.2% | 86.8% | 0.865 |
| Whole-note BM25 + focused BM25F sections | 91.2% | 89.7% | 0.870 |

The two-lane method is now the default for `recall-loop` and managed recall. It scans fewer ranking lanes and improves this regression suite, but requires independent queries before a broad superiority claim. The agent-facing command still returns compact paths and scores; whole-note BM25 does not paste a whole note into its output.

The existing local semantic hybrid (BGE-small English embeddings plus BM25F) reached 83.8% Recall@3 on the same 34 questions. At top ten, it did not recover any label absent from the whole-note BM25 top ten. It remains an **optional escalation**, not a default call. Semantic vectors are now cached outside the vault by note-content hash and model, so unchanged notes are not embedded again. A warm in-process sample took about 13 ms after a 3.5 s cold model load/index build on this machine. The vector cache file is private (`0600`); if weights change under the same model identifier, clear the cache before comparing results.

## Hosted Jev follow-up

After the vault owner authorized a hosted evaluation and the Vercel account passed card verification, we ran the same 34 frozen questions against the same read-only 55-note vault. The benchmark sent only query-specific candidate excerpts, titles, and paths to Vercel's TypeSafe-compatible Jev endpoint. The API key was supplied only to the benchmark process; it was not saved in this repository or the runtime config. The private JSON reports, including retrieved paths, remain outside the repository.

| Workflow | Hit@3 | Recall@3 | MRR | nDCG@3 | Mean / query | p95 / query | Misses |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Curator handoff, two-lane lexical fusion | 91.2% | 89.7% | 0.858 | 0.858 | 11.8 ms | 17.0 ms | 3 |
| Hosted Jev, Vercel AI Gateway, threshold 0.6, candidate cap 8 | 94.1% | 92.6% | 0.912 | 0.908 | 743.3 ms | 1008.0 ms | 2 |

Jev recovered two questions missed by the lexical top three, but also lost one question that lexical retrieval hit. Neither mode abstained on this labeled set. This is a small regression suite drawn from the same research fixture as the vault, not an independent held-out test. The 0.6 threshold was not calibrated on a development split, and the set lacks genuine no-answer cases. Do not make Jev the default on these numbers alone. The current default remains local lexical retrieval, with hosted Jev available as an opt-in quality mode. Measure false acceptance, Thai and mixed-language queries, and a fresh held-out vault before changing that default. Vercel's `typesafe-ai/jev` alias also does not expose a pinned resolved Jev version in the response, so exact version parity with another provider is not established by this run.
