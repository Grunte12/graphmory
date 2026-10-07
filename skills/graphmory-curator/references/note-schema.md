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

For a main-agent-authored patch, preserve every `lifecycle.revalidate_when` condition as a separate item in a simple multiline YAML list. If the patch has no event triggers, no `revalidate_when` note field is required. Preserve `valid_until` as its own date only when the patch supplies it. Do not replace event triggers with a date.

Every canonical note should contain:

- a link to the project map,
- one precise durable claim,
- applicability boundaries,
- provenance,
- links to related or conflicting notes.

Mark stale or superseded knowledge explicitly. Do not erase history required to explain current decisions.

## Guarded patch records

`remember` generates the exact note projection. The renderer includes operational frontmatter and one `graphmory-patch-record:v1` block. Its digest binds the full schema-valid patch, including claim, applicability, provenance, confidence, and lifecycle fields. JSON scalar rows preserve exact strings and array order; optional-field presence is explicit. Do not hand-edit these rows or copy the block inside a quote or code fence.

Links to project maps, related notes and evidence live outside the owned block. `remember` keeps whatever the note already has there; the Curator adds, removes and repairs them with `link`. When an approved replacement supersedes an earlier note, list it in `lifecycle.supersedes` with its current hash; its content is kept as history. Checkpoint finish writes the predecessor's status and replacement metadata deterministically from the approved patch and canonical successor path. The replacement must retain every declared predecessor path.

`remember` completes a write with checkpoint finish, which applies authorized predecessor metadata and runs full persistence verification; only its receipt proves the full patch was saved. Verification checks representation; the Curator must still inspect original evidence and authority before writing.
