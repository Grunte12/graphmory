# Active optimization goal and acceptance rules

The user authorized a persistent goal on 2026-09-28. Optimize correctness first, then agent usability and whole-workflow latency/cost. “All other tools” is an aspiration; the measurable claim covers only named, pinned configurations actually reproduced. Unavailable/proprietary tools remain not tested. Never merge literature scores into reproduced results.

## Predeclared gates

These are project acceptance choices, **not thresholds recommended by a paper**. Freeze cases, scorers and configurations before the final comparison; development evidence is for choosing interventions only.

1. **Validity:** all expected trials accounted for; no missing/duplicate trial silently scored as a pass; zero detected gold leakage, source mutation, forbidden tool calls or unsupported destructive writes. Infrastructure errors count in operational success and are reported separately.
2. **Mechanical delivery:** every gold evidence group reachable in the ranked pool remains reachable after actual CLI pagination; no skipped/duplicated paths or non-progressing continuation; immutable original-source hashes match. Failure on any eligible controlled case blocks promotion. This does not prove an autonomous curator reads all pages.
3. **Primary quality:** supported-complete answer success, with official answer scores alongside it, on LoCoMo and LongMemEval and a separate product-risk suite (negation, scope, conflict, missing evidence, update, late evidence). Target at least 95% supported-complete success on the controlled product-risk suite, plus paired noninferiority against each tested comparator with a predeclared 2 percentage-point margin and a 95% interval. Strict semantic labels require blinded independent review; uncalibrated automatic judgments do not satisfy this gate.
4. **Superiority claim:** “better quality” requires a positive lower bound on a paired 95% difference interval for the predeclared primary metric against that named configuration. Noninferiority alone means at least as good within the margin, not superiority. Bootstrap grouping respects conversation/history families; few clusters cannot support broad claims. Choose final sample sizes from pilot variance and independent group availability before opening final outcomes.
5. **Efficiency:** after quality gates, target at least 20% lower median end-to-end latency OR known cost per supported-complete success, with uncertainty and no more than 10% p95 latency regression. Tiny samples cannot establish tail latency; unknown subscription allocation/billing cannot satisfy a monetary savings claim. Count curator plus lead, ingest where relevant, retries and failures; cache states separate.
6. **Usability:** installation and the documented memory workflow pass on each claimed host/version without mandatory model API keys, extra servers or new user-facing dependencies for the default subscription-curator mode. A mock setup is not an authenticated workflow test.

Keep critical invariants separate from averages. Passing easy cases cannot compensate a forbidden write or leakage. The goal remains active until all gates for the advertised scope are met, or an explicit user decision changes the scope.

## Comparator tracks

- Graphmory's previous frozen configuration: regression baseline, not an independent competitor.
- Ordinary file search/read: simple matched-host baseline.
- Basic Memory: previously reproduced `0.23.2` text-search lane; test supported hybrid separately before making a claim about the product's hybrid capability. Its native ingestion and configuration are part of the recorded treatment.
- Mem0 OSS / Graphiti OSS: candidates, not installed/tested in this phase. Hosted Mem0/Zep results cannot be inherited by OSS configurations. Add one only with documented compatible backend, budget and a fair shared input protocol.

Exact current benchmarks, metrics and controls: [full-layer plan](full-layer-evaluation-plan-2026-09-28.md). Existing one-question [reader diagnostic](reader-attribution-pilot-2026-09-28.md) is not an acceptance result. Next: actual paginated CLI delivery on exposed development data, then a traced reader/curator intervention if the delivery evidence justifies one.

## Progress ledger

Goal is active. Initial CLI pagination: 18/18 controlled runs preserved candidate reachability. Bundle comparison: 24/24; late evidence available in one bundle but not all gold spans present in previews. Omitted-section correction: 24/24 delivered-path/hash/completeness parity, with accurate partial-source flags and 18/18 focused regression tests. These close mechanical diagnostics only; semantic quality, competitor noninferiority, efficiency and host acceptance gates remain unmet. Separate reports preserve each experiment.

Latest full repository verification: `npm run check` passed 278/278 tests and configured deterministic gates. Raw reports are in `eval/reader-pilot/cli-pages-*.json`; experiment notes: [pagination](cli-pagination-experiment-2026-09-28.md), [bundle](cli-bundle-experiment-2026-09-28.md), [partial-preview repair](omitted-section-repair-2026-09-28.md). These gates remain open: independent semantic grading, official answer scores, competitor comparisons, authenticated host matrix and end-to-end efficiency.

## Continuation experiment, 2026-09-28

[Three preserved attempts](curator-continuation-experiment-2026-09-28.md) now distinguish model-driven bundle success, numeric-offset pagination failure, and boolean-continuation pagination success. On the selected exposed LoCoMo question, both completed flows read original Markdown and the paged flow reached the rank-26 Chicago note, but host input and elapsed time were much higher for paged flow (160,548 input tokens / 54.4 s versus 61,815 / 27.7 s) with protocol and prompt differences. The pinned category-1 raw QA function scored 0.6349 versus 0.3016 on this single question. Temporal support remains ambiguous, so **primary supported-complete, competitor and efficiency gates remain open**. The new tests verify source mediation, unseen-path rejection and exhausted-page feedback; they do not validate semantic answer quality.

Post-experiment check: 281/281 repository tests and configured gates pass; npm package dry-run still contains 95 files and no development eval scripts/artifacts. Goal is active because final supported-complete, held-out, matched competitor and cost/latency acceptance evidence is missing.

## Cross-dataset delivery check

[LongMemEval CLI experiment](longmemeval-cli-delivery-2026-09-28.md): 14 exposed development questions × 4 treatments; 56/56 complete. All 12 answerable cases had source-session gold groups on the first page in all treatments. In mixed-notes mode, bundle used about 48% more median first-page response bytes than auto without a first-page completeness gain. This contradicts any universal conclusion from the one-case LoCoMo bundle benefit, so defaults remain unchanged. Two mechanical runs preserved 56/56 field parity after adding per-page byte instrumentation. The matched-ID Basic Memory text-search pilot remains the only reproduced named competitor slice; these new variable-size pages are not a comparable @12 score. Goal remains active pending reader accuracy, support labels, matched competitors, latency/cache/cost and host usability gates.

Post-experiment repository check: 281/281 tests and configured gates pass; npm pack dry-run still contains 95 files, excluding development eval files. The Obsidian vault sync status command could not run without a Graphmory sync config at `/Users/grunte/Obsidian`.

Follow-up [source-read diagnostic](longmemeval-cli-delivery-2026-09-28.md): all 20/20 first-page gold-session paths in the 12 answerable development cases carried `sourceReadRequired`; their previews total 18,004 bytes versus 285,237 bytes for their original Markdown. Thus 12/12 path reachability does not establish readable complete evidence, supported answers, or cost. The diagnostic rerun matched 56/56 prior rows after ignoring its newly added fields.

The first [LongMemEval live Curator/Lead diagnostic](longmemeval-live-reader-2026-09-28.md) completed one exposed development question with one source read and a source-supported answer matching the two reference names. It used three fresh Luna host calls, 62,423 reported input tokens, zero cached input tokens and 24.398 s. A one-case success is not a quality rate; the host pattern is not a persistent sub-agent cost comparison. Primary quality, matched comparator and efficiency gates remain open.

Post-diagnostic check: 281/281 tests and configured gates pass; npm pack still contains 95 files and no new development artifacts. The Obsidian vault status check remains unavailable without a Graphmory sync config at `/Users/grunte/Obsidian`.

The [Curator session/cache A/B diagnostic](curator-session-cache-ab-2026-09-28.md) found an actual resumed Luna Curator cache hit (23,296 cached input tokens), but whole-workflow noncached input rose from 62,423 to 72,442 tokens versus the earlier fresh/full run on the same exposed question. Both answers matched the named entities and cited the same original. Persistence and prompt compaction were changed together, so this does not establish a causal effect or an efficiency winner. No production default changes.

[Session failure accounting repair](session-failure-accounting-2026-09-28.md): changed/missing resume identity now records the failed call and available usage before stopping. Controlled wrong-session regression and full checks pass (283/283). This closes an evaluator reporting gap, not the goal's semantic quality or efficiency acceptance gates.
