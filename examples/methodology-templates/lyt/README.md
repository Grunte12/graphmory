# LYT Methodology Example

LYT stands for **Linking Your Thinking** (by Nick Milo).
It emphasizes **Maps of Content (MOCs)** — curated index notes that link to
related atomic notes. The vault is fluid and grows organically through
wiki-style links.

## Layout

```
vault/
├── source-map.md
└── notes/
    ├── 00 MOCs/
    │   ├── MOC Agent architecture.md
    │   ├── MOC Memory systems.md
    │   └── MOC Development workflow.md
    ├── Concepts/
    │   ├── Memory Patch lifecycle.md
    │   └── Brain Brief contract.md
    ├── Decisions/
    │   └── Agent routing policy.md
    └── Sessions/
        └── 2026-07-09 Sprint review.md
```

## MOC Role

A Map of Content (MOC) is a hub note that links to 5–15 related notes.
It is not an index of everything — it is a curated entry point for a topic.

```
# MOC Agent Architecture

- [[Decision: Agent Routing Policy]]
- [[Concept: Memory Patch Lifecycle]]
- [[Concept: Brain Brief Contract]]
- [[Session: 2026-07-09 Sprint Review]]

_This MOC guides agent routing and memory decisions._
```

## Linking Style

- Use `[[Wiki Links]]` to connect related notes.
- Every note should have at least one incoming link (from an MOC or another note).
- Review orphan notes periodically.

## Memory Patch Guidance

- Create or update an MOC when you have 5+ patches in a thematic cluster.
- Link new Memory Patches to the most relevant existing note.
- Update MOCs when a patch supersedes another or when priorities shift.

## Reference

- Nick Milo, *Linking Your Thinking* workshop series
- https://www.linkingyourthinking.com/
- https://notes.linkingyourthinking.com/
