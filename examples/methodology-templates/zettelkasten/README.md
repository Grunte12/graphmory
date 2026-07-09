# Zettelkasten Methodology Example

Zettelkasten (German for "slip box") is an atomic note-taking method
associated with Niklas Luhmann. Each note is a single, self-contained idea
with a unique ID and links to other notes.

## Layout

```
vault/
├── source-map.md
└── notes/
    ├── 202607091001 Agent routing decision.md
    ├── 202607091002 Visual QA ownership.md
    ├── 202607091003 Memory Patch lifecycle.md
    └── keywords/
        ├── agent-routing.md
        ├── visual-qa.md
        └── memory-patch.md
```

## ID Convention

Each note gets a **timestamp-based ID** at the start of its filename:

```
YYYYMMDDHHMM Brief title.md
```

The ID encodes when the note was created. For branching ideas, append a
letter suffix: `202607091001a.md`, `202607091001b.md`.

## Note Structure

Every atomic note has:

1. **ID** — timestamp in filename
2. **Title** — the single idea in brief form
3. **Body** — the idea with links to other notes
4. **Tags** — optional keywords for grouping

### Example

```markdown
# Agent routing decision

**202607091001**

Route tasks by user-visible artifact ownership, not file type.

- Designer owns everything a user can see or interact with.
- Fixer owns backend, data, tests, and infrastructure.
- See [[202607091002 Visual QA ownership]] for related policy.
```

## Keyword Index

The `keywords/` directory acts as a lightweight tag system.
Each keyword note links to all notes with that tag.

```
# agent-routing

- [[202607091001 Agent routing decision]]
- [[202607091003 Memory Patch lifecycle]]
```

## Memory Patch Guidance

- Keep each Memory Patch in a single atomic note — one claim, one file.
- Link forward: when a new patch relates to an existing one, add a link.
- Do not merge atomic notes — create a separate index or keyword note instead.

## Reference

- Niklas Luhmann, *Communicating with Slip Boxes* (1981)
- Ahrens, *How to Take Smart Notes* (Sonke Ahrens, 2017)
- https://zettelkasten.de/overview/
