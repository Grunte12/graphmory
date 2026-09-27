# Session identity failure accounting — 2026-09-28

## Finding

Review of the persistent Curator runner found that a missing or changed `thread.started` session ID raised an error before adding that completed subprocess call to `modelCalls`. The workflow still failed, but the report omitted its call and available usage. This violated the goal's requirement to account for failed trials and retries in efficiency metrics.

## Repair and controlled verification

The runner now records the call, available usage, `failed: true` and `sessionIdentityFailed: true` before stopping. A deterministic fake-host regression deliberately returns a different session ID on the resumed second Curator call. The test verifies two recorded calls, failed second call, no Lead answer, and incomplete workflow. This is protocol validity evidence, not a live model, quality, latency or cache experiment. Existing successful resume behavior remains covered separately.

`npm run check` passed **283/283** tests and configured gates. The Obsidian vault status command returned `SYNC_CONFIG_NOT_FOUND`; no user vault content was modified. Previous successful live-run scores are unchanged because their session identities matched.

## Consequence

Failed session resumes must contribute to operational failure and available input/output usage before any cost-per-success calculation. Official QA, independently judged support, matched competitors and family-diverse efficiency acceptance remain pending.
