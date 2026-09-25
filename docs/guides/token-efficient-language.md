# Language and token budget

Graphmory stores new canonical agent memory in concise English. The lead agent talks to the user in the user's chosen language, including Thai. Do not maintain parallel translated notes. Preserve exact identifiers, commands, paths, citations, and provenance. Existing notes and raw evidence are not rewritten just to meet a language rule.

The goal is fewer tokens **per correct task**, not the shortest possible reply. A short answer that causes a second search or hides a conflict can cost more overall. Use these defaults:

1. Retrieve paths and compact metadata first. Read at most the relevant notes or sections; expand only for a specific missing fact. Do not put a whole vault or routine logs into agent context.
2. Keep each canonical memory item to one durable claim with enough rationale and provenance to use it safely later. Remove repeated prose, not constraints or evidence.
3. Use the host agent's response language independently from memory language. Keep routine user replies brief and natural; preserve exact errors, commands, evidence, uncertainty, and material risks. Do not force telegraphic prose onto user-facing Thai.
4. Before adding a compression proxy, measure total input/output tokens, retrieval misses, answer correctness, p95 latency, and extra retries on the same tasks. Any compressor must leave paths, identifiers, JSON contracts, code, citations, and safety-critical evidence intact and allow an exact source reread.

## Keep provider prompt caches effective

Keep the host agent's reusable tool definitions, role instructions, and stable memory policy at the start of its prompt. Put the query, retrieved paths/excerpts, timestamps, and tool results after that stable prefix. Append new turns rather than rewriting earlier messages or moving dynamic retrieval into the system prompt. Graphmory's `--agent` flag changes only the CLI result body; it does not configure the host's prompt cache or its cache breakpoints.

Do not shorten a reusable prefix merely to make it smaller: falling below a model's cacheable minimum can cost more across repeated turns. Conversely, do not pad a prompt solely to trigger caching without measuring the break-even point. On the actual host and model, compare **total billed cost per correct task**, cache reads/writes, uncached input, output, retries, and latency before choosing `--agent` over full `--json` for cost reasons. The [cache compatibility audit](../evaluation/prompt-cache-compatibility-2026-09-26.md) records what has and has not been verified.

For agent-driven lexical lookup, use `graphmory recall --vault <path> --query <question> --agent`. If a second local lane is needed, use `graphmory recall-loop --vault <path> --query <question> --agent` once. Both return one JSON line with ranked paths, lifecycle status, retrieval confidence, and expansion signals; the loop also retains lane names. `--json` remains the full diagnostic report. The [public 34-query output evaluation](../evaluation/agent-output-budget-2026-09-26.md) records the size reduction and exact path parity.

These ideas correspond to three distinct approaches: [Caveman](https://github.com/JuliusBrussee/caveman) targets verbose responses and tool output, [Ponytail](https://github.com/DietrichGebert/ponytail) favors the smallest sufficient code change, and [Headroom](https://github.com/headroomlabs-ai/headroom) compresses input context. Graphmory adopts bounded retrieval and concise agent outputs directly; it does not require any of those external tools. Their published savings are project-specific claims, not Graphmory measurements.
