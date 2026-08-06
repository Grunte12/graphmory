# Live Model Results

This file is intentionally separate from deterministic proxy evals.

Proxy evals prove the harness and contracts behave as expected. Live model results compare actual agent/model behavior under equal instructions and budgets.

All evaluation infrastructure is in place (`eval/live-agent/incidents.json`, `run-template.md`, `scripts/eval-live-agent-score.mjs`, `scripts/eval-agent-run.mjs`). What remains is running real model comparisons using these tools.

## Status

**No public live-model benchmark has been published yet.** The infrastructure is ready; real model runs have not been completed.

Do not claim that Memory Patch is empirically better than direct writing, curator inference, vector RAG, GraphRAG, or managed memory systems until this file contains a completed run.

## Recommended Run Matrix

| Run | Model / agent | Strategy | Notes |
|---|---|---|---|
| A1 | TBD | Direct Writer | Lead agent writes memory directly |
| B1 | TBD | Curator Inference | Curator infers memory from a task summary |
| C1 | TBD | Memory Patch | Lead agent authors patch; curator applies it |

Use the same incidents, budget, tools, and hidden expected answers for each run.

## Command

```sh
node scripts/eval-agent-run.mjs \
  --curator-output eval/live-agent/runs/<run-id>/curator-output.json \
  --patches eval/live-agent/runs/<run-id>/patches \
  --allow-failures
```

## Result Template

| Run | Strategy | Curator pass rate | Avg patch quality | False memory failures | Conflict failures | Lifecycle failures | Notes |
|---|---|---:|---:|---:|---:|---:|---|
| A1 | Direct Writer | TBD | TBD | TBD | TBD | TBD | TBD |
| B1 | Curator Inference | TBD | TBD | TBD | TBD | TBD | TBD |
| C1 | Memory Patch | TBD | TBD | TBD | TBD | TBD | TBD |

## Failure Log

Record failures even when the preferred strategy wins.

| Run | Incident | Failure type | What happened | Fix candidate |
|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD |

## Interpretation Rules

- Synthetic proxy scores are harness sanity checks, not model-quality proof.
- Live-model scores should be compared only when the budget, scenario order, and visible instructions are equivalent.
- If Memory Patch loses on cost or latency for tiny tasks, document that honestly.
- If direct writing wins on simple personal-vault tasks, keep that as a valid mode rather than forcing the heavier flow.
- If curator inference invents facts or loses provenance, count it as a false-memory failure even when the final note looks polished.
