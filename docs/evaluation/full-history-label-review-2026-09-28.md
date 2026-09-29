# Independent full-history count-label review

## Protocol

Baseline `5fd2450`. Audit the provisional development question `conv-42:49` using all 29 original sessions (629 turns) from the pinned corpus SHA-256 `79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4`. A fresh `gpt-6-luna` subagent at low reasoning receives only the packet, upstream question/reference and review template. It is instructed to read every session chronologically, record actual rejection events, repeated mentions, future/potential events and uncertainty, and produce a per-session ledger. It cannot see generated answers, treatment mappings, scores or the previous reviewer record. This isolates review from treatment outcomes, but the reference is visible and the model remains an uncalibrated reviewer.

Preparation replay produces the same manifest SHA-256 `b0b9e6055a9841a7ce4dad398455f1ee97c670099d36bb9604da880809e621dd`. Validate the returned JSON against source/manifest hashes, known turn IDs, reviewed-session membership and the count-label gate. Only a full-session review with all event classifications resolved can pass structurally as valid. A single model review is development evidence; it does not replace independent adjudication or satisfy the final acceptance gate. The three sealed histories remain untouched.

## Result

The reviewer returned a 29/29-session ledger matching the manifest inventory (629 turns), with two counted events and a prospective rejection excluded. Its first record used `countedEvents`/`candidateEvents` rather than the required `events` array. The actual validator rejected it with `Incomplete audit verdict`; JSON syntax validity alone did not satisfy the gate. Preserve this failed record (SHA-256 `26584c068feb81f1717b23ea871c333b475ffe84b4595d7f2cac42722b83270d`) and request a separate schema repair without changing the review judgment.

The separate corrected record passes the actual repository validator: 2 counted events, 0 unresolved events, 29/29 sessions reviewed, and all original source hashes intact. Its SHA-256 is `8f8cf9cc61a0f5d1726e24c03013df6957c473d67d5bcdaa9d73d00bd6e338d0`. The session ledger and overall judgment remain identical to the first record. Evidence for the two distinct events includes `D14:1` and `D24:12`; repeated mentions are grouped, and anticipated future rejections at `D27:12` are excluded.

A follow-up integrity assertion initially assumed the first turn in each grouped event must be its rejection announcement. That incorrectly rejected the second event, whose evidence list begins with the earlier submission at `D16:1`. The corrected check tests membership of the rejection announcement within the group; no source, classification or score was changed.

Artifacts: [initial rejected review](../../eval/reader-pilot/count-label-audit/conv-42-49-independent-initial-review.json), [corrected review](../../eval/reader-pilot/count-label-audit/conv-42-49-independent-corrected-review.json), [machine validation](../../eval/reader-pilot/count-label-audit/conv-42-49-independent-validation.json). The prior provisional record stays unchanged.

## Interpretation and verification

This case now meets the structural full-history eligibility rule. The validator certifies source binding, session coverage declarations and resolved event accounting; it cannot certify that the model interpreted every turn correctly. The review is independent of treatment answers, but reference-visible, single-reviewer and uncalibrated. It does not pass the primary independent semantic acceptance gate or justify promotion of any retrieval/default option. Official benchmark scores remain unchanged, and sealed histories remain untouched.

Add a CLI integration regression verifying refusal after source mutation or manifest mismatch. Repository check: 313/313 tests and configured deterministic gates pass. User-vault status remains `SYNC_CONFIG_NOT_FOUND`; no vault content changed.

Next: calibrate a second independent review/adjudication procedure before freezing a larger matched comparison; count-label handling must coexist with non-count, temporal, conflicting-evidence and abstention cases. Goal remains active.
