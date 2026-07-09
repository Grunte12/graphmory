---
type: workflow
status: active
tags: [tension, contradiction, stale]
---

# Conflicting Memory Handling

When a new patch disagrees with active memory, preserve both claims and return `TENSION` with exact paths.

Do not silently overwrite the earlier decision. If evidence or scope is missing, return `BLOCKED` without writing.

## Provenance

- Curator authority boundary.
