# Hot Context Demo

This document shows the **render-hot-context** script in action.
It accepts a Hot Context Pack JSON file and produces a compact Markdown view
suitable for inclusion in an agent's system prompt or session context.

## Script Location

```
scripts/render-hot-context.mjs
```

## Usage

```sh
# Print to stdout
node scripts/render-hot-context.mjs --pack examples/hot-context-pack.json

# Write to file
node scripts/render-hot-context.mjs --pack examples/hot-context-pack.json --out output.md
```

## Input (`examples/hot-context-pack.json`)

```json
{
  "role": "hot-context-pack",
  "canonical_memory": false,
  "generated_at": "2026-06-27T00:00:00Z",
  "derived_from": [
    { "kind": "file", "value": "notes/00 Project Home.md" },
    { "kind": "file", "value": "notes/visual-verification.md" }
  ],
  "entries": [
    {
      "id": "routing:visible-ui-owner",
      "category": "routing",
      "priority": "high",
      "confidence": "high",
      "summary": "Visible UI implementation and visual verification stay with the UI owner.",
      "source_paths": [
        "notes/ui-ownership.md",
        "notes/visual-verification.md"
      ],
      "lifecycle": {
        "status": "active",
        "revalidate_when": [
          "ownership policy changes",
          "visual QA tool routing changes"
        ],
        "supersedes": []
      }
    },
    {
      "id": "safety:no-secret-memory",
      "category": "policy",
      "priority": "high",
      "confidence": "high",
      "summary": "Never store secrets, raw credentials, or private tokens in durable memory.",
      "source_paths": ["notes/secret-policy.md"],
      "lifecycle": {
        "status": "active",
        "revalidate_when": ["secret handling policy changes"],
        "supersedes": []
      }
    }
  ]
}
```

## Output (rendered Markdown)

The script produces:

```markdown
# Hot Context Pack

This is a compact derived context pack. It is not canonical memory.
Generated: 2026-06-27T00:00:00Z

- [HIGH][policy] Never store secrets, raw credentials, or private tokens in durable memory.
  Source: notes/secret-policy.md
  Status: active; revalidate when: secret handling policy changes
- [HIGH][routing] Visible UI implementation and visual verification stay with the UI owner.
  Source: notes/ui-ownership.md, notes/visual-verification.md
  Status: active; revalidate when: ownership policy changes; visual QA tool routing changes
```

A rendered example is also available at `examples/hot-context-rendered.md`.

## When to Invalidate the Rendered Output

The rendered Markdown is a **derived cache**. It is not canonical memory.
Regenerate it whenever one of the following triggers fires:

1. **A source note is added, updated, or removed** that appears in any `derived_from` path.
2. **A lifecycle status changes** — for example, a memory is superseded or revalidated.
3. **The agent session changes** — a new topic may need a different subset of active memory.
4. **The `generated_at` timestamp is older than the most recent Memory Patch** in the vault.
5. **Before a high-stakes task** — ensure the hot context reflects the latest curated memory.

Do not treat the rendered output as canonical. Always fall back to full Memory Curator recall
when a claim needs verification.

## See Also

- `docs/guides/demo-workflow.md` — How hot context fits into the full memory workflow.
- `schemas/hot-context-pack.schema.json` — The JSON schema for the pack format.
- `examples/hot-context-pack.json` — The example input pack.
