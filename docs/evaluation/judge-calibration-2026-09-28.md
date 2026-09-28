# Source-support reviewer calibration sanity check

## Frozen protocol

Baseline `f1d3237`. Before dispatch, freeze 20 shuffled synthetic answer records: event deduplication, current update, prior state, multi-hop completeness, negation, scope, missing evidence, unresolved conflict, citation omission and unsupported additions. Each family contains one constructed supported-complete answer and one deliberately defective answer. These are author labels with explicit rationales, not independently adjudicated real benchmark gold. Sources are complete short synthetic Markdown strings. The reviewer receives only packet instructions, sources, questions, answers and citation paths; no labels, outcome maps or benchmark references.

Use one fresh `gpt-6-luna` low reviewer. No retry or rubric repair based on its answers. Freeze project sanity gates: at least 90% exact primary agreement and zero false acceptance of a constructed defective answer. Report exact accuracy, per-dimension agreement, positive-class precision/recall/F1, confusion counts and false acceptance rate; do not interpret these small counts as general judge validity or statistically established safety. Unknown/unclear is not silently dropped. Missing/duplicate/unknown rows are rejected.

## Result

One actual Luna review completed all 20 records; the scorer accepted exact ID accounting and frozen packet binding. Original packet and label hashes still match the pre-result manifest. No retry, label adjustment or response repair followed. Results replay byte-identically.

| Metric | Result | Meaning |
|---|---:|---|
| Exact supported-complete agreement | 20/20 (100%) | All constructed pass/fail decisions match author labels |
| Positive precision / recall / F1 | 1 / 1 / 1 | 10 positive answers accepted, 10 defective answers rejected |
| False acceptance | 0/10 | No deliberately defective answer passed |
| Source-support agreement | 20/20 (100%) | Agreement on whether every factual claim is supported |
| Completeness agreement | 12/20 (60%) | Eight incorrect answers have disputed dimension interpretation |
| Citation-coverage agreement | 13/20 (65%) | Seven cited-but-unsupported answers incorrectly receive coverage=yes |
| Unclear primary verdicts | 0/20 | No unresolved primary classification |

The predeclared **primary sanity gate passes**, but dimension agreement is insufficient for layer attribution. The reviewer gives coverage=yes when a relevant filename is present even when its text contradicts the answer, e.g. the old deadline or invented deadline addition. This conflicts with the packet's requirement that each material claim have supporting evidence. Completeness also reveals a label/rubric boundary: author controls label a fully stated but incorrect answer as complete=yes, whereas Luna marks it complete=no. There is no independent adjudication here, so do not claim the model rather than the label interpretation is at fault on completeness. Source support and the conjunction correctly reject these answers in this sample.

Do not retroactively edit labels or scores to obtain better agreement. Before using component metrics to identify a retrieval/reader bottleneck, freeze a revised rubric that distinguishes factual completeness from answer-component presence and supporting citations from path presence; evaluate **new controls**, not a retry on these 20. A future per-dimension gate must be predeclared separately. This easy, balanced synthetic sample cannot validate real-world ambiguity, benchmark-label accuracy, host consistency, general false-acceptance rates or superiority of Graphmory.

## Evidence and verification

Artifacts: [frozen packet](../../eval/judge-calibration/packet-v1.json), [labels and gate](../../eval/judge-calibration/labels-v1.json), [manifest](../../eval/judge-calibration/manifest-v1.json), [unaltered reviewer output](../../eval/judge-calibration/review-v1.json), [score and disagreements](../../eval/judge-calibration/score-v1.json), [hash bindings](../../eval/judge-calibration/review-binding-v1.json).

Replay: `node scripts/score-support-calibration.mjs --packet eval/judge-calibration/packet-v1.json --labels eval/judge-calibration/labels-v1.json --review eval/judge-calibration/review-v1.json`. Scorer regression tests cover false acceptance despite 95% aggregate accuracy, preserved unclear classifications, contradictory primary verdicts, packet changes and missing/duplicate/unknown identities. Full repository check passes 315/315 tests and configured deterministic gates. User-vault status remains `SYNC_CONFIG_NOT_FOUND`; no vault content changed. These development artifacts are outside the published npm file allowlist.

No runtime defaults or official benchmark scores changed; sealed histories untouched. Primary independent semantic, competitor and efficiency acceptance gates remain open. Goal active.
