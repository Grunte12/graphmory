# Reader attribution pilot — 2026-09-28

## Scope and decision

Actual Codex CLI generations were run with `gpt-5.6-luna`, low reasoning, fresh ephemeral sessions, on **one purposely selected exposed LoCoMo development question**, `conv-43:21`. Four stages completed: oracle-source reader, predicted-source reader, curator brief, and reader of that brief. This is a failure-attribution diagnostic, not a benchmark acceptance result or a product-default change.

The immediate actionable failure is evidence delivery: Chicago's source is rank 26 and excluded from the deliberately restricted top-10 diagnostic. A curator cannot reliably recover an absent fact. Keep the product's continuation/full-source workflow; do not interpret this experiment as endorsing a total top-10 cap.

The second finding is label ambiguity: the reference includes Seattle among cities visited, but its cited turn describes an upcoming trip/game. A more precise brief preserves the future tense. Official scoring and strict evidence review must remain separate.

## Frozen data and controls

- Source: [LoCoMo dataset and evaluation](https://github.com/snap-research/locomo/tree/3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376), data SHA-256 `79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4`.
- Builder prepares two known development failures; this run selected only the first. No unopened holdout conversation was rendered or evaluated.
- Same question, same reader model/prompt rules, full original Markdown session text and source hashes. Predicted sources are fusion top-10; oracle sources are gold-selected complete sessions. The oracle condition is not deployable and changes both selection and source volume.
- Gold QA labels are retained in a separate file, never supplied to model prompts. Only the question and source prose (or curator brief) are supplied. The evidence identifiers embedded in original session text are preserved.
- Models are told to use no tools. Traces are checked for any tool item and invalidate such a run. The working directory contains only an output schema. This is **not a proven filesystem access-control boundary**: trace inspection is essential and the host's skills remain visible.
- Every expected stage is listed. Failed trials are retained and no automatic retry occurs. A retry after a diagnosed infrastructure/runner change is a distinct run, not silently substituted.
- No private Obsidian content was used or changed. No external API key or judge service was required.

## Observed generations

Question: “Which US cities does John mention visiting to Tim?”

| Stage | Delivered condition | Actual answer/brief | Wall time |
|---|---|---|---:|
| Oracle reader | Gold sessions 3, 6, 9 | Seattle, Chicago, New York City, with all three source paths | 7.427 s |
| Predicted reader | Ten ranked full sessions; Chicago session absent | Seattle and New York City; Chicago absent | 6.762 s |
| Curator | Same ten predicted full sessions | NYC was visited; Seattle was an upcoming destination; exact paths retained | 9.337 s |
| Brief reader | Only the curator's brief | NYC was visited; distinguishes the planned Seattle trip; Chicago absent | 9.833 s |

These are raw single-trial wall times, not an A/B latency conclusion. The brief workflow requires curator **plus** reader time and usage; do not compare its reader alone with the direct reader as if the curator were free. No repetitions, uncertainty intervals or p95 estimates are justified.

The source inspection was by the root agent, unblinded and not independently human-calibrated. Relevant original turns:

- `session_3.md`, `D3:19`: identifies Seattle and says a game there is next month.
- `session_6.md`, `D6:3`: describes having been in Chicago. Gold session rank is **26**, versus ranks 1 and 10 for the other required sessions.
- `session_9.md`, `D9:6`: describes a trip to New York City.

No official LoCoMo F1 scorer was executed and no calibrated semantic judge was applied. Both values remain null in the artifact. Literal agreement with a reference would conceal the tense distinction; this pilot therefore makes no binary correctness or superiority claim.

## Cost, cache and host limitations

The completed four-stage run reports 89,033 input tokens, 418 output tokens and 134 reasoning output tokens. Provider-reported cached input and cache-write tokens are **zero** in all four calls. Preserve the native categories rather than assuming reasoning is a separate billable addition. Subscription allocation and billed monetary cost are unknown.

The CLI emitted skill-description budget warnings even with `--ignore-user-config`. Therefore this harness has not established a minimal host prefix or effective prompt caching. Fresh sessions do not establish a cold cache by definition; the usage fields establish only no reported cache hits in these calls. Future cost comparisons should measure the entire curator/lead path with the same host configuration and explicit cache conditions. More semantic complexity is not the first optimization to add.

## Failed attempts and runner repair

1. CLI failed before generation because it could not write its local state/app-server data. The user granted filesystem/network permission through the permission tool; no model quality score applies.
2. `gpt-6-luna` returned an unsupported-model error for this authenticated ChatGPT CLI account. The local model cache listed `gpt-5.6-luna`; the next run used that ID explicitly.
3. The first successful Luna generation was incorrectly rejected by the new runner because an advisory `item.type=error` was mistaken for a prohibited tool item. Its actual answer/trace was preserved and excluded from the completed comparison. The runner now distinguishes advisory items in a completed turn from fatal top-level errors, failures and tool executions. Tests cover this counterexample.

There were five actual generations including the excluded warning-rejected answer, across seven host attempts including the two pre-generation failures. The 89,033-input-token total describes only the completed four-stage run, not all attempted work. Raw traces are preserved in local temporary experiment directories; public evidence below retains the completed answers, hashes, native usage, and failure history without local authentication logs.

## Reproduction and artifacts

From the repository root, choose new output directories so prior evidence is preserved:

```sh
node scripts/prepare-reader-pilot.mjs --input /path/to/pinned/locomo10.json --out /tmp/reader-input-new
python3 scripts/run-reader-pilot.py --input /tmp/reader-input-new/reader-input.json --out /tmp/reader-run-new --cases 1 --model gpt-5.6-luna
node --test test/reader-pilot.test.mjs
```

Model availability is host/account-specific. This developer-only run uses authenticated subscription quota. The builder checks the exact dataset hash and development membership, records source/runner hashes, and refuses existing output directories. The runner's expected-trial manifest must match observed successful rows before `runComplete` becomes true.

Public artifact: [completed run and qualitative review](../../eval/reader-pilot/development-2026-09-28.json). It includes source hashes and native usage, not full source sessions or private credentials. The reader package and labels remain separate local files.

## Next intervention

Evaluate **actual adaptive pagination** with observed tool/source delivery traces against the same direct source condition. Check whether the late Chicago evidence is delivered before stopping; do not insert the gold source path into the predicted prompt. Use independent development cases and review answer completeness, contradictions and abstention. Once evidence is actually delivered, compare direct reader versus brief workflow at full workflow cost. Freeze final holdout only after this protocol works. No retrieval or curator default was changed by this pilot.

## Verification

`node --test test/reader-pilot.test.mjs` passed 3/3: advisory warnings do not erase valid answers, prohibited tools stop further stages, and injected label fields are rejected before calling the host. `npm run check` passed 277/277 tests plus configured deterministic gates. These are harness regression checks, not semantic correctness scores. Generated Python bytecode was removed; experiment traces and failures were preserved.
