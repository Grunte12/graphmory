# Agent retrieval output budget (2026-09-26)

This evaluation compares the existing full `--json` response with the new `--agent` response on 34 frozen questions and the 54-note public research fixture. Both flags call the same retriever. The `--agent` projection keeps ranked paths, lifecycle status, confidence, expansion signal, scan limit, and loop lane names. It omits query echo, titles, scores, duplicate lane diagnostics, and generic next-step prose. The agent can read a returned note by path for exact evidence.

| Command | Hit@3, both formats | Full JSON, minified | Agent output | Bytes saved |
| --- | ---: | ---: | ---: | ---: |
| `recall` | 88.2% | 36,181 | 10,155 | 71.9% |
| `recall-loop` | 94.1% | 45,550 | 14,376 | 68.4% |

The evaluator checks ranked path, lifecycle status, confidence, scan-limit, expansion-signal, and lane parity for every question; all 34 passed for both commands. Against pretty-printed `--json`, byte reduction was 75.9% and 76.1% respectively. These are exact serialized-byte counts, **not model token counts or billed-cost measurements**. Retrieval ranking is unchanged by construction; this does not establish answer-quality parity for an agent that previously relied on omitted titles or scores. The output is opt-in with `--agent`; full `--json` remains available when diagnosis needs those fields.

On the separate 15-question public fixture, parity also passed. Hit@3 was 93.3% for both commands, and bytes fell 64.8% (`recall`) and 64.4% (`recall-loop`) against minified full JSON. This guards against a result limited to the research fixture; it still does not test lead-agent answer quality.

Run `npm run eval:agent-output` for the research fixture, or `node scripts/eval-agent-output.mjs --vault eval/fixtures/notes --queries eval/fixtures/queries.json` for the second fixture. This choice follows the principle of exposing search metadata before reading full passages, as evaluated in [A-RAG](https://arxiv.org/abs/2602.03442). [Lost in the Middle](https://arxiv.org/abs/2307.03172) documents risks from long, poorly selected context. [LLMLingua-2](https://arxiv.org/abs/2403.12968) reports gains from learned prompt compression, but Graphmory uses an exact structured projection here to avoid an extra model, proxy, or lossy transformation of evidence.
