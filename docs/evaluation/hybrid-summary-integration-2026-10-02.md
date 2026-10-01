# Hybrid retrieval, reusable summaries and deterministic lifecycle — 2026-10-02

## Status

Implemented in the working tree as **0.5.0-rc.6**. Code checks, local real-embedding integration and one actual installed named Luna update → receipt → fresh-session hybrid recall are tested. **Not certified as a complete native-host MVP**: the broader native acceptance matrix and other hosts remain separate. Luna implementation workers hit the account usage limit; the primary agent completed lifecycle/retrieval/CLI integration. One Luna worker completed the pure summary module and focused tests. No Hindsight install, user-vault write, commit or push occurred.

Latest pre-push checks and expanded native summary workflow: [rc.6 push evaluation](push-eval-2026-10-02.md). Historical experiment scores and archive identities below remain preserved.

## Delivered

| Layer | Change | Boundary |
|---|---|---|
| Write/lifecycle | Checkpoint finish validates successor and all transition plans, then generates approved predecessor status and canonical replacement paths before full verification | Only declared existing targets; conflicts block; preimages/pending state remain; cooperative multi-file writes are not atomic filesystem isolation |
| Retrieval | New Curator setup combines sparse, local BGE and authored graph lanes through existing RRF/paging | Legacy configurations explicitly retain lexical mode; advanced decision modes retain previous behavior; similarity/graph/scan limits do not prove completeness |
| Semantic index | Markdown-section embedding windows pool scores back to original note paths; tail edits invalidate vectors | Local fp32 BGE; first-run download/initialization; character windows still face tokenizer limits; no vector server |
| Summary memory | Tool-generated source fingerprints, evidence links, direct/transitive freshness checks and cycle refusal | Curator supplies supported meaning; hashes do not prove entailment; summaries are derived Markdown, not another authoritative store |
| Governance | Summary commands and recall share pending authority checks; stale summaries are excluded from ordinary retrieval without rewriting files | Native host file tools are not sandboxed by this CLI; consistent state root remains necessary |
| Packaging/docs | rc.6 identity, current integration status in trial guide, setup includes embedding prerequisite; predecessor fields assigned to code in Curator instructions | Historical acceptance is retained as history; it does not certify this candidate |

## Verification and failures retained

- Baseline code tests: 421/421 passed before this round's integration changes.
- First integration test attempt failed because historical lexical tests and their runner inherited the new hybrid default. The next attempt retained 16 failures. Historical sparse fixtures now explicitly request lexical mode; independent hybrid tests exercise the actual new default. No new feature was hidden behind a test-only lexical downgrade.
- Final `npm run check` passed: **443/443 tests**, zero fail/skipped, plus example validators and existing deterministic eval gates. Historical lexical tests explicitly select compatibility mode; new hybrid tests exercise the new default. These gates are not independent answer-quality benchmarks.
- Focused suite includes generated lifecycle metadata, invalid-successor no-write, receipt/replay and a fresh **CLI process** reading successor/history; that is distinct from a fresh actual model session.
- Summary tests cover changed/missing/inactive sources, transitive stale summaries, cycles, unsafe paths, exact case-sensitive content and nonmutation. Integration tests cover dependencies outside query scope and blocked pending summary routes.
- Hybrid tests use an injected semantic lane/embedding function to isolate fusion, scope/lifecycle filtering, graph trails, pagination, long-note cache invalidation and outside-vault cache safety. These are explicitly mocks, not evidence of model quality.
- Real BGE was separately run without model downloads on 19 synthetic notes and six questions. Final screen: lexical Recall@5 **0.4167**, MRR@10 **0.5000**; hybrid Recall@5 **1.0000**, MRR@10 **0.9167**. Both exclude superseded history. These small development-fixture results are not holdout scores or a Hindsight comparison.
- Removing question scaffolding improved MRR but initially reduced Recall@5 to 0.8333 by pushing the long-tail answer down. Markdown-section windows recovered it. Earlier results remain unchanged. Broad semantic candidates still need Curator judgment; output reduction/precision on independent vaults is unproven.

## Experiment records

1. [Initial three-lane fusion](hybrid-summary-experiment-01-2026-10-02.md)
2. [Question-token filtering and retained regression](hybrid-summary-experiment-02-2026-10-02.md)
3. [Heading-aware embedding windows](hybrid-summary-experiment-03-2026-10-02.md)
4. [Final real-model repeat with runtime/source identities](hybrid-summary-experiment-04-2026-10-02.md)
5. [Native evaluator binding repair](native-trace-bindings-repair-2026-10-02.md)
6. [Cache-before-model safety check and final real-model repeat](hybrid-summary-experiment-05-2026-10-02.md)
7. [Installed rc.6 CLI update/receipt/summary smoke](hybrid-summary-package-smoke-2026-10-02.md)
8. [Uppercase paths and installed-role alignment](hybrid-summary-experiment-06-2026-10-02.md)
9. [Actual installed Luna update and fresh-session hybrid recall](hybrid-summary-native-2026-10-02.md)
10. [Independent review fixes and final 443-test check](hybrid-summary-review-repair-2026-10-02.md)

Private evidence is outside the package: `outputs/graphmory-hybrid-summary-20261002/`. Raw model experiment fixtures/reports remain for reproduction. Temporary unit-test vaults are removed by tests. Existing model weights and earlier evidence are preserved. No private vault contents were sent to providers.

## Remaining acceptance work

1. Complete the remaining native acceptance cases with frozen instrumentation, including pending/refusal and native summary creation. The retained actual Luna update/recall success is a distinct new case; existing failed runs/scores remain preserved.
2. The quota reset allowed one installed rc.6 Luna update and a fresh-session recall. Both actual named children are independently identified in their traces/host metadata; source and target hashes, receipt and hybrid output pass. Later independent-review source fixes are tested separately from this frozen archive. Host guide-reading latency/token overhead is recorded and remains unoptimized.
3. Check the setup/model download flow on a genuinely clean installation and test an independent paraphrase/multi-hop/change/contradiction set. Character/tokenizer coverage and semantic candidate selectivity need further evidence; no arbitrary universal threshold or superiority claim is made.
4. Later compare Hindsight in an isolated environment, accounting for ingestion/retrieval/answer models and resource budgets. No comparative installation/eval has occurred yet.

Design reference: [user-approved direction](../design/shared-summary-hybrid-direction-2026-10-02.md), [Hindsight concepts](../research/hindsight-workflow-reference-2026-09-29.md). Established ranking reference: [RRF publication](https://research.google/pubs/reciprocal-rank-fusion-outperforms-condorcet-and-individual-rank-learning-methods/). The section/window and summary-freshness adaptations are Graphmory implementation choices, validated here only within the stated scope.
