# LoCoMo live Curator/Lead attribution — 2026-09-28

## Frozen development setup

The [builder](../../scripts/prepare-locomo-live-development.mjs) verified the pinned LoCoMo file SHA-256 `79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4`, selected two previously untried reader questions by a fixed hash seed from **different development conversations**, and rendered only those conversations to Markdown. Labels stayed in a separate file outside the model's workspace. No held-out conversation was rendered. The frozen IDs were `conv-42:11` (multi-answer category 1) and `conv-50:196` (adversarial category 5). The latter has no upstream reference answer text; the pinned evaluator checks for specific refusal phrases.

The [live mediator](../../scripts/run-curator-paging-pilot.py) called Graphmory `recall-managed --auto --agent` and `read-notes`, with verified source hashes. It used `gpt-5.6-luna` for Curator, `gpt-5.6-sol` for Lead, low reasoning, up to ten Curator turns, and structured citations. All calls were fresh host sessions. The attempt with `gpt-6-sol` is preserved separately because that model ID was rejected by this account's Codex CLI. Trace-derived usage, page paths, reads, output and failures are in the [sanitized run artifact](../../eval/reader-pilot/locomo-live-development-2026-09-28.json); raw traces remain in private temporary run directories.

## Results and attribution

| Case and attempt | Operational outcome | Curator reads | Answer / official extracted-source score |
|---|---|---:|---|
| `conv-42:11`, Lead `gpt-6-sol` | Host rejected unsupported model after two successful Luna calls | 1 | No answer; infrastructure failure |
| `conv-42:11`, Lead `gpt-5.6-sol` | 3 calls completed | 1 | “Most reptiles and animals with fur”; pinned category-1 raw QA F1 **0.2159** |
| `conv-50:196`, Lead `gpt-5.6-sol` | Luna usage limit on first call | 0 | No answer; infrastructure failure, no abstention score |

For `conv-42:11`, **all three gold source notes were already on the first retrieval page** at ranks 1 (`session_5.md`), 2 (`session_2.md`) and 5 (`session_4.md`). Curator read only `session_2.md`, then finalized. Its brief and Lead answer omitted “cockroaches” (in `session_5.md`, line 37) and “dairy” (in `session_4.md`, line 15); both were present in the upstream reference. The answer's two included allergy groups are supported by the read note. The dairy turn says “can't have dairy” rather than explicitly naming an allergy, so an independent support reviewer should preserve that wording distinction. The mechanical bottleneck in this case is **Curator evidence collection after successful ranking and delivery**, not a search miss.

The score was computed with the unchanged QA function bodies extracted from the pinned LoCoMo evaluator source SHA-256 `8e3be5d57ff2ff9ec5cd05939592f468c5f3f1fd95d13e431932bdf6bf0fd6fd`. This is neither the full official CLI/full-split score nor a calibrated semantic-support verdict. Citations remain in the raw answer. No paired competitor answer workflow, quality rate, p95 latency or billing cost can be inferred from this two-question pilot.

Verification after the runner changes: focused mediation tests passed 6/6 and `npm run check` passed 285/285 repository tests plus configured deterministic gates. The Obsidian vault status command returned `SYNC_CONFIG_NOT_FOUND`; this run did not access or change the user's vault. Host quota prevented further model trials, so no retry or replacement score was silently inserted.

## Decision

Keep the production default unchanged. Test a tool-side evidence-coverage intervention on exposed development cases: surface short, source-attributed matched passages from all retrieved candidate notes and a clear count of distinct relevant notes to Curator, then compare its original reads and answer completeness against the existing preview format. Do not use gold paths or reference strings in the runtime tool. Stop/abstention decisions still need actual live evaluation when host quota permits; the quota failure remains in the operational denominator. Freeze this protocol and independent support rubric before opening the three LoCoMo holdout conversations.
