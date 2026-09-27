# Write-decision scorer correctness repair — 2026-09-28

## Observed problem and intervention

The [Astra audit](astra-eval-skill-audit-2026-09-28.md) reproduced a false
100% pass rate: two copies of one wrong action scored 70 points each, and
omitted incidents disappeared from the denominator. The root agent repaired
this evaluator before further optimization. Runtime retrieval and curator
configuration are unchanged.

Protocol is now `write-decision-v2-complete-denominator`:

- All expected write incidents define the denominator. Missing and duplicated
  write outputs score zero and fail; recall-only incidents remain explicitly skipped.
- Action correctness is a mandatory gate. Composite tension-or-supersede accepts
  a tension action or a save action with nonempty supersedes metadata.
- Detected leakage and the fabrication-risk heuristic cannot be offset by metadata.
- Evidence identifiers require full equality rather than substring overlap.
- Unknown/malformed extras invalidate the run. `runComplete` and `runPassed`
  are reported in both JSON and the console summary. A high row pass rate with
  invalid extra outputs does not mean the run passed.

Scores remain heuristic diagnostics. Exact identifier overlap does not establish
that evidence supports a claim. Citation count does not establish topic scope.
The secret-pattern check can have false positives/negatives. Human evidence review
or a calibrated semantic evaluator is still required. These are neither LoCoMo
QA F1 nor LongMemEval answer accuracy.

## Reproduction and tests

```sh
node --test test/live-agent-score.test.mjs
node scripts/eval-live-agent-score.mjs --run-dir tmp/astra-scorer-probe --json
```

12/12 targeted tests passed. The identical Astra duplicate probe now yields
0/11 passes, ten missing incidents, one duplicate ID, and `runComplete: false`.
Wrong-action output at score70 fails; detected-leak output at score90 fails.
A complete synthetic correct-action run passes11/11; malformed extra outputs
make the same run incomplete/invalid. Intentional subset evaluations must use
an explicit subset incident file.

## Regrading existing outputs

This is a deterministic regrade of stored historical pilot outputs, not a new
model experiment. It does not independently establish the historical model/session
provenance or allow a new architecture-superiority claim. Original tables are
preserved and visibly qualified. Source hashes, scorer hash, exact commands, and
per-incident scores are in [regrade JSON](../../eval/live-agent/scorer-regrade-2026-09-28.json).

| Stored run | V2 passed | Complete run | Average heuristic points |
|---|---:|---|---:|
| A-direct-writer | 8/11 | True | 87.5 |
| B-curator-inference | 7/11 | True | 66.9 |
| C-memory-patch | 7/11 | True | 89.5 |

Old published pass counts were9/11,7/11,10/11 for A,B,C. Current counts are
8/11,7/11,7/11. These changes reflect stricter evaluation of the same outputs,
not degraded product performance. Do not compare old and new score protocols
as if the underlying model had changed.

## Decision

Keep the evaluator repair and counterexample tests. Next correctness work must
produce actual reader answers from delivered evidence, compare with pinned
official benchmark scorers, and measure unsupported relations and abstention
separately. Preserve unopened holdouts until that protocol is frozen.

Final verification: `npm run check` passed, including 274/274 tests and all
configured deterministic evaluation gates. The additional runPassed assertions
were also verified in the targeted scorer test suite.
