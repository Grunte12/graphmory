# Retrieval pipeline proposal: deterministic where possible, evidence-gated (2026-10-04)

Status: proposal, no code changed. Every stage names (a) the published method, (b) what this repo has already measured, and (c) the experiment that must pass before it becomes a default. Nothing here becomes a default because a paper says so; the paper says what to try, our eval decides.

## What our own evals already show

| Finding | Source in repo |
| --- | --- |
| Two-lane lexical RRF did **not** improve the first ten on BEIR SciFact (nDCG@10 0.665 vs whole-note BM25 0.668); it only added deeper recall (Recall@1000 0.972 vs 0.957) | `docs/evaluation/beir-official-scorer-2026-09-29.md` |
| Lexical + local BGE hybrid reached nDCG@10 0.708 / Recall@10 0.847 on the same SciFact scorer | `docs/evaluation/curator-semantic-integration-results-2026-09-29.md` |
| Local cross-encoder rerank (MiniLM-L-6-v2) did not raise Hit@3 on the 34-question vault (88.2% both); the lexical top 4 already contained a relevant note in 31/34, a ceiling for any reorder-only step | `docs/evaluation/managed-modes-2026-09-23.md` |
| Gated graph expansion: 94.1% → 97.1% Hit@3 on one development set, broad expansion hurt Hit@12; kept opt-in | `docs/evaluation/adaptive-graph-pilot-2026-09-24.md`, `graph-structure-2026-09-26.md` |

Lesson: fusion helps when lanes are **different** (sparse + dense), not when they are two views of the same lexical signal. Reordering cannot fix a candidate that was never retrieved.

## Proposed stages

| # | Stage | Deterministic? | Method and source | Repo status | Gate to make it default |
| --- | --- | --- | --- | --- | --- |
| 1 | Keyword lane | yes | BM25F over sections. Robertson, Zaragoza & Taylor, "Simple BM25 extension to multiple weighted fields", CIKM 2004; Robertson & Zaragoza, "The Probabilistic Relevance Framework: BM25 and Beyond", 2009. BM25 is the strong zero-shot baseline in BEIR (Thakur et al., NeurIPS 2021 Datasets) | shipped | none, baseline |
| 2 | Meaning lane | yes (fixed weights, fp32, no sampling) | Local BGE-small. Xiao et al., "C-Pack: Packaged Resources To Advance General Chinese Embedding" (BGE), 2023 | shipped opt-in; +0.040 nDCG@10 on SciFact | held-out repeat on a second BEIR set (e.g. NFCorpus or FiQA) plus the real vault, no regression in Hit@3 |
| 3 | Fusion | yes | Default: RRF, k = 60. Cormack, Clarke & Büttcher, "Reciprocal Rank Fusion outperforms Condorcet and individual rank learning methods", SIGIR 2009. Candidate: convex combination of normalized scores, which beat RRF once α was tuned on a small labeled sample. Bruch, Gai & Ingber, "An Analysis of Fusion Functions for Hybrid Retrieval", ACM TOIS 2023 | RRF shipped (`fuseRankedLanes`, k = 60) | fuse heterogeneous lanes only (sparse + dense + graph); test convex combination with α fixed on a dev split, report on held-out split |
| 4 | Graph expansion | yes | Replace hop-count BFS with Personalized PageRank seeded on the fused top seeds, fixed damping and iteration cap. Haveliwala, "Topic-Sensitive PageRank", WWW 2002; Gutiérrez et al., "HippoRAG: Neurobiologically Inspired Long-Term Memory for LLMs", NeurIPS 2024 (PPR over a knowledge graph improved multi-hop retrieval on MuSiQue, 2WikiMultiHopQA, HotpotQA) | BFS ≤3 edges, ≤512 visited, gated, opt-in | must beat current gated BFS on `eval:graph:hard` and a public multi-hop subset (MuSiQue dev sample) on complete-evidence@k; keep caps |
| 5 | Lifecycle filter | yes | rule-based (raw, stale, archived, deprecated, superseded) | shipped | correctness rule, regression tests only |
| 6 | Near-duplicate control | yes | Maximal Marginal Relevance on section embeddings or token overlap. Carbonell & Goldstein, "The Use of MMR, Diversity-Based Reranking for Reordering Documents and Producing Summaries", SIGIR 1998 | not built | complete-evidence@k improves on multi-source questions without lowering Hit@3 |
| 7 | Rerank | yes (section focus) / yes at inference (cross-encoder) | Section focus is our own heuristic. Cross-encoder: Nogueira & Cho, "Passage Re-ranking with BERT", 2019; BEIR reports BM25 + cross-encoder as the strongest zero-shot pipeline. Anthropic "Contextual Retrieval" (2024) reports fewer failed top-20 retrievals when reranking is added to contextual hybrid search | section focus shipped opt-in; cross-encoder pilot showed no gain on the vault (ceiling) | run **only when uncertain**: apply when the top-1 vs top-2 fused margin is small, or when the Curator asks for page 2. Default only if MRR/nDCG@10 rises on held-out data; report latency |
| 8 | Context order | yes | Put the strongest evidence first (and last if many items). Liu et al., "Lost in the Middle: How Language Models Use Long Contexts", TACL 2024 | not explicit | Curator citation accuracy on `eval:curator` does not drop; cheap to adopt |
| 9 | Curator judge | no (LLM) | Select, verify, abstain. Yan et al., "Corrective Retrieval Augmented Generation" (CRAG), 2024: a retrieval evaluator decides correct / ambiguous / incorrect before generation. Asai et al., "Self-RAG", ICLR 2024 | shipped (skill) | keep LLM; add a deterministic pre-gate: if no candidate passes a fused-score floor, return abstain without spending Curator tokens. Tune floor on abstention fixtures |

## Evaluation protocol (applies to every row)

- Metrics: nDCG@10, Recall@10, MRR@10 (official BEIR scorer, already wired); Hit@3 and complete-evidence@k on the repo vault fixtures; Curator citation accuracy for stage 8–9.
- Splits: tune any constant (α, PPR damping, rerank margin, abstain floor) on a dev split; report once on a held-out split. Fixtures authored during development count as regression tests, not evidence.
- Significance: paired randomization or bootstrap test per query. Smucker, Allan & Carterette, "A Comparison of Statistical Significance Tests for Information Retrieval Evaluation", CIKM 2007.
- Cost: report warm and cold latency with rotated arm order; no speed claim without it.
- Promotion rule: a stage becomes default only if it improves the primary metric on held-out data and does not regress Hit@3 or abstention. Otherwise it stays opt-in and the film does not show it as default.

## Interface

All stages run inside the engine behind the three MCP tools (`recall`, `read`, `remember`). The agent never chooses flags; the tool applies the promoted defaults.
