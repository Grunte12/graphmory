# Live Model Results

This file is intentionally separate from deterministic proxy evals.

Proxy evals prove the harness and contracts behave as expected. Live model results compare actual agent/model behavior under equal instructions and budgets.

All evaluation infrastructure is in place (`eval/live-agent/incidents.json`, `run-template.md`, `scripts/eval-live-agent-score.mjs`, `scripts/eval-agent-run.mjs`). What remains is running real model comparisons using these tools.

## Status

**A pilot run has been completed with full incident coverage** (`pilot-2026-08-01`, see `eval/live-agent/runs/pilot-2026-08-01/`). It is a **single-model pilot** (Claude Sonnet 5 playing all three strategies, in fresh isolated sessions per incident/strategy, all 12 public incidents — 11 write-scorable + 1 correctly skipped as recall-type — 1 trial each) — it is evidence, not a definitive comparison, and it is **not** a cross-model benchmark. Do not cite it as proof this architecture beats vector RAG, GraphRAG, or managed memory systems. Full methodology and honest limitations are captured in this file (see "Failure Log" below) and in the raw run data under `eval/live-agent/runs/pilot-2026-08-01/`.

The scorer (`scripts/eval-live-agent-score.mjs`) had 3 bugs when this pilot first ran on a 6-incident subset; all are now fixed (see the Failure Log below, rows marked "Fixed 2026-08-01"), and the pilot was subsequently extended to all 12 incidents under the corrected scorer.

Do not claim that Memory Patch is empirically better than direct writing, curator inference, vector RAG, GraphRAG, or managed memory systems from this pilot alone — treat it as the first data point, not the final word.

## Recommended Run Matrix

| Run | Model / agent | Strategy | Notes |
|---|---|---|---|
| A1 | Claude Sonnet 5 (pilot, 2026-08-01) | Direct Writer | **Done** — 11/11 write-scorable incidents scored |
| B1 | Claude Sonnet 5 (pilot, 2026-08-01) | Curator Inference | **Done** — 11/11 write-scorable incidents scored |
| C1 | Claude Sonnet 5 (pilot, 2026-08-01) | Memory Patch | **Done** — 11/11 write-scorable incidents scored |
| A2/B2/C2+ | TBD (different model, or ≥2 more trials per condition) | same three | Open — needed for a real cross-model claim or to distinguish signal from single-trial noise |

Use the same incidents, budget, tools, and hidden expected answers for each run.

## Command

```sh
node scripts/eval-live-agent-score.mjs \
  --run-dir eval/live-agent/runs/pilot-2026-08-01/<A-direct-writer|B-curator-inference|C-memory-patch> \
  --incidents eval/live-agent/incidents.json --json
```

## Result Template

| Run | Strategy | Pass rate | Avg score | Action (avg) | Provenance (avg) | Scope (avg) | Lifecycle (avg) |
|---|---|---:|---:|---:|---:|---:|---:|
| A1 | Direct Writer | 81.8% (9/11) | 87.5 | 0.79 | 1.00 | 0.95 | 0.68 |
| B1 | Curator Inference | 63.6% (7/11) | 66.9 | 0.82 | 0.09 | 0.50 | 0.91 |
| C1 | Memory Patch | 90.9% (10/11) | 89.5 | 0.76 | 1.00 | 0.95 | 0.82 |

This is a narrower gap than the hand-authored deterministic proxy (`docs/evaluation/evaluation.md`, A=12.5%, B=75%, C=100%) suggests, and the *shape* of the gap is different: **action-correctness alone barely separates the three strategies (0.79/0.82/0.76 — B is not worse here, and even edges out C)**. The real, large, consistent separation is in **provenance** (1.00/0.09/1.00) and **scope** (0.95/0.50/0.95) — B's two-step summarize-then-infer design structurally severs the link between a decision and its evidence, exactly as `docs/evaluation/evaluation.md` hypothesized but never measured until now. B also unexpectedly *leads* on lifecycle metadata completeness (0.91 vs. A's 0.68), a nuance worth reporting rather than omitting. **Report the full breakdown, not just pass rate** — pass rate alone would hide exactly which dimension drives the difference.

## Failure Log

| Run | Incident | Failure type | What happened | Fix candidate |
|---|---|---|---|---|
| A1 | ui-visual-owner-after-build-pass | wrong-action | Model returned `tension` (framing ownership as contested) where `save` was expected | Prompt/contract could disambiguate "who owns follow-up action" vs. "what technical fact should be saved" as separate questions |
| A1, C1 | derived-index-misread / hot-context-entry | wrong-action | Reasonable but non-matching judgment calls (`block` vs `save-boundary`, `block` vs `hot-context-candidate`, `tension` vs `save-boundary`) | Expected-action labels may be stricter than multiple defensible real answers; consider grouped-acceptable-actions like the retrieval eval's `relevant_groups` pattern |
| B1 | 10 of 11 incidents | provenance loss | `evidence_paths` empty on 10/11 write-scorable incidents — the curator persona, working only from a 1-2 sentence summary, structurally cannot cite exact evidence it was never given | This is the expected, hypothesized failure mode for strategy B — now confirmed empirically at N=11, not just N=6 |
| A1, C1 (pre-fix) | missing-evidence-memory-request | false-memory (scorer flag) | `noFabrication` heuristic penalized `confidence: "high"` + empty `evidence_paths` for *any* action, but here empty evidence was the *correct* judgment (the incident has no evidence to cite) | **Fixed 2026-08-01** — penalty now scoped to assertive actions (save/save-boundary/hot-context-candidate) only |
| all 3 (pre-fix) | secret-in-transcript | noLeakage=0 for every strategy | The heuristic regex `/secret/i` matched the substring "secret" in the incident's own `incident_id` field, zeroing this dimension regardless of actual behavior | **Fixed 2026-08-01** — regex now scoped to candidate content fields only. Residual: still trips on genuine content that merely *mentions* "secret" responsibly (B's claim text) |

## Interpretation Rules

- Synthetic proxy scores are harness sanity checks, not model-quality proof.
- Live-model scores should be compared only when the budget, scenario order, and visible instructions are equivalent.
- If Memory Patch loses on cost or latency for tiny tasks, document that honestly.
- If direct writing wins on simple personal-vault tasks, keep that as a valid mode rather than forcing the heavier flow.
- If curator inference invents facts or loses provenance, count it as a false-memory failure even when the final note looks polished.
