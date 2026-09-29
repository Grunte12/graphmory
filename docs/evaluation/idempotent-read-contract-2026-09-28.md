# Idempotent original-read contract — 2026-09-28

## Evidence and change

Two workflows in the [frozen five-pair LoCoMo A/B](locomo-preview-reader-ab-2026-09-28.md) stopped because Curator requested already-delivered originals. The public `read-notes` tool is read-only; treating a benign repeated request as a fatal workflow failure made the development mediator unnecessarily brittle.

The [mediator](../../scripts/run-curator-paging-pilot.py) now records protocol `curator-paging-development-v3-idempotent-reads`:

- Deduplicate paths within a request and partition supplied paths into new and previously read originals.
- Fetch and hash-check only new originals; retain each original once in full follow-ups.
- Provide explicit already-read paths and reuse feedback. Compact resumed follow-ups redeliver requested cached originals without disk rereads.
- Keep unknown/unseen requests as errors and verify immutable original-source hashes before a successful finish.
- Preserve the declared round budget; endless repeats are failures, not success.
- Record every accepted request with `new` and `reused` paths in `sourceRequests`. Original reads and model usage remain separate.

This changes the experimental reader mediator, not production retrieval rankings or a calibrated semantic gate. The batch launcher also recognizes the targeted development diagnostic protocol; its scorer aggregates targeted retries without pretending different questions are A/B pairs.

## Experiment 1: controlled host responses, actual Graphmory CLI

The test host is deterministic and replaces model generation only. Real CLI retrieval and source reads still execute on isolated synthetic Markdown vaults, with original hashes checked. A baseline runner extracted from commit `a4665a3` failed both repeat/duplicate regression tests. The repaired runner passes all eleven mediation tests.

Covered scenarios: ordinary and mixed new/repeated reads; duplicate paths in one request; resumed compact context receiving a cached original; reuse plus exhausted pagination retaining both feedback messages; endless repeats exhausting three declared Curator rounds; unseen paths mixed with a previously read original still stopping before another read; existing source/citation/session boundaries. Source-read logs remain unique and originals unchanged.

```sh
node --test test/curator-paging-pilot.test.mjs
```

For the negative baseline, copy the `a4665a3` mediator into an isolated temporary `scripts/` directory, link its `brain-sync.mjs` to the current CLI, then set `READER_PILOT_RUNNER` to that copy and run the `repeated originals|duplicate paths within` test pattern. The override is test-only.

## Experiment 2: stopped real-trace classifier replay

[Audit artifact](../../eval/reader-pilot/idempotent-read-trace-audit-2026-09-28.json) uses the exact `classify_source_requests` function extracted from the repaired mediator. It replays the final request from both previously stopped real Curator traces, without generating another answer.

- `conv-47:52`: all nine requested paths had already been read; zero were unseen. New classifier accepts reuse, with zero new disk reads.
- `conv-48:36`: all ten requested paths had already been read; zero were unseen. Same classification.

```sh
python3 scripts/audit-reader-repeat-requests.py --runs /path/to/original/frozen/runs --out /tmp/repeat-audit-new.json
```

These are request-classification outcomes only. Original workflow failures and official scores remain unchanged. A separate scoring replay confirms every original row and aggregate field is preserved, with only a newly empty `sourceRequests` field added when loading historical reports.

## Decision

Use the repaired mediator for new frozen diagnostics. The targeted [live follow-up](idempotent-targeted-live-2026-09-28.md) remains separate: deterministic branch correctness does not establish autonomous answer quality, lower latency/cost, or superiority over competitors. Independent supported-complete, holdout and matched comparator gates remain open.

Verification: `npm run check` passed 291/291 tests, example validation and all configured deterministic gates; `git diff --check` passed. Required Obsidian sync status returned `SYNC_CONFIG_NOT_FOUND`; the user vault was untouched. These are mechanical checks, not semantic quality acceptance.
