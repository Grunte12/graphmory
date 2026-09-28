# Full-source prefetch A/B — 2026-09-28

## Decision

Keep `--prefetch-wide-originals` experimental and off by default. One exposed broad count question improved from an unsupported answer of three letters to the two independently described letters, while the Curator/Lead workflow used two instead of three model calls and 18.380 instead of 33.729 seconds. Two narrow controls correctly skipped prefetch and cannot measure its benefit. One stochastic generation per arm cannot establish general quality, latency or cost superiority. Independent supported-complete grading, holdout and matched competitor gates remain open.

This turn follows a completed [section-window experiment](source-section-window-2026-09-28.md) that rejected lossy source selection. Full-source prefetch transports complete original Markdown bytes, with the same rank order and no shortening. It optimizes the Curator's delivery path, not the memory corpus or retrieval ranking.

## Frozen intervention and safety

[Manifest](../../eval/reader-pilot/prefetch-ab-manifest-2026-09-28.json) freezes three previously exposed LoCoMo development questions, six counterbalanced arm slots, original hashes, runner/CLI hashes, model IDs, budgets and promotion rule. All six attempts completed in that order without replacement or rerun. Luna `gpt-5.6-luna` Curator and Sol `gpt-5.6-sol` Lead use low reasoning, fresh Curator calls, structured citations, `--auto`, ten rounds and 300,000 input-byte limit. Labels and gold paths are separate from model input. Three sealed conversations remain unrendered.

With the opt-in flag, Graphmory attaches exact `read-notes` originals as `originalSources` only when the first adaptive page is wide, has no more candidates, did not hit a scan limit, and totals at most 256,000 raw original bytes. Read results retain path/SHA-256/byte count/full Markdown. The mediator verifies source hashes and makes those originals visible before the first Curator call. It skips focused questions, pagination, oversized pools and continuation pages; normal selective reading remains available. A file changed between ranking snapshot and attachment raises an error. The 256,000-byte eager-transport cap is not an end-to-end prompt-size guarantee; caller input budgets still apply. `prefetch.semanticCompleteness` remains `not_assessed`.

The option is not enabled in the default CLI, adapter or installation flow. It requires curator adaptive mode. It may expose more local vault content to the selected Curator model in a single call than selective reads, so users must control which model/host receives their vault. The experiment used the public LoCoMo corpus; no user Obsidian vault content was sent.

## Results

[All six sanitized results](../../eval/reader-pilot/prefetch-ab-results-2026-09-28.json), [unchanged pinned QA scores](../../eval/reader-pilot/prefetch-ab-raw-scores-2026-09-28.json).

| Question | Prefetch | Delivery | Model calls | Gold originals | All originals read | Seconds | Gross / cached input | Raw QA |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Letter count | Off | selective read | 3 | 2/2 | 29 | 33.729 | 86,395 / 29,440 | 0 |
| Letter count | On | 29 complete originals | 2 | 2/2 | 29 | 18.380 | 65,531 / 14,080 | 0 |
| Meeting date | On | skipped: focused | 3 | 1/1 | 1 | 27.070 | 53,246 / 46,592 | 0.5 |
| Meeting date | Off | selective read | 3 | 1/1 | 1 | 32.760 | 53,225 / 14,080 | 0.5 |
| False surfing premise | Off | selective read | 6 | 1/1 | 29 | 65.007 | 144,322 / 46,592 | 0 |
| False surfing premise | On | skipped: focused | 5 | 1/1 | 20 | 53.914 | 121,488 / 57,600 | 0 |

The broad prefetch page returns 120,835 native CLI output bytes versus 20,375 baseline search-page bytes; the baseline then separately reads all 29 originals. This trades a larger first tool result for one fewer model round. Raw source bytes are not provider tokens. The broad pair's observed noncached input is 51,451 on versus 56,955 off, but cache shares differ and subscription billing is unknown. The two focused controls use the same old selective path; their different reads/calls/timing are stochastic host behavior, not treatment effects. There is no powered p95 estimate or monetary savings claim.

### Answer/source audit

Unblinded author review, not calibrated independent support grading:

- The two counted letters are the company rejection in `session_14.md` and a blog reader's letter in `session_18.md`. Baseline also counts a childhood **note** in `session_27.md` as a third letter; that is not the pinned reference's two-letter answer. Both arms actually receive/read all gold originals, so the error is interpretation, not gold-path reachability. The prefetch answer gives two, with both supporting paths cited.
- Both meeting-date arms answer June 8, 2023 and cite/read `session_8.md`.
- Both false-premise arms say Tim does not surf and cite/read `session_3.md`. Their wording misses the upstream category-5 refusal phrases, so raw QA scores remain zero. Identity-valid citations do not independently prove every claim is supported.

The unchanged pinned QA scorer gives both full-sentence count answers zero because the reference is “Two” and lexical/category behavior is strict. Keep that official-derived raw score alongside this source audit; do not rewrite predictions or normalize the score after seeing them. Mean raw QA is 1/6 in both treatment groups (0.1667). This is not a full official LoCoMo run.

## Verification and limits

The manifest, all six actual runner reports, immutable original hashes and recorded source reads match. The prefetch-on broad arm attaches all 29 exact originals and never invokes a separate original-read tool; focused arms attach none. Tests cover scoped/canonical exclusion, default parity, exact CLI payload, narrow/page/budget skip, full-source fallback, a changed-file race, and mediated two-call flow. The full `npm run check` passes 308/308 tests and deterministic gates; `git diff --check` passes. User-vault sync status is `SYNC_CONFIG_NOT_FOUND`; it was not changed.

This is a development screen, not a predeclared powered comparator result. Source normalization and output contracts differ from Basic Memory, which was not run here. No independent holdout, external semantic labeler, cross-host validation, repeat variance, financial accounting or competitor noninferiority is established.

Next: repeat broad tasks from multiple source families, with matched native Basic Memory and ordinary selective Graphmory, plus narrow/oversized controls. Preserve exact answer support labels under blinded review, whole-workflow usage and actual host cache behavior. Only then consider enabling prefetch for a documented scope; the full optimization goal remains active.
