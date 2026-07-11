---
name: brain-update
description: Apply a lead-authored, verified Memory Patch or Learning Packet to canonical Obsidian memory with provenance, lifecycle, conflict, and project-map checks. Use only after evidence has been verified and the lead has authored the durable meaning.
---

# Brain Update

This is a lead-agent write workflow. Do not delegate the write to a read-only
curator or reviewer.

## Preconditions

Require a complete Memory Patch or Learning Packet. Reject or return `BLOCKED`
when meaning, evidence, scope, confidence, lifecycle, revalidation, or required
user approval is missing. Never promote an Evidence Digest, transcript, hook
event, search result, embedding result, or graph edge directly.

## Apply

1. Recall the project home and strongest nearby canonical note.
2. Verify provenance against the named source before writing.
3. Apply the significance gate again. Prefer no write over diary memory.
4. Merge into the strongest existing atomic note when the claim is compatible.
   Create a new note only when it represents a distinct durable concept.
5. If active memory disagrees, preserve both claims and return `TENSION`; do not
   silently overwrite either side.
6. Preserve applicability boundaries, confidence, lifecycle status,
   `revalidate_when`, and supersession links.
7. Link the changed note from the project home and add only useful related-note
   links.
8. Return `APPLIED`, `TENSION`, or `BLOCKED` with changed paths, provenance
   retained, and checks performed.

## Structure

Use the project map and atomic folders:

```text
00 Project Home.md
01 Decisions/
02 Workflows/
03 Root Causes/
04 Preferences/
05 Source Maps/
06 Tensions/
inbox/
```

Inbox items are provisional evidence. Canonical notes are operational memory.
Raw sources remain evidentiary truth. Embeddings, graphs, and generated packs
are rebuildable derived views.

## Safety

- Never save secrets, full transcripts, or unverified reflection.
- Never auto-push after an update. Run `sync-plan`; publishing still requires
  explicit user approval.
- In an external review lane, do not use this skill. Hand the finding to the
  owning lead agent.
