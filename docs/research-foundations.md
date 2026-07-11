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

## Agentic Retrieval Pipeline Evidence (2026-07)

Evidence supporting the query-understanding -> planner ladder -> answer-composition -> ingestion pipeline documented in `agentic-rag-pipeline-design.md`.

### Query understanding and corpus-internal expansion

Adaptive-RAG routes retrieval strategy by a query-complexity classifier rather than always doing the same amount of work; this harness's cheap-first classification (script/lang detection, temporal/aggregation regex, vault-mined alias expansion before any semantic rung) follows the same adaptive-effort spirit with deterministic rules instead of a trained router. doc2query shows corpus-internal expansion (generating/matching terms drawn from the corpus itself) improves retrieval without hallucinating outside vocabulary, which is why this harness's alias expansion is mined from vault frontmatter rather than LLM-generated. The Elasticsearch ICU tokenizer documents dictionary-based segmentation as the standard fix for non-spaced scripts (Thai, CJK), which is the same problem this harness's `Intl.Segmenter`-based Thai tokenization solves.

Sources:

- Adaptive-RAG: https://arxiv.org/abs/2403.14403
- doc2query: https://arxiv.org/abs/1904.08375
- LLM-assisted PRF survey (RM3 lineage): https://arxiv.org/pdf/2601.11238
- Elasticsearch ICU tokenizer: https://www.elastic.co/guide/en/elasticsearch/plugins/8.19/analysis-icu-tokenizer.html

**Caution:** query expansion driven by an LLM (rather than the corpus itself) has been reported to fail for unfamiliar or ambiguous queries and can hurt worst-case topics even when it helps on average. This is direct evidence for this harness's conservative choice of corpus-internal, vault-mined expansion only, not LLM-generated expansion terms.

Source: https://arxiv.org/abs/2505.12694

### Planner ladder (staged retrieval effort, active/self-reflective retrieval)

FLARE argues retrieval should be triggered only when the model's own confidence signals warrant it ("active" retrieval). Self-RAG trains reflection tokens to critique whether retrieval was needed and whether retrieved content was used correctly. Both are precedent for *adaptive effort* — spend more retrieval work only on queries that need it — not for their specific mechanism (LLM-judged reflection tokens or confidence scores), which this harness deliberately replaces with deterministic staged budgets (rung 1 lexical, rung 2 alias retry, rung 3+ reserved) so the ladder stays auditable and free of per-call model judgment. RRF gives a simple, well-established way to combine multiple ranked lists deterministically if/when the ladder adds a second retrieval method. BEIR's finding that BM25 is a strong, hard-to-beat zero-shot baseline across domains supports keeping BM25F as rung 1 rather than defaulting straight to a heavier method. Anthropic's Contextual Retrieval reports hybrid BM25+embeddings with contextual chunking cut failed retrievals by 49%, which is the direction a later semantic rung in this ladder would take.

Sources:

- FLARE: https://arxiv.org/abs/2305.06983
- Self-RAG: https://arxiv.org/abs/2310.11511
- CRAG: https://arxiv.org/abs/2401.15884 (also cited above)
- Adaptive-RAG: https://arxiv.org/abs/2403.14403
- RRF: https://dl.acm.org/doi/10.1145/1571941.1572114
- BEIR: https://arxiv.org/abs/2104.08663
- Anthropic Contextual Retrieval: https://www.anthropic.com/engineering/contextual-retrieval

**Caution:** CRAG, Self-RAG, and FLARE all use LLM-judged loop control (a model scores its own confidence or critiques its own retrieval and decides whether to continue). This harness deliberately does not adopt that mechanism — it is cited here only as precedent that *adaptive effort itself* is a sound idea, not as endorsement of LLM-judged control loops, which this harness replaces with deterministic staged budgets (fixed rungs, fixed retry conditions, no per-call model judgment call in the retrieval loop).

### Answer composition and attribution

Attributed QA and the ALCE benchmark both treat citation/attribution as a first-class, separately measurable property of an answer, not a byproduct of retrieval. Atlas shows an 11B-parameter model with strong retrieval beats a 540B-parameter model without it on Natural Questions, supporting this harness's bet on small-model-plus-good-retrieval over model scale. REPLUG shows retrieval and generation can be tuned somewhat independently, supporting a pipeline that composes answers from a separately-scored retrieval stage rather than fusing the two into one opaque step.

Sources:

- Attributed QA: https://arxiv.org/abs/2212.08037
- ALCE: https://arxiv.org/abs/2305.14627
- Atlas: https://arxiv.org/abs/2208.03299
- REPLUG: https://arxiv.org/abs/2301.12652

### Abstention

SQuAD 2.0 established that knowing when a question is unanswerable from the given context is a distinct, learnable skill, not a side effect of QA accuracy — this harness's separate abstention-accuracy metric (as opposed to folding abstention into Hit@k) follows that framing. Selective QA under domain shift finds that a single confidence signal does not cover every abstention case across distribution shift, which is evidence for this harness's multi-signal confidence bands (`bounded`/`low`/`none`) rather than one scalar threshold.

Sources:

- SQuAD 2.0: https://arxiv.org/abs/1806.03822
- Selective QA under domain shift: https://arxiv.org/abs/2006.09462

### Ingestion and memory lifecycle

Mem0's extraction-plus-consolidation approach and MemGPT/Letta's tiered memory (working vs. archival) both inform this harness's separation of raw episodic notes from curated/consolidated semantic memory. Zep/Graphiti's temporal knowledge graph work is the precedent for tracking validity windows and supersession rather than treating memory as a flat, timeless store. Lilian Weng's autonomous-agents survey frames memory as one of several first-class agent subsystems (alongside planning and tool use), which is the framing this harness's ingestion pipeline follows.

Sources:

- Mem0: https://github.com/mem0ai/mem0
- MemGPT/Letta: https://arxiv.org/abs/2310.08560
- Zep/Graphiti: https://arxiv.org/abs/2501.13956
- Lilian Weng, LLM Powered Autonomous Agents: https://lilianweng.github.io/posts/2023-06-23-agent/

### Eval gates

Hamel Husain's "Your AI Product Needs Evals" argues that systematic evals, not vibes, should gate changes to an LLM/retrieval pipeline — this harness's hard-fixtures gate (`eval/fixtures-hard`) with per-category floors follows that argument directly. RAGAS gives a concrete example of decomposing RAG quality into separately measurable metrics rather than one blended score, which this harness's per-category Hit@k/Recall@k/MRR/nDCG breakdown follows. BEIR is cited again here as precedent for evaluating retrieval across multiple distinct query distributions (this harness's decoy/paraphrase/near-duplicate/temporal/multilingual/long-note/abstention categories) rather than one aggregate number.

Sources:

- Hamel Husain, Your AI Product Needs Evals: https://hamel.dev/blog/posts/evals/
- RAGAS: https://arxiv.org/abs/2309.15217
- BEIR: https://arxiv.org/abs/2104.08663 (also cited above)

## Project-Specific Hypothesis

The following combination is original to this harness and requires local evaluation:

> A lead agent with full task context should author the durable semantic payload, while a separate curator should control retrieval, placement, linking, conflict detection, and graph hygiene without adding unsupported meaning.

The rationale is information preservation, not an assumption that more agents are always better. For small tasks, direct lead-agent memory may be cheaper. See `evaluation.md`.
