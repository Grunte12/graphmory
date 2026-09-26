# Vault setup and architecture

Graphmory reads Markdown from a local folder. An Obsidian vault is a good home for that folder, but Obsidian, GitHub sync, a graph database, and embeddings are not prerequisites for local recall. The `--vault` argument selects the root Graphmory reads. Keep the tool checkout separate from the user's notes.

## Choose one layout during agent-guided setup

| Situation | Recommended choice | Graphmory `--vault` |
| --- | --- | --- |
| Starting fresh | Dedicated Markdown/Obsidian vault | New vault path |
| Existing Obsidian vault, keep other notes separate | New `Graphmory/` folder inside it | Full path to `Graphmory/` |
| Existing structured memory | Reuse its current folders and links | Existing vault path |

The installer should inspect `detect --json` before asking. Ask the user to select a layout only when multiple safe choices remain. For an existing vault, list the proposed `--vault` path and any files that would be created. Merely selecting that vault does not authorize moving notes, bulk rewriting, or Git adoption. Review an adoption or restructure plan separately if requested.

## Minimal layout for new memory

```text
<vault>/
  00 Inbox/                       # temporary captures awaiting review
  02 Projects/
    <project>/
      00 Project Home.md          # short navigation map, when useful
      <focused decision or lesson>.md
```

Create only the folders and notes needed now. The fixed folder names above match Graphmory's existing project initializer and inbox conventions; other folders are allowed. `node scripts/init-project.mjs --vault "<vault>" --project "<project>"` creates a fuller optional project template with Decisions, Workflows, Root Causes, Preferences, Source Maps, Tensions, and a patch inbox. Do not use it when the user chose the minimal layout. For a minimal start, the installing agent can create `00 Inbox/` and `02 Projects/<project>/` using ordinary filesystem operations and add a project home only when there is real context to record.

When reusing an existing structure, project folders may have different names. Pass the relevant vault-relative folder as `--scope` during recall; do not rename folders just to match this example. Keep the original language and identifiers of source evidence. New curated memory can be concise English while the lead agent answers the user in their preferred language.

## Notes and graph links

The lead agent writes a verified, durable memory patch. The curator places or updates a focused Markdown note, preserves its source evidence, and flags conflicts. Keep raw captures in `00 Inbox/` until curated. Record lifecycle status and provenance on canonical notes; short aliases help retrieval when a concept has multiple names. A project home should link to useful notes, but it need not list every note.

Graphmory derives edges from ordinary local Markdown links, Obsidian wikilinks, and optional `part_of`, `depends_on`, `implements`, `evidence_for`, and `related` properties. Add a relation only when the evidence supports it. Full vault-relative targets resolve duplicate titles more reliably. See [knowledge graph](knowledge-graph.md) for the supported syntax and limits. Do not generate a large speculative graph during installation.

## Verify the chosen layout

```sh
graphmory detect --vault "<vault>" --json
graphmory audit --vault "<vault>" --json
graphmory graph-audit --vault "<vault>" --json
```

`audit` and `graph-audit` inspect the vault without changing notes. Review broken or ambiguous links and missing provenance before relying on those notes. Once the vault contains real memory, test a scoped query with `graphmory recall --vault "<vault>" --query "<known question>" --scope "<project folder>" --agent` and have the lead agent check the returned source. The graph is a navigation aid; retrieved text still needs evidence review.

Private GitHub sync is an optional later step. Configure it only after the user chooses a repo and reviews any adoption plan. Local-only setup does not need `bootstrap` or `status`.

## Evidence for this default

The layout is a small convention for safe setup and project scoping, not a proven optimal taxonomy. A [controlled 2×2 ablation](../evaluation/vault-structure-ablation-2026-09-26.md) on the public research fixture found no direct retrieval gain from its grouped folders or MOC pages. However, deleting the MOCs while leaving note links intact broke 45 links, so the no-index arms do not represent healthy multi-hop vaults. Keep existing layouts and links; add a concise index when it helps navigation. A held-out, multi-project task evaluation is still needed before changing the retrieval default or migrating notes.
