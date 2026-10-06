# Graphmory MVP summary — 2026-10-01

## Status

**Ready for a trial within the tested scope:** Codex CLI 0.146.0, with the Lead and the Curator both on `gpt-5.6-luna` at low reasoning effort, Node 24.18.0 and a local Markdown vault.

Gates G1–G9 all pass, after the failed delivery round was recorded and the delivery was corrected in one more round. The default model `gpt-6-luna`, Cursor, Claude and the user's own main vault still need their own trial.

## What was done

| Area | What was added or fixed | Benefit |
|---|---|---|
| Writing memory | Notes are created from a patch, and the check covers the conclusion, scope, sources and lifecycle | Catches important information that went missing, instead of checking metadata only |
| Lifecycle | One expiry rule is shared by retrieval and audit | Expired information is never used as a current fact, even when the cache was already warm |
| Writes | Checkpoints and pre-edit copies are kept outside the vault | Unfinished work is visible, and memory with an unfinished write stops being used |
| Recovery | The current hash is checked before a file is restored, and a lock left by a stopped process needs an approval step | Work that was closed halfway can be recovered, and source files that were edited from outside are preserved |
| Curator | The guide and role work through the installed CLI | The Lead hands a complete task to the Curator and receives a summary and a receipt back |
| Delivery | The package contains the guides, the reports and working links | It can be installed for a trial without extra APIs or a local model download |

## How it was tested

A **synthetic vault with real Markdown files** and an `.obsidian` folder was used, and every file hash was compared before and after. The user's main vault was not modified, and the Obsidian app was not opened for this test.

- `npm run check` passed **394 of 394 tests**, including the configured examples and evals.
- The Curator had to continue to page two, read the original evidence and use the graph engine to walk real links.
- A policy update changed only the **3 allowed files**, and kept the old policy and the history links in both directions.
- Cases with insufficient evidence or conflicting evidence changed no file at all.
- A fresh session read the current memory, the history and a preference, and replayed them with **no file changed**.
- A recovery test killed a real process with `SIGKILL`, then inspected and recovered from a new process.
- The package and 60 real links were checked, the evidence was kept privately, and the temporary test workspace was deleted.

## What failed in the first round

1. After the expiry check was added, every new filtered result made the search cache unusable. The fix keeps the cache and invalidates it when the relevant data or time changes.
2. In the first native round, the Lead made the update itself while the Curator received only the preference task, so it did not count as passing the intended workflow. The corrected round handed the complete update to a single Curator and passed on real traces.
3. The guide referred to a report that was not in the npm package, so the packaging was fixed and the links were checked again.

The failed results remain in the reports. The code and the checks took about 45 minutes, but the corrected native test, the independent review and the cleanup pushed the total past the one-hour target.

## Before trying the main vault

Read the [trial guide](../guides/trial-mvp.md), then use guided setup to choose the real host, model and vault. Start with a small task whose result can be checked, and use a single writing Curator per vault.

This work was kept on the local machine for review. Nothing was committed, pushed or published as a package, and no other tool was benchmarked in this round.

Detailed evidence: [the full MVP process](mvp-implementation-report-2026-10-01.md), [native acceptance](mvp-native-acceptance-2026-10-01.md) and [package audit](mvp-package-audit-2026-10-01.md).
