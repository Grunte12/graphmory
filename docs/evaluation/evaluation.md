# Evaluation

For the current audit, external dataset choices, and proposed controlled experiments, see [Evaluation strategy — 2026-09-26](evaluation-strategy-2026-09-26.md). Existing synthetic results below are development/regression evidence, not proof of end-to-end agent effectiveness.

The repository should earn its claims with repeatable comparison rather than architecture diagrams alone.

## Retrieval Baseline

Run:

```sh
npm run eval:retrieval
npm run eval:report
```

The included synthetic fixture contains eight canonical notes and fifteen queries across exact, semantic, conflict, distractor, multi-hop, and hard-semantic categories.

Initial result at `k=3`:

| Method | Hit@3 | Recall@3 | MRR | nDCG@3 | Avg context chars |
|---|---:|---:|---:|---:|---:|
| Lexical overlap | 80.0% | 71.1% | 0.817 | 0.708 | 1144 |
| BM25 | 86.7% | 77.8% | 0.786 | 0.739 | 1139 |
| BM25 sections | 86.7% | 77.8% | 0.811 | 0.746 | 997 |

Interpretation:

- BM25 improved Hit@3, Recall@3, nDCG, and context size, but slightly lowered MRR.
- Section retrieval kept BM25 recall while reducing retrieved context further.
- Hard-semantic and multi-hop queries still expose recall gaps.
- The result justifies BM25 as a measured baseline, not as a required runtime dependency.

Decision: keep BM25 as an evaluation baseline. Do not make it the production default until a larger real-vault dataset shows a meaningful gain.

> **Update (2026-08-01):** the numbers above are the *original* v0.4-era baseline table and are kept as-is for historical comparison — do not edit them in place. A fresh reproduction of the same synthetic fixture on 2026-08-01, after the field-weighted BM25F section retrieval work described below had already shipped, measured higher numbers on the same eight-note/fifteen-query fixture:
>
> | Method | Hit@3 | Recall@3 | MRR | nDCG@3 | Avg context chars |
> |---|---:|---:|---:|---:|---:|
> | BM25 | 93.3% | 84.4% | 0.839 | 0.806 | 1147 |
> | BM25 (section-scoped) | 93.3% | 84.4% | 0.828 | 0.797 | 676 |
> | **BM25F (field-weighted, sections)** | **93.3%** | **84.4%** | **0.861** | **0.807** | **674** |
>
> This is not a re-measurement error or fixture drift — it reflects real code improvement between when the original table was written and 2026-08-01 (frontmatter-as-metadata indexing, heading hierarchy, field-weighted BM25F, conservative plural normalization, bounded wikilink boosting — see "Section and Field-Weighted Retrieval (v0.5)" below). Reproduce with the same two commands above on the current `main`; the live-model pilot numbers this reproduction accompanied live in `docs/evaluation/live-model-results.md`.

### Stress Baseline

Run `npm run eval:retrieval:stress` to evaluate a larger generated vault containing canonical notes, stale guidance, raw captures, and unrelated distractors. Unlike the original scale benchmark, this diagnostic measures retrieval quality and contamination as well as speed:

- misses at the selected `k`,
- stale/raw notes retrieved above or beside canonical memory,
- current-memory accuracy, which requires a correct canonical hit with no stale/raw/superseded item in the returned set,
- estimated context tokens,
- average query latency,
- category-level exact, alias, paraphrase, conflict, and multi-hop performance.

This command intentionally exposes failures and has no adoption threshold yet. Its first role is to establish a reproducible v0.5 baseline before agentic query expansion or another retrieval technique is added.

The first 250-note development run exposed lifecycle pollution. After governed filtering and bounded one-hop wikilink expansion, the v0.5 deterministic gate runs 50 query variants across seven corpus/seed combinations (350 query executions total):

| Corpus | Runs | Minimum Recall@3 | Minimum MRR | Pollution | Max estimated context |
|---|---:|---:|---:|---:|---:|
| 250 notes | 3 seeds | 99% | 0.990 | 0 | 128 tokens |
| 1,000 notes | 3 seeds | 99% | 0.990 | 0 | 128 tokens |
| 5,000 notes | 1 seed | 99% | 0.990 | 0 | 128 tokens |

Run `npm run eval:v05-gate` to reproduce the acceptance check. The gate requires at least 50 query executions per run, Recall@3, current-memory accuracy, and MRR of at least 0.90, zero stale/raw pollution, at most 300 estimated context tokens, and bounded local latency.

This is a deterministic regression and scale gate, not sufficient evidence of real-world effectiveness. Query variants share ten underlying intents, latency is machine-dependent, and synthetic aliases/links are cleaner than many real vaults. It supports governed filtering as the default local recall path but does not establish superiority on private vaults or justify embeddings.

The v0.5 candidate adds Obsidian-aware section chunking and field-weighted BM25F: frontmatter is indexed as metadata, headings carry their hierarchy, section bodies avoid re-ingesting frontmatter, and structured fields receive more weight than long body prose. Conservative plural normalization and bounded wikilink boosting further reduce brittle lexical misses without admitting raw/stale memory. Section, frequency, eligible-document, BM25/BM25F corpus, wikilink reference-index, and scoped-vault caches avoid repeatedly rebuilding pure derived state during eval or multi-lane recall. On the deterministic gate this reduced estimated context from roughly 199 tokens to roughly 128 tokens while raising Recall@3 to 99% with zero stale/raw pollution. In local v0.5 development, the full deterministic gate dropped from roughly 74 seconds to under roughly 10 seconds on the same machine after cache/index work; latency remains machine-dependent and should be treated as regression evidence, not a universal benchmark.

On a frozen private 30-question scoped vault eval, governed BM25F section retrieval reached Recall@3 83.3% and MRR 0.726. `recall-loop` is intentionally evaluated as a diagnostic sparse-fusion fallback; it compares field-weighted, focused-query, and ordinary section BM25 lanes in one bounded command. In the current private eval it improved Recall@3 to 86.7% but lowered MRR to 0.706, so it is not the default path. Keep it for low-confidence cases and failure analysis.

The remaining private misses are mostly vocabulary and semantic-distance failures, not lifecycle pollution. A local optional Transformers.js semantic-hybrid experiment using `Xenova/bge-small-en-v1.5` improved the same frozen private eval to Recall@3 96.7% and MRR 0.903 with one remaining miss. This justifies an opt-in semantic escalation lane, but not a core dependency: first-run model download, local index cost, and embedding privacy/caching choices must remain explicit user decisions.

Optional semantic eval:

```sh
npm install @huggingface/transformers
node scripts/eval-semantic-retrieval.mjs --vault <vault> --queries <frozen-queries.json> --scope <scope> --json tmp/semantic-report.json
```

### Section-Focus Rerank

`npm run eval:rerank` applies the deterministic `sectionFocusRerank` on top of BM25F section retrieval using the synthetic fixture. The rerank is a lightweight structural pass that boosts documents where:

- **Section focus:** unique query tokens concentrate in the single best-matching section,
- **Heading affinity:** query tokens appear in section headings,
- **Co-occurrence:** multiple query tokens appear together in the same section.

No LLMs, no paid APIs, no external calls. Each result reports `rerankApplied` and `rerankSignals` for transparency. Use `--rerank` with `recall` or `recall-loop`, or `recall-rerank` as a standalone command.

The rerank is a v0.6 candidate. It is evaluated separately from the v0.5 retrieval gate because it changes result ordering rather than candidate set composition. `npm run eval:rerank -- --json tmp/rerank-report.json` produces a side-by-side baseline-vs-reranked comparison.

### Live-Agent Scoring

`npm run eval:live-agent-score` scores a completed agent run against the incident dataset. It requires a run directory with `curator-output.json` and optionally `patches/`, `tool-calls.json`, and `metadata.json`. Use the expanded `eval/live-agent/run-template.md` worksheet for structured recording.

The scorer computes a weighted rubric over: action correctness (30%), provenance accuracy (20%), scope boundedness (15%), lifecycle completeness (15%), fabrication avoidance (10%), and leakage prevention (10%). It classifies false-memory, conflict-handling, and lifecycle-omission failures independently.

```sh
node scripts/eval-live-agent-score.mjs \
  --run-dir ./tmp/live-agent-runs/<run-id> \
  --incidents eval/live-agent/incidents.json \
  --json
```

The scoring wrapper is deterministic and uses only the incident expected-answer data. Live model benchmark results and filled TBD tables belong in `docs/evaluation/live-model-results.md` only after real runs exist.

## v0.5 Release Evidence Gate

`0.5.0` remains a release candidate until all applicable layers are reported separately:

1. **Deterministic regression:** `npm run check`, `npm run eval:v05-gate`, and `npm run release:gate` pass with no critical safety regression. **Implemented** — `scripts/release-gate.mjs`, `scripts/eval-v05-gate.mjs`.
2. **Human-labeled retrieval:** at least 30 private or anonymized real-vault questions, frozen before tuning, with Recall@3 >= 0.90, MRR >= 0.80, zero stale/raw pollution, and bounded context. **Infrastructure ready** — see `docs/evaluation/cost-and-scale.md` for private-vault results; public incident set at `eval/live-agent/incidents.json`.
3. **Lifecycle correctness:** `npm run eval:lifecycle` passes. Stale/expired/superseded/current cases must be audited separately from recall; `lifecycle-audit` should identify revalidation, replacement, and tension-decision needs without mutating notes. **Implemented** — `scripts/eval-lifecycle-audit.mjs`, `brain-sync.mjs lifecycle-audit`.
4. **Conflict decision quality:** `npm run eval:conflict` passes. Same-note divergence, non-overlapping agent histories, and dirty local drafts should produce distinct read-only decision options without mutating Git state. **Implemented** — `scripts/eval-conflict-assist.mjs`, `brain-sync.mjs conflict-assist` (with `decisionOptions`), `conflict-plan`, `conflict-apply`.
5. **Live memory behavior:** at least 20 incidents drawn from real failures, with three isolated trials per tested setup. Record false-memory, secret handling, conflict handling, future-task utility, token use, latency, and human correction time. **Infrastructure ready** — `eval/live-agent/incidents.json` (20+ scenarios), `eval/live-agent/run-template.md`, `scripts/eval-live-agent-score.mjs`. **Blocked on live-model runs** — no real model comparisons published yet.
6. **Mixed graders:** deterministic contract graders for objective properties, model graders only for semantic rubrics, and human spot review to calibrate subjective judgments. **Infrastructure ready** — `scripts/eval-curator.mjs`, `scripts/eval-patch-quality.mjs`, `scripts/eval-agent-run.mjs`.
7. **Failure publication:** report misses and confidence limits; do not publish only averages or silently promote a capability suite into a regression claim. **Infrastructure ready** — `scripts/eval-report.mjs`, generated reports in `tmp/eval-report.md`; `npm run release:gate` includes npm pack dry-run.

These gates follow the evaluation distinction between reproducible code graders and non-deterministic agent trials. They also keep the synthetic capability set separate from real-world release evidence.

**Remaining blocker for v0.5 release:** item 5 (live memory behavior) requires real model runs that have not been completed. All evaluation infrastructure and scoring tooling is in place.

Evaluation design references:

- OpenAI, [How evals drive the next chapter in AI for businesses](https://openai.com/index/evals-drive-next-chapter-of-ai/): define a golden set, inspect 50-100 early outputs, test under realistic conditions, and keep domain experts involved.
- Anthropic, [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents): start with 20-50 real tasks, use multiple isolated trials, separate capability from regression suites, and combine code, model, and human graders.
- Anthropic, [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents): optimize for the smallest high-signal context and design tools that return bounded, unambiguous outputs.
- Hu, Wang, and McAuley, [MemoryAgentBench](https://arxiv.org/abs/2507.05257): evaluate memory agents across accurate retrieval, test-time learning, long-range understanding, and selective forgetting.
- Wu et al., [LongMemEval](https://arxiv.org/html/2410.10813v2): separate memory design into indexing, retrieval, and reading; measure information extraction, multi-session reasoning, temporal reasoning, knowledge updates, and abstention.
- Robertson and Zaragoza, [The Probabilistic Relevance Framework: BM25 and Beyond](https://ir.webis.de/anthology/2009.ftir_journal-ir0anthology0volumeA3A4.0/): use BM25F-style weighted fields when document structure and metadata carry different relevance signals.
- Chhikara et al., [Mem0](https://arxiv.org/abs/2504.19413): compare memory systems against RAG/full-context baselines and report accuracy, latency, and token-cost trade-offs.
- Rasmussen et al., [Zep / Graphiti](https://arxiv.org/html/2501.13956v1): model dynamic memory with temporal validity, provenance, and relationship history.
- Uddin et al., [Memora / FAMA](https://arxiv.org/html/2604.20006v1): penalize reliance on obsolete or invalidated memories rather than rewarding recall alone.

This fixture is deliberately small and synthetic. It validates the benchmark code and exposes failure categories; it does not prove production retrieval quality.

`npm run eval:report` runs the deterministic eval suite and writes a generated Markdown summary to `tmp/eval-report.md`.

`npm run release:gate` runs `npm run check`, `npm run eval:report`, and `npm pack --dry-run --json`, then verifies that the package surface excludes private runtime artifacts and contains the runtime files needed by installed agents. It does not push or publish anything.

A separate private real-vault evaluation is summarized in `cost-and-scale.md`. Its note contents and labeled queries are intentionally not committed.

### Private Real-Vault Query Rules

Real-vault retrieval should be scored in at least two modes:

1. **Global recall:** no scope filter. This measures worst-case vault noise and is expected to be harder.
2. **Scoped recall:** each query includes the known project or domain path, such as `02 Projects/example` or `03 Reference/Agent Engineering`. This better matches agentic use, where the lead agent usually knows the active project/domain before asking memory.

Query labels may use either:

- `relevant`: a flat list of exact gold note paths.
- `relevant_groups`: a list of acceptable evidence groups. Any path in a group satisfies that group.

Use grouped relevance only after human review. Do not add retrieved paths as "acceptable" merely because the current algorithm returned them. Grouped relevance is for genuine alternate canonical notes, MOCs, or policy summaries that answer the same memory need.

If scoped recall is still below threshold, treat the miss as a curation signal before adding heavier retrieval infrastructure:

- add or repair aliases/frontmatter on canonical notes,
- link MOCs to the specific notes they summarize,
- split overloaded notes,
- mark raw/stale/superseded captures clearly,
- then rerun the frozen query set.

Use `brain-sync.mjs curation-recommend` on private eval reports to turn misses into bounded memory-structure tasks:

```sh
node scripts/brain-sync.mjs curation-recommend --report tmp/private-vault-report.json --queries tmp/private-vault-gold.json --method governed-bm25f-sections --json
```

The command classifies miss patterns such as buried gold, missing scope, no candidates, and vocabulary/gold ambiguity. It suggests aliases/frontmatter, MOC links, scope fixes, and grouped-gold review candidates. It does not edit memory or promote retrieved paths automatically.

JSON output is a `curation-plan` derived contract. Each `patchCandidates` item records the target, proposed metadata/link change, originating miss evidence, `requiresHumanReview: true`, and `autoApplicable: false`. Agents may use this plan to prepare a bounded review, but must not treat it as canonical memory or apply it without validating the note and intent.

## Obsidian Memory Curator Eval

Retrieval quality is necessary but not enough. The core claim of this harness is that a memory curator should retrieve and maintain an Obsidian/Markdown memory without inventing meaning. That requires a separate behavior eval.

Run:

```sh
npm run eval:curator
```

The default fixture uses `eval/curator/scenarios.json` and scores `eval/curator/candidate.memory-patch.json`.

Current reference result:

| Category | Purpose | Result |
|---|---|---:|
| recall-routing | Recall the right UI ownership notes without backend noise | 1/1 |
| recall-multihop | Return a compact split of UI and backend memories | 1/1 |
| recall-safety | Retrieve secret-handling policy without extra context | 1/1 |
| write-apply | Apply a verified lesson with retained provenance | 1/1 |
| write-block | Block a patch that lacks evidence | 1/1 |
| write-conflict | Return `TENSION` instead of overwriting contradictory memory | 1/1 |
| write-noise | Reject routine summaries as non-durable memory | 1/1 |
| write-derived | Preserve the boundary between generated indexes and canonical Markdown | 1/1 |

The evaluator checks:

- Brain Brief schema validity, 1-7 memory items, and at most three direct-read paths.
- Required and forbidden note paths.
- `APPLIED`, `TENSION`, or `BLOCKED` status accuracy.
- `changed_paths` discipline when writes are forbidden.
- retained provenance for applied patches.
- conflict paths for `TENSION`.
- required and forbidden claim/reason terms.
- generated index output staying derived rather than becoming canonical memory.

## Patch Quality Eval

Run:

```sh
npm run eval:patch-quality
```

This scores candidate Memory Patches beyond basic schema validity. The current rubric checks:

- valid contract shape,
- bounded non-vague claim,
- clear why-it-matters,
- applies/excludes scope,
- evidence provenance,
- lifecycle status,
- revalidation triggers,
- no diary/noise language,
- no raw secret terms.

Current fixture result:

| Candidate | Score | Expected |
|---|---:|---:|
| Strong Memory Patch | 100 | 95-100 |
| Missing Lifecycle | 55 | 0-79 |
| Vague Summary | 65 | 0-69 |

The intent is not to replace human judgment. It gives the lead agent and curator a cheap guardrail before durable memory is written.

## Learning Loop And Future-Task Eval

Run:

```sh
npm run eval:learning-loop
npm run eval:future-task
```

The learning-loop eval compares a compact v0.2-style Memory Patch candidate with a v0.3 Learning Packet candidate. It scores verification, evidence, future behavior change, loop trace, lifecycle, noise rejection, and structured selectors.

It also reports cost proxies:

- payload bytes,
- payload characters,
- estimated tokens,
- evidence item count,
- selector item count,
- score delta per estimated token delta,
- candidate-specific maximum estimated-token ceilings.

The future-task eval tests downstream usefulness. It asks whether a candidate memory style changes later decisions for visual completion gates, stale policy checks, routine/noise rejection, and contradiction handling.

Current proxy result:

| Candidate | Passed | Score |
|---|---:|---:|
| Direct writer baseline | 0/4 | 0 |
| Learning packet guided | 4/4 | 100 |

This is still a deterministic proxy. It does not prove live-model performance, but it catches whether the harness structure carries behavior-changing memory into later task decisions.

To test a real agent, save its outputs in the same shape as `eval/curator/candidate.memory-patch.json` and run:

```sh
node scripts/eval-curator.mjs --candidate path/to/agent-output.json
```

To score a combined live run with both curator behavior and patch-quality outputs:

```sh
node scripts/eval-agent-run.mjs \
  --curator-output path/to/curator-output.json \
  --patches path/to/patch-candidates
```

See [Live Model Evaluation](live-model-eval.md) for the anonymized incident set and recommended reporting format.
Publish completed real-model comparisons in [Live Model Results](live-model-results.md), not in this proxy-eval section.

This is a deterministic contract eval. It does not prove model quality by itself; it proves whether an output obeys the memory harness rules for a fixed scenario set. Model comparison should run this same evaluator across fresh sessions, equal budgets, and blinded scenarios.

### Proxy Effectiveness Comparison

Run:

```sh
npm run eval:curator:compare
```

This compares three hand-authored proxy candidates:

- **A - Direct Writer**: the lead agent writes or recalls memory directly.
- **B - Curator Inference**: a second agent infers what to remember from a task summary.
- **C - Memory Patch**: the lead agent authors a structured patch; the curator applies it.

Current proxy result:

| Candidate | Passed | Pass rate |
|---|---:|---:|
| A - Direct Writer | 1/8 | 12.5% |
| B - Curator Inference | 6/8 | 75.0% |
| C - Memory Patch | 8/8 | 100.0% |

Interpretation:

- The direct writer proxy fails because it over-retrieves, writes without provenance, overwrites conflicts, saves routine summaries, and promotes derived graph output.
- The curator inference proxy is better at recall and blocking obvious missing evidence, but still loses detail on provenance and derived-artifact boundaries.
- The Memory Patch proxy passes because semantic authorship, provenance, status, and boundaries are explicit before the curator writes.

This is not yet a live-model benchmark. It is a falsifiable scenario harness. To compare actual models or prompts, generate candidate output files from fresh agent runs and score them with the same script.

## Retrieval Upgrade Gates

Add a technique only when its matching failure is measured:

| Observed failure | Candidate | Required evidence before adoption |
|---|---|---|
| Exact identifiers or error strings are missed | BM25/full-text | Better Recall@k than filesystem/lexical baseline |
| Synonyms and paraphrases miss relevant notes | Embeddings | Better semantic Recall@k without unacceptable false positives |
| Either exact or semantic retrieval alone is incomplete | Hybrid sparse+dense | Better aggregate recall and category balance |
| Relevant notes appear but rank too low | Reranker | Better MRR/nDCG at a bounded context size |
| Multi-hop questions need several retrieval rounds | Agentic retrieval loop | Better task accuracy under explicit step/token/latency budgets |
| Relationship questions span code and memory | Graph-assisted retrieval | Better multi-hop recall while Markdown remains canonical |

Before adding a hosted embedding or reranking service, record privacy, cost, cache, and offline behavior.

## Baselines

Test the same scenarios using:

- **A - Direct writer**: lead agent reads and writes memory directly.
- **B - Curator inference**: lead agent sends a task summary; curator decides what to remember.
- **C - Memory Patch**: lead agent authors the structured patch; curator applies it.

## Dataset

Start with 20-30 completed coding-agent incidents containing:

- a verified decision or root cause,
- concrete provenance,
- a later task where that memory should affect behavior,
- several cases with stale or contradictory knowledge,
- several cases that should not be saved.

Remove secrets and project identities. Freeze expected answers before running agents.

## Metrics

### Memory quality

- Claim precision: stored claims supported by evidence.
- Recall coverage: relevant expected facts returned.
- False-memory rate: unsupported claims presented as fact.
- Contradiction handling: conflicts surfaced rather than silently overwritten.
- Duplicate rate: semantically redundant canonical notes.

### Task utility

- Correct future routing or implementation decision.
- Number of extra vault reads.
- Token use for write and recall.
- End-to-end latency.
- Human correction time.

## Procedure

1. Randomize scenario order.
2. Run each baseline in a fresh agent session.
3. Keep model, tools, and token budget constant.
4. Do not reveal the expected answer to the tested agent.
5. Score contracts with deterministic checks first.
6. Use blinded human review for semantic correctness.
7. Publish failures and confidence intervals, not only averages.

## Initial Success Gate

Adopt C as the default only if it:

- lowers false-memory rate versus B,
- preserves or improves future-task accuracy versus A,
- detects contradictions more reliably,
- and does not add unacceptable token or latency overhead.

Until this experiment is run, describe the project as evidence-informed, not proven superior.
