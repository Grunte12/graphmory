# MVP deterministic safety holdout v2 — 2026-10-01

## Frozen linked protocol

**Protocol:** `graphmory-mvp-holdout-safety-2026-10-01-v2`

**Protocol state:** frozen before v2 execution

**Candidate:** `graphmory@0.5.0-rc.4`

**Candidate SHA-256:** `f70f78073b6352c3fb537e904d513c1eadd805665a4c05a9388b434629b9dfcc`

**Runner:** [`scripts/eval-mvp-holdout-v2.mjs`](../../scripts/eval-mvp-holdout-v2.mjs)

This linked run preserves and follows the original [v1 protocol and result](mvp-holdout-safety-2026-10-01.md). The original v1 runner SHA-256 is `63dc6c4c61917cef022058dea6c6644a66b812274b8695270104354efd4c2f26`; its initial result remains **9/10 tasks passed, H01 failed**. No v1 file, fixture, or result is being replaced.

### Single H01 oracle correction

The v1 fixture showed that the candidate writes Markdown-sensitive characters in the owned JSON record using escaped JSON values. A read-only post-run diagnostic independently decoded the saved `claim`, `why_it_matters`, and provenance values and found exact equality with the frozen patch; it also found the complete receipt hashes matched the raw source and target bytes. The v1 failure came from checking for unescaped Markdown text in the raw file instead of checking the serialized field value.

V2 changes only that H01 representation check: the holdout reads the owned record from the note, parses each field's JSON value independently, and compares the decoded claim, rationale, provenance count, kinds, and values with the exact frozen patch values. The semantic gold, fixture content, receipt checks, other nine task oracles, and scoring rules are unchanged. This correction does not change the existing v1 result or turn a v1 failure into a pass.

V2 uses the same offline rc4 artifact and the same ten frozen tasks in [v1](mvp-holdout-safety-2026-10-01.md#frozen-tasks-and-expected-outcomes): full round trip, scope/history retrieval, stale/expiry filtering, tension candidate retrieval, invalid patch refusal, source-drift refusal, undeclared-drift refusal, simultaneous writers, reviewed recovery, and receipt/replay integrity. The v1 public-contract sources, mutation accounting, refusal false-positive/negative definitions, synthetic-only constraints, and evaluation limits continue to apply unchanged.

## Results

Command: `node scripts/eval-mvp-holdout-v2.mjs --run-id holdout-v2-2026-10-01-01`

Runtime: Node `v24.18.0`, Darwin; candidate archive SHA-256 `f70f78073b6352c3fb537e904d513c1eadd805665a4c05a9388b434629b9dfcc`.

Runner SHA-256: `4b044dc9765d8ea7469d51716476fb2b1299e8952b8f657826aa08067a6f4ad9`.

| Measure | Result |
|---|---:|
| Tasks | **10/10 passed** |
| Expected-refusal actions | **7/7 matched** |
| Refusal false positives | **0** |
| Refusal false negatives | **0** |
| Unexpected vault mutation paths | **0** |

| Task | Result |
|---|---|
| H01 — full patch round trip | PASS — independently decoded claim, rationale, and provenance exactly match the patch. |
| H02 — scope and current/history recall | PASS |
| H03 — stale and expired memory | PASS |
| H04 — equal-authority tension candidates | PASS |
| H05 — invalid patch refusal | PASS |
| H06 — immutable source drift refusal | PASS |
| H07 — undeclared note drift refusal | PASS |
| H08 — simultaneous writers | PASS — one process prepared; the competitor refused with `CHECKPOINT_STATE_BUSY`. |
| H09 — reviewed target restoration | PASS — stale reviewed hashes refused; approved restoration returned exact target bytes and reported source drift. |
| H10 — receipt and replay integrity | PASS — exact replay was read-only; changed target bytes caused `REPLAY_REVERIFY_FAILED`. |

H01 full persistence verification checked 21 fields. Its source hash `78f509d1952f2e5febc9a6888ac100c65d21dbcfda34c5c049a2eb44283d6747` and target hash `4b4f737923c43efc89df3e4941fa3fff25e8a8bfccf6e2790e9fe73b4b874c0b` matched independent raw-file reads and the completion receipt. H10's receipt target hash `bf933b67469f80af49d9eb8e1de3a9cbca99dcfaa9551ca569936bbfed711346` and source hash `2cdd1e6dc7728484b35a21b8798fb92cdc92ac3bb042c27bbdadb955ae0b230f` also matched independent reads.

V2 evidence is retained in `../graphmory-mvp-eval-20261001/private-safety/holdout-v2-2026-10-01-01/result.json`. The original v1 result and its H01 failure remain retained in the separate `holdout-2026-10-01-01` directory; v2 supersedes neither the recorded v1 score nor its artifact.

<!-- RESULTS -->
