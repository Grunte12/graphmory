# Exact prompt packing: deterministic transport preflight

## Preregistered before implementation measurements

The [native feasibility screen](ranked-original-live-screen-2026-09-29.md) rejected ranked-original transport: five of six workflows failed within the fixed resource budget. This experiment tests one code intervention in the existing source collection path: combine original fragments into batches sized against the complete serialized map prompt, then reuse the existing verified-span ledger for synthesis. It does not change ranking, scope, models, default installation or the resource ceiling.

Use the same two exposed LongMemEval-S histories (`gpt4_d84a3211`, `67e0d0f2`) and their frozen source hashes. Dataset SHA256: `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`. Run legacy and packed collectors once per history, in that order, with 150,000-byte tool pages, at most 32 pages, at most two map callbacks and 300,000 UTF-8 bytes per actual map prompt. The third Curator call remains reserved for synthesis; this preflight does not invoke it. Callback returns an empty span list, with no model inference or original-text publication.

Predeclared transport gate: packed mode must deliver and present every declared original byte exactly once to mapping callbacks, with matching path/hash and continuous line ranges, no partial lines or omitted sources, using at most two callbacks. Each actual serialized prompt must fit the byte cap. A source line that cannot fit, missing coverage, source drift or need for a third mapping callback must return an explicit incomplete result. Record all failed baseline/treatment attempts; never enlarge a ceiling to obtain a pass.

Synthetic verification also covers Unicode, JSON escaping, long lines, same-source continuation, original quote validation, invalid spans and infeasible budgets. Complete byte delivery and exact quote identity do not prove semantic extraction completeness or entailment. Empty-callback transport cannot qualify an answer-quality or synthesis-budget claim.

The intervention is motivated by the existing [collection-ledger architecture decision](../research/architecture-decision-2026-09-28.md) and [scale preflight](collection-scale-preflight-2026-09-28.md). GraphRAG's staged aggregation motivates the pattern; its published gains do not establish gains here. Only a transport pass permits subsequent label/support qualification and a separately frozen live comparison; promotion still requires the predeclared answer and independent holdout gates.

## Results

Both packed runs passed the predeclared complete-mapped-byte transport gate. Both legacy runs stopped at `collection-map-call-budget`. Empty map callbacks were used; no actual model was called.

| History | Original notes / bytes | Legacy mapped bytes | Packed mapped bytes | Packed actual prompt bytes | Packed preflight seconds |
| --- | ---: | ---: | ---: | --- | ---: |

| `gpt4_d84a3211` | 48 / 500,514 | 286,920 | 500,514 | 299788, 234257 | 0.721 |
| `67e0d0f2` | 52 / 506,072 | 287,980 | 506,072 | 299885, 241792 | 0.883 |

All 48/52 originals matched the frozen source hashes and exact continuous mapped byte ranges. Four CLI pages were packed into two mapping callbacks in each history. Synthesis remains untested: the empty callback ledger is not an extraction-quality result and does not prove a populated synthesis ledger fits. Single-run preflight times exclude model inference and are descriptive, not a latency comparison with completed reader answers. Legacy consumed its two mapping callbacks without covering every original; packed mode does more complete work.

Records: [bike](../../eval/reader-pilot/collection-packing-bike-2026-09-29.json), [courses](../../eval/reader-pilot/collection-packing-courses-2026-09-29.json). Run `python3 scripts/preflight-collection-packing.py --input <matching-label-free-reader-input> --out <new-record.json>`. Source text and prompt bodies remain unpublished; records include their identities and coverage metadata. Temporary collection state is automatically removed.

Code adds only opt-in `--collection-pack-prompts` with `--collection-ledger`. Actual UTF-8 serialization determines batches; LF-safe binary-search packing handles large single notes without per-line full-prompt replay. Packed mapping failures, rejected quotes, oversized lines or excessive planned calls stop before synthesis. The production install and default collection behavior stay unchanged.

## User priority update

After this transport run, the user requested that work prioritize a usable complete workflow over incremental benchmark percentages. Defer further comparative tuning and quality leaderboard work until a practical Lead → cheap Curator → multi-hop recall → verified memory update/lifecycle → Lead response workflow works end to end. Continue correctness/source-preservation checks. This preflight is a supporting implementation check, not the product completion gate or a reason to launch another small metric loop.

## Verification

Focused collector tests passed 12/12, the source-free preflight artifact test passed, and `npm run check` completed with exit 0. The private-vault status check returned expected `SYNC_CONFIG_NOT_FOUND`; the private vault was unchanged. No model or API call was made during this transport preflight. These checks establish implementation/transport behavior, not end-to-end product completion.
