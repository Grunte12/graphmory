# Evidence delivery stress experiment

## Question and protocol

Can compact adaptive previews hide information needed by a curator? Eight
synthetic cases were specified before running retrieval: conflicting dated
decisions, negation, evidence across notes, a long section with its answer near
the end, paraphrasing, unknown approval, 24 related notes, and nested folders.
Both `--auto` and `--auto --matched-previews` read the same temporary Markdown
vault for each case. All pages are followed. Gold note paths are explicit in
the script; no model grades its own answers. Temporary vaults are removed in
`finally`. Reproduce with:

```sh
node scripts/eval-evidence-stress.mjs --out eval/competitor-pilot/evidence-stress.json
```

This is a synthetic diagnostic, not an independent public benchmark, live
curator evaluation, or comparison against competitors. The fixtures do not
establish semantic recall: the paraphrase fixture contains just one candidate.

## Initial observations

- Both variants returned all 33 required note paths across seven answerable
  cases. The unknown case returned one related note; that is not evidence
  that the agent would correctly abstain.
- Ordinary auto included previews for 33/33 required paths. Matched previews
  included 31/33: the owner and deadline facts share only one matching content
  term each, below the two-term filter threshold.
- Both variants omitted the required answer at the end of the long section
  from the 350-character preview. A preview-bearing path therefore does not
  establish answer-evidence coverage.
- All 24 related notes were delivered together. No fixed top-three cutoff
  was introduced.

## Implementation and rerun

Keep retrieval ranks, filtering, and pagination unchanged. Mark truncated
sections with `truncated: true`; mark candidates whose previews are absent or
truncated with `sourceReadRequired: true`, including compact `--agent` output.
This exposes missing preview information without expanding every note. It
does not guarantee that the curator obeys the flag, and an unmarked preview
is not a certification that every relevant section was included.

The stress suite was rerun after this change; required path coverage and
the two observed preview limitations stayed unchanged. A regression test
checks flags for both truncation and filtered previews, and preserves the
ordinary path-only response. `npm run check` and `git diff --check` passed.

Do not infer speed from these single in-process runs: auto always runs first,
so startup/warmup biases the timings. No provider requests, cache measurements,
or private vault reads occurred. Both adaptive flags remain opt-in. Before
promotion, run a larger independent live comparison measuring supported
answers, abstention, source-read compliance, total input, and latency.
