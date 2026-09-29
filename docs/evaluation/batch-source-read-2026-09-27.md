# Batch original-source read experiment

## Hypothesis and frozen protocol

After the preview-state live gate failed, test a mechanical source-read change
rather than another prompt variant. Supply full selected Markdown originals
in one CLI call with separate path, raw-byte SHA-256, byte count, and line count.
No summarization, excerpts, relevance scores, or implied relations. Integrity
metadata proves source identity, not claim support. No fixed note-count cap.
Large batches return large output: curator must select relevant sources.

Measure local I/O only: 20 synthetic notes with required facts after long
backgrounds, seven repetitions, alternating arm order. Compare 20 individual
CLI calls, one batch CLI call, and ordinary single-process `cat` of all files.
Validate exact original text parity. The cat baseline avoids claiming batching
beats an already batched host read; it supplies no separate source envelopes.
This benchmark excludes LLM calls, tokenization, provider cache, and grading.

## Implementation

`graphmory read-notes --vault <path> --paths '["one.md","two.md"]'` returns
compact JSON full sources. Duplicate normalized paths are read once. Missing
or unsafe paths fail the whole request before any output, without silent
truncation. Reject absolute/escaping/non-Markdown paths, protected vault paths,
and symlinks resolving outside the vault. This is a local convenience tool,
not a sandbox for hostile concurrent filesystem modifications.

Regression checks preserve UTF-8/Thai, CRLF, long sections, final negation,
raw-byte hashes, compact CLI parity, and source immutability. Reading originals
reduces ambiguity introduced by excerpts but cannot prevent a model from
misattributing facts. No live-quality improvement claim is made.

```sh
node scripts/bench-source-read.mjs --out eval/competitor-pilot/batch-source-read.json
```

## Results and decision

| Arm | Median local time | Output bytes | Processes |
|---|---:|---:|---:|
| Individual CLI reads | 1,202.16 ms | 52,070 | 20 |
| Batch CLI | 63.59 ms | 51,804 | 1 |
| Batch cat | 3.30 ms | 49,040 | 1 |

All 21 runs preserved original-source text. Batch CLI avoided repeated startup
and was about 95% faster than individual CLI reads on this machine. Ordinary
batch cat was substantially faster, so do not require this command over a
host's existing batched reader. Structured metadata adds about 6% bytes over
plain concatenated Markdown in this fixture. This is not a token or LLM-latency
measurement, and full sources can consume more context than selected excerpts.

Retain as an optional source-read convenience, without changing curator
prompts, retrieval defaults, or requiring another service. It neither fixes
the observed cross-topic attribution errors nor proves better answer quality.
`npm run check` and `git diff --check` passed. Temporary fixtures were removed
in `finally`; no live provider calls or private-vault reads were made.
