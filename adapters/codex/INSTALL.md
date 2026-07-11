# Codex Install Guide

Use the adapter installer for a safe, rendered Codex setup. It installs the
harness, native skills, and optional custom agents, but deliberately does not
modify an existing `AGENTS.md`.

## Install

From the repository root:

```powershell
node adapters/codex/install.mjs `
  --vault "C:\path\to\ObsidianVault" `
  --scope "02 Projects\Example" `
  --with-semantic
```

Useful options:

```text
--codex-home <path>       default: $CODEX_HOME or ~/.codex
--harness-target <path>   default: <codex-home>/tools/memory-patch-harness
--model-cache <path>      local semantic model cache
--curator-model <id>      default: gpt-5.4-mini
--curator-effort <level>  default: medium
--deep-model <id>         default: gpt-5.4
--deep-effort <level>     default: low
--ingest-model <id>       default: gpt-5.4-mini
--ingest-effort <level>   default: medium
--with-semantic           install local Transformers.js semantic fallback
--skip-harness            update only Codex adapter files when harness exists
--dry-run                 print planned files without writing
--force                   replace existing adapter-owned skills/agents
```

Use model IDs available in the target Codex account. The defaults avoid
private provider aliases. A local installation may select a faster Codex model
for the deep fallback after a frozen recall eval confirms it.

## Merge Instructions

The installer writes a rendered snippet to:

```text
<codex-home>/memory-patch-harness/AGENTS.snippet.md
```

Review it, then merge the marked block into either:

- `~/.codex/AGENTS.md` for a personal cross-project brain; or
- a repository `AGENTS.md` for project-only memory behavior.

Do not overwrite unrelated instructions. Start a fresh Codex task after the
merge so native skills and custom agents reload.

## Environment

The rendered agents contain explicit paths and work without shell-profile
variables. Environment variables remain useful for manual CLI calls:

```powershell
[Environment]::SetEnvironmentVariable(
  "OBSIDIAN_VAULT",
  "C:\path\to\ObsidianVault",
  "User"
)
[Environment]::SetEnvironmentVariable(
  "MEMORY_PATCH_HARNESS_SCOPE",
  "02 Projects\Example",
  "User"
)
```

## Verify

```powershell
node "$HOME\.codex\tools\memory-patch-harness\bin\memory-patch-harness.mjs" doctor --json
node "$HOME\.codex\tools\memory-patch-harness\bin\memory-patch-harness.mjs" recall `
  --vault "C:\path\to\ObsidianVault" `
  --scope "02 Projects\Example" `
  --query "What prior decision changes this task?" `
  --k 3 --rerank --json
```

When `--with-semantic` is installed, verify one known paraphrase miss with
`recall-semantic --k 10`. The ten results are candidate metadata; the curator
must still filter and directly read at most three notes.

## Operational Flow

1. Recall: `memory-curator` returns a compact Brain Brief.
2. Ingest: `memory-ingest` turns named raw sources into an Evidence Digest.
3. Author: the lead verifies evidence and writes the semantic delta.
4. Update: the lead invokes `brain-update` with a complete Memory Patch or
   Learning Packet.
5. Maintain: run health/lifecycle checks after meaningful batches.
6. Sync: run `sync-plan`; push only after explicit approval.

## Reviewer Mode

When Codex is invoked as an external reviewer for another orchestrator, keep
the vault read-only. Recall is allowed; ingestion proposals may be returned to
the owner; `brain-update`, bootstrap, restructure, and push are forbidden.

## Do Not

- Do not inject the full vault or full role prompt at startup.
- Do not save raw transcripts, credentials, or routine summaries.
- Do not let intake or retrieval agents write canonical memory.
- Do not treat embeddings or graph output as accepted truth.
- Do not run both curator models by default or retry-loop low confidence.
- Do not auto-merge or auto-push shared memory.
