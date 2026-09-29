# Curator evidence-preview development loop

## Hypothesis and implementation

The path-only curator result made the reader open many full conversation notes.
An **opt-in** `recall-managed --agent --evidence-preview` now adds short source
spans to each existing candidate row. It keeps the same ranking, paths,
pagination and unrestricted candidate total. For conversation notes, previews
come from user turns; the first turn and two query-matched turns are shown.
The reader may still open any original note and request every page. The preview
is incomplete evidence, especially for counts and conflicting statements.
There is no new model, vector database, service or default install dependency.

The [`preview-development.json`](../../eval/competitor-pilot/preview-development.json)
artifact records source and runner hashes, the two LongMemEval S case IDs, arm
order, host counters, outcome labels and source integrity checks. Gold and raw
private traces remain outside the repository. All arms ran in separate
read-only OpenCode 1.18.29 sessions with `openai/gpt-5.6-luna`; the external
control was Basic Memory 0.23.2 native text search. This tests the retrieval
adapter, not a full host installation.

## What the iteration found

The first preview picked two turns per note. On the kitchen count task it gave
Graphmory **3/5** while the control answered **4/5**. The reader paged through
all 46 candidates but opened only three sources. The missed toaster and coffee
facts existed in the returned source notes: this was an evidence-preview/read
failure, not proof that the index lacked them. That version was rejected.

The revised preview includes the initial user turn and matches inflected verbs
such as `replace/replaced`. On the **same inspected development task**, both
arms answered **5/5** with cited paths. On a second task whose egg-tart count
cannot be determined, both arms safely declined to invent a count. Graphmory
paged through the candidates and finished without reading all 44 full notes.

| Two revised-preview cases | Graphmory | Basic Memory text |
| --- | ---: | ---: |
| Median host input counter, excluding cache | 48,232 | 71,594 |
| Median total input including cache read/write | 196,968 | 267,690 |
| Median elapsed time | 50.5 s | 70.2 s |
| Correct or safe unknown | 2/2 | 2/2 |

The revised preview used about **33% less noncached input** and **28% less
elapsed time** in these two runs. The host's input counters are not a provider
invoice. Repeated trials on the same count question varied substantially, so
these numbers are diagnostic, not a stable cost estimate. The original preview
failure must remain in the record; selecting only the revised result would
overstate reliability.

## Promotion decision

Keep preview **opt-in**. It has no demonstrated quality gain over this control,
only two task families, no independent fresh acceptance test, and no p95 latency
or uncertainty estimate. It does not meet the
[optimization gates](optimization-loop-2026-09-27.md). Before enabling by
default, freeze new project/episode families, use the same host/model and
counterbalanced arms, grade complete evidence and claim support from original
notes, and check that preview never causes count/list omissions. Compare the
same Graphmory reader with and without preview, as well as named native
competitor modes. A successful case-level result does not establish superiority
over all tools.
