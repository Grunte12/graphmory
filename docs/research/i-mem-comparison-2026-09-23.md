# I-MEM and Graphmory: repository comparison

Date: 2026-09-23. This comparison uses an existing local I-MEM checkout for its current working state, a temporary GitHub `main` clone for the published tests, and the current Graphmory checkout. No files in the existing local I-MEM checkout were changed.

Historical snapshot, not the current runtime inventory. Update 2026-09-27: Graphmory now caches semantic document vectors outside the vault by content hash, reusing unchanged vectors; see [managed retrieval](../guides/managed-retrieval.md) and `cachedDocumentVectors` in `src/semantic-recall.mjs`. The performance row and experiment advice below describe the earlier inspected revision. This correction does not change the recorded benchmark results or establish a new end-to-end speed advantage. I-MEM's later state has not been rechecked here.

## Recommendation

Use **Graphmory as the operational base** for further tool development and personal Obsidian use. Keep **I-MEM as the academic research artifact** with frozen datasets, dated corrections, and publication material. Port individually measured retrieval improvements into the operational base; do not merge the research tree wholesale. If a single repository must be chosen for running the system, choose Graphmory.

## Evidence

| Dimension | Graphmory | I-MEM | Assessment |
|---|---|---|---|
| Installation and use | CLI, installer, agent skill/adapters, doctor, vault bootstrap, sync, conflict and restructure flows | Private research package; no CLI install or curator runtime | Graphmory is much further along as a usable tool |
| Retrieval baseline | BM25F section recall, one-hop links, recall loop, optional semantic CLI; scope pruning and semantic-confidence fixes in this checkout | Three lexical lanes with standard RRF; optional bidirectional link lane; isolated semantic API | I-MEM had the better fused ranking on the shared fixture; its RRF fix has now been ported into Graphmory |
| Lifecycle governance | Rich write/sync lifecycle checks; `deprecated` retrieval exclusion ported in this checkout | Excludes deprecated in published `main`; reports tension | Both now align on this eligibility rule |
| Research traceability | Broad deterministic tests and evals, fewer frozen academic narratives | Frozen 54-note/34-question set, dated raw logs and corrections, negative ablations, paper and bibliography | I-MEM is stronger for publication |
| Performance engineering at the inspected revision | In-process WeakMap caches, CLI file scan each call; semantic embeddings recalculated each call at that revision | Same underlying limitations at that revision | Neither had demonstrated optimized end-to-end latency or persistent embedding cache in this comparison; see the later Graphmory update above |

The existing local I-MEM branch is three commits behind GitHub `main`, with substantial uncommitted academic reorganization. Its `src/memory-recall.mjs` working change only updates a document path; the runtime retrieval behavior matches its checked-out commit. `npm test` passed 43/43 there. The published clone passed 49/49. Graphmory's `npm run check` passed after the ports.

On the same committed I-MEM public fixture (54 notes, 34 frozen questions, k=3), the published I-MEM `recall-loop` scored Hit@3 **91.2%**, Recall@3 **89.7%**, MRR **0.869**. Graphmory before the RRF port scored Hit@3 **88.2%**, Recall@3 **86.8%**, MRR **0.865**. After changing `fuseRankedLanes` from `1/(rank+1)` to standard `1/(60+rank+1)`, Graphmory scored **91.2%**, **89.7%**, **0.869** on the same script and fixture. This is one small public research corpus, not proof of general superiority.

I-MEM's opt-in bidirectional wikilink lane is a useful experiment, but its own end-to-end ablation shows regression when added to the already fused default: Hit@3 **91.2% → 88.2%** and Recall@3 **89.7% → 86.8%**. It should not be enabled as a default without a new measured design. The I-MEM paper also explicitly says its curator runtime and persistence adapter are proposed architecture rather than shipped code.

## Jev experiment

The user's intended Jev role is candidate relevance scoring after keyword and semantic retrieval. Keep RRF as a deterministic candidate fusion baseline, then test Jev as a learned relevance judge over the bounded union. Jev would score short candidate sections against the query, admit the best evidence, and trigger at most one bounded retrieval expansion if none passes. Compare this against local RRF and curator verification for quality, latency, cost, and abstention. The implementation plan is in `docs/design/jev-retrieval-plan.md`.

At the inspected revision, the semantic lane ran separately, re-embedded documents per call, and had no demonstrated end-to-end win in I-MEM. The experiment recommendation then was to persist and invalidate local vectors before running an always-on hybrid/Jev experiment; Graphmory has since implemented that cache as noted above. Hosted Jev would receive the query and candidate excerpts, so live private-vault evaluation requires a separate explicit opt-in and payload preview.
