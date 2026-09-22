# Jev-assisted retrieval plan

This is the earlier retrieval experiment plan. The [Jev curator-replacement design](jev-replaces-curator.md) defines the current target workflow. Hosted Jev retrieval has since been implemented; the experiment and full evidence contract remain open.

## Current shape

The lead agent authors durable Memory Patches. The memory curator sub-agent handles bounded recall, note placement, links, and lifecycle checks. The CLI selects candidate paths; the curator reads the selected notes and produces a Brain Brief. The default `recall` lane uses local BM25F section ranking. `recall-semantic` is an optional escalation lane.

The current local benchmark on 2026-09-23 measured about 79 ms end to end for a CLI recall over the 54-note public evaluation vault (five runs, Node 24 on macOS). `bench-scale` measures in-process ranking on reused arrays, so it cannot predict CLI, file I/O, model, network, or sub-agent latency. The current `WeakMap` caches in `src/retrieval.mjs` help only while a process and document array remain alive.

## Where Jev could help

Jev accepts state plus typed Choice, Score, or Noul questions and returns probabilities. Use it as an optional relevance judge over a bounded set of candidate sections from keyword and semantic retrieval. TypeSafe's [API documentation](https://docs.typesafe.ai/introduction/quickstart) describes the request and response shape. Jev cannot read the vault, generate a Brain Brief, decide canonical truth, or write notes.

The proposed pipeline is `lifecycle + scope gate → keyword and semantic candidate generation → RRF candidate fusion → Jev relevance scoring → evidence admission → curator → lead agent`. RRF combines ranked lists without reading candidate meaning; Jev would judge whether each short passage answers the query. Give each candidate an atomic relevance Noul and evidence-support Score in one batched request, then combine those outputs with the RRF prior in deterministic code. Keep the original scores and paths in the result so decisions can be audited.

If no candidate passes a threshold calibrated on held-out questions, expand retrieval once with a larger candidate pool or a bounded link neighborhood and score the new candidates. If that also fails, return insufficient evidence. Do not let Jev override lifecycle or scope filters. Compare always-on Jev with a gate that skips the network call for clear local hits; on the 54-note fixture, complete local CLI recall measured about 79 ms, so hosted scoring may increase latency.

## Delivery order

1. **Measure the full path.** Add an end-to-end benchmark for 100, 1,000, and 10,000 synthetic notes. Measure cold/warm p50 and p95, file reads, parses, ranking, model load, embeddings, and curator response separately. Freeze exact-answer, no-answer, stale/raw, scoped, and Thai/English paraphrase cases.
2. **Correct local gates.** Apply scope before `maxFiles`, constrain path scopes to exact notes or folder prefixes, and fix semantic confidence so a lone rank-one vector hit does not count as bounded evidence. Calibrate abstention on held-out no-answer cases.
3. **Reuse local preparation.** Add a versioned, rebuildable index for parsed sections and BM25F postings. Invalidate on create, edit, delete, rename, and lifecycle changes. Keep the index outside canonical notes and atomically replace it. Fall back to a fresh scan on corruption. Preserve identical rankings on an unchanged vault.
4. **Cache semantic vectors.** Key vectors by the exact embedding input hash, model revision, pooling, normalization, and truncation settings. A warm unchanged query should embed only the query. Measure model startup separately. Keep semantic recall optional.
5. **Run a Jev reranking experiment.** Implement an opt-in provider behind `src/jev-reranker.mjs` and orchestration in `src/retrieval-policy.mjs`. Fuse a bounded keyword and semantic candidate union, score short passages in one batched typed-decision request, and admit top-k only above calibrated thresholds. Start in shadow mode on synthetic or approved data. Allow at most one expanded retrieval pass, a strict total timeout, response validation, and deterministic fallback. Log aggregate timing and decisions without private text.

## Data and evaluation gates

Meaningful relevance scoring needs the query and candidate text; IDs and scores alone are insufficient. Send only the query, opaque candidate IDs, short selected sections, and bounded numeric retrieval signals. Sending even those excerpts to a hosted service requires explicit opt-in and an inspectable payload preview. Do not send full notes, raw captures, or unrelated frontmatter. A Jev response is advisory and cannot authorize vault writes.

Compare keyword-only, semantic-only, local RRF, always-on Jev reranking, and gated Jev reranking on the same frozen questions. Measure Hit@3, Recall@3, nDCG, no-answer false acceptance, stale/raw pollution, end-to-end p50/p95, model input size, and cost. A proposed promotion gate is either at least 10% lower end-to-end p95 at noninferior recall, or at least five percentage points better hard-query recall with no more than 10% p95 latency increase; require no-answer false acceptance at or below 5% in either case. These are hypotheses to test, not measured benefits. Include curator time because a better admission decision may save an agent verification round even when local search is already fast.

The first correctness batch is implemented in `src/memory-recall.mjs` and `src/semantic-recall.mjs`, and hosted Jev relevance scoring is implemented in `src/decision-recall.mjs`. Persistent caches, an end-to-end benchmark, and the full curator-replacement contract remain planned work.
