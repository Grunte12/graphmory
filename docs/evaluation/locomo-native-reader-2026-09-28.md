# Matched native LoCoMo Curator/Lead diagnostic — 2026-09-28

## Frozen protocol

The [manifest](../../eval/reader-pilot/locomo-native-reader-manifest-2026-09-28.json) freezes three exposed LoCoMo development questions from distinct conversations: category 1 multiple evidence, category 2 temporal reasoning and category 5 adversarial/unanswerable. Deterministic selection excludes previously generated question IDs but **does not** make their previously evaluated histories fresh holdout. The three sealed conversations remain unrendered. Six planned answer workflows completed without substitution or retry.

Both tools use the same Luna `gpt-5.6-luna` Curator, Sol `gpt-5.6-sol` Lead, low reasoning, ten-round/300,000-byte per-prompt ceilings and structured Lead citations, through Codex CLI 0.146.0. Labels are separate from reader inputs; no tool use is allowed inside model calls and traces are checked. The runner mediates candidate pages and only the originals the Curator requests. Hosts start fresh on each round; no persistent session or compact follow-up is enabled. Arm order alternates by case. Host caches cannot be reset.

Basic Memory 0.23.2 uses native `search-notes --hybrid` and `read-note`. Each native FTS/vector index verified 29/30/29 observed and indexed notes, the same number of actual embeddings, zero errors and model `FastEmbedEmbeddingProvider:bge-small-en-v1.5:384`. Index builds took 13.072/14.297/13.576 seconds outside answer-workflow timing. All files were normalized by native ingestion; original/indexed hashes are recorded separately. Graphmory uses `recall-managed --auto --agent` and `read-notes` on immutable originals. Native formats, page sizes and payloads intentionally differ; this is a workflow comparison, not isolation of ranking algorithms.

## Results

The [sanitized report](../../eval/reader-pilot/locomo-native-reader-development-2026-09-28.json) preserves six unique attempts, raw answers/briefs, page hashes, reads, native bytes, all host usage, index state and frozen code hashes.

| Case | Tool | Answer summary | Raw QA score | Original notes read | Workflow seconds | Gross / cached input |
|---|---|---|---:|---:|---:|---:|
| Letter count | Basic | Cannot determine | 0 | 0 | 44.661 | 115,741 / 14,080 |
| Letter count | Graphmory | 2 letters; childhood notes unspecified | 0 | 29 | 32.150 | 86,456 / 8,960 |
| Creative-team meeting date | Graphmory | 8 June 2023 | 0.375 | 1 | 25.205 | 53,251 / 14,080 |
| Creative-team meeting date | Basic | June 8, 2023 | 0.375 | 0 | 20.743 | 49,977 / 14,080 |
| Tim's surfing feelings | Basic | Tim does not surf; reading feelings distinguished | 0 | 0 | 19.055 | 51,271 / 14,080 |
| Tim's surfing feelings | Graphmory | Tim does not surf; feelings unsupported | 0 | 1 | 27.560 | 64,476 / 28,160 |

Both arms complete 3/3 workflows and have mean raw QA score **0.125**, also 0.125 after the predeclared failure adjustment because none failed. Median workflow time is 20.743 s for Basic and 27.560 s for Graphmory. Total gross input is 216,989 versus 204,183; cached input is 42,240 versus 51,200. Cache shares, source selection and native payloads differ; these observations do not prove causal cost savings, noninferiority, p95 behavior or general superiority. Subscription billing remains unknown. All calls supplied usage counters.

### Original-source and answer audit

This is an **unblinded implementation-agent review**, not independent calibrated support grading:

- The letter reference is “Two.” Graphmory's digit `2` and its longer raw sentence score zero under the unchanged category-1 function. The two gold turns describe separate received letters, and the additional childhood-notes qualifier is supported by another actually read turn. Basic safely declines but misses the recorded count. Its native search delivered all 29 candidates over three pages; [exact replay](locomo-native-output-audit-2026-09-28.md) confirms the live page hashes, so empty source reads must not be called a retrieval miss.
- Both meeting-date answers match the reference semantically: a conversation timestamped 9 June says the meeting occurred “yesterday.” The unchanged raw scorer gives 0.375 to both full-sentence answers. Graphmory reads/cites that original; Basic uses native search content, with no separate original read.
- Both surfing answers correctly reject the premise: Tim explicitly says he does not surf and compares his reading experience with John's surfing. The category-5 phrase-based scorer gives zero because their raw refusal wording is outside its recognized phrases. This demonstrates a scorer/semantic distinction, not license to rewrite emitted answers or change the official scorer after seeing outcomes.

The content review finds three requested behaviors in Graphmory and two in Basic on these three cases. That is not an independently validated supported-complete rate. **Final Lead citation completeness also differs:** Graphmory's three answers name source paths in the structured citation array, while all Basic arrays are empty even though two Curator briefs contain exact paths. The runner's citation-identity check passes those empty arrays vacuously; it cannot establish evidence coverage or grounding. Preserve this provenance handoff problem separately from content correctness and workflow completion. Do not describe Basic's missing original reads as proof that its two source-supported answers are ungrounded: native search supplied content too.

### Harness limitation affecting interpretation

The fresh-call mediator forwards only the current page plus requested originals; older preview bodies are not carried forward. The multi-page Basic count workflow therefore discards old previews unless Curator explicitly reads their originals. Paths remain accessible, and the Curator can request them, but it did not. Graphmory's wide page supplied all 29 candidates and it requested all originals. This is a real tested contract difference and a possible contributor to the result, not a measured causal explanation. A persistent/compact Curator A/B is needed before attributing that answer gap to either product. Reading the entire 29-note history is also a concrete Graphmory efficiency concern; success alone does not make that behavior desirable.

## Scorer provenance and next gate

Separate [Basic](../../eval/reader-pilot/locomo-native-basic-score-2026-09-28.json) and [Graphmory](../../eval/reader-pilot/locomo-native-graphmory-score-2026-09-28.json) scores preserve emitted raw answers. The four unmodified QA function bodies come from [pinned LoCoMo evaluation.py](https://github.com/snap-research/locomo/blob/3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376/task_eval/evaluation.py), SHA-256 `8e3be5d57ff2ff9ec5cd05939592f468c5f3f1fd95d13e431932bdf6bf0fd6fd`; imports are adapted to avoid unused BERTScore. This is a selected development run, not a full official benchmark CLI result. Do not add semantic review counts to raw QA scores.

No production retrieval/prompt default changed. Next, isolate Curator session persistence on the same multi-page exposed case, preserve original-selection and citation failures, then freeze the successful protocol before an independent matched comparison. Until independent support labels, holdout, usability and efficiency gates pass, no superiority claim follows.

```sh
node scripts/prepare-locomo-native-reader.mjs --input /path/to/pinned/locomo10.json --out /new/prepared
python3 scripts/run-locomo-native-reader.py --prepared /new/prepared --out /new/runs
/path/to/scorer-venv/bin/python scripts/summarize-locomo-native-reader.py --prepared /new/prepared --runs /new/runs --scorer-source /path/to/pinned/evaluation.py --out /new/summary
```

## Verification and cleanup

`npm run check` passed 296/296 tests, example validation and configured deterministic gates. The new accounting regression rejects pending, duplicate and unknown trials before any output score is created. `git diff --check` passed. Native builder and mediator hashes match the frozen manifest; all six trials have unique planned identities and all host counters are present. The source-index snapshots and raw QA score artifacts remain committed, while disposable reconstructed vaults, native indices, host traces, scorer scratch labels and check logs are removed after review. Basic Memory's generated `:memory:.ses` file is also removed. The required user-vault status returned `SYNC_CONFIG_NOT_FOUND`; the user's Obsidian files were not modified.
