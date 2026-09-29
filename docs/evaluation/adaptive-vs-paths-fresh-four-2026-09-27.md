# Adaptive bundle versus the current path-only reader

## Frozen comparison

Four new LongMemEval S question families were selected and graded against a
frozen rubric. Their question IDs and labeled evidence sessions were disjoint
from the listed previous pilots; wider conversation history may still overlap.
The two arms used identical Markdown notes, the same question and reference
date, OpenCode 1.18.29, `openai/gpt-5.6-luna`, a read-only prompt and a fresh
session. Order alternated. Gold stayed outside agent workspaces. Answers were
graded under anonymous X/Y IDs before arm identity was revealed.

The treatment was `recall-managed --auto`; the control was the current
`recall-managed --agent` path-only output. Both readers could inspect original
notes and follow pagination. All eight runs stopped normally, without tool
errors or vault changes. The [sanitized row data](../../eval/competitor-pilot/adaptive-vs-paths-fresh-four.json)
include source, runner, config and vault hashes. Raw traces and labels remain
private. Source revision: `98d7416c24c778c2fee6e6f3006e7a073259d48f`;
SHA-256: `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.

## Result

| Metric, four pairs | Adaptive | Path-only |
| --- | ---: | ---: |
| Core answer correct and required evidence complete | 4/4 | 4/4 |
| All material claims directly supported | 3/4 | 3/4 |
| Safe abstention | 2/2 | 2/2 |
| Median elapsed | 28.8 s | 48.1 s |
| Median tool calls | 5.5 | 11 |
| Median host input counter, excluding cache | 29,293 | 29,407 |
| Median cache-inclusive input | 80,664 | 120,236 |

Adaptive was faster and used fewer tool calls in all four pairs. Its uncached
input was higher in two pairs and lower in two; the median difference is too
small to claim a token saving. Cache-read counters varied widely and do not
measure subscription billing. A four-pair, one-run-per-task pilot cannot
estimate a stable p95 or causal quality difference.

Blind grading found one unsupported extra claim in each arm. The adaptive
reader correctly declined to identify a father's birthday gift, then added an
unsupported silver-necklace detail from an unrelated note. The path-only
reader correctly declined to infer a manager-role team size, then described
two dated engineer counts as inconsistent without evidence of a same-time
conflict. These errors matter even though the core answers and safe
abstentions passed. Trace inspection showed the adaptive reader also read the
original note before its unsupported extra; the preview alone was not the
sole source of that error.

## Decision

Keep `--auto` opt-in. It is a promising latency and tool-call improvement for
these conversation-style vaults, but neither arm met the 95% citation-support
[promotion gate](optimization-loop-2026-09-27.md), and the sample is small.
Do not advertise lower cost or better answer quality. Continue with fresh
Markdown layouts, repeated trials and a targeted evidence-support check before
making this the default curator output.
