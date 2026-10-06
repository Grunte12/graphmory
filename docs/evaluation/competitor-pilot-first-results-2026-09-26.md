# First competitor comparison results

Run locally: Basic Memory 0.23.2 in text-search mode against Graphmory on the same 14 LongMemEval questions (12 with an answer, 2 without).

| System, question only | Full evidence in the top 3 | Full evidence in the top 12 |
| --- | ---: | ---: |
| Basic Memory text | 8/12 | 12/12 |
| Graphmory BM25 | 10/12 | 12/12 |
| Graphmory fusion | 10/12 | 12/12 |

**Reading the result:** in this sample Graphmory ranks the evidence higher, but the sample is small and the competitor's hybrid and semantic modes were not tested, so it cannot be said that either system is better overall. No model was called to answer or judge, so this score is not answer accuracy.

## What was found and what was adjusted

- A question with a date appended made Basic Memory return nothing. An index check and a known-item test showed that the problem was the query shape, so both systems were tried with the question alone, and both results were kept.
- Graphmory BM25 improved from 8/12 to 10/12 on the development set, but on a fresh set both query shapes scored the same 11/12, so production was not changed to chase the score.
- An eval option was added to separate the search text from the reference date, and to select a test set with frozen IDs. The date must still be passed to the reader when temporal reasoning is measured.
- Basic Memory printed about 54 KB of stdout per query (the median of the question-only round). That is worth trying a compact output for later, but it is not evidence about token cost because the result structures differ.

## What to do next

1. Compare Basic Memory hybrid with its recommended settings before drawing any conclusion about semantic capability. This round did not download the model.
2. Use the same reader and judge to measure correct answers and abstention when the evidence is insufficient.
3. Add more questions and measure the cost per correct answer before claiming superiority.

This round had no API cost and did not use a private vault. The existing 238 tests passed, and after the eval option was added the related tests passed, with no change to the production algorithm. Luna helped with research and setup but hit a usage limit before finishing, so the lead ran the deterministic part and the audit. Only one competitor was covered this round to limit quota use.

Details, reproduction commands and per-item results: [competitor pilot](../../eval/competitor-pilot/README.md)
