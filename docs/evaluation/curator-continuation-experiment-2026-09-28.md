# Curator continuation and raw QA score — 2026-09-28

## Scope

This is a traced **development** experiment on exposed LoCoMo question `conv-43:21`: “Which US cities does John mention visiting to Tim?” The vault contains the source's public conversation sessions as Markdown. The question and evidence prose were sent to the authenticated Codex CLI using `gpt-5.6-luna` at low reasoning. Gold answers/evidence IDs remained in the evaluator's separate local file. No unopened holdout, private Obsidian note, external model API key, or competitor system was involved.

Three distinct attempts are preserved. They are **not repeat trials of one frozen treatment**: the mediation protocol and prompt changed after the failure. The sample was chosen because the earlier reader experiment exposed a late-ranked Chicago source, so it cannot support a generalization claim.

| Attempt | Delivery / mediation | Result | Model calls | Host input tokens | Wall time |
|---|---|---|---:|---:|---:|
| [Bundle](../../eval/reader-pilot/curator-paging-live-2026-09-28.json) | One byte-budgeted candidate bundle; Curator asks for originals; Lead gets brief | Completed; reads 4 originals; answer lists Chicago and NYC, omits Seattle | 3 | 61,815 | 27.7 s |
| [Paged v1](../../eval/reader-pilot/curator-auto-v1-failed-2026-09-28.json) | Three actual `--auto` pages; model had to return numeric offset | **Failed:** after last page (`hasMore=false`, `nextOffset=null`), Curator asked for offset 20 again; runner rejected it | 3, no Lead answer | 85,864 | Not an accepted quality trial |
| [Paged v2](../../eval/reader-pilot/curator-auto-v2-live-2026-09-28.json) | Three actual `--auto` pages; model returns `next_page` boolean, runner owns offset and shows current page explicitly | Completed; reads 14 originals; answer lists Chicago, NYC and Seattle | 6 | 160,548 | 54.4 s |

Input-token figures are the sum of each call's native `input_tokens`; all accepted calls report `cached_input_tokens=0`. They are **not billable dollar costs**. The bundle and paged runs differ in delivered evidence, prompt, continuation contract, and the number of source reads. Their time/token gap identifies a cost risk, not a controlled causal improvement or latency superiority. The v1 failure is retained in the operational denominator, not silently scored as a successful answer.

## Failure and intervention

The v1 trace reached pages at offsets 0, 10 and 20. The final page explicitly reported no continuation. The Curator nevertheless requested `next_offset=20` once more after reading two original notes. This was a model/protocol interaction, not missing retrieval candidates. Exact trace actions and the failed row are retained in the local raw trace; the public artifact records page offsets, model usage and stop reason.

The v2 runner changes the *evaluation mediation contract*: Curator returns `next_page: boolean`; the runner uses the current Graphmory `nextOffset`, never a number supplied by the model. If a model asks for a page after exhaustion, the runner returns explicit “no more pages” feedback and gives it a chance to finish within the round budget. Each new prompt has one clearly labeled current page, verified original reads and prior path names. The repository's production CLI pagination code was **not changed**. Regression tests cover successful source delivery, rejection of unseen source paths, and exhausted-page feedback.

This repair made the selected v2 run complete. It did not prove the host would always stop correctly, nor that its answer is fully supported. The actual paged trace consumed five Curator calls plus a Lead call and read 14/29 original sessions; one case cannot estimate typical behavior.

## Benchmark score versus evidence support

The [pinned LoCoMo QA source](https://github.com/snap-research/locomo/blob/3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376/task_eval/evaluation.py) has SHA-256 `8e3be5d57ff2ff9ec5cd05939592f468c5f3f1fd95d13e431932bdf6bf0fd6fd`. Its category-1 scorer splits comma-separated answers, applies its normalization/stemming and token F1, then averages best matches to each reference answer. The [upstream license](https://github.com/snap-research/locomo/blob/3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376/LICENSE.txt) is CC BY-NC 4.0. Its code was used only in this isolated research environment; it was not copied into Graphmory's npm package.

`scripts/eval-locomo-official-qa.py` compiles the **unchanged function bodies** from that pinned source and binds only their required dependencies, avoiding the full module's unused BERTScore import. This is an extracted-source category-1 QA computation, **not the full official CLI/full-split benchmark**. It scores raw generated answers, citations included, exactly as the upstream function receives prediction text. A self-reference check scored 1.0; tampered scorer bytes and duplicate IDs were rejected.

| One-case raw QA result | Score |
|---|---:|
| [Bundle answer](../../eval/reader-pilot/curator-bundle-raw-qa-2026-09-28.json) | 0.3016 |
| [Paged v2 answer](../../eval/reader-pilot/curator-auto-v2-raw-qa-2026-09-28.json) | 0.6349 |

These numbers are not semantic correctness probabilities. Citation/path text lowers token precision, and `NYC` versus `New York` is handled lexically. The reference answer includes Seattle, but its supplied gold turn `D3:19` says a game there is **next month** and calls it a favorite city to explore. The bundle brief omitted Seattle as a past visit; paged v2 listed Seattle as though visited. A strict time-aware verdict therefore needs independent adjudication; neither approach can be declared supported-complete from this score. The artifacts leave semantic verdicts null. The one-case raw QA score is not comparable to a published full LoCoMo result.

## What this changes next

Keep the production continuation behavior and retrieval profile unchanged pending a multi-question, matched-budget experiment. The evidence points to two concrete product risks: (1) an agent can misuse numeric continuation even when CLI is correct; (2) paging through full session prose can cost more than an evidence bundle while still harming temporal precision. Test a host-facing continuation affordance and conservative evidence selection on **new development cases**, then run matched reader/Curator arms with repeated family-grouped outcomes. Score official category metrics and independently reviewed support separately. Include unanswerable, contradiction and update cases before any acceptance claim.

No superiority, noninferiority, end-to-end cost saving, or goal-completion gate is satisfied by this experiment.

## Verification and reproducibility

`node --test test/curator-paging-pilot.test.mjs` passed 3/3 meaningful protocol cases; `npm run check` passed **281/281** tests and configured deterministic gates after the runner/source changes. `npm pack --dry-run --json` listed 95 package files and excluded the development runner, scorer and experiment artifacts. Scorer smoke checks gave 1.0 for reference-versus-itself, rejected a changed upstream source hash, and rejected duplicated prediction IDs. These checks validate harness invariants only.

To reproduce locally, download the exact pinned [scorer source](https://raw.githubusercontent.com/snap-research/locomo/3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376/task_eval/evaluation.py) outside the repository and install `numpy`, `regex`, and `nltk` in an isolated development Python environment; no runtime dependency is added for Graphmory users. Use `node scripts/prepare-reader-pilot.mjs --input <pinned-locomo10.json> --out <new-dir>` to create separate reader input, labels, and a read-only Markdown vault. Then run `python3 scripts/run-curator-paging-pilot.py --input <new-dir>/paging-input.json --out <new-run-dir> --mode auto --max-rounds 5`. The runner refuses to overwrite any prior run. Its model availability and subscription usage depend on the authenticated host. The original private local JSONL traces remain outside the repository for audit.
