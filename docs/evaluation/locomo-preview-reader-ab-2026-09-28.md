# LoCoMo preview-reader A/B development diagnostic — 2026-09-28

## Predeclared protocol

[Manifest](../../eval/reader-pilot/locomo-preview-reader-ab-manifest-2026-09-28.json) was saved before the first generation. The fixed hash seed selects one question per upstream category from five distinct exposed development conversations, excluding previously attempted reader questions. Every pair uses identical original Markdown, question, low reasoning, Luna `gpt-5.6-luna` Curator and Sol `gpt-5.6-sol` Lead. Fresh host calls, max ten Curator turns, 300,000 prompt-byte budget, structured citations. The only treatment difference is `--coverage-previews`; both use `recall-managed --auto --agent`.

Execution order alternates existing-first and coverage-first across pairs. Five pairs cannot balance an odd count perfectly, reset host caches, power a superiority test or estimate p95 latency. All ten planned trials remain in accounting; failures are preserved and not replaced. No sealed conversation is rendered. This is development reader evidence, not an independent holdout or competitor comparison.

Categories: 1 multi-hop, 2 temporal, 3 single-hop, 4 open-domain, 5 adversarial, following the pinned upstream evaluator. Category 3 uses only the first semicolon-delimited reference component. Category 5 uses a refusal-phrase heuristic rather than semantic adjudication. Reference answers are separate from model input; category 5's absent answer is represented as an empty string for the unchanged scorer, which ignores it.

## Reproduction

```sh
node scripts/prepare-locomo-preview-reader-ab.mjs --input /path/to/pinned/locomo10.json --out /tmp/preview-reader-prepared
python3 scripts/run-locomo-preview-reader-ab.py --prepared /tmp/preview-reader-prepared --out /tmp/preview-reader-runs
/path/to/scorer-venv/bin/python scripts/summarize-locomo-preview-reader-ab.py --prepared /tmp/preview-reader-prepared --runs /tmp/preview-reader-runs --scorer-source /path/to/pinned/evaluation.py --out /tmp/preview-reader-summary
```

The recorded original attempts use the mediator from commit `4b7b11f`; the current mediator has the separately documented citation-identity repair. To replay the exact original treatment, use a separate checkout with that mediator version and the recorded source hashes. Preparing with current code freezes a new development variant, not a retroactive repair of these outcomes.

The runner validates frozen source and input hashes, excludes labels from its input, mediates actual retrieval and original reads, records native host usage and stops on host-wide quota/unsupported-model failures. The summarizer checks trial coverage, input/runner hashes and treatment identity. Preserve all raw generated answers, including ones emitted before an operational provenance failure. Report raw official-function scores separately from operational-adjusted scores assigning zero to failed/no-answer trials, as predeclared. Neither is the primary independently adjudicated supported-complete metric.

## Results

All ten planned trials were attempted. [Sanitized run/score artifact](../../eval/reader-pilot/locomo-preview-reader-ab-2026-09-28.json). Raw local traces remain available for auditing. No live trial was replaced after a failure.

| Metric | Existing | Coverage opt-in |
|---|---:|---:|
| Operationally complete / planned | 3/5 | 3/5 |
| Mean pinned raw QA score, all planned | 0.0261 | 0.0360 |
| Mean operational-adjusted QA score | 0.0261 | 0.0360 |
| Median seconds, completed workflows only | 41.028 | 49.728 |
| Input tokens, all attempted workflows | 431,872 | 518,030 |
| Cached input tokens, all attempted workflows | 147,712 | 180,992 |

Completed-workflow sets differ between arms, so their medians are not a matched causal latency comparison. Coverage used about 20% more total reported input tokens; host caches, source selection and failed workflow termination also differ. Do not infer monetary cost or general efficiency from this sample.

| Case/category | Existing outcome / raw score | Coverage outcome / raw score |
|---|---|---|
| `conv-42:19` / multi-hop | Emitted “2 times”; citation verifier rejected / 0 | Same / 0 |
| `conv-47:52` / temporal | Stopped on repeated source request; no answer / 0 | Approximate June–July 2022, exact date unstated / 0.125 |
| `conv-48:36` / single-hop | Exact age unstated / 0 | Stopped on repeated source request; no answer / 0 |
| `conv-26:142` / open-domain | Long description of learning/growth/support / 0.1304 | Longer description of learning/growth/support / 0.0548 |
| `conv-30:84` / adversarial | Contemporary dance piece / 0 | Kind of piece not specified / 0 |

## Non-blinded diagnostic audit

This audit is by the implementing agent with labels visible. It is useful for classifying errors, **not independent semantic grading or primary acceptance**.

1. `conv-42:19`: both read both reference notes and answered two occurrences, semantically equivalent to reference “twice.” The unchanged token scorer gives zero. Their briefs use `session_8` and `session_11`; exact file-extension matching falsely rejected otherwise traceable identities. The [separate repair](citation-identity-repair-2026-09-28.md) leaves original operational failures intact.
2. `conv-47:52`: coverage reads the reference note and qualifies its temporal estimate. Reference says approximately summer 2022; the low lexical score alone cannot determine temporal support. Existing flow already read the gold note before requesting a previous source again. The mediator treats repeated reads as fatal, which differs from ordinary idempotent read tools and needs protocol review.
3. `conv-48:36`: reference infers “likely no more than 30” from studying/internships. Those observations do not establish an age bound. Existing answer refuses to invent an exact age; a zero official score must not be used to incentivize unsupported age inference. Neither arm read all seven reference source notes. Preserve reference-support disagreement for independent review, without relabeling or dropping the case.
4. `conv-26:142`: both read the reference source and include learning/growing, but overexpand beyond the requested description. Any extra claims require claim-level support review; gold-note reads are insufficient. Longer output lowers the lexical overlap score and increases audit burden.
5. `conv-30:84`: the dance-piece evidence is spoken by Gina, while the question asks about Jon. Existing answer transfers that claim to Jon. Coverage declines to specify the kind, but “not specified” gets zero from the upstream category-5 check, which accepts only “no information available” or “not mentioned.” Do not rewrite raw output to increase the official score; preserve the speaker mismatch and weak refusal metric separately.

## Decision and next step

Keep coverage previews opt-in. This diagnostic does not establish quality superiority; neither arm satisfies the independently reviewed supported-complete gate. No comparator answer workflow or holdout has been evaluated here.

First repair evaluator citation identity, then freeze a more faithful read contract: already-delivered original sources should be explicit and repeat requests should be idempotent with feedback, while unseen/out-of-vault requests remain errors. Test this contract deterministically before any new live comparison. Reusing these exposed cases is development only. A future final protocol must freeze primary support labels and matched competitor/host conditions before opening sealed conversations.

## Scorer and mechanical verification

The unchanged extracted QA functions come from [pinned LoCoMo evaluation.py](https://github.com/snap-research/locomo/blob/3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376/task_eval/evaluation.py), source SHA-256 `8e3be5d57ff2ff9ec5cd05939592f468c5f3f1fd95d13e431932bdf6bf0fd6fd`. The wrapper adapts imports only; it is not a full official benchmark CLI run. Category-specific scores and inference/refusal limitations remain separate from semantic support.

A second no-model scoring pass produced a byte-identical summary. Controlled ledger probes rejected pending, duplicate and unknown attempts before creating a score directory. Frozen runtime drift was rejected before any new model call. `npm run check` passed 288/288 tests, example validation and configured deterministic eval gates. `git diff --check` passed. Obsidian sync status remains `SYNC_CONFIG_NOT_FOUND`; the user's vault was untouched. These checks do not establish primary semantic or competitor acceptance.
