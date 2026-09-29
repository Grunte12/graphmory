# Persistent postings cache: product screen

Protocol: [frozen opt-in screen](persistent-index-optin-protocol-2026-09-29.md).

## Implementation and failures

The optional `--index-cache <directory>` path stores existing focused-section BM25F postings outside the Markdown vault. It does not change ranking, candidate discovery, the Curator model, or the default path. Source hashes are checked against freshly loaded Markdown. Changed notes update in a transaction; cold builds use an atomic temporary-file replacement. Cached scoring runs only after lifecycle and scope eligibility have been decided. An unsupported runtime, lock, or other cache failure uses the original scorer with one short stderr diagnostic.

Luna implementation assistance ended on a usage limit after writing a draft. Review found and fixed a file-URL read error, a SQL placeholder count error, and a metadata fingerprint property mismatch. The first full check passed 345 tests and failed the new cache lifecycle test while the module was unavailable; this was an integration failure, not a passing result.

The first timing screen returned exactly equal managed results for 30/30 SciFact queries, but failed the predeclared 20% p50 improvement gate. Baseline p50 was 1,689.2 ms and cache p50 1,474.2 ms; baseline p95 was 2,898.8 ms and cache p95 2,617.9 ms. First cache call was 4,282.6 ms and DB size 16,683,008 bytes. A source edit occurred during this first run, so its timing also cannot establish a stable implementation comparison. Retain it as a failed exploratory attempt, not release evidence.

Review found that the draft parsed sections in every note before checking whether they changed. The revision parses changed notes during updates and only matching notes during scoring; eligible corpus lengths come from the cached rows. Stable note/section ordering is preserved before ties are sorted. No query labels or gold answers are used by this optimization.

## Correctness checks

- Six mutation states × twelve frozen queries: exact full managed JSON compared with the current baseline, without a cache fallback.
- Corrupt cache: rebuild from current Markdown or fall back; no stale evidence delivered.
- Two simultaneous cold CLI calls: both full JSON responses match baseline.
- Locked SQLite database with a changed note: one fallback diagnostic and fresh baseline evidence; next unlocked call refreshes normally.
- Forced SQL failure after incremental deletion begins: transaction rollback leaves the prior DB byte hash unchanged; removing the fault allows refresh on the next call.
- Cache path inside the vault, including a symlinked ancestor: rejected without writing there.
- Thirty-six generic graph queries across default, historical and project-scoped contexts: exact full JSON and no fallback, including a navigation hub, a two-hop bridge and a cycle. This verifies product integration separately from the prior experimental ranker.

The full check run with 348 tests passed after stopping the concurrent benchmark. The preceding full run passed all 348 tests but failed the existing stress latency gate; timing contention is a plausible explanation, not a demonstrated cause. No threshold was changed. The subsequently added graph integration test also passed in the targeted four-test cache suite. The required read-only sync status check returned `SYNC_CONFIG_NOT_FOUND`; no sync configuration was created.

## Stable revision results

Thirty alternating fresh-process pairs on the exposed SciFact slice passed exact full managed JSON and byte-size parity (30/30). No index fallback occurred. The revision's product files were unchanged during this run; the harness at this point recorded the CLI hash only. The updated reproducibility harness now freezes hashes of all relevant code files and the loaded source set before each future run and rejects end-of-run drift.

| Measurement | Baseline | Opt-in index |
| --- | ---: | ---: |
| p50 whole-command latency | 1,641.3 ms | 1,138.2 ms |
| p95 whole-command latency | 2,350.1 ms | 1,405.5 ms |
| Exact response parity | — | 30/30 |
| First indexed call, including build | — | 4,745.9 ms |
| Cache size | — | 16,683,008 bytes |

The 30.7% p50 reduction passes the predeclared 20% large-slice gate; p95 and output bytes do not worsen. These are one run on an uncontrolled local machine, not statistical evidence across hardware or a relevance gain.

The read-only local-vault screen used ten generic unlabeled queries and an external disposable cache. All ten full responses and byte sizes matched, and the loaded Markdown source-set hash was unchanged. p50 was 93.3 ms baseline versus 88.7 ms indexed, while p95 was 99.4 versus 113.5 ms. The regular checks also ran during part of this small screen, so these timings are noisy and cannot establish a small-vault speed benefit. The cache was deleted after the run. Keep opt-in; no automatic threshold follows.

Reproduce the large screen with:

```sh
node scripts/eval-persistent-index-optin.mjs --prepared /path/to/prepared-scifact --out /path/to/new-report.json
```

Use `--vault /path/to/vault` instead of `--prepared` for the ten-query private-vault parity screen; it records hashes and aggregates, not query results or note paths. This command builds and deletes a temporary external index and leaves the vault unchanged.

## Limits

This screen measures retrieval implementation parity and command latency, not supported-complete answers. SciFact uses the exposed first 30 queries and the scanner's first 5,000 Markdown notes, not the official full BEIR result. Independent holdout and matched competitor workflows remain required. Node 20 compatibility is supported by the capability/path tests and dynamic-import boundary, but an actual Node 20 runtime test remains unverified. The default remains unchanged.
