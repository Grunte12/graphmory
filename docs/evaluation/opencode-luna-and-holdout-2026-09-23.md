# OpenCode Luna pilot and next evaluation set (2026-09-23)

## What was actually tested

The earlier “curator handoff” rows measured local retrieval output, **not** a Luna call. This pilot invoked `openai/gpt-5.6-luna` through OpenCode 1.18.29 with an isolated, read-only `memory_curator_eval` agent profile. Each call received the query and the same eight lexical candidate notes that Graphmory offers to the decision modes, with at most 1,200 characters of selected excerpt per note. Luna returned up to three candidate IDs. The runner measured path-label retrieval quality, including OpenCode startup and model latency. It did **not** dispatch a curator from a lead agent, generate a Brain Brief, check factual answer quality, or write memory.

The first two frozen questions in each of seven categories were run against the read-only 55-note Obsidian AgentBrain vault. The same 14 IDs were selected from the existing 34-question reports for the lexical and Jev rows. Private reports with retrieved paths remain outside the repository.

| Method, same 14 questions | Hit@3 | Recall@3 | MRR | Mean / question | p95 / question |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lexical candidate order, no model | 85.7% | 82.1% | 0.774 | 11.1 ms | 17.0 ms |
| Hosted Jev via Vercel | 85.7% | 82.1% | 0.821 | 766.7 ms | 1,461.4 ms |
| Luna via OpenCode | 85.7% | 82.1% | 0.821 | 6,470.1 ms | 9,543.7 ms |

The three methods missed the same two link-recovery questions on this subset. Fourteen questions cannot establish quality equivalence. A 34-question Luna run was attempted but stopped when OpenCode reported **“The usage limit has been reached.”** Do not combine partial results with the full 34-question Jev row. Luna used an existing OpenAI OAuth subscription in OpenCode; this is quota use, not a zero-cost operation. Jev's measured latency includes a network call. Luna's latency includes a fresh OpenCode process and session per question, so it is an end-to-end CLI figure, not isolated model inference.

## Reproduce when OpenCode quota is available

The [OpenCode runner](../../scripts/eval-opencode-curator.mjs) uses the isolated [agent configuration](../../eval/opencode-curator/opencode.json) and does not edit the user's normal OpenCode config or the vault. It needs an authenticated OpenAI provider in OpenCode. Start with a two-per-category pilot, then run the full set. Keep reports outside the repository because they contain note paths.

```sh
node scripts/eval-opencode-curator.mjs \
  --vault /path/to/AgentBrain \
  --queries eval/real-vault/queries.json \
  --per-category 2 \
  --json /private/path/luna-pilot.json

node scripts/eval-opencode-curator.mjs \
  --vault /path/to/AgentBrain \
  --queries eval/real-vault/queries.json \
  --resume /private/path/luna-pilot.json \
  --json /private/path/luna-full.json
```

For a **true sub-agent workflow** comparison, register the same curator instructions as an OpenCode sub-agent, give a lead agent the same task and bounded tool access, and record the lead's final answer, curator dispatch count, tool calls, input/output tokens, latency, and corrections. Keep that result separate from this direct curator-selection pilot. An agent profile alone does not establish that a lead agent invoked it.

## Better data than adding test notes to the live vault

The 55-note AgentBrain vault largely mirrors the original I-MEM research fixture, and its 34 path labels were written for that fixture. Adding synthetic notes to this live vault would contaminate both normal memory and the benchmark. Instead, snapshot an **independent evaluation vault** outside the working brain and freeze queries before changing retrievers or thresholds. Preserve the source note IDs, status, timestamps, and links. Do not publish private note text or prompts.

Build two distinct sets:

1. **Development set:** 20–30 reviewed questions to calibrate separate Jev and local-decision thresholds. Include exact, paraphrased, Thai, English, mixed-language, multi-note, link-recovery, superseded/stale, and no-answer cases.
2. **Held-out set:** at least 50 new questions from actual user tasks or independently written task scenarios, with no prompt or threshold tuning after labels are frozen. Include at least 15 genuine no-answer and 10 stale/superseded traps. Human reviewers should record acceptable evidence paths, an expected answer or abstention, and the note revision used to label it.

Grow the evaluation vault through **real, reviewed research notes and task outcomes** collected over time, rather than duplicating a paper abstract many times. If more scale is needed before enough genuine notes exist, create a separate synthetic stress vault and report it as synthetic. Do not mix its score with the real-vault score. A snapshot should contain enough distractors to expose ranking failures, but adding documents alone does not create reliable labels.

Score candidate retrieval and end-to-end agent behavior separately. Retrieval: Recall@3, MRR, nDCG, candidate ceiling, stale/raw pollution, no-answer false acceptance, and p50/p95 latency. Agent behavior: answer correctness with cited note paths, unsupported claims, correct abstention, Brain Brief compactness, lead correction count, tool/token use, and subscription/API spend. Run each method on the same frozen snapshot and candidate budget. For no-answer cases, report a separate abstention/false-acceptance rate rather than folding them into Recall@3. For temporal questions, judge whether the answer uses the current note rather than an obsolete one.

This split follows the abilities covered by [LongMemEval](https://arxiv.org/abs/2410.10813) (including updates and abstention), [MemoryAgentBench](https://arxiv.org/abs/2507.05257) (including selective forgetting), and [LongMemEval-V2](https://arxiv.org/abs/2605.12493) (workflow and environment knowledge). [Ragas](https://docs.ragas.io/en/stable/concepts/test_data_generation/rag/) can help vary query style and multi-hop scenarios, but generated questions need human review. A [recent study of authentic versus synthetic RAG queries](https://arxiv.org/abs/2609.14579) found substantial distribution differences; actual task questions should carry the release decision.
