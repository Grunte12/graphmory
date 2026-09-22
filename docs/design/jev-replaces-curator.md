# Jev as the curator decision engine

Status: incremental implementation, 2026-09-23. `recall-managed` calls Jev directly in hosted mode and emits a compact EvidencePacket. Jev-assisted note placement and calibrated quality gates below are not implemented yet.

## Role boundary

The workflows are choices, not a chain of agents:

| Mode | Evidence judgment | Prose and durable memory authorship |
| --- | --- | --- |
| Subscription curator | Luna, Haiku, or another user-selected host sub-agent | Lead agent authors patches; curator maintains notes within its existing limits |
| Hosted Jev | Jev alone; zero Luna/Haiku curator calls | Existing lead agent |
| Local decision | A tested local decision engine alone; zero hosted or subscription curator calls | Existing lead agent |
| Local light (planned) | A small local reranker, if it passes evaluation | Existing lead agent |

The harness searches, checks scope/lifecycle, enforces budgets, validates model responses, and constructs exact edits. Jev is a typed decision model: it can judge relevance or choose among supplied options, but does not generate a Brain Brief, invent a path, summarize a note, or write Markdown. No mode silently falls back to a different paid model.

## Recall without a curator sub-agent

```text
Lead asks a concrete question
  → harness filters scope and lifecycle, then generates lexical/semantic candidates
  → hosted Jev judges bounded passages in one request
  → harness admits, ranks, or abstains under a measured policy
  → compact EvidencePacket with exact excerpts and provenance
  → existing lead reads selected notes and answers the user's task
```

The first Jev question per candidate should ask whether the passage contains information useful for this exact question. Add a separate direct-evidence/support judgment only if a frozen evaluation shows benefit. Batched questions are independent; compute the final route from their answers in code. A model score is an admission signal, not proof that a claim is true or current. Apply lifecycle and scope rules before the call. If nothing passes, allow one explicit, bounded expansion, then abstain. Errors must be reported as errors, not as low relevance.

Use a separate `EvidencePacket` contract instead of labeling Jev output a Brain Brief. The existing Brain Brief schema requires at least one memory item and cannot honestly represent no evidence. The first packet version has `ready` and `abstain` statuses, requested model ID, retrieval confidence, decision gate, candidate count, expansion flag, selected canonical paths, bounded excerpts, excerpt hashes, scores, and next action. Command errors remain distinct from abstention. Empty evidence is valid for abstention. `retrievalConfidence` describes the local sparse retriever; Jev's Noul probability has no separate confidence field.

Keep agent output compact by default: path, status, short excerpt, score, and excerpt hash. The lead can read full notes by path when needed. Do not print full API payloads or private notes in routine logs. Cache only when keyed by the question, passage hashes, resolved model version, question schema, and threshold policy.

## Note placement and consolidation without Luna

The lead authors a Memory Patch with proposed claims and provenance. The harness finds a bounded set of possible destinations. Jev may classify each comparison as `duplicate`, `compatible addition`, `conflict`, or `insufficient`, and may choose only from supplied destination IDs. The harness prepares an exact edit, rechecks source hashes, validates frontmatter/links/lifecycle, and writes atomically under existing authority rules. An ambiguous semantic merge or unsupported claim returns to the lead for an explicit replacement; Jev never invents patch prose. Start with retrieval only. Enable automated placement after separate write-safety evaluation.

## Implementation order

1. **Implemented:** `mph config` asks for curator provider/model only in curator mode. Saved curator fields remain inactive for backward compatibility and are not required in Jev/local configurations.
2. **Implemented:** The OpenCode adapter is workflow-aware. In Jev mode, it runs `recall-managed --agent` and passes evidence directly to the lead.
3. **Implemented:** Jev/local reports omit active `curator` metadata and expose `decisionModel`, `retrievalConfidence`, a decision gate, and an `EvidencePacket` schema. The packet allows an honest empty abstention.
4. Increase candidate recall before optimizing the judge. Current `managedRecall` scores at most `maxCandidates` from a `k: 10` local shortlist. A good reranker cannot recover evidence that never reaches it. Measure candidate Recall@K and tune lexical/semantic fusion under token and latency budgets.
5. Run the same labeled questions through subscription curator and Jev-only workflows. Measure Hit@3, Recall@K, no-answer false acceptance, stale/superseded admission, Thai/English/mixed queries, compound-question coverage, p50/p95 latency, total lead tokens, API cost, and curator dispatch count. Check zero curator calls in Jev/local mode. Calibrate thresholds per model and vault before promoting defaults.
6. Add Jev-assisted placement only after testing duplicate, contradiction, malicious note content, source-change, and unsupported-write cases. Prioritize false writes and missed conflicts over rank gains.

For local models, prefer the strongest model that fits the user's RAM ceiling and passes the same quality gate. A tiny reranker can rank passages but may not reliably perform typed conflict and placement decisions; treat those as separate capabilities. Local Jev is not a published TypeSafe weight in the current catalog, so label these engines as Jev-compatible or local decision models, not Jev itself.

References: [TypeSafe quickstart](https://docs.typesafe.ai/introduction/quickstart), [Jev model limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13), [TypeSafe model catalog](https://docs.typesafe.ai/models).
