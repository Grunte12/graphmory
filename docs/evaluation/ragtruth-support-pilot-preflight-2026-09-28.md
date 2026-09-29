# RAGTruth source-support pilot preflight

## Frozen scope

This preflight freezes a 24-response source-support calibration sample before any reviewer output. It uses the official RAGTruth `train` split, `good` responses only, and four responses in each task × human-span-presence cell. The 24 selected responses have 24 distinct `source_id` groups. The reviewer sees only a blind ID, task type, exact original prompt, and generated response. The packet order is deterministically hash-shuffled so span-presence strata are not contiguous.

The reference is narrow: no annotated hallucination span maps to `sourceSupport=yes`; any annotated span maps to `no`, including `implicit_true` spans because the information is absent from supplied context. Zero spans mean agreement with absent human hallucination annotations, not certified answer completeness or exhaustive truth. The frozen pilot gate is at least 90% exact source-support agreement and zero false acceptances; `unclear` counts as nonagreement.

## Dataset and selection accounting

The source is ParticleMedia/RAGTruth at commit `1d52a81c9e28e79e252a1945d858eb8dfd975c23`. The local input files were pinned from `dataset/response.jsonl` and `dataset/source_info.jsonl`. The preparer filters response rows by top-level split metadata before parsing a row; test responses and annotations are not inspected or sent to a reviewer. It joins only good train response groups to source-info metadata, uses `source_info.task_type` for stratification and the exact original `prompt` as judge context, and does not add `source_info` fields or the short `source` marker to the packet.

| Accounting item | Count |
|---|---:|
| Response rows in pinned file | 17,790 |
| Train rows | 15,090 |
| Test rows excluded by split metadata | 2,700 |
| Good train responses | 14,942 |
| Train rows excluded by quality | 148 (120 incorrect refusals, 28 truncated) |
| Distinct good-train source groups | 2,515 |
| Planned and selected responses | 24 |
| Selected distinct source groups | 24 |
| Selected no-span / annotated-span references | 12 / 12 |
| Selected `implicit_true` spans | 0 |

Candidate pools were sufficient for all six planned cells:

| Task | No-span candidates (responses / source groups) | Annotated-span candidates (responses / source groups) | Selected per cell |
|---|---:|---:|---:|
| QA | 3,346 / 826 | 1,546 / 686 | 4 |
| Summary | 3,275 / 789 | 1,480 / 749 | 4 |
| Data2txt | 1,623 / 816 | 3,672 / 883 | 4 |

An independent context audit found the original prompt includes QA questions and passages for all 839 QA source records and the summary input for all 793 Summary records. For Data2txt, all nonempty string leaves matched the original prompt with raw, JSON, or Python escaping; all 18,715 nonstring scalar values matched, and the 13 unmatched address values were empty. The review packet therefore uses only the original prompt and response; no source-info supplement is added. This audits input alignment, not human-label exhaustiveness.

## Frozen identities and hashes

The following ID pairs identify the selected records; this list does not disclose per-record reference labels or prompt text.

| `source_id` | Response `id` |
|---:|---:|
| 12092 | 3755 |
| 12188 | 16178 |
| 13541 | 5311 |
| 13677 | 6076 |
| 13745 | 6457 |
| 13866 | 4172 |
| 13897 | 4360 |
| 13945 | 4644 |
| 13978 | 4840 |
| 13984 | 4877 |
| 14234 | 8144 |
| 14434 | 12699 |
| 14449 | 12790 |
| 14528 | 8650 |
| 14718 | 9720 |
| 14922 | 10896 |
| 14970 | 11166 |
| 15017 | 11440 |
| 15357 | 14618 |
| 15427 | 15041 |
| 15481 | 15364 |
| 15514 | 15562 |
| 15536 | 15694 |
| 15775 | 1088 |

SHA-256 bindings:

| Artifact | SHA-256 |
|---|---|
| Pinned `response.jsonl` | `e4c2e4ac24fff676d8984cc61c35d791612fadc58015335d97dd632375e18073` |
| Pinned `source_info.jsonl` | `0dffc26ea9f3c1c3d7c7e8336b56ef1646e3cec876edffcca3c9c624d12d578b` |
| Frozen reviewer packet | `9061010f708601a0b5bb14101ad7ee6aba231fef269578e3ffabe741b7317e8e` |
| Frozen human-label file | `7e15804e2aa3cc9df0851337907e72edde6ad3ba7bf57c32b09f25aa69e5d46f` |

The packet, full labels, private manifest, raw input files, and any later review output remain under `/private/tmp/graphmory-ragtruth-pilot-v1` or `/private/tmp/graphmory-ragtruth-pinned-data-v1`. No RAGTruth prompt, source text or response text is included in the repository. A [source-free public manifest](../../eval/ragtruth-support-pilot/manifest-v1.public.json) publishes identifiers, derived binary references, counts and hashes for reproducibility; it was not supplied to the reviewer. The repository license is MIT; redistribution rights for source text embedded from upstream corpora are unverified, so no corpus text is redistributed.

## Review status

At this preflight freeze, no model review or score existed. The frozen packet and labels passed byte-hash, protocol, planned-count, source-group, and synthetic scorer checks. The selected cases contain no `implicit_true` spans, so the pilot will not directly measure reviewer agreement on that annotation subtype; the preparer maps any such span to `no`, and synthetic tests cover that rule. Completeness, citation coverage, answer completeness, broader reliability, and Graphmory performance remain outside this pilot.
