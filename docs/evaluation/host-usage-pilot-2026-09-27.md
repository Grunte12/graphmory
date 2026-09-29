# Same-host usage instrumentation pilot

OpenCode 1.18.29, `openai/gpt-5.6-luna`, one public eight-note fixture question, three new-session trials per arm with alternating order. A shared read-only curator role answered a question about patch fields, authorship and missing provenance. Treatment used Graphmory managed retrieval; control used ordinary file search. The full Graphmory skill was not loaded in this instrumentation pilot, so it is not a full-product acceptance experiment.

| Host-reported measure (median across 3 trials) | Graphmory retrieval | Plain file search |
| --- | ---: | ---: |
| Input counter | 12,973 | 13,489 |
| Cache-read counter | 20,480 | 31,744 |
| Full input-side volume (input + cache read + cache write) | 33,453 | 44,956 |
| Output tokens | 424 | 379 |
| End-to-end wall time | 30.8 s | 25.6 s |
| Largest observed wall time | 32.2 s | 33.9 s |

All six answers included the required field/authorship/no-unsupported-write claims with supporting note paths on primary-agent source review. All reported cache-write counters were zero. The fixture's byte contents matched the original after the run. This is answer behavior plus a no-change check, not a write-mode safety evaluation. Three trials of one known question cannot establish general quality, latency tails, or paired superiority; both arms succeeded, so quality improvement is zero on this case.

The counters are OpenCode's normalized fields and are retained separately. In the [pinned v1.18.29 source](https://github.com/anomalyco/opencode/blob/v1.18.29/packages/opencode/src/session/session.ts#L321-L383), input subtracts cache reads/writes, so input-side volume is input + cache read + cache write. The full-volume median was 25.6% lower for treatment on this one question; individual trials varied and this is not a billed-cost saving claim. `tokens.total` is provider-supplied and is not added again. The same source computes cost from model price metadata; subscription billing was unavailable and a host `cost: 0` value is not proof of zero economic cost. New sessions do not guarantee a cold provider cache. Static host tool definitions are substantial even for an eight-note task.

Codex CLI 0.146.0 smoke failed inside the sandbox before model execution (app-server/state-database initialization). OpenCode initially failed on a user plugin's inaccessible meter log; isolated XDG state plus `--pure` succeeded. The experiment did not change user configuration. A temporary isolated authentication copy was removed after the trials. Private host state and outputs are kept outside this repo.

`scripts/eval-host-usage.mjs` provides the developer-only runner; it requires an isolated authenticated OpenCode environment and the `paired_eval` agent. The first pilot retained answers and counters but not per-tool JSONL traces. The runner was subsequently improved to retain private traces and reject absent counters as unknown. Full acceptance must use that trace-enabled version, fresh labeled tasks, exact source/model/config hashes and calibrated reviewers.

## Next development suite

The runner accepts question-only JSON (`[{"id":"safe-id","question":"..."}]`)
with `--questions <path>` and `--repeats 1..10`. Keep answer rubrics outside
the trial workspace. It records dataset, question, runtime, host configuration,
and retrieval-source hashes plus the Git revision and OpenCode version.
The configured evaluator model must match the recorded model. Each trial
retains a private JSONL trace; any vault mutation or host failure stops the run.
These checks support reproducibility; they do not establish benchmark superiority.
An expanded suite over these previously inspected eight notes remains development
data, even when its questions are newly written.

## Five-question development follow-up

Ten fresh host sessions used the same eight-note fixture and the same evaluator
model/configuration: five question pairs, one run per arm. Tasks covered ownership
across notes, Memory Patch authority, unresolved conflicts, graph/brief policy,
and unknown verification details. Labels were kept outside the trial workspace.
The inspected fixture retains its historical seven-item brief policy; answering
that source correctly does not establish that this is the current product policy.

| Host-reported measure | Graphmory adapter | Plain file search |
|---|---:|---:|
| Total input, including cache, across five tasks | 202,193 | 249,182 |
| Median input per task, including cache | 33,448 | 56,564 |
| Total output tokens | 2,238 | 2,101 |
| All tool calls, including host todo updates | 25 | 32 |

Input totals were 18.9% lower for Graphmory on this development suite. This is
input volume, not a bill or a guaranteed saving on subscriptions. Task-specific
results differ: the ownership question used more input with Graphmory. Both
methods answered the unknown case without inventing a version or browser.
Vault file hashes were unchanged after every trial. Raw per-tool JSONL traces,
question-only inputs, and the separate rubric were retained locally.

Limitations: one repetition per question, previously inspected fixture, no
independent held-out benchmark, retrieval-adapter treatment without the complete
product skill. The same automated reviewer authored the rubric and graded
anonymized answers; this is an exploratory review, not a calibrated independent
human evaluation. Initial trials overlapped repository tests, so latency from
this run is excluded from performance acceptance. Graphmory ran first in each
pair; the next runner revision counterbalances order across questions as well
as repeats. No superiority or p95 gate is established by this run.

Trace inspection found three todo updates in the first Graphmory session.
Reducing unnecessary planning on simple read-only recall is a candidate for a
paired follow-up; it has not yet been demonstrated to improve quality or cost.

### Verification and remaining regression

The full test run passed 249/249 tests and example validation passed. `npm run
check` stopped at the v0.5 governed-retrieval latency gate. A subsequent
`npm run eval` with no concurrent evaluation/test process failed the same gate;
therefore the failure cannot be dismissed as concurrent test load. Correctness,
current-memory accuracy, MRR, pollution, and context gates passed. Latency
investigation remains open, and no performance threshold was relaxed.
The anonymous automated review marked all ten answers supported, complete,
and citation-supported against the development rubric. This does not replace
calibrated evaluation on harder unseen data.

Follow-up: [BM25F optimization](bm25f-optimization-2026-09-27.md) reduced repeated
scoring calculations with exact development-result parity. The subsequent full
`npm run check` passed 252 tests and all deterministic gates. Earlier failures
remain recorded above; external quality/cost acceptance is still incomplete.
