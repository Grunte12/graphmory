# Claude Code Install Guide

Use this guide to wire Memory Patch Harness into a Claude Code installation
(`<CLAUDE_HOME>`, typically `%USERPROFILE%\.claude` on Windows).

## Automated Install

`adapters/claude-code/install.mjs` installs the harness core, the
`memory-curator` subagent, the `claude-memory-handoff` skill, and the helper
scripts, and renders `CLAUDE.snippet.md` / `settings.snippet.json` with your
real paths filled in. It never touches an existing `CLAUDE.md` or
`settings.json` — those stay yours to merge by hand.

```powershell
node adapters/claude-code/install.mjs `
  --vault "C:\path\to\ObsidianVault" `
  --scope "02 Projects\Example"
```

Useful options:

```text
--claude-home <path>   default: $CLAUDE_HOME or ~/.claude
--skip-harness         update only the claude-code adapter files when the harness already exists
--dry-run               print planned files without writing
--force                 replace existing adapter-owned agent/skill/script files
```

Then review and merge the two rendered files:

```text
<claude-home>\memory-patch-harness\CLAUDE.snippet.md
<claude-home>\memory-patch-harness\settings.snippet.json
```

Merge sections you want into `<CLAUDE_HOME>\CLAUDE.md`, and merge the `env`/
`hooks` keys from `settings.snippet.json` into `<CLAUDE_HOME>\settings.json`
only if you want the optional recall hook — skip that step entirely for a
zero-hook install. Start a fresh Claude Code session afterward so the
subagent, skill, and scripts reload. Scripts are copied file-by-file into
`<CLAUDE_HOME>\scripts\`, so an existing `scripts/` directory with unrelated
files is never wiped.

## Manual Install

The steps below are what the installer above automates. Use them if you
don't have Node available, want to review every file before it lands, or
need to hand-place things differently than the installer assumes.

### Steps

1. Install the base harness (`memory-curator` skill + CLI + source) using the
   existing installer, unchanged:

   ```sh
   node scripts/install.mjs --target "<path-to-your-.claude>" --vault "<path-to-your-vault>" --runtime core
   ```

2. Copy this adapter's subagent definition into your agents directory:

   ```sh
   cp adapters/claude-code/agents/memory-curator.md "<CLAUDE_HOME>/agents/"
   ```

3. Copy this adapter's handoff skill into your skills directory
   (`memory-curator` is already deployed by step 1 — do not duplicate it):

   ```sh
   cp -r adapters/claude-code/skills/claude-memory-handoff "<CLAUDE_HOME>/skills/"
   ```

4. Copy this adapter's helper scripts into your scripts directory:

   ```sh
   cp adapters/claude-code/scripts/*.ps1 "<CLAUDE_HOME>/scripts/"
   ```

5. Merge the sections you want from `CLAUDE.snippet.md` into
   `<CLAUDE_HOME>/CLAUDE.md`, filling in your real vault path and memory
   scope in place of the placeholders.

6. (Optional) Merge `settings.snippet.json`'s `env` and `hooks` keys into
   `<CLAUDE_HOME>/settings.json` if you want the bounded Brain Brief recall
   hook. Do not overwrite the whole file — add or merge these keys alongside
   whatever is already there (model, statusLine, plugins, etc.). Replace
   `<CLAUDE_HOME>`, `<path-to-your-vault>`, and `<your-memory-scope>`
   placeholders with your real paths. Skip this step entirely if you only
   want the skill/subagent/scripts without any hook.

7. Verify the install:

   ```sh
   node "<CLAUDE_HOME>/bin/memory-patch-harness.mjs" doctor --json
   ```

## Do Not

- Do not overwrite an existing `settings.json`, `CLAUDE.md`, `agents/`, or
  `skills/` directory wholesale — merge/add files instead.
- Do not duplicate the `memory-curator` skill; it is already deployed by
  `scripts/install.mjs` from the repository's top-level `skills/memory-curator/`.
- Do not enable the recall hook unless you want it; it is opt-in via
  `settings.snippet.json`, and the adapter works with zero hooks.

## Verify

```sh
node "<CLAUDE_HOME>/bin/memory-patch-harness.mjs" doctor --json
node "<CLAUDE_HOME>/bin/memory-patch-harness.mjs" health --vault "<path-to-your-vault>" --json
```

Report what changed and what remains manual (this adapter does not touch
`scripts/install.mjs`, so future harness upgrades will not automatically
re-sync `agents/`, `skills/`, or `scripts/` for Claude Code — re-copy them
after pulling harness updates).
