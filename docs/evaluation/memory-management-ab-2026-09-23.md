# Memory management decision pilot (2026-09-23)

This pilot used the 12 synthetic cases in `eval/memory-management-ab/`. Both arms received the same frozen proposed claim, source context, and candidate notes. Neither arm wrote Markdown. The scorer checked proposed status, operation, target, reason, provenance, and false writes. These cases are development examples, not an independent held-out set.

These historical counts used scorer v1. The v2 scorer now checks claim text and extra source IDs and counts unsafe proposals even in cases expected to be applied. Do not compare these counts directly with v2 reports. The two arms also differed in final decision workflow, and Luna timing/cost were unavailable, so this is a workflow pilot rather than a model ranking.

| Arm | Exact cases | Correct status | False writes | Timing / usage |
| --- | ---: | ---: | ---: | --- |
| Codex `gpt-6-luna` curator sub-agent | 10/12 | 12/12 | 0 | Per-call tokens, latency, and cost unavailable from this invocation |
| Vercel `typesafe-ai/jev` + frozen deterministic lead mapping | 2/12 | 4/12 | 1 | 12 HTTP requests; mean 877 ms, p95 2,580 ms; 9,629 input and 3,024 output tokens reported by Gateway; billed cost unavailable |

The Luna arm chose every write/block/tension status and operation correctly. It omitted the target note for two tension cases and labeled one conflict as approval-needed rather than conflict. It ran as a Codex sub-agent because the local OpenCode OpenAI OAuth token returned HTTP 401 (`token_invalidated`). This is **not** an OpenCode Luna measurement; it also used `gpt-6-luna`, whereas the prior OpenCode retrieval pilot used `gpt-5.6-luna`.

The Jev arm used one System One request per case with `noul` questions for apply, tension, create, nine block reasons, and candidate destinations. A fixed pre-run mapping used 0.6 as the apply/tension threshold and picked the highest reason score. This mapping proposed an unsafe duplicate write in case 04. It also treated several unsafe proposals as tension rather than blocked. The raw scores often identified the underlying reason (for example duplicate, secret, stale source), but the generic tension question was broad and the apply score alone did not enforce novelty. Changing thresholds or precedence after seeing these 12 answers would be tuning on the test set, so the reported score remains the original run.

## Decision

Keep Luna/Haiku curator mode available. Keep hosted Jev for bounded **retrieval** decisions only. Do not enable Jev-assisted note writing from this pilot. The present Jev mapping is neither safe enough nor cheap in tokens: 14 simultaneous questions per case used 3,024 output tokens across 12 small cases.

For a next Jev curation experiment, first reject secrets and missing provenance deterministically, ask fewer typed questions, and let the lead review ambiguous/contradictory cases. Freeze that policy before running a new, independently authored held-out set with real project-style notes. Measure actual write diffs in disposable vault copies before any production write path is enabled.

The model alias is not a pinned Jev version. Vercel documents the [TypeSafe-compatible System One endpoint](https://vercel.com/changelog/ai-gateway-now-supports-typesafe-clients-and-http-api-for-jev); the endpoint returned token usage but no billed amount in these responses.
