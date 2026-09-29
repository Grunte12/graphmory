# Section preparation: reuse document-invariant tokenization

## Inspection and frozen hypothesis

The loader reads/parses vault documents for each CLI invocation. Cross-process
caching would require persistent cache invalidation and private derived data;
do not introduce it without an end-to-end profile and stronger justification.
Within each request, section preparation recomputes the same path, title,
metadata string and their tokens for every section in a note. These values
are invariant across sections. Compute them once per note, then copy token
arrays into each section to preserve independent mutable arrays. Section
heading/body processing, ranks, candidate discovery and pagination stay intact.

Freeze comparison against `c272cf4:src/retrieval.mjs`. Use 100 and 1,000
synthetic Markdown notes with 12 sections each; nine timed repetitions per
arm, alternating order. Timing covers cold section preparation after parsing,
not CLI startup, file I/O, ranking, LLM time or subsequent pagination. Compare
every serialized section and all returned IDs/scores for three ranking queries.
Keep only if exact parity holds and median section time falls at both scales;
otherwise revert. Do not infer answer-quality improvement from this test.

```sh
node scripts/bench-section-preparation.mjs --out eval/competitor-pilot/section-preparation.json
```

The runner materializes the pinned public module temporarily, fixes only its
relative import to the current resolver, and removes it in `finally`. Resolver
code is identical across arms. Synthetic aliases, metadata, multiple headings
and negation are included. No user vault or provider call is used.

## Whole-request follow-up and results

Before claiming a tool benefit, add five alternating repetitions of complete
in-process `managedRecall` at each scale: load files, parse, rank and generate
adaptive matched previews. Use fresh document arrays on every request. Clone
the current source modules temporarily for the control and replace only its
retrieval module with the pinned baseline. All other code is identical.
Compare complete serialized managed responses exactly for every pair. The
timing includes vault I/O but excludes Node process startup and any model.
Filesystem caches are warm and both arms share the machine; not cold disk I/O.

| Phase | Notes | Baseline median ms | Candidate median ms |
|---|---:|---:|---:|
| Section preparation | 100 | 14.005 | 9.926 |
| Section preparation | 1,000 | 127.891 | 92.071 |
| Complete managed recall | 100 | 33.699 | 30.079 |
| Complete managed recall | 1,000 | 286.059 | 239.645 |

Keep the change: median section preparation fell about 28–29%, and complete
managed recall about 11–16% on these fixtures. All 1,100 notes' section payloads,
six ranked-query comparisons, and ten complete response comparisons matched
exactly. No new cache, daemon, configuration, or dependency is introduced.
This does not remove repeated vault I/O between CLI invocations. Notes with
few sections may benefit less; no general real-vault or agent-latency effect
has been measured. Retrieval correctness and quality are preserved on the
checks, not improved. `npm run check` and `git diff --check` passed. Temporary
source clones and vaults were removed in `finally`.
