# Architecture

## Responsibility Boundary

The lead agent has the richest task context. It owns the semantic decision:

- Is this worth remembering?
- What exactly changed?
- Where does the claim apply?
- Which evidence supports it?

The curator owns memory operations:

- retrieve a bounded working set,
- locate an existing canonical note,
- detect duplicates and contradictions,
- merge without expanding the claim,
- add metadata and links,
- preserve provenance,
- lint the affected neighborhood.

The curator cannot supply missing rationale. A missing field produces `BLOCKED`; disagreement with active memory produces `TENSION`.

## Lifecycle and Staleness

Every Memory Patch includes lifecycle metadata:

- `status`: `active`, `superseded`, `tension`, or `deprecated`,
- `revalidate_when`: conditions that should force review,
- optional `valid_until`,
- optional `supersedes`.

This is the harness's answer to stale context risk. A remembered claim should not remain authoritative merely because it was saved. If the trigger condition fires, the lead agent should treat the memory as a candidate for revalidation before relying on it.

## Memory Layers

### Evidence

Source files, commands, artifacts, user statements, URLs, and raw episodes. Evidence should remain inspectable and should not be silently rewritten.

Evidence is the evidentiary source of truth. A wiki note may summarize or interpret it, but cannot replace or overwrite it.

### Canonical Wiki

Small linked Markdown notes representing current durable understanding:

- decisions,
- workflows,
- root causes,
- preferences,
- source maps,
- tensions.

The wiki is canonical operational memory, not ground-truth evidence. Every durable claim must remain traceable to immutable or independently verifiable evidence.

### Derived Views

Search indexes, embeddings, knowledge graphs, dashboards, HTML reports, and generated summaries. These accelerate navigation but do not become truth merely because a tool generated them.

### Derived Index Contract

Optional graph, search, and source-map integrations should speak the harness's generic `derived-index` contract instead of becoming core dependencies.

The contract requires:

- `role: "derived-index"`,
- `canonical_memory: false`,
- generator and scope metadata,
- at least one `derived_from` evidence item,
- entries with confidence and evidence references.

This lets the curator use a generated map for discovery while preserving the source-of-truth boundary:

```text
generated index -> routing hint
raw evidence -> evidentiary truth
Markdown note -> canonical operational memory
Memory Patch -> only durable write path
```

The index may point to relationships, files, symbols, or notes. It must not claim that a generated edge is accepted memory. If an index reveals a durable lesson, the lead agent still authors a Memory Patch and the curator still returns `APPLIED`, `TENSION`, or `BLOCKED`.

### Hot Context Pack

A Hot Context Pack is a compact, derived prompt-prefix generated from canonical memory. It is designed for stable high-utility guidance:

- current policies,
- user preferences,
- routing rules,
- known gotchas,
- stale warnings,
- open questions.

It exists to make repeated agent sessions cheaper and more consistent. It is not memory truth; it is a cacheable view. Each item carries source paths and lifecycle metadata so the pack can be rebuilt, invalidated, or shortened without corrupting canonical notes.

## Write Flow

1. Complete and verify a task.
2. Apply the significance gate.
3. Lead agent emits a valid Memory Patch.
4. Curator searches the relevant project map and nearby notes.
5. Curator returns `APPLIED`, `TENSION`, or `BLOCKED`.
6. A deterministic validator checks contract shape and patch quality.

## Learning Loop

For behavior-changing lessons, use a stricter loop:

1. Recall relevant memory.
2. Act on the task.
3. Verify the result with evidence.
4. Emit a Learning Packet only when future behavior should change.
5. Curate and link the packet without inventing missing facts.
6. Run memory health or future-task evals before making broad claims.

The Learning Packet contract records the lesson, trigger, future behavior change, evidence, verification result, loop trace, memory action, confidence, and lifecycle. It exists to block unverified reflection and routine diary entries from becoming durable memory.

## Recall Flow

1. Lead agent asks a narrow memory question.
2. Curator starts from the project map or index.
3. Curator follows only relevant links.
4. Curator returns a Brain Brief with 1-7 memory items.
5. Lead agent may directly inspect at most three named notes when exact nuance matters.

## Threat Model

The design targets:

- false memories created during repeated summarization,
- loss of task meaning during agent handoff,
- stale notes that still look authoritative,
- duplicate concepts,
- unconstrained vault reads,
- raw transcripts overwhelming retrieval,
- derived graph/search state being mistaken for canonical truth.
