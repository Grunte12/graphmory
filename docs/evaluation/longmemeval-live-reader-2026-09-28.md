# LongMemEval live Curator source-read pilot — 2026-09-28

## Question and controls

After the [CLI delivery experiment](longmemeval-cli-delivery-2026-09-28.md) found first-page gold-session paths but incomplete previews, this pilot tested whether a real cheap Curator would choose and open a source before answering. It used one previously exposed LongMemEval development question (`a40e080f`, single-session-assistant) from the pinned cleaned-S dataset SHA-256 `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`. This is a **diagnostic**, not an independent holdout, representative sample or official benchmark run.

`scripts/prepare-longmemeval-reader-pilot.mjs` rendered all 48 original sessions as Markdown; labels and gold paths went to a separate file. The Curator received the question and actual `recall-managed --auto --agent` page, then could request paths for the mediator to open with `read-notes`. Only paths returned by the CLI were allowed; original bytes and SHA-256 were checked. A separate Lead answered from the Curator's source-cited brief. The mediator used `gpt-5.6-luna`, low reasoning, fresh `codex exec --ephemeral` calls with no direct tools, a three-round cap, and preserved failures. [Sanitized run report](../../eval/reader-pilot/longmemeval-live-a40-2026-09-28.json) records page paths, read path/hash, prompts hashes, native usage, timing, output and warnings. Raw host traces stayed outside the repository.

## Observed result

The gold session was rank 1 on the first page. The Curator requested **one** original note (4,621 bytes), then produced a brief; the Lead answered “Patagonia and Southwest Airlines” and cited `sessions/0031-334e97a0e66d.md`. The benchmark reference gives the same two names. Both names are explicitly in that original note (lines 45–49 of the rendered Markdown), so this single answer is supported for the named entities. This is a manual source check, **not** a blinded independent semantic label or official LongMemEval score.

| Measure | Observed |
|---|---:|
| CLI pages / source files read | 1 / 1 |
| Model calls (Curator ×2, Lead ×1) | 3 |
| Host-reported input / cached input tokens | 62,423 / 0 |
| Host-reported output tokens | 144 |
| End-to-end wall time | 24.398 s |
| Completed without protocol failure | Yes |

The second Curator call received the first retrieval page again with the opened original. This and the fresh ephemeral host sessions are plausible contributors to input-token cost and absent cache hits; the trace does not isolate their causal shares. Per-call input tokens were 23,030, 24,001 and 15,392. Those numbers include host context and are **not** Graphmory response tokens or billed dollars. The run cannot estimate persistent sub-agent cache behavior, p95 latency, or general answer success.

Verification after the evaluator/runner changes: `npm run check` passed 281/281 tests and configured gates. `npm pack --dry-run --json` still lists 95 package files and excludes the development runner and artifacts. The configured vault status command for `<private vault>` returned `SYNC_CONFIG_NOT_FOUND`; this pilot used only temporary public benchmark Markdown and did not modify that vault.

## Decision and next test

Keep the current retrieval defaults. Path reachability alone was too weak a proxy for usable evidence, while one live answer is too weak to justify a new source-reading policy. Next compare **matched live workflows** with a persistent Curator session and a compact continuation that sends only new source bytes; require the same source-selection freedom, question family split, separate answer/support labels, full token categories, and failure accounting. Change a production default only if supported-complete quality holds while measured end-to-end cost/latency improves.

Reproduce preparation (choose fresh output directories to preserve trials):

```sh
node scripts/prepare-longmemeval-reader-pilot.mjs --input tmp/datasets/longmemeval_s_cleaned.json --id a40e080f --out /tmp/lme-reader-new
python3 scripts/run-curator-paging-pilot.py --input /tmp/lme-reader-new/reader-input.json --out /tmp/lme-reader-live-new --model gpt-5.6-luna --mode auto --max-rounds 3
```
