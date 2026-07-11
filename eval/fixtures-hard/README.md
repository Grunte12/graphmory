# eval/fixtures-hard

Hard retrieval regression fixtures for `scripts/eval-retrieval-hard.mjs`. See
`queries.json` for query cases and `thresholds.json` for frozen regression
floors. Run `npm run eval:retrieval:hard:gate` to enforce them.

The gate separates ranking from answerability. `abstentionAccuracy` measures
correct refusal on the six unanswerable cases, while
`answerableAcceptanceAccuracy` penalizes false refusal on answerable cases.
`selectiveAccuracy` is stricter: an answerable case counts only when it is both
accepted and retrieved in the top `k`; an unanswerable case counts only when it
is refused. This prevents an "abstain on everything" policy from looking good.
Each JSON run also records the lexical confidence signals and thresholds used
for its decision, so future calibration can inspect score share and top/second
separation without reverse-engineering the ranking output.

## Multilingual category split (2026-07)

The original `multilingual` category mixed two different things under one
label: queries that exercise Thai word segmentation against notes that *do*
carry Thai vocabulary, and queries that happened to be pure Thai against
notes that only ever had English content. The second case is cross-lingual
retrieval (query language != corpus language), which no lexical method
(BM25F, vault-mined alias expansion) can pass by construction — there is no
shared vocabulary to match on. Treating both as one category conflated a
measurable, fixable gap with an out-of-scope one.

The category was split:

- **`multilingual`** (bilingual-aliased, scored, floor applies): the four
  `globex-*` gold notes now carry natural Thai `aliases:` phrases translating
  their actual topic (e.g. `globex-remote-work-policy` gets
  `ทำงานจากที่บ้าน`, `นโยบายทำงานทางไกล`). This is the harness's documented
  curation-first remedy — add real vocabulary the corpus is missing rather
  than trying to make the retriever translate. The four pure-Thai queries
  (`multilingual-remote-work-th`, `multilingual-expense-th`,
  `multilingual-password-th`, `multilingual-parental-th`) now hit at rung 1
  via the aliases field (BM25F field weight 4), with no semantic/translation
  step involved. Aliases are natural Thai expressions of the note's topic,
  not verbatim copies of any query string.

- **`multilingual-crosslingual`** (documented gap, reported separately, not
  held to the `multilingual` floor): two pure-Thai queries
  (`crosslingual-vuln-ack-th`, `crosslingual-retry-th`) target two other
  existing gold notes (`helix-security-handbook`, `quasar-retry-limit`) that
  intentionally receive **no** Thai aliases. These are expected to miss under
  every lexical method available today; that is the honest baseline for
  true cross-lingual retrieval, not a bug. This category exists so the gap
  stays visible and measured (not hidden by omission, and not masked by
  quietly deleting the hard queries) rather than being silently absorbed
  into — or artificially inflating/deflating — the `multilingual` score.
  Closing this gap for real is out of scope for the lexical/BM25F pipeline
  and is deferred to a Phase B semantic/cross-lingual retrieval rung.

Both categories are reported per-category by `scripts/eval-retrieval-hard.mjs`;
`thresholds.json` has no threshold set for `multilingual-crosslingual` for the
same reason it accepts a sub-0.5 score today — it is a documented gap, not a
regression target.
