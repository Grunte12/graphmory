# Native-tool reader comparison: integration protocol

## Fixed treatments

- Graphmory curator-mode `recall-managed` plus source-note reads.
- Basic Memory **0.23.2 native text search**, with semantic search and its reranker
  disabled, plus reads of the identical original source notes. This treatment is
  not Basic Memory hybrid, Mem0, or Graphiti.
- Both use OpenCode 1.18.29 with the same `openai/gpt-5.6-luna` subscription
  evaluator, shared evidence-based read-only prompt and fresh host sessions.
  This tests retrieval adapters, not the complete Graphmory installation/skill.

The host runner accepts `--control basic-memory-text --control-config <json>`.
The private control file specifies absolute `exe`, `state`, `home`, `notes`
paths and `project`. State/config paths must be isolated experiment directories;
never supply the user's normal Basic Memory directories. Prepare the project
and index before invoking the reader. The runner verifies CLI version 0.23.2,
records configuration and indexed-note hashes, and retains native tool traces.

Question JSON may contain `id`, `question` and optional `date` only. Date is
separate reader context, not appended to the initial search string. Both arms
receive the same reference date. This preserves temporal reasoning and avoids
the previously observed Basic Memory punctuation-sensitive dated-query failure.

The Basic Memory reader starts native search at page size 10 and may paginate
using `--page`, reformulate using native search, and read returned source paths.
The Graphmory reader may page using `nextOffset`, reformulate and read source
notes. Neither arm has a top-three note reading cap. Ordinary file search is
not the Basic Memory candidate-discovery mechanism in this treatment.

## Initial integration sample

Source: LongMemEval S, revision
`98d7416c24c778c2fee6e6f3006e7a073259d48f`, SHA-256
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
Selection seed: `graphmory-native-reader-v1`. Choose one answerable and one
abstention case deterministically by hashed ID after excluding prior pilot,
development-v2, acceptance-v2 and competitor holdout families and their relevant
evidence-session IDs. Reject malformed/future-history cases using strict-time
validation. Background sessions may overlap older cases; this is not an unseen
corpus. Two cases with one repetition per arm are an integration pilot only.

Each case has identical original timestamped Markdown inputs. Basic Memory
indexes its own copy and may rewrite frontmatter; record original/indexed hashes
and indexed counts, and verify a known-item query before any live reader call.
Readers use original source files so citation checks compare identical evidence.
Gold answers, categories and evidence labels stay outside model workspaces.
Freeze required claims against the source before viewing answers, then grade
anonymized answers. Audit native snippets and actual note reads for support;
a path alone is not evidence.

Record host input/output/cache counters, tool calls, termination, source hashes
and answer outputs. Missing usage is unknown. Subscription invoices remain
unknown; OpenCode `cost: 0` is not a billing result. One pair per task cannot
establish p95, calibrated quality, or significant superiority. A larger frozen
acceptance run is still required by the optimization-loop gates.

## Instrumentation follow-up

An initial host session exited with code zero after a rejected tool permission
and emitted no answer. The old runner incorrectly marked that process completed.
The runner now records nested tool errors and fails any answerless trial, even
when the host exit code is zero. All shell calls are explicitly instructed to use
the trial workspace rather than its parent. Preserve the original failed trace;
any retry is a diagnostic follow-up, not a replacement chosen for a better score.
`--order-offset 1` lets a separately launched case begin with the control arm;
record the offset when counterbalancing order across isolated workspaces.
The runner also requires the final host step to end with reason `stop`; interim
text followed by unfinished tool calls is a failed trial.

## Observed development result

The sanitized counters and provenance are in
[`native-reader-development.json`](../../eval/competitor-pilot/native-reader-development.json).
The original count trial for Graphmory was an instrumentation failure (permission
rejection, no answer), so it is excluded from quality and cost comparisons. Its
trace and counters remain in the artifact. A later, explicitly marked diagnostic
follow-up used the same question and sources after the workspace instruction fix.

| Case | Graphmory | Basic Memory text |
| --- | --- | --- |
| Count kitchen items, gold 5; diagnostic follow-up | Correct 5/5 with five cited source notes; 20 distinct notes read | Answered 3; omitted two items despite the indexed corpus containing them; zero original notes read |
| Egg-tart frequency, no supported count | Safely declined to invent a count; 44 notes read | Safely declined to invent a count; five notes read |

For the two valid paired cases, median **uncached input** was 120,218 tokens for
Graphmory versus 73,408 for Basic Memory text (+63.8%). Median elapsed time was
83.9 versus 67.2 seconds (+24.9%). Cache-read counters were also much higher
for Graphmory; these are host-reported tokens, not invoices. The quality result
is one Graphmory win and one tie, with uncertainty including zero. It therefore
does **not** meet the loop's cost, latency, sample-size or paired-superiority
gates. The initial count failure and diagnostic follow-up cannot be combined as
repeated independent trials.

Trace audit: the count miss was partly evidence selection, not an index miss:
the control's native results included the kitchen-mat note, but its reader did
not inspect it. Graphmory's unknown-case reader inspected every candidate,
which preserved abstention but made the path-only handoff expensive. This
motivates testing compact, source-linked excerpts as a *new treatment*, while
keeping pagination and full-note reads available. Neither this two-case sample
nor the excerpt hypothesis establishes an improved default. This pilot compares
only Basic Memory's pinned text mode, not its hybrid mode or other tools.
