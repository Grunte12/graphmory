# Memory contracts

The data shapes behind Graphmory. Durable memory changes only through a Memory Patch; every other contract is derived and rebuildable.

## Memory Patch

```json
{
  "claim": "Visual verification belongs to the agent that owns visible UI.",
  "why_it_matters": "Future routing should not send UI correctness checks to backend agents.",
  "scope": {
    "applies": ["visible UI implementation and review"],
    "excludes": ["API, data, and build verification"]
  },
  "provenance": [
    {
      "kind": "file",
      "value": "AGENTS.md"
    }
  ],
  "confidence": "high",
  "suggested_type": "decision",
  "lifecycle": {
    "status": "active",
    "revalidate_when": ["ownership policy changes"],
    "supersedes": []
  }
}
```

The curator returns one status:

- `APPLIED`: memory was merged or created with provenance, and a receipt hash records the write.
- `TENSION`: an active note disagrees; both positions remain visible and nothing is written.
- `BLOCKED`: the patch lacks sufficient meaning, scope, evidence or confidence, or needs owner review; nothing is written. Low-confidence memory waits in a private review queue (`graphmory review list`) until the owner approves or rejects it.

## Derived Index

A derived index is an optional source map generated from files, notes, or code. It can help retrieval, but it is never canonical memory.

```json
{
  "role": "derived-index",
  "canonical_memory": false,
  "generator": {
    "name": "example-local-indexer"
  },
  "derived_from": [
    {
      "kind": "file",
      "value": "notes/00 Project Home.md"
    }
  ],
  "entries": [
    {
      "id": "note:visual-verification",
      "kind": "note",
      "label": "Visual verification policy note",
      "confidence": "high",
      "evidence_refs": [
        {
          "kind": "file",
          "value": "notes/visual-verification.md"
        }
      ]
    }
  ]
}
```

The contract is deliberately tool-agnostic. A graph, search index, source map, or generated report can implement it without becoming a dependency of this harness. Durable memory still changes only through a Memory Patch.

## Hot Context Pack

A Hot Context Pack is a compact derived prompt-prefix candidate for stable, frequently used memory. It is useful for provider prompt caching and repeated agent sessions, but it is not canonical memory.

```powershell
node scripts/render-hot-context.mjs --pack examples/hot-context-pack.json
```

Only high-utility active memory should enter this pack: current policies, preferences, routing rules, gotchas, stale warnings, and open questions. Each entry must point back to canonical notes and include lifecycle metadata so the pack can be regenerated or invalidated.

## Brain Brief

The Curator's answer to a recall. It is a short, cited summary, not a dump of notes:

- `outcome`: `answered`, `partial` (some claims have no supporting note) or `no-evidence` (nothing supports an answer)
- `relevant_memory`: each supported finding with its note path and the hash of the note as recalled
- `constraints` that affect the next step, and `watchouts` such as stale or contradictory notes
- `note_paths` and 0-3 `direct_read_paths` for optional direct reading
- `stop_reason` (`nothing-relevant-left`, `evidence-sufficient`, `budget`, `scan-limit`) and `pages_read`

A `no-evidence` brief has no findings and means the main agent must say there is no supporting note rather than guess. The main agent does not browse the whole vault; it asks the Curator for the smallest useful set. See `examples/brain-brief.json` and `schemas/brain-brief.schema.json`.

## Repository Map

```text
adapters/opencode/       OpenCode integration examples
docs/                    Architecture, research, and evaluation
examples/                Valid example contracts
schemas/                 Machine-readable JSON Schema
scripts/                 Install, initialize, and validate
skills/graphmory-curator/   Installable on-demand agent skill
src/                     Dependency-free validation logic
test/                    Deterministic contract tests
```
