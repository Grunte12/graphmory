# Research source map

This file records which sources change the architecture and which sources were reviewed but excluded.


## Adopted Foundations

| Source | Evidence used | Architectural consequence |
|---|---|---|
| [Anthropic: Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Context is finite; load identifiers and evidence just in time | Brain Briefs and bounded direct reads |
| [LangChain: Context Engineering](https://www.langchain.com/blog/context-engineering-for-agents) | Write, select, compress, and isolate context; evaluate whether context changes help | Memory Patch, curator retrieval, section compression, isolated canonical/evidence layers |
| [HumanLayer: 12-factor agents](https://github.com/humanlayer/12-factor-agents) | Own prompts, context, and control flow; use structured outputs and focused agents | Explicit contracts and curator authority boundary |
| [Faulty continuous memory](https://arxiv.org/abs/2605.12978) | Forced consolidation can degrade useful memory; raw episodes should remain evidence | Significance gate, provenance, `BLOCKED`, no automatic rewrite |
| [Episodic-semantic architecture](https://arxiv.org/abs/2605.17625) | Bounded episodic and consolidated semantic memory reduce tokens; RAG remains useful for some historical retrieval | Canonical semantic wiki plus optional future RAG indexes |
| [StructMemEval](https://openreview.net/forum?id=a9vY2sJkf4) | Memory agents benefit from explicit organization | Typed atomic notes and project maps |
| [SimpleMem](https://openreview.net/forum?id=CMveUVer0m) | Structured compression and adaptive retrieval improve efficiency | Section-bounded retrieval and future adaptive gates |
| [CraniMem](https://openreview.net/forum?id=Tts94WVw40) | Gated, bounded memory resists distractor noise | Save only durable high-utility memory |
| [Anthropic: Contextual Retrieval](https://www.anthropic.com/research/contextual-retrieval) | Hybrid retrieval and reranking improve retrieval, with cost/latency trade-offs | Evaluate BM25, embeddings, and reranking separately before adoption |
| [STALE](https://arxiv.org/html/2605.06527v1) | Long-term agents must recognize when remembered state is no longer valid | Add stale-belief and premise-resistance cases to the evaluation plan |
| [Typed memory and provenance-role collapse](https://arxiv.org/html/2605.25869v1) | Provenance can blur when generated memory is treated like source evidence | Separate evidentiary truth from operational synthesis |
| [Codebase-Memory](https://arxiv.org/abs/2603.27277) | Deterministic code graphs can reduce broad code exploration for structural questions | Keep graph retrieval as an eval-gated derived index |
| [SQLite FTS5](https://www.sqlite.org/fts5.html) | Local BM25/full-text indexing is available without a separate retrieval service | Use persistent FTS only when corpus size or measured scan latency justifies it |

## Discovery Source

[Awesome Agent Harness](https://github.com/Picrew/awesome-agent-harness) is a useful catalog for discovering harnesses, benchmarks, observability, and context tools. It is not treated as primary evidence; claims must be traced to the linked project, paper, or official engineering report.

The broader discovery and filtering method is documented in [Independent NotebookLM Review](notebooklm-review.md).

## Reviewed but Excluded

[StockAgent / arXiv:2407.18957](https://arxiv.org/abs/2407.18957) studies LLM-based stock-trading simulation. It may be relevant to financial multi-agent systems, but it does not evaluate coding-agent memory, context retrieval, consolidation, or harness cost. It is therefore excluded from this project's architectural evidence.

## Summary

- Anthropic and LangChain support selecting only the context that is needed instead of loading everything.
- 2026 memory work supports separating episodic evidence from semantic memory, and warns that consolidating too often can make memory worse.
- HumanLayer supports structured outputs, focused agents, and controlling context and control flow in the tool itself.
- RAG work supports hybrid retrieval and reranking, but accepts the latency and system cost.
- Our architecture keeps the source evidence separate from Markdown, which is the canonical operational memory, and leaves BM25, vector and graph indexes as derived indexes to be added when evals show they are needed.
