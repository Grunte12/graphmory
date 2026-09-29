# Adaptive evidence bundle: four fresh paired cases

## Setup

We compared `recall-managed --auto` with the same Graphmory curator using
`--evidence-preview` and normal pages of ten. Both arms used the same physical
Markdown notes, question and reference date, OpenCode 1.18.29,
`openai/gpt-5.6-luna`, read-only prompt and fresh session. Arm order alternated.
The four task families and rubric were frozen before any model run. Labeled
evidence sessions were disjoint from the listed earlier suites, although wider
conversation history can overlap. A grader saw anonymized answers before arm
identity. Private raw traces, answers and gold labels remain outside the repo.

Source: LongMemEval S, revision `98d7416c24c778c2fee6e6f3006e7a073259d48f`,
SHA-256 `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
The [sanitized results](../../eval/competitor-pilot/adaptive-bundle-fresh-four.json)
record each paired row, source and runner hashes, usage, grader outcomes and
vault-integrity checks. All eight runs stopped normally, with no tool errors or
vault changes.

## Result

| Metric, four pairs | Adaptive | Paged preview |
| --- | ---: | ---: |
| Supported answer, complete evidence | 4/4 | 3/4 |
| Safe abstention | 2/2 | 1/2 |
| Median elapsed | 22.8 s | 32.1 s |
| Median tool calls | 4 | 6 |
| Median host input counter, excluding cache | 31,134 | 28,424 |
| Median cache-inclusive input | 67,339 | 86,536 |

Adaptive was faster and used fewer tool calls in every pair. Its uncached
input counter was **higher in every pair**, so this is not a demonstrated
token-cost reduction. Cache read varied by run; host counters are not billed
subscription cost. The adaptive tool chose a wide evidence bundle in three
cases and a focused first page in one. On the Shinjuku abstention question,
the paged-preview reader speculated about a seven-month stay without a source
for Shinjuku. The adaptive reader abstained and cited both Harajuku sources.
One run per task cannot establish that the retrieval change caused that
difference or estimate latency variance.

The local CLI check on a separate structured 34-query vault found every gold
evidence group on the first adaptive response (34/34). It selected focused
output 31 times and wide output three times; median response was 9,300 bytes.
This is candidate coverage, not end-to-end answer quality. On conversation
notes with repeated titles, the wide response reduced full candidate
enumeration from five or six CLI calls to two, without changing ranked paths.

## Decision

Keep `--auto` **opt-in**. The small fresh trial supports a latency/tool-call
hypothesis with no observed quality regression here. It does not meet the
[promotion gates](optimization-loop-2026-09-27.md): too few tasks, no repeated
trials or p95, higher uncached input, and no fresh direct comparison with the
path-only default or external tools. The next paired suite should test against
path-only and include varied Markdown layouts before changing the default.
