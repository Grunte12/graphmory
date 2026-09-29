# Prefetch duplicate-preview removal: frozen development screen

## Predeclared question and scope

Baseline commit `5912d51` delivers all original Markdown in an eligible wide first page but also repeats snippets from those same notes in `results[].evidencePreview`. Test an **opt-in** presentation change that omits only these redundant previews when every candidate original is already present. Keep source paths, order, scores, source bytes, hashes, pagination and skip behavior identical. This does not select fewer notes or claim semantic correctness. No answer labels are supplied to the selector.

Run the same pinned 1,439-question LoCoMo development screen as the previous [eligibility experiment](prefetch-eligibility-2026-09-28.md), comparing normal full-source prefetch and `compactPrefetch` on each question. The 30 eligible questions are the primary size population; all 1,439 check unchanged skip behavior and paths. The three previously exposed, live-tested histories remain development examples. The 3 sealed histories are not rendered.

Accept this as a **mechanical candidate** only if all eligible originals match byte-for-byte and in order, no ranked candidate/path/pagination changes, skipped responses are byte-identical, and median serialized ready-response bytes fall by at least 10%. A separate paired fresh-host answer experiment with supported citations is required before changing the default. Reject or repair if any evidence is lost. Latency and provider-token effects require live measurement; JSON bytes are not token or billing measurements.

## Results

[Frozen manifest](../../eval/reader-pilot/prefetch-preview-dedup-manifest-2026-09-28.json) and [all question measurements](../../eval/reader-pilot/prefetch-preview-dedup-results-2026-09-28.json). The full 1,439-question development run and replay both finished; the explicit-config result SHA-256 is `180f81166d8b4f4b8c91cec4fd2e34a77f67f2800c34f0e5a4c16c306bdd3aa2`.

| Check | Observed |
| --- | ---: |
| Eligible wide pages / all development questions | 30 / 1,439 |
| Ineligible responses identical | 1,409 / 1,409 |
| Original Markdown byte and hash parity | 30 / 30 |
| Candidate path order and pagination parity | 1,439 / 1,439 |
| Median actual `--agent` response size, baseline / compact | 122,648 / 102,006 bytes |
| Median per-question `--agent` byte reduction | **16.44%** |
| Range of eligible `--agent` byte reduction | 14.32–18.82% |
| Sum of eligible `--agent` bytes, baseline / compact | 3,677,785 / 3,075,616 |

The current full-source prefetch remains opt-in. `--compact-prefetch` requires it and omits `evidencePreview`, `sourceReadRequired` and `previewOmitted` only when every candidate original is attached to the same first wide page. When prefetch is skipped, the entire response is identical. This passes the frozen mechanical and 10% byte criteria. It does **not** prove a token reduction, billing reduction, latency improvement or answer-quality noninferiority. Eligible questions are mostly count/exhaustive prompts; the sample is not representative of every memory task.

The source-label [audit](three-arm-source-label-audit-2026-09-28.md) found ambiguity or incomplete gold evidence annotations in all three histories used by the prior live comparison. The next paired live test should use separately source-checked answerable cases, preserve official references unchanged, and grade supported completeness independently of raw F1. No production default is promoted by this screen.

### Reproducibility correction before finalizing

The first screen used the CLI's implicit runtime config, so its exact CLI environment was not pinned. Before finalizing, the evaluator was changed to create and pass the repository's frozen `DEFAULT_RUNTIME_CONFIG` explicitly. No query, candidate, option, threshold, source assertion or metric changed. All 1,439 rows and aggregate measurements in the corrected run match the first run exactly; only the manifest identity differs. The published file uses the explicit-config run. A second corrected replay was byte-identical (SHA-256 above). This correction is part of this development experiment, not a new holdout or a claim of independent replication. `npm run check` passed 309/309 tests and the configured gates after the code change. Read-only user-vault status still returns `SYNC_CONFIG_NOT_FOUND`; this experiment did not change the user's vault.
