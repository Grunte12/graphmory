# Evidence-gated optimization loop

## Scope of the claim

Target: improve useful coding-agent memory on comparable tests at acceptable cost. No finite test can establish superiority over every tool. Claims must name tested versions, configurations, tasks and limitations. Retrieval-only results cannot establish answer or memory-write quality.

## Promotion criteria (engineering targets, not research-established constants)

| Gate | Initial target | Measurement |
| --- | --- | --- |
| Supported answer correctness | At least 90% on answerable acceptance tasks | Blind evidence-based review against frozen required claims; unsupported assertions fail |
| Citation support | At least 95% of material cited claims directly supported | Inspect exact source sections; a returned path alone is insufficient |
| Complete evidence | At least 90% of answerable tasks | All required evidence groups found within actual curator reads |
| Safe unknown handling | At least 90% on unanswerable/ambiguous cases | Correct abstention or clarification; no invented facts |
| Memory integrity | Zero observed unsupported writes or destructive actions | Isolated trial vaults, diff and provenance audit; zero observed is not zero risk |
| Quality versus control | At least +5 percentage points in task success, paired uncertainty excluding zero | Same task IDs, model, history and context budget; project/episode-family clustered analysis |
| Cost and time | Median input tokens and p95 latency no more than 20% above control | Actual usage and timestamps; bytes and subscription price are not token billing |

Acceptance requires all applicable gates, not an averaged score masking an unsafe outcome. Unknown usage or insufficient sample size makes a cost/superiority claim inconclusive. Revise targets only before a new frozen acceptance run and record why.

Methodology references: [Anthropic's agent evaluation guidance](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) motivates outcome checks, trace inspection, repeated trials and calibrated graders. [LongMemEval's official harness](https://github.com/xiaowu0162/LongMemEval) provides an external memory benchmark; a custom coding-vault pilot must be reported separately. Neither source establishes the numeric targets above or Graphmory superiority.

## Loop

1. Freeze the question set, required claims/evidence, source snapshot, host/model and comparison arms. Keep labels outside the agent-visible vault. Split by project/episode family; inspected acceptance becomes development evidence.
2. Run small blind paired pilots first: Graphmory curator versus the same model with ordinary file search. Validate the rubric and trace collection before spending on larger runs. Use three repetitions for live variance pilots; never select the best run.
3. Audit failures as retrieval miss, incomplete read, wrong scope, unsupported synthesis, stale claim, unnecessary retrieval or excessive cost. Check evaluator errors before changing the product.
4. Change one mechanism. Verify deterministic integrity and development outcomes. Reject changes that regress quality or add unmeasured dependencies.
5. Freeze a candidate and run fresh acceptance cases against pinned competitor configurations on identical inputs. Basic Memory text/hybrid, Mem0 OSS and Graphiti OSS are distinct treatments; uninstalled or inaccessible tools remain untested.
6. Promote only with evidence meeting the gates. Otherwise preserve the previous default and iterate. Stop and report a blocker if required host access, labels or measurements are unavailable; do not relabel a proxy as success.

First live pilot: three already-inspected development questions, Luna treatment and Luna plain-file-search control, read-only physical trial vault. This pilot validates evidence and trace collection; it does not meet acceptance sample, variance, no-answer or cost gates. Additional live trials must use fresh tasks, isolated sessions and evaluator-reviewed labels.
