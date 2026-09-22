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

Hosted Jev via TypeSafe or Vercel was **not measured** because no API key was available in the process environment, and sending vault excerpts also requires explicit config consent. No private vault content was sent to a hosted model. Agent subscription mode here measures the CLI retrieval that would be passed to Luna/Haiku; it does **not** measure the sub-agent's final answer or curation quality.

Reproduce the deterministic and managed retrieval runs with:

```sh
node scripts/eval-vault-retrieval.mjs --vault /path/to/AgentBrain --queries eval/real-vault/queries.json --k 3
node scripts/eval-managed-recall.mjs --vault /path/to/AgentBrain --queries eval/real-vault/queries.json --k 3
node scripts/eval-managed-recall.mjs --vault /path/to/AgentBrain --queries eval/real-vault/queries.json --config /path/to/runtime.json --k 3
```

For a local CPU reranker, install `fastapi`, `uvicorn`, and `sentence-transformers` in an isolated Python environment, set `RERANKER_MODEL_ID`, and run `uvicorn serve_cross_encoder:app --app-dir eval/local-rerank --host 127.0.0.1 --port 8000`. The benchmark server is optional and intentionally separate from the Node CLI package. Keep `--json` reports private: they include retrieved note paths.
