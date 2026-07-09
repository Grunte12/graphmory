# Demo Workflow

This walkthrough shows how the harness turns a verified coding-agent incident into future-useful memory.

## 1. A Task Finishes

Example incident:

> A visible dashboard chart looked correct in data tests but failed visual review. The backend owner had run build and API checks, but the final acceptance needed visual QA artifacts.

Evidence:

- `.opencode/visual-qa/2026-06-27/report.json`
- user statement: "Designer owns visual QA for visible UI"
- local policy note: `notes/ui-ownership.md`

## 2. Lead Agent Authors Meaning

The lead agent has the task context. It writes the Memory Patch:

```json
{
  "claim": "Designer owns visual QA for visible UI acceptance after implementation.",
  "why_it_matters": "Future handoffs should not treat backend build success as visual acceptance.",
  "scope": {
    "applies": ["visible UI implementation", "visual QA acceptance"],
    "excludes": ["backend data correctness", "API verification"]
  },
  "provenance": [
    { "kind": "artifact", "value": ".opencode/visual-qa/2026-06-27/report.json" },
    { "kind": "user-statement", "value": "Designer owns visual QA for visible UI." }
  ],
  "confidence": "high",
  "suggested_type": "decision",
  "lifecycle": {
    "status": "active",
    "revalidate_when": ["visual QA routing changes", "ownership policy changes"],
    "supersedes": []
  }
}
```

## 3. Memory Curator Applies Or Blocks

The curator does not invent meaning. It searches nearby notes, checks for duplicates or contradictions, and returns one status.

Example:

```json
{
  "status": "APPLIED",
  "changed_paths": ["notes/visual-verification.md"],
  "retained_provenance": [
    { "kind": "artifact", "value": ".opencode/visual-qa/2026-06-27/report.json" },
    { "kind": "user-statement", "value": "Designer owns visual QA for visible UI." }
  ],
  "stored_claim": "Designer owns visual QA for visible UI acceptance after implementation."
}
```

If the patch conflicts with an active memory, the curator returns `TENSION`. If evidence is missing, it returns `BLOCKED`.

## 4. Future Recall

Before a similar UI task, the lead agent asks:

> Which prior memory affects visual acceptance routing?

The curator returns a Brain Brief:

```json
{
  "relevant_memory": [
    {
      "summary": "Visible UI implementation and visual verification stay with the UI owner.",
      "path": "notes/visual-verification.md"
    }
  ],
  "constraints": ["Do not route visual acceptance to backend-only owners."],
  "watchouts": [],
  "note_paths": ["notes/visual-verification.md"],
  "direct_read_paths": ["notes/visual-verification.md"]
}
```

## 5. Hot Context Pack

High-utility active memory can be rendered into a compact prompt-prefix view:

```sh
node scripts/render-hot-context.mjs --pack examples/hot-context-pack.json
```

This pack is cache-friendly and cheap to load, but it is not canonical memory. It must be regenerated from source notes when lifecycle triggers fire.
