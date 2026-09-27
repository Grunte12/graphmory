# Live A/B: omitted preview versus mandatory original read

## Frozen protocol

Compare old metadata (an empty selected preview sets `sourceReadRequired`)
with new metadata (`previewOmitted`). The wrapper projects old metadata from
current retrieval output; discovery, query, ranks, previews, and instructions
are identical. Both arms know both flags' meanings. Codex CLI `gpt-5.6-luna`,
low reasoning, read-only, fresh ephemeral sessions. Source reads and next-page
requests use the same mediated JSON interface; no native shell bypass.

At most 16 pairs: eight cases, two repeats, alternating arm order. First run
the two safety counterexamples: Cedar responsibility/schedule wording lacks
query owner/deadline terms, and the Rowan answer must be absent from page one
but reachable through subsequent offsets. Then run six prior development
cases. The first six from prior work are reused diagnostic cases, not holdout
validation. All Markdown fixtures are synthetic; no private Obsidian notes.

Gold labels are fixed in the runner before trial. Literal fact/path checks
are an early-stop screen, not a semantic grader. Audit final answers manually
for correctness, citations, and cross-topic requirement attribution. Stop
when treatment loses a required fact/source that control obtains. Maximum
six model rounds per trial is a test-run budget, not a product retrieval cap;
exhaustion is an infrastructure/protocol failure, not an answer-quality score.

Retain the behavior as an optimization only if treatment gains at least three
strict supported passes, loses none, and increases neither total model calls
nor median input tokens. Treat latency descriptively. Cached input is a subset
of total input. No provider dollar-cost or competitor superiority claims.

Reproduce with a new workspace:

```sh
python3 scripts/eval-codex-preview-state.py --workspace /private/tmp/graphmory-preview-state-new
```

## Preflight amendment before later-page trials

The Cedar pair completed safely in both arms. Before the first Rowan model
trial, the fixture assertion stopped the runner: retrieval ranked its required
note third, so it was already on the default first page. This is not a model
failure or evidence of bad retrieval. Preserve the completed Cedar pair and
continue with a fresh workspace. For Rowan alone, request the product's
existing explicit `k:2` preview page mode in both arms. The required note is
then on page two; ranking and notes are unchanged. This tests supported
continuation with a deliberately small requested page, not default adaptive
paging at scale. The metadata intervention is inactive on these short,
unfiltered Rowan previews, so this case checks the interface rather than a
new-vs-old omission effect. No product limit or default is changed.

## Results and decision

Completed **16 pairs / 32 trials**, eight distinct questions repeated twice.
This is eight question families, not 16 independent benchmark samples. No
literal gold-loss stop triggered. Author manually audited every answer; the
labels were not blinded. Public evidence includes answers, source requests,
pagination offsets, all-call token usage, and grades in
`eval/competitor-pilot/preview-state-live.json`.

| Metric | Old mandatory-read metadata | New omission metadata |
|---|---:|---:|
| Required facts correct | 16/16 | 16/16 |
| Required source paths cited | 16/16 | 16/16 |
| Strict supported, relevant answer | 12/16 | 13/16 |
| Median elapsed seconds | 17.34 | 18.09 |
| Median total input tokens | 32,122 | 32,147.5 |
| Median uncached input tokens | 2,936 | 12,561 |
| Total model calls | 35 | 35 |
| Source reads, deduplicated per trial | 48 | 50 |

There was **one strict-pass gain and no strict-pass loss**. Both repetitions
of the broad recovery question remained wrong in scope: they included owner,
deadline or deployment facts as recovery requirements without source support
for that relationship. In the first deployment-restriction pair, the new arm
avoided the unrelated recovery requirement and the old arm did not. In the
repeat, both included it. Core fact correctness alone conceals this error.

Both repetitions of the weak-overlap Cedar question and Rowan continuation
question passed in both arms. Rowan requested offset 2 and cited z-final.md.
This demonstrates the mediated interface could obtain page-two evidence in
explicit small-page mode; it does not establish default adaptive deep recall.
All recorded vault integrity checks passed. No private vault was used.

**The acceptance gate failed:** gain one rather than the required three, no
reduction in calls, and slightly higher median input. New latency was about
4% higher descriptively; there are too few unique questions to infer a stable
latency effect. Stop this behavioral optimization without another prompt
variant. Keep state separation as a semantic diagnostic correction, not as a
proven performance optimization. Adaptive modes remain opt-in.

Cached input was reported, but old/new cache differences are large relative
to the tiny payload change and reflect prefix reuse, order, and host state.
Do not attribute these differences to the metadata or claim cache behavior
is perfectly optimized. Totals include every fresh CLI call and its injected
host context. No billed-dollar comparison is available.

## Verification and cleanup

`npm run check` passed; the new Python runner was syntax-checked and exercised
by every live trial. Preflight failure and the successful Cedar pair were
preserved; the restarted run skipped only that completed pair. The combined
artifact has exactly one row per question/arm/repeat. Temporary vaults and
execution wrappers were removed after collecting results. Private local
JSONL traces remain available for audit; credentials were never copied or
committed. Reproduction on later code is a new experiment: baseline runtime
commit is d313eb6.
