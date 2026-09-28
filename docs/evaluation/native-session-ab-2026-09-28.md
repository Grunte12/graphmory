# Native Curator session persistence A/B — 2026-09-28

## Decision

Do not promote persistent Curator sessions from this experiment. In both tools the persistent arm stopped with only one of two gold originals read and answered one letter; the fresh arm read both and answered two. Persistence successfully resumed the actual host thread, but did not fix complete-evidence selection. This is one exposed question, one generation per cell: it identifies a failure mode, not a general preference or superiority result. Production defaults remain unchanged.

## Frozen design and artifacts

One development LoCoMo question (`conv-42:62`), 29 immutable original Markdown sessions; Luna `gpt-5.6-luna` Curator and Sol `gpt-5.6-sol` Lead, low reasoning. Basic Memory 0.23.2 native hybrid index versus Graphmory managed auto. Per tool, change only Curator persistence; keep full follow-up rendering, structured citations, ten rounds and 300,000 input-byte budget. Lead starts fresh in every cell. Fixed order: Basic fresh, Basic persistent, Graphmory persistent, Graphmory fresh. No label or gold path is passed to either model.

- [Initial frozen manifest](../../eval/reader-pilot/native-session-ab-manifest-2026-09-28.json)
- [Failed prerequisite accounting](../../eval/reader-pilot/native-session-ab-preflight-failed-2026-09-28.json)
- [Separately frozen retry manifest](../../eval/reader-pilot/native-session-ab-retry-manifest-2026-09-28.json)
- [All four measured results](../../eval/reader-pilot/native-session-ab-results-2026-09-28.json)
- [Unmodified raw QA scores](../../eval/reader-pilot/native-session-ab-raw-scores-2026-09-28.json)
- [Batch runner](../../scripts/run-native-session-ab.py), [summarizer](../../scripts/summarize-native-session-ab.py)

The corpus SHA-256 and runtime/input/original hashes are preserved in manifests. Three sealed conversations remain unrendered. Reusing this exposed question does not create a holdout.

## Failed initial prerequisite

The first native index build failed before any host generation. Native stderr reported SQLite result 8 for the Python URL cache database, followed by a recursive-mutex exception/abort. A missing writable cache permission is a plausible contributing factor, not a proven sole cause. Preserve one failed index and four blocked workflow slots; zero model attempts occurred. Their conventionally adjusted zero scores are operational accounting, not measured answer-quality failures.

After specific cache-directory write permission was granted, a separate four-slot batch built the hybrid index successfully and completed all four workflows. The retry links the first manifest hash rather than overwriting the failure. Across both batches there are eight scheduled workflow slots, four blocked before generation, and four actual completed workflows; these do not represent eight independent answer trials.

## Measured retry results

| Tool | Curator | Answer count | Gold originals read | Pages / total originals read | Calls incl. Lead | Whole workflow s | Gross / cached / noncached input |
|---|---|---:|---:|---:|---:|---:|---:|
| Basic | Fresh | 2 | 2/2 | 2 / 12 | 6 | 87.306 | 208,997 / 43,520 / 165,477 |
| Basic | Persistent | 1 | 1/2 | 1 / 2 | 3 | 38.646 | 150,841 / 48,896 / 101,945 |
| Graphmory | Persistent | 1 | 1/2 | 1 / 10 | 3 | 30.495 | 104,105 / 21,248 / 82,857 |
| Graphmory | Fresh | 2 | 2/2 | 1 / 29 | 3 | 30.070 | 86,429 / 0 / 86,429 |

All four returned structured citations with valid source identities. Identity validation does not establish support completeness: each persistent answer cited only its single gold source. Source-path/hash records distinguish original reads from native search content; missing original reads alone do not imply a candidate was absent.

All thread identities pass the independent trace audit. Persistent arms each have two Curator calls with the same hashed `thread.started` identity and exactly one actual resume; fresh arms use distinct identities and no resumes. Thus the intended intervention really occurred. This does not prove causal quality differences with one stochastic generation per cell.

## Answer/scorer audit

The pinned reference is “Two.” All four unchanged emitted sentences receive raw QA F1 **0**, including the fresh arms' correct digit `2`. Keep these scores intact. The raw artifact identifies the unchanged [upstream LoCoMo QA function bodies](https://github.com/snap-research/locomo/blob/3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376/task_eval/evaluation.py), their hash and environment adaptation; this is not a full upstream CLI evaluation.

Unblinded author review of the original turns finds two separate letters: the company rejection at D14:1 and blog-reader letter at D18:5. Fresh answers identify/cite both. Basic persistent identifies only the blog letter; Graphmory persistent identifies only the rejection and correctly deduplicates its repeated mention, but misses the other letter. Additional childhood notes at D27:30 have unspecified count and are not additional counted gold letters. This review is not calibrated independent semantic grading and does not satisfy the primary quality gate.

## Interpretation and next optimization

The earlier fresh-session count omission was not reliably reproduced: Basic fresh now finds both letters. Persistence is insufficient to solve complete-evidence selection and may preserve an early narrow interpretation. The current experiment cannot determine whether random generation, context policy or their interaction caused the difference.

Do not pursue cache-hit percentage alone. Persistent Graphmory observes cached tokens but still uses more gross input than fresh; its lower noncached count is small and accompanies an incomplete answer. Basic persistent saves time and input while omitting one letter. Neither is a valid quality-preserving efficiency win. Full follow-ups were deliberately retained; compact resumption needs a separate frozen experiment.

Next candidate: tool-visible coverage accounting for enumeration/count questions, so Curator can distinguish inspected originals, partial previews and unseen candidates before finalizing. Test scoped and unanswerable controls too; simply forcing every note to be read would increase latency and distractors. Do not insert gold paths, tune on sealed conversations, or impose universal top-k truncation. A candidate must pass controlled coverage/scope invariants and a preregistered multi-family live development A/B before any holdout or default promotion.

Subscription monetary cost, p95 latency, independent support labels, powered comparator intervals and other host acceptance remain unmeasured. No universal superiority claim.

## Verification and cleanup

`npm run check` passes all 297 tests and configured deterministic gates. Summary replay with an added score-identity guard preserves every row and byte-identical raw scores. Pending, duplicate and unordered accounting regressions pass. Frozen runner hash matches; public artifacts exclude keys, raw thread IDs and local private paths. User-vault status remains `SYNC_CONFIG_NOT_FOUND`; no user-vault files were changed. Disposable benchmark vaults/native indices, host traces and scoring scratch are removed after sanitized artifacts are preserved. Goal remains active.
