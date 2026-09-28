# Historical competitor parity audit — 2026-09-28

## Scope and evidence

Recompute the historical exposed LongMemEval question-only comparison: Basic Memory 0.23.2 text and verified hybrid, plus Graphmory `bm25` and `baseline`. This is an audit of existing artifacts, not a new search/model experiment or independent test.

[Initial audit](../../eval/competitor-pilot/parity-audit-2026-09-28.json) and [final audit](../../eval/competitor-pilot/parity-audit-final-2026-09-28.json). The final auditor also checks exact arm identity and records its own/helper hashes and raw report-file hashes. It preserves the initial result rather than overwriting it.

```sh
node scripts/audit-competitor-parity.mjs --input tmp/datasets/longmemeval_s_cleaned.json --out /tmp/parity-audit-new.json
```

## Findings

- All four treatments use the same 14 ordered case IDs and pinned dataset hash, with question-only query format declared.
- All 56 case/treatment rows have valid unique source paths and matching category/session counts. Recomputed Recall@3, Recall@12, Complete Evidence@3 and @12 agree exactly with stored metrics; abstention rows remain null rather than retrieval successes.
- All 28 Basic Memory original-input body hashes match reconstructed Markdown. Hybrid rows record nonzero embeddings and zero embedding errors. Native ingestion rewrites source formatting/frontmatter; equal original input does not imply identical indexed representation.
- Graphmory records dataset/helper metadata but no per-case original-body hashes. Reconstruction and score agreement do not independently prove every historical input byte. Current and historical helper hashes are both recorded; later helper changes cannot be treated as a recorded historical version.
- Historical reports do not record per-call query hashes. Declared query parity is weaker than immutable call receipts.
- Across all 14 cases, source-ID overlap yields 13 history components and 14 gold-source components. Shared distractors alone do not prove correlated outcomes, and separate gold IDs do not prove independence. These are diagnostics, not a calibrated clustering rule or a new confidence interval.
- Timing remains incomparable for whole-workflow claims: Graphmory uses in-process retrieval measurements, Basic Memory native CLI measurements. Native output bodies and Graphmory path/preview packets also differ. No matched reader success, cache, installation/ingest amortization or billing comparison exists here.

## Decision

Retain the [published retrieval table](basic-memory-vector-index-correction-2026-09-28.md), including the complete-evidence@3 tie and @12 completeness. It does not establish answer-level superiority, noninferiority or end-to-end savings.

Next comparator run must record per-case source hashes and actual query hashes before each tool call, pin native configuration/index evidence, use the same Curator/Lead host protocol and whole-workflow timer, preserve ingestion/normalization as part of each tool's native treatment, and independently adjudicate supported-complete answers. Freeze sample/primary metric/dependence rules before opening final outcomes. Existing exposed cases can validate instrumentation; they cannot satisfy independent holdout acceptance.

No new live model calls were made. The last usage snapshot was 97% of the five-hour allowance used. The persistent goal remains active; this audit closes reporting uncertainty only.

## Verification

`npm run check` passed 292/292 repository tests, example validation and configured deterministic gates. `git diff --check` passed. The required Obsidian status command returned `SYNC_CONFIG_NOT_FOUND`; the user's vault was not changed. These checks validate repository behavior and the audit computation, not answer-level comparator quality.
