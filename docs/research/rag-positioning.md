# Where This Fits in the RAG Landscape

## English

### Short answer

Graphmory is **not a complete Agentic RAG system today**.

It is an **agent-controlled memory retrieval architecture** over a canonical, linked Markdown wiki. It has some agentic retrieval behavior and a dependency-free BM25F section retrieval pipeline, but it does not yet include the full iterative retrieval loop, persistent search index, or reranking-by-model pipeline normally expected from a production Agentic RAG system.

### A practical RAG taxonomy

The names below overlap in the literature. Treat them as architectural patterns, not mutually exclusive product categories.

| Pattern | Typical flow | Main additions |
|---|---|---|
| Naive RAG | chunk -> embed/index -> top-k retrieve -> generate | One fixed retrieval pass |
| Advanced RAG | improve query/chunks -> hybrid retrieve -> rerank/filter -> generate | Query rewriting, smarter chunking, metadata, BM25 + vectors, reranking |
| Modular RAG | route among interchangeable retrieval and generation modules | Multiple sources, retrievers, validators, caches, memory, or tools |
| Agentic RAG | agent plans -> chooses retrieval tools -> evaluates evidence -> retrieves again if needed -> answers/acts | Planning, iterative search, reflection, tool use, stopping policy |
| GraphRAG | retrieve entities, relations, neighborhoods, or communities from a graph | Relationship-aware and multi-hop retrieval |

### What this harness has now

| Capability | Status | Current mechanism |
|---|---:|---|
| External durable knowledge | Yes | Canonical Markdown/Obsidian wiki |
| Agent decides what memory is relevant | Yes | Memory curator |
| Bounded retrieval | Yes | Brain Brief with 1-7 items and 0-3 direct-read paths |
| Multi-step link following | Partly | Curator follows project maps and wikilinks |
| Retrieval provenance | Yes | Exact note and evidence paths |
| Conflict handling | Yes | `TENSION` rather than silent overwrite |
| Chunking | No | Notes are already human/agent-sized semantic units |
| Embeddings/vector database | No | Not needed at the current scale |
| BM25/full-text section retrieval | Yes (default) | Dependency-free BM25F section ranking with lifecycle filtering and scope narrowing |
| Hybrid sparse+dense retrieval | Optional | `recall-semantic` fuses BM25F with local Transformers.js embeddings; optional install, not core default |
| Section-focus reranking | Optional | `sectionFocusRerank` via `--rerank` flag; deterministic section-heading signal, not a learned model |
| Automated retrieval-quality loop | No | The curator does not yet score sufficiency and retry systematically |

### So what should we call it?

Preferred:

> Agentic memory retrieval with a compiled Markdown wiki.

Also accurate:

> A RAG-ready memory governance layer.

Avoid for now:

> Full Agentic RAG, Advanced RAG, or GraphRAG.

Those labels would imply retrieval components that are not implemented yet.

### Why not add every RAG technique now?

Each component solves a different measured failure:

- **Smart chunking** helps when source documents are too large or split across bad boundaries. Canonical notes already act as semantic chunks.
- **Embeddings** help when vocabulary differs between the query and the note. They add indexing cost and can return semantically similar but operationally wrong notes.
- **BM25** helps with exact terms, identifiers, error messages, and names.
- **Hybrid retrieval** combines exact and semantic recall when either alone misses evidence.
- **Reranking** helps when the initial retriever returns too many weak candidates.
- **Agentic retrieval loops** help when a single query cannot answer a multi-step question, but they increase latency, cost, and failure surface.

Do not add a component because it is considered "advanced." Add it when an evaluation identifies the failure it fixes.

### Upgrade path

```text
Phase 1 - Current
Project map + wikilinks + bounded curator recall

Phase 2 - Deterministic search (current default)
Dependency-free BM25F section retrieval with lifecycle filtering, scope narrowing, and release-gate thresholds. Persistent indexing is deferred until per-query BM25F latency becomes the bottleneck.

Phase 3 - Hybrid retrieval
Add embeddings plus BM25 when semantic recall failures are measured

Phase 4 - Reranking
Rerank only when candidate precision becomes the bottleneck

Phase 5 - Agentic RAG loop
Let the curator reformulate, retrieve, judge sufficiency, and retry under a cost/step budget

Phase 6 - Graph-assisted retrieval
Use code graph or source-map tools as derived indexes, never as evidentiary truth or canonical operational memory
```

Context compression and graph/source-map tools may complement this architecture later, but neither should silently replace canonical Markdown or provenance.

The repository uses governed BM25F section retrieval as the default recall path. On synthetic stress tests, it meets the release gate thresholds (Recall@3 >= 0.90, current-memory accuracy >= 0.90, MRR >= 0.90, zero polluted queries). Reranking, hybrid semantic lanes, and persistent indexing are deferred until evaluation measures a gap that those components fix.

### Sources

- RAG taxonomy: https://arxiv.org/abs/2312.10997
- Agentic RAG survey: https://arxiv.org/abs/2501.09136
- Agentic RAG systematization and risks: https://arxiv.org/abs/2603.07379
- Contextual chunks, hybrid retrieval, and reranking: https://www.anthropic.com/research/contextual-retrieval
