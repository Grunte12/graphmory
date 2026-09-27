# Experiment: suppress weakly matched curator previews

## Pre-run decision (written before the new reader trials)

The current `--auto` bundle retains every ranked candidate path but attaches
up to three text previews to each result. A low-confidence query can therefore
show many adjacent facts. In the prior fresh path-only comparison, the adaptive
reader safely abstained on a father's birthday gift but added an unsupported
claim about a different gift. The path-only control also made an unsupported
extra claim on a different task. This is a failure hypothesis, not evidence
that previews caused either error.

Change **one mechanism**: an optional matched-preview filter for `--auto` in
**wide mode only**. For an English query with at least three content terms, attach a note's preview
only when a user/source section matches at least two distinct content terms.
For one or two terms, require one match. Keep every ranked path and the same
ranking and continuation; byte-budgeted page boundaries may change. The curator can still open a source whose wording differs from
the query. Leave the ordinary `--auto` and `--evidence-preview` outputs
unchanged. Do not call the filter semantic relevance or claim it proves an
answer is supported.

Before live trials, an offline 34-query structured-vault check of an initial
all-mode filter found four gold evidence groups whose previews disappeared,
including semantic and link-recovery questions. We narrowed the filter to
wide mode **before** running any model. That preserves focused-mode previews
and records a real failure of the first candidate rather than selecting a
favorable result after the A/B.

Frozen evaluation plan:

1. Verify path order, pagination, vault integrity and byte accounting with
   tests. On the separate structured Markdown vault, check that gold evidence
   paths remain reachable and measure first-response output bytes.
2. Run new LongMemEval S question families: two single-evidence
   answerable, two multi-session answerable and two abstention tasks if
   disjoint labels are available. Freeze
   labels and rubric outside agent workspaces before the model runs. Pair the
   same Luna reader, prompt and note tree using current `--auto` as control;
   alternate run order. Grade anonymized answers before revealing the arms.
3. Report supported answer correctness, required evidence completeness, safe
   abstention, cited-claim support, elapsed time, tool calls and host input
   counters including cache reads. Preserve failures and source/runner hashes.

Reject the filter for a default if any answerable or abstention quality score
regresses, even if it saves tokens. A small one-run pilot can only inform
the next iteration; it cannot meet the release promotion gates or show a
reliable p95. Keep local private traces outside the public repository.

Frozen-suite selection found only one remaining disjoint `_abs` family after
excluding 182 prior question families and 286 labeled evidence sessions.
The available suite therefore has **five** cases: two single-evidence, two
multi-session and one abstention. We did not fabricate a second unknown case
or reuse prior evidence. This change to the planned mix was recorded before
any model run; it further limits unknown-handling conclusions.

## Results

Offline structured-vault check, 34 queries: both ordinary and matched `--auto`
placed every gold evidence group **and a preview for every group** in the
first response (34/34). The filter operated in wide mode for three queries;
median JSON response size was 10,459 versus 10,632 bytes. Two first-page
path lists differed because shorter previews allowed more ranked paths within
the same byte budget. This is candidate coverage only, not answer quality or
proof that citation support improves.

The frozen five-case reader trial used identical Markdown sessions, the same
question/date, OpenCode 1.18.29 and `openai/gpt-5.6-luna`. Each arm started a
fresh session; order alternated. Gold and rubric were outside the workspaces.
The grader saw anonymized answers before arm identity. All ten runs stopped
normally, with no tool errors or vault changes. The [sanitized row data](../../eval/competitor-pilot/matched-preview-fresh-five.json)
record runner/source/config/vault hashes, usage and grades. Raw traces and
answers remain private. Source: LongMemEval S revision
`98d7416c24c778c2fee6e6f3006e7a073259d48f`, SHA-256
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.

| Metric, five pairs | Matched wide previews | Ordinary `--auto` |
| --- | ---: | ---: |
| Core answer correct and required evidence complete | 5/5 | 5/5 |
| All material claims directly supported | 5/5 | 4/5 |
| Safe abstention | 1/1 | 1/1 |
| Median elapsed | 17.9 s | 27.4 s |
| Median tool calls | 3 | 5 |
| Median host input counter, excluding cache | 21,386 | 25,943 |
| Median cache-inclusive input | 41,524 | 102,493 |
| Median first retrieval response | 7,011 bytes | 32,204 bytes |

Matched previews were faster in **three of five** pairs and used fewer tool
calls in three; one tied and one used more. Both arms preserved the required
answer and evidence in all five. On the sole abstention task, matched output
omitted a preview for one of two comparison paths, but kept the path; its
reader still found both sources and abstained safely. Ordinary `--auto` added
an author's name not present in its cited note on the book question. The name
may be true from outside knowledge, but it was unsupported by vault evidence.
This one difference cannot establish that filtering caused better support.

The input and cache counters are host-reported, not subscription bills. Run
order and provider cache state can affect them. With one run per case, five
cases and only one unknown, we cannot estimate variance, p95, or a general
quality gain. This remains a development observation, not a release gate.

## Decision

Keep `--matched-previews` opt-in, and retain ordinary `--auto` as the
experimental baseline. The filter substantially shrinks wide bundles while
preserving all five core outcomes in this small suite, but it has not met the
[promotion criteria](optimization-loop-2026-09-27.md). The next iteration
should first repair unnecessary wide routing on narrow questions, then test
fresh answerability and citation support with repeated runs before any default
change.
