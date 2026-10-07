# Hybrid retrieval and reusable summaries

New Curator setup uses keyword, local semantic embeddings and authored note links together. Markdown remains canonical. The embedding cache is rebuildable and outside the vault; there is no vector database server or embedding API. The named host Curator reads originals and synthesizes a brief.

## Setup

Install Graphmory normally with `npm install -g .` from its checkout; do not omit optional dependencies for hybrid retrieval. If an installation omitted them, install `@huggingface/transformers` in that installation's package directory. During guided setup, explain and allow the initial local `Xenova/bge-small-en-v1.5` download. Vector and model files must be outside the vault. Subsequent runs can reuse them; cold initialization still has a cost. The current embedder uses fp32, not a local generative LLM.

`graphmory config` selects hybrid for Curator setup. Existing config files without `retrievalMode` retain lexical behavior for compatibility; explicitly migrate through configuration, or use the flag below. Native host model selection remains in the host's named agent definition.

```sh
node scripts/brain-sync.mjs recall-managed --vault "<vault>" --query "<question>" --retrieval-mode hybrid --agent
```

Continue with `--offset <nextOffset>` while evidence is incomplete and `hasMore` is true. There is no fixed total three-note cap. Returned `lanes` and `graphTrail` explain navigation, not proof or probability. Graph traversal uses up to eight seeds, three edges and 512 visited notes per request; `graphLimitReached` reports truncated traversal. `recall-explore` supports explicit additional exploration. Scan caps and lexical/semantic candidate heuristics mean exhaustive semantic completeness is not guaranteed.

The semantic candidate floor is currently cosine 0.3, an uncalibrated broad navigation heuristic. It may return irrelevant candidates; Curator must review them and may need to reformulate/narrow the scope. Internal overlapping character windows cover the Markdown body, then scores are pooled by original note path. Tokenizer limits can still truncate a window; long dense/non-English text needs separate coverage evaluation. No evidence is replaced with a stored chunk.

`SEMANTIC_UNAVAILABLE` is BLOCKED with a setup next step. Lexical diagnostics can be requested explicitly with `--retrieval-mode lexical`; never report that as all-three hybrid retrieval. Hosted Jev/local decision/reranker paths retain their prior behavior and are not covered by this new Curator integration claim.

## Source-backed summaries

After reviewing originals, ask the tool to generate metadata:

```sh
node scripts/brain-sync.mjs summary sources --vault "<vault>" --paths '["Evidence/A.md","Evidence/B.md"]'
```

The response includes `memory_kind: summary`, `evidence_for` paths and `summary_sources` fingerprints, plus ready-to-copy frontmatter fields. Curator writes concise supported prose, adds these fields alongside the normal rendered patch frontmatter, and preserves evidence links. Do not create a second frontmatter block. Prepare/finish the summary through the normal checkpointed write workflow, including source bindings. The command itself writes nothing.

```sh
node scripts/brain-sync.mjs summary check --vault "<vault>" --note "Project/Summary.md"
```

Changed, missing, inactive or stale transitive sources make the summary stale. Cycles/depth limits are not considered fresh. Normal retrieval excludes stale summaries without editing their files. Direct reuse needs a fresh check. Refreshing requires re-reading originals, checking meaning, generating new fingerprints and checkpointing the supported update. Do not merely update hashes to hide a stale summary.

Fingerprints detect changes; they do not verify entailment, authorization or truth. Summaries and their own sources are not independent corroboration. This is application-level summary reuse, separate from provider prompt caching. The summary routes obey the same pending read guard as other agent-facing content routes.

## Lifecycle writes

An approved patch's `lifecycle.supersedes` lists exact existing predecessor paths, all declared as targets. Curator preserves their bodies and leaves lifecycle fields to `curation-checkpoint finish`. Finish validates bindings and the successor, generates `status: superseded` and canonical `superseded_by`, then runs full persistence and affected graph/lifecycle checks. Conflicting/ambiguous replacement metadata blocks instead of being silently overwritten. Only a completion receipt means the update succeeded; interrupted writes stay pending with existing recovery preimages.

Current readiness and experiment limits: [integration report](../evaluation/hybrid-summary-integration-2026-10-02.md).
