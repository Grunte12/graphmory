# Shared summaries and combined retrieval — 2026-10-02

Status: user-approved direction; implementation and comparative evaluation are pending. This note records requirements, not a completed feature or readiness claim.

## Decisions

- Markdown remains canonical. Multiple coding agents may reuse an evidence-linked summary instead of synthesizing the same originals repeatedly.
- A summary is derived knowledge: keep links to originals, source identity, and conditions requiring review. Links alone do not prove freshness or correctness.
- Keyword, semantic, and graph retrieval must participate in the normal pipeline. Semantic is not merely a fallback. Update the older optional-semantic guidance when this integrated path is implemented and verified.
- Curator interprets evidence and writes supported prose. Code enforces schemas, approved targets, lifecycle transitions, provenance, pending operations, and verified receipts.
- Lifecycle decisions that change meaning still need supported intent/approval. Deterministic code applies an authorized decision; it does not decide truth from timestamps or hashes.

## Small implementation sequence

1. Close the existing write blocker: generate approved predecessor status and canonical replacement metadata through the checkpointed workflow. Preserve snapshots, drift checks, full verification, and the pending guard. Repair the evaluator and shipped candidate-status documents; prove update → receipt → fresh-session recall.
2. Integrate keyword, local semantic, and graph candidates behind one normal retrieval entry point. Share scope/lifecycle filtering, deduplicate by canonical note identity, and combine rankings. Return evidence paths and channel/trail information. Paginate so Curator can continue reading related notes; no fixed total three-note cap.
3. Treat the embedding index as rebuildable derived data. Bind entries to source content and embedding-model identity, update changed notes, and remove obsolete entries. A local file index can be sufficient for the initial vault scale; a separate database service is not a requirement. Measure actual model download, memory, cold startup, and retrieval behavior before promising easy setup or speed.
4. Add reusable summaries for recurring questions. Store source references and source fingerprints. Changed, removed, invalidated, or superseded dependencies mark the summary as needing review. Curator refreshes meaning; code checks dependencies and commits the refresh. Detect direct and transitive stale dependencies without following cycles indefinitely. Preserve a route to original evidence and avoid treating summaries as independent corroboration of their own sources.
5. Verify paraphrase-only, exact-identifier, multi-hop, changed-source, supersession, contradictory-evidence, missing-source, and concurrent-edit cases. Record every experiment separately, including failures and model/settings identity.

Summary reuse is application-level caching, distinct from provider prompt/KV caching. Source hashes establish identity/change, not semantic entailment. Token and latency savings remain hypotheses until measured.

## Existing code to reuse

Luna's read-only exploration found the fusion/paging seam in `src/memory-recall.mjs` and managed candidate construction in `src/decision-recall.mjs`. `src/semantic-recall.mjs` already supports optional Transformers.js BGE embeddings with a file vector cache; this is not wired into the normal default. Its input truncation means full-note semantic coverage must be explicitly checked on long-note tests. `src/graph-navigation.mjs` already derives authored relations and links, while the normal lexical link boost is not equivalent to deeper graph traversal. Reuse these modules rather than adding another server or provider abstraction.

Current source handoffs pin originals for an operation, but persistent summary-to-source freshness tracking is still missing. That is an implementation gap, not a completed cache. Apply the latest read-authority guard to all summary and evidence routes; older audit failures must be distinguished from current fixes.

## Hindsight local deployment findings

Official documentation supports local embedded PostgreSQL (`pg0`) with pgvector, local embedding/reranking, and local LLM providers such as Ollama or LM Studio. A self-hosted memory server can also use remote inference. "Local storage" and "fully local inference" are different configurations. Graphmory likewise keeps memory local but its usual Codex/Claude Curator uses hosted inference.

Sources researched by Luna:

- [Hindsight storage](https://hindsight.vectorize.io/developer/storage)
- [Provider configuration](https://github.com/vectorize-io/hindsight/blob/main/skills/hindsight-docs/references/developer/configuration.md)
- [Installation options](https://github.com/vectorize-io/hindsight/blob/main/skills/hindsight-docs/references/developer/installation.md)
- [Recall API](https://github.com/vectorize-io/hindsight/blob/main/hindsight-docs/docs/developer/api/recall.mdx)
- [Mental models](https://github.com/vectorize-io/hindsight/blob/main/skills/hindsight-docs/references/developer/api/mental-models.md)

## Later controlled comparison

No Hindsight installation or direct benchmark occurred in this turn. Install only in an isolated evaluation workspace after the Graphmory default workflow is proven.

Compare end-to-end systems with the same raw corpus, questions, timestamps, accessible LLM, answer/judging settings, and resource budgets; record each system's ingestion, retrieval, and synthesis configuration. Allow their native mechanisms, while accounting for ingestion and inference costs. Separately isolate retrieval with shared extracted evidence and matched embedding/reranking settings when the question is which retrieval strategy helps. Matching only the final answer model does not isolate the cause of a difference. Native coding-agent subscription access must not be assumed to provide an API endpoint usable by Hindsight.

Current readiness evidence: [2026-10-01 reverify](../evaluation/mvp-readiness-reverify-2026-10-01.md). No runtime edits, user-vault changes, model benchmark, commit, or push accompany this decision record.
