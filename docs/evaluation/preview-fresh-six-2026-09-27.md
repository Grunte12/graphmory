# Preview versus path-only: six new task families

## Frozen comparison

We compared the same Graphmory curator retrieval adapter with and without
`--evidence-preview`. The source was pinned LongMemEval S revision
`98d7416c24c778c2fee6e6f3006e7a073259d48f`. Four answerable and two
abstention task IDs were selected before reader runs; their labeled answer
sessions do not overlap the listed earlier suites. Background conversation
history can still overlap. Each arm received the same physical Markdown notes,
question/date, OpenCode 1.18.29 host, `openai/gpt-5.6-luna` model, read-only
prompt and fresh session. Arm order alternated by case. Gold and frozen rubric
were outside the model workspaces. An evaluator graded anonymized answers
against original source notes before arm identity was revealed.

The sanitized 12-row data with source, runner and revision hashes is in
[`preview-fresh-six.json`](../../eval/competitor-pilot/preview-fresh-six.json).
Private traces and raw answer text remain outside this public repository.
Every trial ended normally; original vault hashes stayed unchanged.

## Result

| Metric, six pairs | Preview | Path-only |
| --- | ---: | ---: |
| Median host input counter, excluding cache | 32,168 | 42,782 |
| Median total input, including cache read/write | 113,930 | 151,747 |
| Median elapsed | 41.2 s | 51.7 s |
| Unambiguous answer correctness | 5/5 | 5/5 |
| Answerable evidence complete on unambiguous cases | 3/3 | 3/3 |
| Safe abstention | 2/2 | 2/2 |

Preview's median input counter was about 25% lower and median elapsed about
20% lower. It was faster in all six paired runs, but its uncached input was
higher in one case and its cache-inclusive input was higher in two. Host usage
counters are not subscription bills; with one run per task, these are
development observations, not a stable latency or billing estimate.

The sixth task is **materially ambiguous**: the frozen label expects a
first-client contract, while another dated source describes a plausible
significant business milestone four weeks before the question. Preview answered
with the contract; path-only answered with the other sourced event. We retained
both answers in the private audit and exclude this task from the paired win/loss
count. The preview answer also omitted one context source required by the
frozen rubric. On an abstention task, preview omitted one of two labeled
comparison notes while still safely declining to invent a football count.

The source-only grader found no contradicted cited factual claim among its
determinable atomic claims. A few statements about searching the vault could
not be judged from citations alone; trace audit confirmed both arms paged the
candidate set and ran additional file searches on the affected abstention
tasks. That audit does not prove semantic absence of every possible paraphrase.

## Decision and next gate

Keep `--evidence-preview` opt-in. The fresh sample supports a **cost hypothesis
without observed answer regression** for these tasks, but it does not show a
quality gain, a reliable p95, or superiority over pinned external competitors.
The [optimization-loop gates](optimization-loop-2026-09-27.md) therefore remain
unmet. The next suite should exclude this inspected set, repair or remove
ambiguous questions before running, add harder multi-hop/count and conflict
cases, and compare the frozen candidate against Basic Memory hybrid and other
named tools under the same reader budget. Any default change requires the
quality and cost gates together; do not infer memory-write safety from this
read-only experiment.
