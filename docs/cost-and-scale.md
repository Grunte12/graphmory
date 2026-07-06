# Cost and Scale

## What the harness makes cheaper

The harness removes several mandatory components from the initial deployment:

- no hosted vector database,
- no embedding API,
- no embedding batch or re-index job,
- no separate retrieval service,
- no raw-history upload,
- and no vector index as a second source of truth.

It does not make memory free. Costs still exist:

- the curator model must interpret retrieval results,
- filesystem or BM25 search consumes local CPU,
- humans or agents must maintain canonical notes,
- and large files still waste context unless retrieval is section-bounded.

## Real Private-Vault Evaluation

A private local evaluation used 23 real project notes and ten manually labeled questions. Note contents and queries were not published.

At `k=3`:

| Method | Hit@3 | Recall@3 | MRR | nDCG@3 | Avg context chars |
|---|---:|---:|---:|---:|---:|
| Lexical whole-note | 70.0% | 55.0% | 0.498 | 0.415 | 50,843 |
| BM25 whole-note | 90.0% | 75.0% | 0.787 | 0.703 | 28,190 |
| BM25 section retrieval | 100.0% | 90.0% | 0.817 | 0.792 | 2,330 |

Section retrieval reduced retrieved context by about 95.4% versus lexical whole-note retrieval while improving recall by 35 percentage points.

This is a private sanity check, not a public benchmark. The dataset is small, manually labeled, drawn from one vault, and intentionally unpublished to avoid leaking personal/project memory. Public claims should rely on reproducible fixtures and release gates.

## Is It More Scalable Than Vector RAG?

It depends on the dimension being scaled.

| Dimension | File-native harness | Vector RAG |
|---|---|---|
| Installation/distribution | Simple files and Node.js | More components and model/index choices |
| Ingestion cost | No mandatory embedding pass | Embeddings and re-indexing required |
| Model context cost | Low with section-bounded retrieval | Low when retrieval/reranking is tuned |
| Search CPU at large corpus size | Linear without a persistent index | ANN indexes scale better |
| Semantic paraphrase recall | Limited | Usually stronger |
| Exact policy/status/provenance control | Native and inspectable | Requires metadata and filtering design |
| Offline operation | Native | Also possible with FAISS, SQLite vector extensions, or embedded Qdrant |
| Concurrent multi-user service | Not built in | Mature databases provide stronger concurrency and access controls |

Vector retrieval is not inherently cloud-only or expensive. Local FAISS, SQLite Vec, and Qdrant Edge show that embeddings and vector search can run locally. The real trade-off is operational complexity, indexing, model selection, stale derived state, memory use, and governance.

## Provisional Operating Ranges

These are engineering starting points, not universal limits:

- **Small curated memory**: project maps plus section retrieval.
- **Medium memory with exact-term failures**: add a persistent BM25/full-text index.
- **Semantic recall failures**: evaluate local embeddings and hybrid retrieval.
- **Large or uncurated corpora**: vector/hybrid retrieval becomes increasingly valuable.
- **Concurrent team service**: add a database/service layer for transactions, identity, and access control.

Raw evidence remains the evidentiary source of truth. Canonical Markdown remains the operational memory at every stage. Indexes should be rebuildable derived views.

## Dependency-Free Scale Benchmark

Run:

```sh
npm run bench:scale
```

Illustrative results from one Windows development machine, using 20 in-memory queries per size:

| Notes | Method | Average query ms | Retrieved context chars |
|---:|---|---:|---:|
| 100 | lexical | 0.69 | 544 |
| 100 | BM25 | 0.30 | 541 |
| 100 | BM25 sections | 1.20 | 168 |
| 1,000 | lexical | 1.55 | 547 |
| 1,000 | BM25 | 2.11 | 544 |
| 1,000 | BM25 sections | 9.36 | 169 |
| 10,000 | lexical | 13.94 | 550 |
| 10,000 | BM25 | 22.36 | 547 |
| 10,000 | BM25 sections | 113.03 | 170 |

The current implementation recomputes token statistics and sections for every query. It is intentionally a transparent baseline, not an optimized search engine. The roughly linear growth demonstrates the boundary: section retrieval controls model context well, but a persistent local index becomes appropriate as corpus size and query concurrency grow.

## Pain Points This Architecture Targets

- vector similarity can retrieve a semantically close but stale or out-of-scope policy;
- chunking can detach a claim from status, date, scope, and provenance;
- embedding model changes require re-indexing;
- deleted or edited source files can leave stale vectors;
- every extra retrieval service adds deployment and observability work;
- storing raw conversations creates noisy memory and privacy risk;
- many coding-agent memories are already structured decisions rather than unstructured document archives.

## Pain Points The Architecture Does Not Solve

- semantic search across very large or multilingual corpora;
- high-concurrency team access;
- automatic authorization inherited from source systems;
- uncurated PDF and transcript ingestion;
- approximate nearest-neighbor search at very large scale;
- guaranteed correctness of curator judgment.

## Sources

- Anthropic Contextual Retrieval: https://www.anthropic.com/research/contextual-retrieval
- FAISS: https://github.com/facebookresearch/faiss
- SQLite Vec: https://sqlite.org/vec1
- Qdrant local and embedded options: https://qdrant.tech/documentation/
- Episodic-semantic memory evaluation: https://arxiv.org/abs/2605.17625
- Consolidation failure evidence: https://arxiv.org/abs/2605.12978
