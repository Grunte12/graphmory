# MCP link: the Curator maintains links

`link` lets the Curator keep the memory graph connected without the owner editing links by hand. One call edits up to 50 notes, and only their links.

```json
{ "notes": [
  { "path": "Projects/Cedar/Decision.md", "hash": "<hash from read>",
    "add": [{ "target": "Projects/Cedar/Index.md", "relation": "part_of" }],
    "remove": [{ "target": "Entities/Old queue.md", "relation": "related" }] },
  { "path": "Projects/Cedar/Runbook.md", "hash": "<hash from read>",
    "repair": [{ "from": "Old Queue", "to": "Entities/Queue.md" }] }
] }
```

- **add / remove** edit the relation properties in the note's frontmatter: `part_of`, `depends_on`, `implements`, `evidence_for` and `related` ([knowledge graph](knowledge-graph.md)). New values are quoted wikilinks such as `"[[Projects/Cedar/Index]]"`, so Obsidian shows them as clickable links and recall's link lane follows them. A target must be an exact vault-relative path of an existing note. Adding a link that is already there, or removing one that is not, changes nothing.
- **repair** points a broken or ambiguous link at an existing note. It rewrites every `[[from]]`, `[[from|label]]`, `[[from#heading]]`, `[text](from.md)` and relation value with that target, keeping labels and headings. Links inside code, inline code, comments and the Graphmory record block are left alone. A link that already resolves returns `LINK_NOT_BROKEN`.

Each note is bound to the hash the Curator read. Every note in the batch is checked before anything is written, so one stale hash (`TARGET_CHANGED`) or bad target blocks the whole batch and `BLOCKED` names that note's `path`. Each file is replaced atomically, and if a write fails the notes already written are put back. Results: `LINKED` with, per note, `previousHash`, the new `hash` and the `changes`; `UNCHANGED`; or `BLOCKED` with a code (`LINK_TARGET_NOT_FOUND`, `LINK_NOT_FOUND`, `NEEDS_CURATION` for a property that is not a simple list, `CURATION_PENDING`).

## When the Curator links

- Batch the work: after a session's writes, or when `status` lists several broken links, send one `link` call for all the notes instead of one call each.
- After `remember` returns `APPLIED`: connect the new note to its project index (`part_of`) and to the evidence notes it cites (`evidence_for` from the evidence, or `related`), and make the index link back when the project uses one.
- When `status` reports broken or ambiguous links: read each note, find the note the link meant, and `repair` it. If the right target is unclear, leave it and tell the main agent.
- When a note is superseded: point links that should follow the current decision to the successor; keep links that cite the history.

Link only relationships a source states or the notes already imply directly. Shared keywords alone are not a reason to link, and a link never proves a claim.
