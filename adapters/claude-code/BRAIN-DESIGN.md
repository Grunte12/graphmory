# Claude Code Agent Brain Design

This adapter is deliberately smaller than the Codex adapter's pipeline
(`../codex/BRAIN-DESIGN.md`): one subagent, one handoff skill, one optional
recall hook. No ingest agent, no deep-curator escalation, no automated
capture. The lead session (you, in Claude Code) always decides what is
worth remembering; nothing here infers meaning on its own.

## Design Basis

Same evidence base as the Codex adapter, applied narrower: [Mem0](https://arxiv.org/abs/2504.19413)
(retrieve salient memory, not full history), [MemGate](https://arxiv.org/abs/2606.06054)
(retrieval is a trust boundary, not just a similarity score), and
[MemMachine](https://arxiv.org/abs/2604.04853) (retrieval depth and query
correction matter more than aggressive ingestion). This adapter keeps
Markdown notes as canonical, human-readable memory and treats every search
index as a rebuildable derived view — no database or graph server required.

## Two Layers, Not Four

Codex's adapter separates working context, episodic evidence, canonical
memory, and derived views because it also runs an ingest pipeline. This
adapter has no ingest pipeline, so only two layers matter in practice:

| Layer | Purpose | Authority |
|---|---|---|
| Working context | Current task, current conversation | Lead session only, never persisted automatically |
| Canonical memory | Markdown notes in the vault (`OBSIDIAN_VAULT` + `MEMORY_PATCH_HARNESS_SCOPE`) | Changes only through a lead-authored Memory Patch placed by `memory-curator` |

Everything the harness CLI returns (BM25F scores, Brain Brief snippets) is a
routing hint, not canonical truth — verify against the note itself before
relying on it.

## Read Path

```text
task-relevant question
  -> optional UserPromptSubmit hook (brain-brief-hook.ps1) OR manual recall.ps1
  -> harness CLI: recall --vault --scope --json (bounded top-3, governed BM25F)
  -> Brain Brief injected as prior context, not fact
  -> lead verifies against current repo/file state before acting
```

The hook fails closed: with `OBSIDIAN_VAULT` or `MEMORY_PATCH_HARNESS_SCOPE`
unset it injects nothing and never guesses or creates a vault path (see
`scripts/brain-brief-hook.ps1`, covered by `test/adapters.test.mjs`). Recall
is the only automatic step; there is no automatic write path.

## Write Path

```text
verified lesson or task-switch moment
  -> lead decides: handoff (task state) or Memory Patch (durable knowledge)
  -> claude-memory-handoff skill (or scripts/new-handoff.ps1) for a handoff
  -> memory-curator subagent for a complete Memory Patch
     { claim, why_it_matters, scope, provenance, confidence, suggested_type, lifecycle }
  -> curator returns APPLIED | TENSION | BLOCKED
```

`memory-curator` (`agents/memory-curator.md`, `model: haiku`) validates
structure, finds related notes, and stores — it never invents a claim from a
vague summary. A handoff is task state, not durable memory, and is never
promoted to canonical memory on its own.

## Canonical Structure

Reuses the top-level harness's structure; this adapter does not define its
own:

```text
<scope>/
  01 Decisions/
  02 Workflows/
  03 Root Causes/
  04 Preferences/
  05 Source Maps/
  06 Tensions/
  inbox/
```

## What This Adapter Does Not Do

- No automatic capture — recall is the only thing that can fire without an
  explicit lead action, and it is opt-in (the hook) and fails closed.
- No task orchestration, model routing, or transcript capture. Those are
  the user's own Claude Code configuration, not part of this adapter.
- No graph, embeddings, or semantic index by default; that surface belongs
  to the shared harness core (`../../src/`), not this adapter.

## Evaluation Gate

Before changing the hook, the subagent prompt, or the recall query shape,
re-run the harness's own retrieval eval (`scripts/eval-vault-retrieval.mjs`
or `scripts/eval-retrieval-stress.mjs`) against a frozen query set and
confirm Hit@3 does not regress. This adapter has no retrieval logic of its
own to re-test — it only calls the shared harness CLI — so the eval gate
lives in the harness core, not here.
