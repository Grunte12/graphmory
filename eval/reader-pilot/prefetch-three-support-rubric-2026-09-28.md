# Blinded source-support rubric for the frozen three-arm development pilot

Freeze this rubric before looking at nine model answers. The reviewer sees one
question and answer at a time, without tool identity, model usage, order, or
benchmark QA score. References and immutable source text may be inspected.

For each response, record:

1. `referenceAgreement`: yes/no/unclear. Does the answer express the pinned
   reference's requested facts, allowing numeric/date paraphrase? Keep any
   source/reference conflict explicit rather than silently relabeling.
2. `sourceSupport`: yes/no/unclear. Do the original, attributable turns support
   every material factual claim, including person, scope, time and negation?
3. `complete`: yes/no/unclear. Are all requested answer components present?
   A missing item fails even if what remains is correct.
4. `citationCoverage`: yes/no/unclear. Are supporting original paths cited for
   each material claim? An empty array is not an automatic pass.
5. `supportedComplete`: yes only if sourceSupport, complete and citationCoverage
   are all yes and there is no unsupported contradictory addition. If reference
   and original sources conflict, mark unclear and explain instead of forcing a
   pass/fail.
6. `rationale`: short, with exact dialog IDs or source paths for decisions.

Do not treat raw LoCoMo QA F1 as semantic correctness. Do not infer answer
quality from speed, tokens, tool name or model order. This review is exploratory:
one reviewer without calibration/adjudication does not satisfy the goal's final
independent supported-complete acceptance gate.
