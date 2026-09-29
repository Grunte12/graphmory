# Lifecycle metadata postcheck — 2026-09-29

## Change and reason

The preceding native Curator run lost an approved `lifecycle.revalidate_when` trigger despite passing input schema validation and existing audits. Add a read-only check of one canonical destination against the patch's lifecycle metadata, reusing the contract validator, safe source reader and Markdown parser.

```sh
graphmory verify-patch-persistence --vault <vault> --input <patch.json> --note <canonical-note.md> --agent
```

Generated Curator instructions now require saving event triggers as a YAML list, preserving any separately supplied expiry, and passing this postcheck before returning `APPLIED`. Input validation, original-source reading, write authority and independent graph/lifecycle audits remain necessary.

## Independent experiment

Acceptance criteria were recorded first in `patch-lifecycle-persistence-protocol-2026-09-29.md`. The parent invoked the actual CLI on temporary synthetic Markdown files, checking exit codes and SHA-256 before/after for both note and patch.

| Case | Expected | Observed |
|---|---|---|
| Prior native omission pattern, extended to two events and an expiry | Reject | Reject |
| Reordered complete list plus an extra event and matching expiry | Accept | Accept |
| Partial event loss despite matching expiry | Reject | Reject |
| Date supplied instead of event list | Reject | Reject |
| Complete events but missing required expiry | Reject | Reject |
| Destination escaping the vault | Reject | Reject |

All six cases matched expectations and left input/note bytes unchanged. The temporary workspace was removed. Machine-readable results: `eval/reader-pilot/patch-lifecycle-persistence-2026-09-29.json`.

Focused regression coverage is reproducible with:

```sh
node --test test/patch-persistence.test.mjs test/setup-curator-agent.test.mjs
```

It additionally covers malformed input, a missing note, a symlink escape, content leakage and invalid expiry types. The worker's focused run (also including `test/contracts.test.mjs`) passed 23/23. The parent ran `npm run check`: exit 0, 363/363 unit tests plus repository example/evaluation gates passed. `git diff --check` passed. The required read-only status of `/Users/grunte/Obsidian` returned the expected `SYNC_CONFIG_NOT_FOUND`; no private sync configuration was created.

## Limits

`metadataOnly: true` and `checkedFields` name the exact scope. This does not verify claim meaning, provenance support, supersession links, unrelated patch fields or permission to write. Event comparison requires every expected trimmed string; extra events and reordering are allowed. It uses the existing limited frontmatter parser, not a general YAML implementation. The existing date-oriented lifecycle audit may emit an informational missing-date finding for event triggers; this is reported separately rather than treated as proof of a missing event.

This experiment used no model calls, external API or private-vault writes. It has not yet demonstrated that a fresh live Curator follows the new postcheck instruction. The frozen earlier native experiment remains unchanged, and no performance/superiority claim follows from these synthetic checks.
