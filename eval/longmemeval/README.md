# LongMemEval session-retrieval pilot

Source: [LongMemEval](https://github.com/xiaowu0162/LongMemEval), ICLR 2025; [cleaned dataset](https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned), MIT license per dataset card. Dataset revision: `98d7416c24c778c2fee6e6f3006e7a073259d48f`. Public reports contain IDs/derived metrics, not conversation content or answers. Downloaded data stays in ignored `tmp/datasets/` and is developer-only.

## What was run

Validate all 500 full-history small-variant cases; select two cases per six question types plus a separate abstention category using a fixed hash seed, before observing scores. Render each session to a separate Markdown note, ordered by timestamp. Keep the original role and content verbatim. Do not generate aliases, summaries or graph edges from labels. Run each question in an independent temporary vault; remove it after scoring.

Evaluator-only labels include answers, question categories and evidence session IDs. Agent-facing objects contain only role/content/date and the query/date. `has_answer` and other turn metadata are removed through an allowlist. This separation is tested but is **not an OS sandbox**: any future live-agent runner must restrict filesystem access and never grant access to evaluator files or the source dataset.

The baseline is current governed sparse fusion, not bare BM25. The candidate is the same retrieval with automatic graph exploration. Both have 12 candidate slots; reported top 3 is the output-size diagnostic. Arm order alternates between cases; timings remain a single-pass observation. No LLM, Jev API, embedding model or billable inference was used. This is not the official LongMemEval answer-accuracy evaluation or a test of curator ingestion.

## Results

| Metric | Preserve original history | Strict temporal subset |
| --- | ---: | ---: |
| Eligible input cases | 500 | 424 |
| Selected questions | 14 | 14 |
| Answerable / abstention | 12 / 2 | 12 / 2 |
| Complete evidence sessions in top 3 | 6/12 | 5/12 |
| Complete evidence sessions in top 12 | 10/12 | 10/12 |
| Mean evidence-session recall@3 | 62.5% | 58.3% |
| Mean evidence-session recall@12 | 87.5% | 87.5% |
| Abstention questions returning candidates | 2/2 | 2/2 |

Both retrieval arms have identical quality in this pilot. Automatic graph expansion activated zero times. These notes lack curated explicit graph structure, and queries were not rewritten to invoke graph mode. Therefore this does not test the potential benefit of a learned/curated graph; it tests current behavior on uncurated external histories.

The strict run is a separate adapted experiment, not a fair before/after improvement comparison: its eligible pool and some selected IDs differ. 76 upstream cases contain at least one history timestamp after the question timestamp under the documented date parser. These are preserved in the default run and listed in the report; the strict run excludes the entire case, rather than silently trimming evidence. This observation is not a claim that the upstream benchmark is invalid. Timestamp parsing treats timezone-free upstream values on a common nominal UTC axis for ordering only; no local timezone conversion is made.

Thirteen upstream cases have repeated session IDs. We preserve every occurrence with a unique note path. For session-ID golds, any occurrence with that ID matches the same evidence group, consistent with session-level ID scoring. Turn-level faithfulness and distinctions between duplicate occurrences require additional review; this pilot does not score them.

Two questions per category are only a wiring/error-discovery pilot. No confidence or superiority claim is supported. The report does not measure answer correctness, claim support, successful abstention, cost per successful task, or durable write quality. Those require a fixed reader/agent, calibrated grading, repeated trials and isolated memory state.

## Reproduce

From the source checkout, download the revision-pinned **full-history** file (roughly 200 MB):

```sh
mkdir -p tmp/datasets
curl -L --fail https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/98d7416c24c778c2fee6e6f3006e7a073259d48f/longmemeval_s_cleaned.json -o tmp/datasets/longmemeval_s_cleaned.json
npm run eval:longmemeval -- --input tmp/datasets/longmemeval_s_cleaned.json --revision 98d7416c24c778c2fee6e6f3006e7a073259d48f --out eval/longmemeval/pilot.json
npm run eval:longmemeval -- --input tmp/datasets/longmemeval_s_cleaned.json --revision 98d7416c24c778c2fee6e6f3006e7a073259d48f --strict-time --out eval/longmemeval/pilot-strict-time.json
node --test test/longmemeval.test.mjs
```

The revision option records provenance; the runner cannot independently verify a supplied local file belongs to that revision. Compare its SHA-256 with the committed report. Oracle-named input files are rejected, but renaming a file cannot prove full-history provenance. Preserve the source URL, dataset revision and byte hash together. Reports also record implementation hashes, selected IDs, per-category and per-case results. Do not compare newly generated reports as algorithm-only A/B results if any of these differ.
