# Positioning

## What is original here

This repository is an original integration, not a claim to have invented agent memory or LLM wikis. Its distinct contribution is the contract between:

- lead-agent semantic authorship,
- curator-limited write authority,
- explicit `APPLIED/TENSION/BLOCKED` outcomes,
- provenance-preserving patches,
- lifecycle and stale-revalidation metadata,
- bounded Brain Brief retrieval,
- optional Derived Index and Hot Context Pack contracts,
- and deterministic contract audits.

See [Research Foundations](research-foundations.md) for source-backed design rationale, including Agentic RAG, CAG, caching, prompt reuse, and long-term memory papers. See [Evaluation](../evaluation/evaluation.md) for retrieval and curator behavior checks.

See [Repository Patterns](../design/repository-patterns.md) for why optional graph, compression, MCP, and HTML layers are kept outside the core contracts.

## Is this agentic RAG?

Short answer: Graphmory is agentic memory retrieval over an evidence-grounded Markdown wiki, with a hybrid retriever.

The Curator or lead agent asks scoped questions, receives bounded Markdown note paths, reads the originals and turns them into a cited Brain Brief. New Curator setups combine keyword (BM25F section ranking), local semantic embeddings (BGE) and authored `[[links]]`, fused with Reciprocal Rank Fusion, with lifecycle filtering so stale and superseded notes are not recalled. Legacy configurations stay keyword-only until the owner switches them, and the semantic backend is an optional dependency (`doctor` reports whether it is installed). Generated indexes never become canonical memory.

Read the bilingual guide: [Where This Fits in the RAG Landscape](rag-positioning.md).

The retrieval baseline is documented in [Evaluation](../evaluation/evaluation.md). Synthetic stress tests support governed BM25F section retrieval as a strong local baseline. Earlier private real-vault evals exposed semantic/alias and vault-curation gaps that should be re-evaluated with the current hybrid retriever and `curation-recommend` before making public claims about private-vault effectiveness.

See [Cost and Scale](../evaluation/cost-and-scale.md) for private real-vault results, honest vector-RAG trade-offs and the current scalability boundary. See the [Research Source Map](research-source-map.md) for adopted evidence, discovery-only sources and sources excluded as irrelevant, and the [Independent NotebookLM Review](notebooklm-review.md) for the neutral research pass, seeded critique, accepted changes and rejected overreach.
