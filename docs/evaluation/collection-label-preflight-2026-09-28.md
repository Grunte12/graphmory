# Collection experiment: label readiness preflight

This is a pre-generation readiness inspection, not a benchmark or a new judge-calibration experiment. The [architecture plan](../research/architecture-decision-2026-09-28.md) requires eight source-verified exposed development questions: four aggregation/count, two specific facts, and two unanswerable. It permits 24 matched workflows only after freezing valid labels, source hashes, resource ceilings, arm access and order.

## Existing evidence inspected

| Existing case/artifact | What it actually establishes | Readiness |
|---|---|---|
| `conv-42:49`, [full-history review](full-history-label-review-2026-09-28.md) | A reference-visible independent Luna review declares all 29 sessions reviewed, two counted events, zero unresolved events; the structural validator accepts source/turn bindings. | Development candidate; not independent semantic adjudication or proof of all interpretations. |
| `conv-50:47`, [compact prefetch result](prefetch-compact-live-ab-2026-09-28.md) | The pre-run annotated-turn check missed other events. At least three visits are explicit and a fourth event remains disputed; the upstream reference is two. | Invalid for a strict supported-complete win/loss until ambiguity is resolved separately. Keep the official reference and scores unchanged. |
| `conv-26:40`, `conv-47:8`, `conv-50:18`, [three-arm prefetch result](prefetch-three-arm-2026-09-28.md) | Previously exposed multi-note questions with original hashes and generated answers. Paperwork/event interpretation remains unclear in part of this set; the review is one uncalibrated model. | Not a complete eight-slot source-verified label book. Prior answers must not be used to pick favorable replacements. |
| 14-case [native retrieval diagnostic](three-arm-native-full1-2026-09-28.md) | Twelve answerable reference evidence groups and two abstention labels on pinned LongMemEval-S, evaluated for retrieval. | Does not independently audit all histories, final answer support, or absent facts. Retrieval success is not label qualification for the new answer-level count experiment. |
| [Synthetic judge calibration](judge-calibration-2026-09-28.md) and [RAGTruth pilot](ragtruth-support-pilot-results-2026-09-28.md) | Tests of reviewer behavior, with different populations; RAGTruth calibration failed. | Neither supplies the required eight memory questions nor authorizes model judgments to decide a tool winner. |

## Gate decision

The inspected artifacts do **not** establish a frozen, valid eight-slot book. No 24-workflow generation batch is launched, and no synthetic substitute is relabeled as the planned public-corpus benchmark. No personal-vault data or sealed holdout was rendered. This preflight does not establish that no suitable questions exist in the datasets; it establishes that the required qualifications are currently missing from the inspected evidence.

Tool/runner integration can proceed without model outputs. Before generation, create the complete proposed slot inventory using only already-exposed development histories, review each full history with a source-bound event/fact ledger, classify ambiguity explicitly, and freeze original references separately from the support rubric. Unanswerable labels need a full-scope absence check, not an empty retrieval response. Resolve or block ambiguous proposed slots **before** any treatment answers; no post-answer replacements or reference repairs.

Do not start another open-ended judge calibration loop. A qualified source ledger plus blinded adjudication of unresolved meaning is required where ambiguity remains. If this cannot be obtained, report the missing gate and keep the collection feature experimental rather than producing a claimed winner from unreliable labels. Independently preserved holdout and final powered acceptance gates remain separate and unfulfilled.

## Concrete candidate inventory prepared after this inspection

The pinned public LoCoMo file was restored and verified against SHA-256 `79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4`. `scripts/prepare-collection-candidates.mjs` produced [eight audit candidates](../../eval/reader-pilot/collection-candidates-v1.json), in development split order and original QA order, without consulting prior answer outcomes:

- Aggregation/count: `conv-43:17`, `conv-43:49`, `conv-42:19`, `conv-42:49`.
- Specific facts: `conv-43:71`, `conv-43:72`.
- Adversarial/putatively unanswerable: `conv-43:178`, `conv-43:179`.

These are **unreviewed candidates**, not eight valid labels. Original histories and original QA references remain in separate private audit packets; model reader inputs contain no reference answers. No generation manifest is issued, `generationAllowed=false`, and zero answer workflows were run. There are only two previously exposed source histories in this candidate book, so even a future development pass would not establish generalization. The sealed histories were not rendered.

Category-5 packets preserve the upstream `adversarial_answer` field as supplied; that field must not be relabeled as a correct answer or fed to a generic answer-F1 scorer as gold. Qualification must establish source-scope absence separately, and scoring must preserve the upstream category-specific protocol. No category-5 QA score is calculated by this preparer.

An actual packet replay verified all eight reader/label-packet hashes, exact reader keys (`id`, `question`, `vault`, `sources`), question hashes and 232 copied Markdown source hashes. The source copies repeat histories across questions: 232 is not the number of independent source histories or trials. This verifies preparation and separation, not semantic label validity.

The first preparation invocation failed before packet creation because it excluded every annotated session containing any image caption. Inspection found 18 multi-note count questions before that filter and zero after it; only one category-5 candidate survived too. This was an overbroad proxy: an unrelated picture in a session does not prove a question requires visual evidence. The second invocation records caption presence and requires verbal-text support during label qualification instead. No answers had been generated, no failed benchmark slot was replaced, and no labels were edited. Image-caption-only support cannot qualify the planned text-only comparison.

Reproduce with the pinned input and new output paths:

```sh
node scripts/prepare-collection-candidates.mjs --input <pinned-locomo10.json> \
  --out /private/tmp/<new-audit-directory> --summary <new-source-free-summary.json>
```

Before trials, audit complete histories for these fixed candidates and freeze source-bound positive facts/event identities or full-scope absence evidence. Any unresolved slot blocks the intended eight-slot batch; do not replace it after seeing treatment answers.

## Integration preconditions recorded before generation

The old control and Basic Curator can request originals only from retrieved paths, whereas the proposed collection arm enumerates the declared history. An answer comparison is invalid under that asymmetry. The existing runner therefore needs a common opt-in source index, available to all three arms, before any trial. It must show only the same original path/hash inventory and permit reads anywhere within that inventory. Normal/default runs remain separate from this shared-index comparator configuration.

Fragment transport now includes line-cursor locations and partial-line flags; the six collection/CLI tests pass with assertions against the original bytes. Repository `npm run check` passed 337/337 tests and configured gates at this preparation checkpoint. This verification does not certify the pending runner integration or any model output. Model cache effectiveness, workflow latency, token cost and supported-answer quality remain unmeasured in this phase.
