# LongMemEval development CLI delivery — 2026-09-28

## Why this experiment

The preceding one-question LoCoMo pilot suggested a byte-budgeted bundle could spare Curator pagination. This check asks whether that repeats on a different memory dataset **without** paying for 14 live model workflows. It executes Graphmory's actual `recall-managed --agent` CLI on public [LongMemEval](https://github.com/xiaowu0162/LongMemEval) sessions rendered as Markdown, follows every `nextOffset` to exhaustion, and verifies original source hashes. It is a mechanical delivery experiment, not official answer accuracy or autonomous Curator behavior.

## Frozen sample and controls

- Same pinned cleaned-S dataset bytes as the existing [development-v2 report](../../eval/longmemeval/development-v2.json), SHA-256 `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
- First two already-selected, exposed development cases from each category: 12 answerable across six types, plus two abstention cases. The sample was inspected and is not a fresh holdout.
- Same raw question-only query and corpus per case; no appended benchmark date. The date must still be supplied for a future temporal reader evaluation. Gold answers/session paths are present only in the evaluator process, never in the CLI query.
- Four Graphmory treatments: mixed-notes versus conversations profile, each with `--auto` versus `--bundle`. Each request uses the same 32 KB bundle default and source vault for its case. The script records each actual page, candidate count, byte count, source-read flags and stop contract; it rejects source mutation and duplicate paths.
- Deterministic controller exhausts all candidates to measure reachability. A real Curator may stop sooner; exhaustion cost is **not** normal workflow cost. Byte count is stdout, not model tokens or billed spend.

## Results

All **56/56** CLI trials completed without protocol/hash failure. Every answerable case had all required gold source-session groups available on the **first page** in all four treatments (12/12 per treatment). Two abstention cases had candidates, which says nothing about whether a reader would abstain. This small sample did **not** reproduce the page-three LoCoMo failure.

| Treatment | First-page complete (answerable) | Total pages if exhaust all 14 cases | Median first-page output |
|---|---:|---:|---:|
| mixed-notes / auto | 12/12 | 35 | 20,614 bytes |
| mixed-notes / bundle | 12/12 | 28 | 30,475 bytes |
| conversations / auto | 12/12 | 28 | 30,664 bytes |
| conversations / bundle | 12/12 | 28 | 30,642 bytes |

On this selected sample, mixed-notes `--bundle` sends about 10,320 **more bytes per case on average** on page one than mixed-notes `--auto`, with no improvement in first-page gold-session completeness. The median first-page bytes are roughly 48% higher. Seven paired cases have a large positive bundle-minus-auto byte difference; seven have a small negative one. In conversations profile, `auto` and `bundle` select essentially the same wide delivery; bundle is 22 bytes shorter per case because of metadata differences. These figures do not count subsequent original-source reads or host prompts, so they cannot establish end-to-end cost.

The full-exhaustion total bytes are almost equal (about 588–589 KB per 14 cases), because all modes eventually list the same candidate pool. Comparing that total to normal agent usage would be misleading. The contrast with LoCoMo shows why setting bundle globally from one late-evidence example would be premature.

Repository verification after this experiment: `npm run check` passed 281/281 tests and configured gates; `npm pack --dry-run --json` listed 95 files, excluding this development runner and its evaluation artifacts. The configured vault sync check for `<private vault>` reported `SYNC_CONFIG_NOT_FOUND` because that vault has no Graphmory sync configuration; no vault files were changed.

## Repeated instrumentation and comparator boundary

The [initial 56-trial artifact](../../eval/reader-pilot/longmemeval-cli-delivery-initial-2026-09-28.json) did not record bytes by page. A second [56-trial run](../../eval/reader-pilot/longmemeval-cli-delivery-pagebytes-2026-09-28.json) added that diagnostic field. Every pre-existing field was identical in **56/56 paired rows**, including all page contracts, candidate counts and total output bytes. This checks deterministic instrumentation parity; it is not 112 independent questions. The runner source hashes distinguish versions. Temporary source vaults were removed after verification.

These 14 IDs and dataset bytes also match the earlier [Basic Memory 0.23.2 text-search pilot](../../eval/competitor-pilot/README.md). That prior controlled comparison measured **complete evidence@3/@12** for different search backends; it found Graphmory 10/12 versus Basic Memory text 8/12 at @3, with both 12/12 at @12. The current first-page results have variable page sizes (about 20–32 candidates on page one), so **12/12 first-page completeness is not a matched @12 comparison** and must not be used as a new competitor win. Basic Memory hybrid, final answers, model time and quality remain untested on these cases.

## Follow-up diagnostic: first-page paths versus usable text

A third mechanical run [recorded gold-source flags and bytes](../../eval/reader-pilot/longmemeval-cli-delivery-goldread-2026-09-28.json) for the same 14 exposed cases. After removing only the newly added fields, its rows matched the prior byte-instrumented run **56/56**. Each arm returned all 20 gold-session paths on page one across the 12 answerable cases. **All 20/20 carried `sourceReadRequired`**; none was a complete original-source preview. The combined gold-path previews occupied 18,004 JSON bytes, while the 20 original Markdown sessions occupied 285,237 bytes (about 15.8× as much). These counts are identical across arms because the same gold paths and previews were returned. The original-size total is an *oracle-selected lower bound* for reading just those sources; a real Curator does not know gold paths and may read more. A partial preview might already contain the answer, so `sourceReadRequired` is a completeness warning, not proof of answer failure.

This corrects the interpretation of “first-page complete”: **path reachability is 12/12, but evidence sufficiency and answer quality remain unmeasured**. The next live experiment should trace which sources the Curator actually opens and score supported answers separately from paths and bytes.

## Decision

No retrieval or bundle default changes. Keep `--auto` and `--bundle` as available modes; choose based on task evidence, not a universal rule. The next useful controlled test is *actual* Curator/Lead answer quality and whole-workflow cost on a larger family-diverse sample, with an independent support adjudication and matched candidate/source budgets. Preserve the LoCoMo late-evidence cases as a separate stress slice. This development study cannot satisfy the active goal's final quality, efficiency or broad competitor gates.

Reproduce from the repository root, using a new output path:

```sh
node scripts/eval-longmemeval-cli-delivery.mjs --input tmp/datasets/longmemeval_s_cleaned.json --out /tmp/lme-cli-delivery-new.json
```
