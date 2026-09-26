# Live curator optimization pilot — 2026-09-27

Status: development loop in progress; acceptance criteria not met.

Two Luna sub-agents answered the same three already-inspected questions against a read-only, frozen 139-note trial vault. Treatment used Graphmory managed retrieval plus curator skill; control used ordinary file search. Neither received evaluator labels. The primary agent reviewed source evidence using an evaluator-only rubric recorded before reading outputs. This is preliminary model-assisted review, not a calibrated independent human judge.

| Question | Initial Graphmory curator | Plain-file-search control |
| --- | --- | --- |
| Curator implementation comparison | Broad distinction supported; used abbreviated citation labels instead of exact paths | Broad distinction supported with exact paths; full required claim coverage still needs review |
| Semantic implementation/cache comparison | Relied on historical comparison and missed conflicting operational guide | Same historical-source failure |
| Prompt caching strategy | Supported caution about stable prefix and measuring actual cost; citation format incomplete | Supported caution and exact source paths |

The semantic failure is substantive: the older comparison discusses re-embedding/no demonstrated persistent cache, while the runtime guide in the same snapshot explicitly documents note-content-hash vector caching. Both answers needed to reconcile that difference, not treat the comparison as the current implementation inventory. Source dates and status help detect conflicts but cannot establish truth automatically.

First optimization: curator instructions now require an operational source check for claims about implementation/provider configuration, explicit conflict handling, and exact vault-relative citations. A follow-up on these same questions is an informed development iteration, not fresh acceptance evidence.

Follow-up observation: the curator supplied exact source paths, identified the conflicting semantic-cache descriptions and withheld an unqualified current-state assertion. It correctly described the lead/curator split. However, the I-MEM semantic summary still established only an adapter's existence, not whether its default workflow calls it. The instruction now explicitly distinguishes module/API existence from workflow wiring and asks for symmetric status checks on both sides. No full task-success percentage is assigned: required claim coverage still has a gap, the changed tasks were already inspected, and the same agent retained the earlier trial context.

Second correction: the skill's flexible synthesis guidance conflicted with the Brain Brief validator/schema's seven-item maximum. The hard maximum was removed; each finding still needs a summary and path, an empty structured brief is rejected, and the separate three optional direct-read-path limit remains. A regression test checks that nine sourced findings validate while a missing source path fails. Removing the cap is contract consistency, not a measured general answer-quality gain.

No comparable cost/latency result: the control recorded about 41 seconds of wall time, while treatment recorded only about 5.9 seconds inside tool calls, excluding synthesis. These different clocks cannot be compared. Neither arm exposed actual provider tokens/cache/billing. Only one trial per arm ran; no unknown-case or write-safety trial ran. We cannot claim that Graphmory beats the control or any competitor from this pilot.

Promotion gates and next trials are in [optimization-loop-2026-09-27.md](optimization-loop-2026-09-27.md). Private outputs and rubric remain outside the repository.
