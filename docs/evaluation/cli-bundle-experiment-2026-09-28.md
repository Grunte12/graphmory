# Experiment 2: one-call bundle versus paged delivery

Same six exposed development questions as experiment 1. Add existing `--bundle` at the default 32,000-byte budget, retaining the three original modes. Four modes × six questions = **24 actual CLI trials**, before changing runtime code. This was selected after observing page-three evidence, so it is a development intervention, not a preregistered superiority result.

| Mode | Complete source paths on first response | At exhaustion |
|---|---:|---:|
| Paths only | 4/6 | 6/6 |
| Auto | 4/6 | 6/6 |
| Auto matched | 4/6 | 6/6 |
| Byte-budget bundle | 6/6 | 6/6 |

Bundles put all candidate paths in one response on these small corpora. They are not unlimited: larger outputs must continue via `nextOffset`. No total note cap is inferred from the per-response byte budget. Paths-only emits far fewer bytes, but must be paired with source reads for answer support; neither response bytes nor command count alone measures total token/latency savings.

## Failure uncovered

For `conv-43:21`, the bundle reaches all 29 candidates but shows only **one of three gold dialog-turn IDs** in its selected preview headings (`D9:6`). Gold source-session presence is not complete evidence delivery. Before the fix only three of the 29 candidates carried `sourceReadRequired`, because that flag was set only for a preview cut mid-section, not for omission of other short sections.

The gold-turn heading check is a mechanical proxy, not an entailment scorer: another turn might contain equivalent evidence, while a matching header does not guarantee its text is sufficient. Still, the actual selected preview omission plus a synthetic counterexample establishes the missing coverage warning. Do not report this as answer accuracy.

Artifact: [24-trial pre-fix report](../../eval/reader-pilot/cli-pages-bundle-before-2026-09-28.json). Decision: repair partial-preview signaling while preserving ranking/content, then recheck the same controlled cases. Do not switch default delivery modes from this sample.
