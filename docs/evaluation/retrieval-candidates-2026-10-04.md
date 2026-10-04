# Retrieval candidates — 2026-10-04

Status: implemented, regression-verified, opt-in. No candidate was promoted.
Source: uncommitted `feat/mcp-server`, implementing the [proposal](../research/retrieval-pipeline-proposal-2026-10-04.md).

| Candidate | Implementation / provisional constant | Promotion gate and current result |
|---|---|---|
| PPR graph lane | Seeded on ≤8 fused seeds; damping 0.85; 30 iterations; induced neighborhood ≤3 hops / ≤512 visited; explicit authored edges only | Hard synthetic + public MuSiQue complete-evidence gate not evaluated for this candidate; opt-in |
| MMR | Token-overlap Jaccard redundancy; lambda 0.7; keeps all candidates pageable | Multi-source complete-evidence and Hit@3 held-out comparison not run; opt-in |
| Margin-gated rerank | Section focus after RRF; relative top-1/top-2 margin ≤0.1 only when enabled | Held-out MRR/nDCG and rotated warm/cold latency comparison not run; opt-in |
| Strongest-first context | Strongest item first; remaining diversity order retained | Curator citation-accuracy comparison not run; opt-in |
| Abstain floor | Empty candidates before Curator when top fused score is below an explicitly supplied threshold | Floor tuning on dev abstention fixtures and held-out acceptance not run; opt-in |

Flags on Curator `recall-managed`: `--ppr`, `--mmr`, `--rerank-margin <number>`, `--strongest-first`, `--abstain-floor <number>`. Engine option: `pipeline`. MCP exposes none of these choices. Default keyword/semantic/graph behavior remains unchanged. This change does not promote a cross-encoder or convex score fusion. Hybrid remains the existing default for new configurations; legacy lexical configs are retained. No new quality claim is made for that prior default.

Evaluation split: the seven new candidate fixtures are authored implementation regressions, not a held-out set. They test deterministic PPR caps and lifecycle exclusion, MMR diversity, rerank gating/order, floor behavior, invalid constants, unchanged defaults and CLI wiring. All seven passed; the related targeted retrieval suites passed 36/36. No constants were tuned against these tests.

The existing frozen `graph-hard-v1` synthetic suite was rerun with its existing baseline/gated BFS arms, not PPR: 209 notes, 30 questions, 23 answerable, seven without an answer. Both arms: Hit@3 23/23 (100%), complete-evidence@3 14/23 (60.87%), complete-evidence@12 19/23 (82.61%), Recall@12 94.20%. Both return candidates on 7/7 unanswerable cases; this remains an abstention limitation, not a success. No stale or out-of-scope candidates. Synthetic graph evidence is unverified until a Curator reads originals.

Paired test: baseline versus existing BFS has all-zero per-query differences for complete-evidence@12, so paired two-sided randomization p=1.0 (exactly, independent of permutation count). This is a default-regression observation, not a candidate promotion result. Raw temporary report: `/tmp/graphmory-mcp-graph-hard.json`; command `node scripts/eval-graph-hard.mjs --out <outside-repo-path>` preserves historical reports.

For every new candidate, held-out nDCG@10, Recall@10, MRR@10, Hit@3, complete-evidence@k, Curator citation accuracy, paired p-value and rotated warm/cold latency are **not measured**. Public dataset/model runs, personal vaults and live Curator API calls were outside this task's synthetic-only/no-external-API boundary. Do not infer superiority, latency or token savings. Before promotion, freeze a dev/held-out split, tune constants on dev only, compare once with paired per-query randomization/bootstrap and report primary-metric improvement without Hit@3/abstention regression. The film's unconditional rerank beat must be adjusted until that gate passes.
