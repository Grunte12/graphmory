# Research Foundations

This project is an engineering synthesis. It does not claim that its exact agent split has already won a published benchmark.

## Directly Supported Components

### Bounded, just-in-time context

Anthropic's context engineering guidance treats context as a limited resource and recommends loading relevant information when needed rather than preloading everything.

Source: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

### Persistent compiled knowledge

Karpathy's LLM Wiki describes an LLM-maintained, interlinked Markdown layer between raw sources and repeated questions. This project adopts the persistent-wiki idea but introduces a stricter semantic-author/curator boundary.

Source: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

### Episodic and semantic separation

Long-horizon memory experiments report benefits from separating immediate episodes from consolidated semantic state under bounded context.

Source: https://arxiv.org/abs/2605.17625

### Gated consolidation

CraniMem reports improved robustness under distractor noise using bounded memory, utility gating, and scheduled consolidation.

Source: https://openreview.net/forum?id=Tts94WVw40

### Preserve evidence

"Useful Memories Become Faulty When Continuously Updated by LLMs" finds that repeated consolidation can degrade useful memory and recommends retaining raw episodes as evidence while gating consolidation.

Source: https://arxiv.org/abs/2605.12978

### Explicit structure and adaptive retrieval

StructMemEval reports that agents benefit when memory organization is made explicit. SimpleMem reports gains from structured compression and adaptive retrieval.

Sources:

- https://openreview.net/forum?id=a9vY2sJkf4
- https://openreview.net/forum?id=CMveUVer0m

### RAG taxonomy and contextual retrieval

The common RAG taxonomy distinguishes Naive, Advanced, and Modular RAG. Agentic RAG adds planning, tool choice, reflection, and iterative retrieval control. Contextual retrieval combines better chunk context, sparse/dense retrieval, and reranking.

Sources:

- https://arxiv.org/abs/2312.10997
- https://arxiv.org/abs/2501.09136
- https://www.anthropic.com/research/contextual-retrieval

## Performance And Efficiency Evidence Related To This Design

This harness is not a full production Agentic RAG stack, so the evidence below should be read as support for individual design choices, not as proof that this repository outperforms every RAG architecture.

| Research area | Reported idea or result | Harness implication |
|---|---|---|
| Agentic RAG | A-RAG studies hierarchical retrieval tools and reports improved multi-hop QA with comparable or lower retrieved-token usage. | Prefer bounded retrieval tools and granularity control over dumping full notes into context. |
| Retrieval self-correction | CRAG adds a retrieval evaluator and corrective actions when retrieved documents are weak. | Retrieval should be scored and gated; this maps to retrieval eval, adversarial eval, and stale/raw pollution checks. |
| Self-reflective retrieval | Self-RAG trains retrieve/generate/critique behavior through reflection tokens. | A memory layer should not treat retrieved context as automatically trusted. It needs critique/eval signals. |
| Agentic RAG surveys | Agentic RAG literature frames planning, reflection, tool use, and iterative retrieval as upgrades over static one-shot RAG. | The harness keeps retrieval agent-controlled: recall, inspect exact paths, produce Brain Brief, then act. |
| Cache-augmented generation | CAG argues that bounded, manageable knowledge can avoid retrieval latency and retrieval errors through cache/preload strategies. | Small, stable project memory can be reused as curated Markdown or Hot Context Packs, but stale control is mandatory. |
| RAG serving cost | RAGCache identifies long knowledge-injected sequences as a bottleneck and reports latency/throughput gains from reusing knowledge states. | Repeated raw-context injection is expensive; the harness should prefer compact canonical context and exact note paths. |
| Prompt reuse | Prompt Cache reports latency gains by reusing repeated prompt segments. | Stable instructions, memory packs, and recurring context should be structured for reuse rather than regenerated every turn. |
| Long-term memory systems | MemoryBank, Mem0, and Graphiti/Zep all emphasize memory extraction, consolidation, lifecycle, provenance, and temporal/relationship awareness. | Markdown memory needs lifecycle fields, provenance, stale/superseded markers, conflict handling, and evals. |

Sources:

- A-RAG: https://arxiv.org/html/2602.03442v1
- CRAG: https://arxiv.org/abs/2401.15884
- Self-RAG: https://openreview.net/forum?id=hSyW5go0v8
- Agentic RAG survey: https://arxiv.org/html/2501.09136v4
- CAG: https://arxiv.org/abs/2412.15605
- RAGCache: https://arxiv.org/abs/2404.12457
- Prompt Cache: https://arxiv.org/abs/2311.04934
- MemoryBank: https://arxiv.org/abs/2305.10250
- Mem0: https://arxiv.org/abs/2504.19413
- Graphiti/Zep: https://arxiv.org/html/2501.13956v1

## Project-Specific Hypothesis

The following combination is original to this harness and requires local evaluation:

> A lead agent with full task context should author the durable semantic payload, while a separate curator should control retrieval, placement, linking, conflict detection, and graph hygiene without adding unsupported meaning.

The rationale is information preservation, not an assumption that more agents are always better. For small tasks, direct lead-agent memory may be cheaper. See `docs/evaluation/evaluation.md`.
