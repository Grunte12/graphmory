# Adaptive graph navigation pilot (2026-09-24)

This is a read-only, local comparison of equal-cap (12 unique candidate notes) retrieval. No model, API, or vector database was used. The 34-question research-vault fixture is a **development regression set**. The separate 15-question public fixture checks ordinary retrieval regression. A small eight-question synthetic adversarial fixture covers links, scope, false relation cues, and two no-answer questions. These tests do not measure final agent answers.

| Fixture | Arm | Hit@3 | Recall@3 | Hit@12 | Mean per query |
| --- | --- | ---: | ---: | ---: | ---: |
| Research vault, 34 | Sparse fusion | 94.1% | 92.6% | 100% | ~6 ms |
| Research vault, 34 | Sparse + gated graph | 97.1% | 95.6% | 100% | ~6 ms |
| Public fixture, 15 | Either arm | 93.3% | 84.4% | 100% | ~1 ms |
| Synthetic adversarial, 6 answerable | Either arm | 100% | 100% | 100% | ~1 ms |

Only `link-recovery-cranimem` improved in the 34-question set. The first broad graph experiment did **not** improve Hit@3 and reduced Hit@12 from 100% to 97.1%; gating was added after seeing this development result. The synthetic fixture was also written during development, so it is not independent proof. On both synthetic no-answer questions, both arms still returned candidate notes. The graph command therefore labels every result `unverified` and requires lead review; it does not claim answer sufficiency.

Timing is local wall time including vault load for both arms, with baseline run first. It is a short pilot, not a stable latency benchmark. Repeated cold/warm measurements should randomize arm order before performance claims. The current result justifies an opt-in experiment, not a default change. No hosted Jev evaluation was run for this loop; a future Jev stage needs consent, a working key, usage telemetry, and no-answer labels.

Reproduce:

```sh
node scripts/eval-adaptive-graph.mjs --vault eval/real-vault/vault --queries eval/real-vault/queries.json
node scripts/eval-adaptive-graph.mjs --vault eval/fixtures/notes --queries eval/fixtures/queries.json
node scripts/eval-adaptive-graph.mjs --vault eval/adaptive-graph/vault --queries eval/adaptive-graph/queries.json
```
