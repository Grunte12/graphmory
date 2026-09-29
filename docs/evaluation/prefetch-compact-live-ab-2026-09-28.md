# Compact prefetch: source-checked live development A/B

## Frozen before generation

Compare normal full-source prefetch with opt-in `--compact-prefetch` using the same Graphmory `--auto` recall, fresh `gpt-5.6-luna` Curator and `gpt-5.6-sol` Lead at low reasoning, structured citations, ten-round and 300,000-input-byte limits. Use the pinned LoCoMo development corpus (SHA-256 `79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4`). No gold answer or evidence path enters the model input. The explicit default runtime configuration, original Markdown hashes, scripts and execution order are frozen in the experiment manifest before the first model call.

Two source-checked, prefetch-ready multi-hop count questions from distinct previously exposed histories:

- `conv-42:49`: Joanna describes a screenplay rejection in D14:1 and another rejection in D24:12; reference `Twice` is supported as two separate events.
- `conv-50:47`: Dave describes a car show in D3:12 and another in D22:1; reference `two` is supported as two separate dated events.

Fixed order: full then compact for the first case; compact then full for the second. No retry, substitute case or switch to a different model. Record every planned/attempted slot including host failures. Compare final answer, cited original paths and source support first; official pinned raw QA F1 is reported separately. Then compare observed gross/cached input tokens, model calls, actual CLI bytes and whole-workflow time. A treatment loss of a supported-complete answer or missing original blocks any promotion. A two-case single-run diagnostic cannot establish quality noninferiority, p95 latency, monetary cost or a general superiority claim even if both cases pass.

## Results

[Frozen manifest](../../eval/reader-pilot/prefetch-compact-live-ab-manifest-2026-09-28.json), [verified per-trial results](../../eval/reader-pilot/prefetch-compact-live-ab-results-2026-09-28.json), and [raw official-function QA scores](../../eval/reader-pilot/prefetch-compact-live-ab-raw-scores-2026-09-28.json). All 4/4 planned trials completed with the pinned models and config; each fetched every complete original (29 notes in `conv-42`, 30 in `conv-50`) and both annotated paths. No retry or substitute was used. A second scoring/identity replay was byte-identical: results SHA-256 `bf33011d2b1c1c66ac6f48a6940d3bce8a18d0c20c4799b82cd7a71a9cc72779`, raw scores SHA-256 `4d2f61fee7f254e73164866215a1745144be2c41a6d9cb72e19a791a48aede6f`.

| Case | Arm | Final answer | Cited originals | CLI bytes | Gross input tokens | Cached input tokens | Workflow seconds |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| `conv-42:49` | Full | 2 times | session_14, session_24 | 121,033 | 65,571 | 14,080 | 16.514 |
| `conv-42:49` | Compact | 2 times | session_14, session_24 | 102,006 | 60,629 | 15,360 | 18.601 |
| `conv-50:47` | Compact | 3 car shows | session_26, session_3, session_22 | 110,365 | 62,151 | 29,440 | 20.719 |
| `conv-50:47` | Full | 4 car shows | session_1, session_3, session_22, session_26 | 133,673 | 68,057 | 15,360 | 23.677 |

Compact delivery lowered actual CLI bytes by 15.7% and 17.4% and observed gross input by 7.5% and 8.7%, respectively. Each arm needed two model calls. Workflow time moved in opposite directions: compact was 2.087 seconds slower in the first case and 2.958 seconds faster in the second. Cache counts also differ substantially, so these two single generations do not establish a latency or monetary-cost effect. The byte reduction is already supported by the larger deterministic screen; this live test shows only two token observations.

### Correctness and reference failure

Both `conv-42:49` arms answered the supported count of two with both source paths. The pinned reference is the word `Twice`, while both final answers use the digit `2`; the unchanged official LoCoMo QA F1 function assigns both **0.0**. This is a literal scorer mismatch, not evidence that both answers are wrong. Keep the published raw scores unchanged and report source support separately.

The pre-run source check for `conv-50:47` inspected its two **annotated** turns but missed other parts of the same history. A full-history audit after the divergent answers found D26:6: Dave describes his first car show at age ten; D3:12 and D22:1 explicitly describe two later visits. D1:2 describes a separate March 2023 event with classic cars on show, plausibly a fourth car show. The upstream reference `two` therefore undercounts at least three explicit visits for the unqualified question “How many car shows has Dave attended?” The compact answer of three cites the three explicit visits; the full answer of four additionally cites the March event, whose exact event type requires adjudication. Neither should be judged wrong solely against the supplied reference, and this case is **invalid for a strict supported-complete A/B win/loss**. Official raw F1 is 0.0 for both against `two` and remains untouched.

This was a real pre-run label-audit failure. I did not remove or replace the case after seeing the answers. It shows why checking only annotated evidence turns is insufficient for an exhaustive-count evaluation. The two-case sample now has only one reference-valid comparison, both arms tied on supported completeness, and no independent blinded semantic adjudication. Keep `--compact-prefetch` opt-in. Do not promote it by answer quality or claim noninferiority/superiority. The next evaluation gate must scan the entire history for counterexamples before freezing count-question labels, then use source-disjoint holdout and repeated runs.

`npm run check` passed 309/309 tests and configured gates; the new preparation and Python scoring scripts passed syntax checks and were exercised by the real run plus byte-identical score replay. Read-only user-vault status returned `SYNC_CONFIG_NOT_FOUND`; no user-vault note was modified. Raw model traces and generated public-corpus vaults stayed in disposable local scratch; only the manifest, scores and compact trial summary are published.
