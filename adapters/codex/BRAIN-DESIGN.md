# Codex Agent Brain Design

This adapter uses Codex as a lead agent with narrow, cheaper memory workers.
The goal is not automatic remembering. The goal is accurate future decisions
with less repeated context and a controlled write boundary.

## Design Basis

Current memory systems repeatedly support the same useful separation:

- [Mem0](https://arxiv.org/abs/2504.19413) extracts, consolidates, and retrieves
  salient memory instead of replaying full history.
- [A-MEM](https://arxiv.org/abs/2502.12110) uses structured atomic notes,
  dynamic links, and updates to related memory.
- [MemMachine](https://arxiv.org/abs/2604.04853) emphasizes preserving episodic
  ground truth and reports larger gains from retrieval depth, context format,
  search prompts, and query correction than from more aggressive ingestion.
- [MemGate](https://arxiv.org/abs/2606.06054) treats retrieval as a trust
  boundary: similarity alone is not sufficient admission into agent context.
- [Graphiti](https://github.com/getzep/graphiti) tracks provenance and temporal
  validity and combines semantic, keyword, and graph retrieval.
- [Episodic-Semantic Memory Architecture](https://arxiv.org/abs/2605.17625)
  finds complementary value in consolidated semantic memory and historical
  RAG, while identifying consolidation quality as the scaling bottleneck.

The adapter adopts those patterns without requiring a database or graph server.
Markdown remains inspectable canonical operational memory; raw evidence remains
ground truth; every index is replaceable.

## Four Memory Layers

| Layer | Purpose | Authority |
|---|---|---|
| Working context | Current task requirements and decisions | Lead session only |
| Episodic evidence | Source files, artifacts, user statements, handoffs | Inspectable evidence, not canonical policy |
| Canonical memory | Atomic decisions, workflows, root causes, preferences, source maps, tensions | Changes only through a verified lead-authored patch |
| Derived views | BM25F, embeddings, graphs, hot packs, reports | Routing hints only; rebuildable |

This separation prevents repeated summaries from becoming false facts and
prevents a retrieved graph edge from silently gaining write authority.

## Read Pipeline

```text
task-specific question
  -> bounded Intake Sweep (metadata-only queue)
  -> scoped sparse recall (top 3)
  -> lifecycle and path admission gate
  -> semantic hybrid candidates (top 10 only on a miss)
  -> cheap curator selects at most 3 canonical notes
  -> compact Brain Brief
  -> lead verifies current repository facts
```

Important behavior:

1. Project scope is mandatory when known.
2. Canonical type and lifecycle outrank raw semantic similarity.
3. Archive, trigger, raw patch, secret-bearing, and unrelated-domain memories
   are rejected before direct reads.
4. Canonical evidence that directly supports the answer is success even when a
   sparse score is low; raw retriever confidence is not an escalation trigger
   by itself.
5. A stronger curator is a one-shot exception, not a default second opinion.
6. Multi-hop decomposition is useful only when one focused query cannot express
   the task; it must not become broad vault exploration.
7. Intake Sweep may name up to five raw candidates and at most three paths for
   the lead to send to `memory-ingest`; it never grants raw evidence admission
   into the Brain Brief or canonical write authority.

## Ingest Pipeline

```text
new raw source
  -> bounded Intake Sweep queue
  -> source identity and secret scan
  -> read-only Evidence Digest
  -> significance gate
  -> lead verification
  -> ignore | handoff | Memory Patch | Learning Packet
```

Ingest does not summarize everything. It keeps directly supported observations,
contradictions, provenance, and questions the lead must resolve. Raw logs and
transcripts stay outside canonical memory. A handoff is current task state, not
a durable lesson.

The curator repeats the bounded sweep after a lead-owned patch so the lead can
see remaining intake. It does not auto-move, link, delete, or promote raw files.
Run health/lifecycle after a meaningful batch rather than every recall.

## Update Pipeline

```text
verified evidence
  -> lead-authored semantic delta
  -> Memory Patch or Learning Packet
  -> locate strongest canonical note
  -> merge | create | tension | block
  -> project-map link and lifecycle metadata
  -> health check
  -> optional human-approved sync
```

Updates are idempotent by concept, not by filename: search for the strongest
existing canonical claim before creating a note. Preserve old evidence and
supersession links. Never rewrite history merely to make the current view tidy.

## Canonical Structure

```text
<project>/
  00 Project Home.md
  01 Decisions/
  02 Workflows/
  03 Root Causes/
  04 Preferences/
  05 Source Maps/
  06 Tensions/
  inbox/
```

Each canonical note should represent one durable concept and include project,
type, lifecycle, confidence, provenance, applicability, revalidation triggers,
and related or conflicting links. The project home is the first navigation
surface and should remain small.

## When To Add A Graph

Do not make a graph database the default. Add a derived graph only after frozen
multi-hop or temporal queries show a measured gap that sparse plus semantic
retrieval cannot close. Every graph node or edge must retain source references,
validity, and `canonical_memory: false`.

## Evaluation Gate

Use a frozen set of real questions before changing retrieval or model routing.
Report at least:

| Dimension | Gate |
|---|---|
| Canonical Recall@3 | Correct active note appears in the final three paths |
| Stale/raw pollution | Zero forbidden direct-read paths |
| Supported answer | Every material claim traces to a returned note |
| Conflict behavior | Contradictions return tension or bounded uncertainty |
| Abstention | Unknown questions do not fabricate memory |
| Token cost | Brief plus direct reads stays below the configured budget |
| Future-task utility | Remembered knowledge changes the later decision correctly |

Promote a cheaper model only when it passes the same frozen questions. Promote
a heavier retrieval lane only when it fixes measured misses without increasing
pollution or unsupported confidence.
