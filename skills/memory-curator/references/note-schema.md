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
revalidate_when:
  - "the policy owner changes"
  - "a material requirement changes"
# Optional date expiry, separate from event triggers:
valid_until: YYYY-MM-DD
---
```

For a lead-authored patch, preserve every `lifecycle.revalidate_when` condition as a separate item in a simple multiline YAML list. If the patch has no event triggers, no `revalidate_when` note field is required. Preserve `valid_until` as its own date only when the patch supplies it. Do not replace event triggers with a date.

Every canonical note should contain:

- a link to the project map,
- one precise durable claim,
- applicability boundaries,
- provenance,
- links to related or conflicting notes.

Mark stale or superseded knowledge explicitly. Do not erase history required to explain current decisions.
