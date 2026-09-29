# Live Curator history-choice diagnostic — 2026-09-28

## Question and controls

Can a cheap Curator choose explicit historical lookup and use the newly reachable prior notes without corrupting current-state, scope, abstention or attribution behavior? The [manifest](../../eval/reader-pilot/historical-curator-manifest-2026-09-28.json) froze six synthetic questions, five source families, runner/runtime hashes, model `gpt-5.6-luna`, low reasoning, expected behaviors and alternating answer-arm order before generation. The [raw artifact](../../eval/reader-pilot/historical-curator-live-2026-09-28.json) retains all 18 calls and 12 answer trials; none failed or were replaced.

For each question, a fresh no-tool Luna call selected `include_superseded` before seeing sources. Both answer arms share that route choice: the existing-policy arm omits the option, while the history-capable arm honors it. The runner executes actual `recall-managed --auto --agent`, then `read-notes` for every delivered candidate. A separate fresh Luna call answers each arm from its original sources. This isolates lifecycle availability with controlled complete reading; it does **not** test autonomous source selection, a complete Curator/Lead workflow, independent routing per arm or another memory product.

The routing and answer prompts, public synthetic corpus and rendering are fixed by the frozen runner hash. Gold expectations remain in the separate manifest/review, not model inputs. The host workspace contains only the output schema; traces showed no forbidden tool use. This is a checked no-tool boundary, not proof of perfect filesystem isolation or absence of public pretraining contamination.

## Observed behavior

Luna selected the intended option on 6/6 questions: ordinary lookup for current state and production scope, historical lookup for the four explicit prior-state questions. Original-source hashes, all lifecycle exclusions and citation-path identity checks held on 12/12 answer trials.

| Case | Existing-policy answer | History-capable answer | Author review |
|---|---|---|---|
| Current | PostgreSQL | PostgreSQL | Both resolve current state |
| January prior state | Evidence insufficient | SQLite, citing prior.md | Treatment resolves recorded prior state |
| Production scope | PostgreSQL | PostgreSQL | Neither substitutes staging SQLite |
| Missing January value | Unresolved | Not recorded, citing prior.md | Neither invents a value |
| Conflicting January values | Evidence insufficient | Unresolved SQLite/MySQL conflict; cites both notes | Treatment preserves the recorded conflict |
| User statement vs assistant suggestion | Evidence insufficient | User said SQLite | Treatment does not adopt suggested MongoDB |

The [unblinded author review](../../eval/reader-pilot/historical-curator-review-2026-09-28.json) finds the requested complete behavior in 3/6 existing-policy versus 6/6 history-capable answers. The three existing-policy failures are safe abstentions with insufficient historical delivery, not hallucinations. These development counts are **not** independently validated supported-complete success or general quality rates. Current and scope controls retained their correct behavior. Three new historical answers cannot establish benchmark superiority or a statistical noninferiority gate.

## Measured usage and time

| Stage | Calls | Total host seconds | Median call seconds | Gross input | Cached input | Output |
|---|---:|---:|---:|---:|---:|---:|
| Shared routing | 6 | 62.126 | 10.009 | 92,431 | 30,208 | 133 |
| Existing answer | 6 | 55.452 | 9.297 | 93,173 | 58,368 | 339 |
| History-capable answer | 6 | 56.009 | 9.679 | 93,703 | 44,288 | 247 |

Cached input is included in gross input, not added to it. Reported cache writes were zero; reasoning-output counters were 23/26/0 for routing/existing/history respectively. Provider-normalized billing semantics and subscription allocation remain unknown. Different cache shares mean these totals do not support a causal cost comparison. Single calls per question do not estimate p95 latency reliably.

**Do not deploy this experiment's separate routing call.** It added roughly ten seconds per question as a host call. The production Curator already decides CLI arguments within its existing tool workflow; the explicit capability and guidance remain the product change. This experiment's staged calls are measurement scaffolding. There is no demonstrated latency saving or reason to add a new router model/service.

## Decision and remaining gate

Retain the explicit historical option, with current-state defaults unchanged. This live screen supports the capability's intended use on controlled examples; it does not fix the separate LongMemEval yoga update failure in unsuperseded histories. The next full-workflow trial must let the Curator select its own original reads and continuation, include dated/scoped conflicts on a frozen independent protocol, and compare named competitors with matched host conditions and support adjudication. The official benchmark and independent acceptance gates remain open.

```sh
python3 scripts/eval-historical-curator.py --out /new/report.json
```

Generated synthetic vaults and host workspace were removed automatically. No private vault or sealed benchmark conversation was opened. `npm run check` passed 295/295 tests, example validation and configured deterministic gates; `git diff --check` passed. Independent offline reconstruction of the frozen fixture definitions matched every delivered original-source hash. Accounting verified 18 unique call IDs, 12 unique answer trials, all frozen runtime hashes and all route expectations. The required private-vault status returned `SYNC_CONFIG_NOT_FOUND`; its contents were not changed.
