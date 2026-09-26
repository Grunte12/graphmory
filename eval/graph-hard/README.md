# Graph hard challenge v1

Run from the source checkout:

```sh
npm run eval:graph:hard
```

The generator `scripts/eval-graph-hard.mjs` creates 209 synthetic notes in a temporary vault, runs 30 fixed questions, writes `results.json`, and removes the temporary vault. It makes no model/API calls and never opens a personal vault. Fixture, query, and retrieval-source hashes are recorded. The retrieval implementation was not tuned against this challenge. This is a synthetic stress test, not a held-out public benchmark or a live-agent answer evaluation.

There are four structurally similar project families, 180 keyword-heavy distractors, superseded notes, a three-hop chain, two entities with the same name, contradictory current policies, natural-language paraphrases, and unsupported questions. The four repeated project families test consistency; they are not four independent samples of generalization. Explicit graph queries and ordinary natural questions are both included so intent gating cannot be hidden.

Gold labels use separate evidence groups for each essential source. Hit@3 alone only means one useful source was found; complete@3 requires every group. Four questions need four distinct notes, so completion at k=3 is impossible by construction. These capacity probes are reported separately. Seven questions lack a single supported answer (including ambiguity and unresolved conflict); returning candidates on them is not the same as hallucinating an answer.

## First-run findings

Both sparse fusion and automatic graph retrieval have the same aggregate quality here:

| Measure | Result |
| --- | --- |
| Any supporting note in top 3 | 23/23 |
| All supporting groups in top 3 | 14/23 |
| All supporting groups in top 3, excluding impossible capacity probes | 14/19 |
| All supporting groups in top 12 | 19/23 |
| Natural multi-hop, no scope: complete@12 | 0/4 |
| Identical questions with correct project scope: complete@3 | 4/4 |
| Unsupported/ambiguous questions that still return candidates | 7/7 |
| Superseded candidates / out-of-scope candidates | 0 / 0 |

Automatic graph traversal activates for only 8/30 queries: explicit relation questions and chain probes. Natural multi-hop questions do not trigger the current intent gate. All graph results retain the `unverified` evidence status. The suite does not evaluate whether a lead agent correctly abstains, asks for clarification, or resolves conflicts.

The first sample suggests testing project/entity routing and a bounded expansion decision for ordinary multi-hop questions before adding more hops globally. Scope is supplied as an oracle in the scoped arm; this does not show that the tool can infer the scope itself. The current graph is not better than sparse fusion on this set. Candidate@12 completion is potential evidence availability, not the three-result CLI output or answer correctness. Timings are one local pass in fixed arm order and should not be used for a speed claim.

Keep v1 golds fixed. Any optimization using these failures makes v1 a development set; test the chosen change against a separately authored held-out set and the earlier regression fixtures before promoting it.
