# Astra review: separate omitted from truncated previews

## Diagnosis and hypothesis

Astra reviewed the six-pair Codex pilot, answers, and retrieval code. It found
that an empty matched preview triggered the same mandatory source-read flag
as a truncated positive preview. Failure to meet a lexical preview threshold
does not establish that the original must be read, nor that it is irrelevant.
This may encourage unnecessary cross-topic reads. The prior control also
read those notes, so the review establishes a plausible mechanism, not a
causal explanation for the answer errors.

Implement one change: truncated selected previews keep `sourceReadRequired`;
empty previews emit `previewOmitted`. Omission describes presentation only.
Curators may still read omitted notes when their topic/path supplies required
evidence. Do not change discovery, ranks, thresholds, or candidate availability.
No model, database, or additional provider call is introduced.

## Frozen deterministic checks and results

Rerun the eight-case stress script and compare path coverage, preview coverage,
answer-marker presence and candidate count with the prior saved rows. All
16 variant rows preserved these measurements: 33/33 required paths per arm,
33/33 preview-bearing paths for auto and 31/33 for matched previews. The long
section answer still requires reading the original; the flag does not fix
preview truncation. This suite is synthetic, not a live answer evaluation.

Regression checks confirm both flags in compact CLI output, unchanged ordinary
path-only behavior, and complete ranking through byte-budget pagination across
80 long Markdown notes. All 80 paths remain reachable in baseline order; the
adaptive output requires multiple pages. Byte accounting includes the metadata
and may alter page boundaries, so invariant is complete sequence, not page size.
`npm run check`, the updated targeted tests, and `git diff --check` passed.
Saved rerun rows: `eval/competitor-pilot/preview-state-stress.json`.

## Risk and proposed live gate

An omitted preview can contain critical weak-overlap evidence, as the split
owner/deadline fixture shows. Path preservation alone does not prove the
curator will read it. The new state is not a semantic relevance judgment.
Keep adaptive modes opt-in. No new live-model quality or latency claim is made.

Astra proposes a bounded future A/B: six prior development questions plus two
counterexamples (paraphrased required evidence and required evidence on a later
page), two repeats each, at most 16 pairs. Both arms must support pagination
and identical source-read interfaces; freeze labels before running. Hide arm
labels during grading where feasible. Stop immediately on unreachable paths
or a required fact/source lost by treatment but obtained by control. Retain
the behavioral optimization only if treatment adds at least three strict
supported passes, loses none, and increases neither total calls nor median
input tokens. This is a pilot acceptance rule, not statistical proof.

That live gate has not run. This iteration corrects misleading metadata and
verifies mechanical safety; it does not demonstrate fewer reads or better
answers. Temporary deterministic vaults were removed by the test runner.
