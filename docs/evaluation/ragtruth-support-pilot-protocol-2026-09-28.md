# RAGTruth source-support pilot: predeclared protocol

## Purpose and scope

Move beyond synthetic sanity controls using externally human-annotated responses. This measures **agreement with response-level hallucination annotation**, not retrieval performance, citation coverage or answer completeness. Evidence source and limitations: [primary-source research](../research/human-source-support-calibration-2026-09-28.md). No Graphmory runtime treatment/default changes or sealed history access.

## Freeze before reviewer output

- Pin the author corpus to `1d52a81c9e28e79e252a1945d858eb8dfd975c23`; record actual file hashes and schema validation. Refuse unknown annotation semantics or malformed joins/offsets rather than guessing.
- Select only official train responses with good quality. Never expose test examples to the reviewer. Record total eligible, exclusions and selected counts; downloaded mixed-split files are not themselves a test evaluation.
- Select 24 responses: four per task × annotation-presence stratum, for QA, Summary and Data2txt. Keep all selected `source_id`s distinct, including across strata. Fix deterministic selection seed/algorithm in the preparer manifest before judging. Stop if the pinned data cannot supply the plan; do not silently replace or reduce cases.
- Human-derived binary reference: no annotated hallucination span => sourceSupport=yes; any annotated span => no. Strict supplied-context support includes `implicit_true` spans as unsupported by context. This comparison inherits human span annotation incompleteness and is not certified exhaustive claim truth.
- Freeze selected IDs, source groups, source/response bytes, annotation derivation and separate packet/label hashes. Keep source-containing artifacts local, with no raw corpus text or responses committed. Publish reproducible adapter, synthetic tests, hashes/IDs and aggregate outcomes only.

## Actual reviewer and scoring

One fresh `gpt-6-luna` reviewer with `max` reasoning receives the exact original generation prompt, task identifier, full generated response and support-only instructions. The prompt already contains the supplied context; do not duplicate `source_info` or append auxiliary information. It receives no human annotations, expected classes, treatment IDs or prior outcomes. Source/prompt text is evidence data, never instructions to follow. Reviewer isolation is instruction-based unless an audited restricted runner is implemented; disclose this limitation. Record host/model/reasoning, all planned identities, failures and available usage. No retry, response repair, rubric tuning or label relabeling after outcomes.

Return sourceSupport=yes/no/unclear with concise source-specific reasons. Preserve raw outputs locally. Reject missing, duplicate or unknown identities and source/label/packet drift before aggregate scoring. Unclear is reported and counts as nonagreement, not dropped.

Predeclared **pilot** gates: exact source-support agreement >=90% and zero false acceptance of human-annotated unsupported responses. Report 2×3 confusion counts, accuracy, positive precision/recall/F1, false acceptance numerator/denominator and unclear count; report task strata. These small counts do not establish broad reliability or final goal acceptance. Case independence is limited to selected unique source groups.

## Next action conditional on evidence

If the pilot fails, preserve errors and audit label/context interpretation before using this judge in a final comparison. If it passes, retain the explicit source-support-only scope and determine a larger independently reviewed comparison design. Either result must be recorded in a separate experiment report. Completeness/citations, matched competitor answer quality, cost/latency and host usability remain separate open gates.
