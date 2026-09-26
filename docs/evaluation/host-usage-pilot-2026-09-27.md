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
