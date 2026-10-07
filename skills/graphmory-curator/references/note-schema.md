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

For the default trial workflow, generate the exact note projection with `graphmory render-patch --input <patch.json>`. The renderer includes operational frontmatter and one `graphmory-patch-record:v1` block. Its digest binds the full schema-valid patch, including claim, applicability, provenance, confidence, and lifecycle fields. JSON scalar rows preserve exact strings and array order; optional-field presence is explicit. Do not hand-edit these rows or copy the block inside a quote or code fence.

Add project-map, related-note, and evidence links outside the owned block. When an approved replacement supersedes an earlier note, preserve that earlier record as history and declare it as an existing checkpoint target. Leave predecessor status/replacement metadata to checkpoint finish, which generates it deterministically from the approved patch and canonical successor path. The replacement must retain every declared predecessor path.

Use successful bound checkpoint finish for completion; it applies authorized predecessor metadata and runs full persistence verification. Standalone `verify-patch-persistence --full` remains diagnostic and can fail before finish has generated lifecycle fields. The legacy metadata-only check does not prove that the full patch survived. Verification checks representation; the Curator must still inspect original evidence and authority before writing. See [the trial workflow](trial-workflow.md).
