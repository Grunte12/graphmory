---
name: memory-curator
description: Retrieve compact Brain Briefs from governed Markdown or Obsidian memory, with lifecycle filtering, semantic fallback, and provenance. Use when prior decisions, handoffs, preferences, root causes, verified lessons, or contradictions may affect the task.
---

# Memory Curator

Treat durable memory as a governed knowledge base, not a diary. Use the custom
`memory-curator` agent for normal read-only recall. Adopt this skill directly
in the lead session only when consolidating a complete lead-authored Memory
Patch; use `brain-update` for the write checklist.

Installed commands:

```text
node "{{HARNESS_CLI}}" recall --vault "{{VAULT}}" --query "<question>" --scope "{{SCOPE}}" --k 3 --rerank --json
node "{{HARNESS_CLI}}" recall-semantic --vault "{{VAULT}}" --query "<question>" --scope "{{SCOPE}}" --k 10 --model-cache "{{MODEL_CACHE}}" --json
node "{{HARNESS_CLI}}" health --vault "{{VAULT}}" --json
node "{{HARNESS_CLI}}" lifecycle-audit --vault "{{VAULT}}" --json
node "{{HARNESS_CLI}}" intake-sweep --vault "{{VAULT}}" --scope "{{SCOPE}}" --limit 5 --json
```

## Intake sweep

Before every recall, and before/after consolidation, run one bounded
`intake-sweep`. It returns metadata only for untriaged Inbox/Clippings items;
archive, auto-triggers, and raw memory-patches remain excluded.

1. Return `intake_status` with counts, at most five candidate paths, secret
   scan state, and a recommended route.
2. If a candidate is task-relevant, name at most three paths for the lead to
   delegate to `brain-ingest`. Do not open, promote, link, move, or delete raw
   evidence in recall mode.
3. Continue canonical recall from the normal bounded ladder. A nonempty intake
   queue does not authorize broad raw search.
4. After a lead-owned patch, sweep once more and report the remaining queue.
   Run health/lifecycle only after a meaningful batch, not each recall.

## Recall

1. Form one task-specific query from the user's goal.
2. Run the Intake sweep above.
3. Run sparse scoped recall with `--k 3`.
3. Inspect the returned path, title, lifecycle, and best section. If filtering
   leaves no relevant active canonical candidate, or the best allowed note
   cannot support the material question after one direct read, run semantic
   recall once with `--k 10`. Do not escalate solely because the CLI's sparse
   confidence is `low` or `none`. Ten results are candidate metadata, not
   permission to read ten notes.
4. Hard-exclude paths under `archive`, `auto-triggers`, and raw
   `memory-patches`, even if metadata claims they are current.
5. Prefer active project homes, decisions, workflows, root causes,
   preferences, source maps, and tensions over inbox artifacts.
6. Treat session handoffs as provisional. Report a handoff's current-state
   claim only when canonical memory corroborates it.
7. Select and directly read at most one primary and two supporting paths.
9. Return a Brain Brief with current goal, decisions, constraints, named role
   assignments, exact operational thresholds when present, watchouts,
   provenance paths, confidence, and repo facts that still need verification.
10. Do not edit in recall mode.

Relevant canonical support is success even when raw retriever confidence is
low. Invoke the deep curator only when the curator's final supported-answer
confidence is low/none, no canonical evidence exists, or a material
contradiction remains unresolved. Never retry-loop either curator.

## Consolidation

1. Require a complete lead-authored Memory Patch or Learning Packet.
2. Verify provenance and scope against the named evidence.
3. Find the strongest existing canonical note and project map.
4. Merge without expanding meaning, or create one atomic note when distinct.
5. Preserve disagreement rather than silently choosing a side.
6. Return `APPLIED`, `TENSION`, or `BLOCKED` with exact paths.

## Authority

- The lead agent authors new semantic meaning; the curator never does.
- Retrieval, placement, deduplication, linking, metadata, and linting belong to
  the curator workflow.
- Raw evidence is evidentiary truth. Markdown is canonical operational memory.
  Search indexes, embeddings, graphs, and generated packs are derived views.
- Never store secrets, full transcripts, routine summaries, or unsupported
  speculation.
- In an external reviewer role, use read-only commands only and return findings
  to the owning lead agent.
