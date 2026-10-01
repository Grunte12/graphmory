# Native trace binding repair — 2026-10-02

The prior scorer recognized only literal child IDs in waits and missed some variable-held commands. This change reads observed spawn outputs paired by call ID and resolves supported `r.agent_id` / `store` → `load` waits without executing trace code. Unknown or reassigned variables cannot establish a matching child. Variable-held literal/template commands now expose implicit offset zero and explicit numeric loop offsets.

`node --test test/native-trace-bindings.test.mjs test/mvp-correctness-evaluator.test.mjs` passed. Four new tests cover observed-vs-unobserved IDs, reassignment, paired/unrelated outputs, variable commands and frozen native-05 traces. The final isolated parser rerun also passed. Existing raw traces and frozen scores were not rescored or overwritten; old native-05 still has its genuine predecessor failure and no matching successful receipt.

This parser supports the documented trace shapes, not arbitrary JavaScript data flow. New native evaluations must freeze the new scorer identity and collect actual model/role/source/receipt evidence; recognizing a dispatch does not prove the memory update succeeded.

Raw private logs are in `outputs/graphmory-hybrid-summary-20261002/verification/`. Source: `scripts/eval-mvp-correctness-repair.mjs`; new tests: `test/native-trace-bindings.test.mjs`.
