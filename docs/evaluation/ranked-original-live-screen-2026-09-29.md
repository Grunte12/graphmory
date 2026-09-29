# Ranked-original native comparison: resumed development screen

## Frozen scope before model generation

Resume the six still-unattempted live workflows from [the three-arm runner preflight](ranked-three-arm-runner-preflight-2026-09-28.md). Cases and order remain `gpt4_d84a3211` graph/ranked/basic, then `67e0d0f2` basic/ranked/graph. Models remain Luna `gpt-6-luna` Curator and Sol `gpt-6-sol` Lead, low reasoning, three Curator rounds, 300,000 prompt bytes, fresh contexts, structured citations and the shared original-source index. Native Basic Memory remains 0.23.2 with its already prepared hybrid embedding index. All arms can read the same original Markdown. Do not use the newly optional Graphmory postings cache in this experiment.

The old frozen manifest is preserved. Its CLI and decision-module hashes predate the opt-in postings-cache commit, so a new manifest records the current code hashes before any live call. Reader inputs, source hashes, native index hashes, models, budgets, prompts and arm order are retained. No previous live treatment answer exists for this six-slot plan. The verifier must confirm all source/index identities before execution. Stop on the first infrastructure/protocol failure, retain the failed slot, and mark remaining slots unattempted; do not retry automatically or switch models to obtain a success.

Primary observations: complete workflow status; supported requested facts and arithmetic against the provisionally source-supported calculations ($25+$40+$120=$185; 8+12=20); citation identity and manual source support. Preserve original references separately. No independent calibrated support adjudication or official answer scorer has yet qualified a winner here. In particular, reading every gold group does not establish answer completeness or support.

Secondary measurements: whole-workflow wall time; all Curator/Lead calls; gross, cached and output tokens with noncached computed separately; actual search/read stdout bytes; original reads; native-index ingestion time separately from query workflow time. Cache conditions and one trial per arm prohibit causal cost/latency claims, p95 estimates or promotion. Do not tune budgets or replace failed questions after generation.

This is an exposed two-case mechanism screen. It may reveal an answer loss, provenance violation or resource failure. It cannot satisfy the goal's independent holdout, broader supported-complete noninferiority or cross-host efficiency gates. The stopped ambiguous LoCoMo collection batch remains stopped; this separate experiment does not repair its labels.

## Host failure and separate compatible-model preregistration

The original-model batch stopped on its first Graphmory slot, before any model answer: the authenticated CLI returned `unsupported-model` for `gpt-6-luna`. Usage was null, the first search completed, and all five remaining slots are unattempted. Preserve the original batch as failed. This repeats a host limitation previously documented in the reader-attribution pilot; the manifest should have been checked against the actual CLI model inventory before attempting generation.

Before any answers, start a **separate** six-slot compatible-host development experiment. The CLI's local model inventory lists `gpt-5.6-luna` and `gpt-5.6-sol`; use those explicitly for every Curator/Lead arm. This is a model-identity change, not a claim that the 5.6 and 6 models have the same quality. Preserve cases, sources, index, prompts, order, budgets and all-attempt accounting. Freeze a new manifest and link the stopped original-model attempt. Stop on any further host/protocol failure, without automatic retry or additional model switching. Report quality provisionally and maintain all independent support/holdout limits above.

The compatible-model batch also stopped in its first Graphmory slot: two successful Curator calls requested 20 then 28 new originals. The CLI delivered all 48 notes (500,514 source bytes), but the next prompt exceeded the unchanged 300,000-byte cap. No Lead call or final answer occurred. Measured gross input was 84,771 tokens with zero reported cached tokens; output was 963 including 255 reported reasoning tokens. Do not add the reasoning count again or convert subscription usage to dollars. The actual completed model prompts were 38,284 and 190,474 bytes; the rejected oversized prompt was not sent to the model. This is a mediated-harness resource failure, not proof Graphmory failed to find evidence or that a native host with different context management would fail.

## Separate all-arm feasibility screen, before remaining-arm answers

Stop-on-any-failure prevents observing other arms after a resource-limited control. Test a separate, explicitly declared **feasibility** screen with six new slots in the same fixed order, the same compatible models, originals, Basic index, three-round and 300,000-byte limits. No intervention, budget, question or answer schema changes. Previous stopped trials remain failures; no failed outcome is overwritten.

The batch runner may continue only after exact `input-byte-budget` or `round-budget` failures with successful model calls and no integrity/host/provenance failure. Revalidate the exact frozen manifest and all original/index identities before proceeding. Host errors, source drift, unsafe paths, invalid citations or timeouts still stop the batch. A batch containing any failed slot exits nonzero even if later arms finish. No slot is retried. This tests arm feasibility under the declared economic contract; it does not tune the treatment to obtain a passing answer.

Primary outcome is per-arm workflow completion/resource failure. For completed workflows, retain emitted answers, original-path citations and source-supported reference-consistency observations; qualified supported-complete grading remains unavailable. Secondary whole-workflow counters remain descriptive. A promising ranked transport result permits only a separately designed, source-disjoint and support-qualified next experiment. After this screen, do not run additional prompt, model or budget variants in response to its answers.

## Final feasibility results and disposition

All six planned slots were attempted once. One completed; five failed under the frozen resource contract; zero remain unattempted. The batch exited 1 as required. Five pre-next-slot integrity revalidations passed. All frozen code/dataset/input/original/native-index hashes were rechecked after execution; every emitted read hash/byte count matched its original. The raw manifest SHA256 is `03840377127cb40c0d581d79474c24952d0c91c1481bef0c40a15ccf0169e765`.

| Case | Arm | Outcome | Workflow seconds | Model calls | Originals / source bytes | Gross / cached input tokens |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| gpt4_d84a3211 | graph | round-budget | 42.063 | 3 | 48 / 500,514 | 125,655 / 0 |
| gpt4_d84a3211 | ranked | input-byte-budget | 28.996 | 2 | 47 / 493,665 | 139,936 / 0 |
| gpt4_d84a3211 | basic | round-budget | 46.549 | 3 | 28 / 279,950 | 153,388 / 35,584 |
| 67e0d0f2 | basic | complete | 44.796 | 4 | 2 / 34,558 | 137,548 / 23,040 |
| 67e0d0f2 | ranked | input-byte-budget | 29.058 | 2 | 27 / 254,161 | 124,462 / 14,080 |
| 67e0d0f2 | graph | round-budget | 40.630 | 3 | 52 / 506,072 | 120,864 / 28,160 |

The completed Basic Memory course answer was `20 online courses.` Its emitted citations were `sessions/0007-730ea6f80239.md` and `sessions/0038-e070111f44b2.md`; provenance validation was true. Manual reread confirmed the user statements about eight edX courses (line 165) and twelve Coursera courses (line 155). This is consistency with the provisional targeted author audit, not a calibrated supported-complete grade or official benchmark score.

**Reject promotion of ranked-original delivery:** it failed both questions with `input-byte-budget`. The Graphmory control failed both with `round-budget`; Basic completed one of two. Search/read transport delivered evidence, but the mediated Curator workflow accumulated original histories or kept requesting sources without finalizing within its three rounds. These results justify addressing evidence transport/collection before further rank or prompt tuning. They do not prove that the relevant evidence was never retrieved, nor that a native coding host with different context management has the same failure.

Failed workflow times are time-to-failure, not faster successful answers. One generation per arm, two exposed cases, different reported cache hits and unqualified support labels prohibit broader winner, tail latency, billing or quality claims. Basic ingestion remains separate from query workflow time. The production retrieval defaults and optional postings-cache status are unchanged.

The two preceding stopped batches are preserved separately: the original-model attempt failed before an answer with unknown usage; the first compatible-model attempt failed after two successful Curator calls and no final answer. Across these three separately declared six-slot batches, 18 slots were planned, eight attempted, one completed, seven failed and ten unattempted. There were 20 host calls, 19 successful model calls (two in the compatible stopped attempt and 17 in the final screen), and one unsupported-model call. This accounting is not 18 independent quality trials.

### Evidence and reproduction

- [Sanitized final all-slot records](../../eval/reader-pilot/ranked-native-feasibility-results-2026-09-29.json): generated answers/briefs, original-relative paths and hashes, resource/token counters; no original Markdown or raw host traces.
- [Prior stopped attempts](../../eval/reader-pilot/ranked-native-stopped-attempts-2026-09-29.json).
- [Public final manifest](../../eval/reader-pilot/ranked-native-feasibility-manifest-2026-09-29.json): local paths removed deliberately. To rerun, reconstruct the private manifest with the matching reader input/config/index paths and verify their pinned hashes; this public copy is an evidence record, not a directly executable manifest.

Execution used `python3 scripts/run-ranked-original-three-arm.py --manifest <private-frozen-manifest> --out <new-run-directory> --continue-resource-failures`; summary used `python3 scripts/summarize-ranked-native-screen.py --manifest <same-private-manifest> --runs <run-directory> --out <new-summary.json>`. Never reuse an output directory or overwrite a previous result. No further model, prompt or budget variant was run after observing these answers.

### Next gate

Design one source-bound collection intervention using the existing collection/ledger architecture: budget the **complete serialized prompt**, read originals in coverage-tracked batches, keep verifiable extracted facts rather than replaying all originals, then synthesize only when the requested source coverage is complete. An exact preflight must show whether complete coverage plus synthesis is feasible under the unchanged three-Curator-call/300,000-byte contract; if not, report infeasibility rather than drop sources or silently raise the ceiling. The failed lexical-window experiment already showed why keyword excerpts cannot replace originals.

Before another live experiment, test lossless Unicode byte packing, no missing/duplicate original ranges, exact source identity, ledger citation support, and fail-closed behavior for oversized notes or inconsistent facts. Freeze treatment/control, resource accounting, data splits and support-qualified labels before model generation; use source-disjoint cases for acceptance. A later design may explicitly propose a different economic contract, but cannot call that a win under this screen's unchanged budget.

## Verification and cleanup

`npm run check` completed with exit 0 after live model workflows had stopped. `git diff --check` passed. The required read-only private-vault status command returned `SYNC_CONFIG_NOT_FOUND`; no config was created and the private vault was not changed. [The final continuation ledger](../../eval/reader-pilot/ranked-native-feasibility-ledger-2026-09-29.json) preserves all planned/failed slots and five successful revalidations. Ephemeral reader workspaces and raw host JSONL/stdout/stderr from the three exact run directories were removed after sanitized records and report hashes were saved. Private report/manifest records and shared original corpora/native indexes remain available for audit; no private vault content or host session identifiers were published.
