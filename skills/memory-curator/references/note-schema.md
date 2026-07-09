# Canonical Note Schema

Use atomic Markdown notes under a project map.

```text
00 Project Home.md
01 Decisions/
02 Workflows/
03 Root Causes/
04 Preferences/
05 Source Maps/
06 Tensions/
inbox/memory-patches/
```

Recommended frontmatter:

```yaml
---
project: <project>
type: decision|workflow|root-cause|preference|source-map|tension
status: active|stale|superseded
updated: YYYY-MM-DD
---
```

Every canonical note should contain:

- a link to the project map,
- one precise durable claim,
- applicability boundaries,
- provenance,
- links to related or conflicting notes.

Mark stale or superseded knowledge explicitly. Do not erase history required to explain current decisions.
