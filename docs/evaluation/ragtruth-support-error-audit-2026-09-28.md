# Post-review error analysis

This is a source-free diagnostic of the eight frozen disagreements, not a second scored review. The v1 score, labels, and judge outputs remain unchanged.

## Frozen result

Exact agreement remains 16/24 (66.7%). The confusion counts are human yes / judge yes: 4; human yes / judge no: 8; human no / judge no: 12; human no / judge yes: 0. False acceptances remain 0/12 and unclear remains 0.

All eight disagreements were human yes, judge no, and had zero annotated spans. The analysis inspected only these cases and their rationales/context.

## Provisional taxonomy

| Cause | Cases |
|---|---:|
| Annotation-gap candidate | 4 |
| External or unstated fact | 2 |
| Overstrict inference or paraphrase plausible | 1 |
| Unresolved | 1 |

The external/unstated-fact cases are also plausible annotation-gap signals under this frozen reference. These classifications describe likely disagreement mechanisms; they do not establish that either the judge or the human labels are correct.

| Blind ID | Task | Provisional cause | Mechanism |
|---|---|---|---|
| e84a033c9a9a | QA | annotation_gap_candidate | unsupported cross-source detail transfer |
| 962ad3b83bc6 | QA | external_or_unstated_fact | domain facts absent from supplied context |
| eda3dcee2f47 | QA | overstrict_inference_or_paraphrase | completion of an incomplete source phrase |
| 8492cea31ab3 | Summary | external_or_unstated_fact | event characterization not stated in supplied context |
| 3367b6997cd4 | Summary | annotation_gap_candidate | attribution or epistemic-strengthening shift |
| 8d88e1dd3e2d | Summary | unresolved | paraphrase with attribution and scope ambiguity |
| bb8bf40aa123 | Data2txt | annotation_gap_candidate | unsupported catalog and frequency specificity |
| 935e0ea6ae24 | Data2txt | annotation_gap_candidate | specificity beyond coarse structured attributes |

The clearest recurrent pattern is a strict source-support reading flagging details or stronger claims absent from zero-span human labels. One case depends on a plausible completion of incomplete wording; one is mixed because attribution and scope can be read either way. Independent human adjudication is needed before calling any case a gold-label error.

## Next evaluation design

- Preserve the v1 score, labels, and judge output unchanged.
- If a diagnostic follow-up is needed, have two independent human reviewers, masked to the judge output and frozen labels, assess only these eight prompt/response pairs for claim-level support and attribution. Resolve reviewer conflicts with a third reviewer and save the result separately.
- For any later calibration, preregister a fresh train-only sample with distinct source groups and dual human reference review, including an audit of no-span cases. Do not tune from these pilot outcomes.

This analysis adds no scored evidence and does not establish human-label errors.
