# Graphmory evaluation strategy and audit — 2026-09-26

Status: research and proposed protocol. A small external session-retrieval pilot is now implemented: see [LongMemEval pilot](../../eval/longmemeval/README.md). Full external benchmarks and live-agent experiments below have not been run. No external skills or frameworks were installed. Current synthetic results remain development evidence.

## What to adopt

| Resource | Fit | Limitation / decision |
| --- | --- | --- |
| [AI Evals Course: evals-skills](https://github.com/ai-evals-course/evals-skills) | Best methodology fit: eval-audit, error-discovery, evaluate-rag, validate-evaluator | Guides work; supplies neither Graphmory ground truth nor validated judges. Use selectively as developer tooling, not a shipped runtime dependency. |
| [Anthropic skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator) | Compare the memory-curator skill enabled/disabled; review outputs and run variance | Skill effectiveness is only one layer; cannot replace memory lifecycle or evidence grading. |
| [Inspect](https://inspect.aisi.org.uk/) | Candidate for a later multi-model runner with logs, scoring and isolated agent environments | Adds Python/environment integration. Validate host adapters first; don't replace the existing Node checks now. |
| [Promptfoo](https://www.promptfoo.dev/docs/configuration/test-cases/) | Potential lightweight provider/prompt comparison with assertions | Provider comparisons do not automatically reproduce a coding-agent subscription host. Optional, not needed for the next experiment. |

These are fit judgments from primary documentation, not comparative performance results or community consensus. No dedicated eval-named skill was found by the local skill-file search. Available research guidance was used; remote eval-audit/evaluate-rag instructions informed the audit.

## Dataset selection

1. **First external dataset: [LongMemEval, cleaned](https://github.com/xiaowu0162/LongMemEval).** Covers extraction, multiple sessions, changing knowledge, time and abstention. Keep timestamps, original question IDs and official answers. Start with a preselected stratified pilot from the full-history small variant. The oracle variant contains answer sessions only: use it solely to isolate reader performance, never claim realistic retrieval from it. Conversation memory differs from coding memory. [Dataset card](https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned) lists MIT; pin the exact revision and retain attribution.
2. **Multi-hop diagnostic: [HotpotQA](https://hotpotqa.github.io/).** Supporting-fact annotations help check complete evidence. Its Wikipedia setting differs from project memory; distractor and full-wiki settings must be named separately. Do not turn gold supporting-fact labels into graph links visible to the system.
3. **Agent experience: [LongMemEval-V2](https://arxiv.org/abs/2605.12493), [official harness](https://github.com/xiaowu0162/LongMemEval-V2).** Workflow, state changes, recurring mistakes and faulty premises fit our intended memory role. It uses web/enterprise histories and a larger multimodal setup; schedule after a small text pilot. A text-only adaptation is a custom experiment, not an official benchmark reproduction. The paper is marked work in progress.
4. **Retrieval breadth: [BEIR](https://github.com/beir-cellar/beir).** Useful later to challenge sparse/hybrid ranking across domains. It does not measure curator writes, temporal memory or coding-task success. Preserve each selected dataset's own license and evaluation setting.

Public sets may occur in model training data. They add external coverage, not proof of zero contamination. Add consented, anonymized coding-workflow episodes for product validity; external QA datasets alone cannot establish that Graphmory improves coding work.

## Audit of current artifacts

- **High — outcome gap.** `scripts/eval-adaptive-graph.mjs` measures evidence paths; it does not execute the downstream task. `eval/graph-hard/results.json` has Hit@3=100% but complete@3=14/23. Seven unsupported cases return candidates; this does not measure answer hallucination or abstention.
- **High — proxy labels.** In `scripts/eval-live-agent-score.mjs`, `scoreScope` uses path count, not project membership; `scoreNoFabrication` uses claim length/confidence/evidence presence, not claim support. These are diagnostics, not semantic correctness grades. Weighted totals must not mask a wrong-project action or fabricated memory. Keep historical scores, label them heuristic, and use exact scope checks plus evidence-based review in future experiments.
- **High — development leakage risk.** Existing fixtures were inspected during optimization. The hard suite repeats four project templates; treat a family as one correlated unit. A larger number of files is not a larger number of independent tasks. Do not rename these sets held-out.
- **Medium — missing experimental controls.** The graph comparison uses fixed arm order and single local timings. Scope supplied in some questions is an oracle. Report routing success separately from retrieval given the correct scope.
- **Cannot determine — calibrated semantic judges.** Inspected artifacts do not establish a human-labeled judge validation set with measured false-positive/false-negative rates. Do not assume a model judge is reliable because its explanations sound plausible.

The audit follows [eval-audit](https://github.com/ai-evals-course/evals-skills/blob/main/skills/eval-audit/SKILL.md) and [evaluate-rag](https://github.com/ai-evals-course/evals-skills/blob/main/skills/evaluate-rag/SKILL.md). Findings above come from our files, not those sources' assessments of Graphmory.

## Proposed controlled experiment

Primary question: **Does memory improve successful coding-agent work, at acceptable cost, without adding false durable knowledge?** Keep three levels separate: deterministic integrity checks; retrieval/evidence coverage; live task outcome and write correctness. [Anthropic's agent-eval guidance](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) supports outcome/trace inspection, mixed graders and repeated trials.

- Collect and review an initial diverse set of actual task traces. Label observed failures: wrong project, missing bridge, missed paraphrase, stale assertion, unsupported answer, unsafe write, unnecessary recall. Include random successful cases. The initial pilot identifies errors; it is not a release-quality sample-size claim.
- Split by project/conversation/episode family before tuning. Separate development, judge calibration and held-out acceptance sets. Paraphrases and generated siblings stay together. Once acceptance cases guide a fix, retire them into regression and create a fresh acceptance slice.
- Main arms: same host/model without memory; current Graphmory; one candidate change. Add equal-budget plain file search as a useful comparator. Oracle evidence is a diagnostic arm only. Test graph routing and semantic expansion separately before combinations. Curator/Luna, hosted Jev and local decision modes are separate treatments, with exact model/provider/config recorded.
- Freeze inputs, source hashes, question-time snapshots and tool budgets. Give every trial a fresh isolated writable vault. Ingest history chronologically, including corrections; keep question/answer labels, expected evidence IDs and future events outside the agent filesystem. Do not manufacture relations from gold answers. Evaluate subsequent tasks after writes to detect memory pollution and forgetting.
- For live trials, alternate/randomize paired arm order and start with three repetitions per task as a variance pilot. Reset session memory between arms. Compare consistent successes, not best-of-three. Deterministic retrieval does not need repeated identical trials except for timing.
- Grade executable outcomes and exact paths with code. Use human-reviewed, evidence-based binary rubrics for semantic claims. Calibrate any LLM judge on separate pass/fail labels, report sensitivity/specificity with uncertainty, and blind arm identities. Disagreements and ambiguous golds require review; missing outputs/timeouts remain visible failures, never silently dropped.
- Report task success, complete evidence within the actual context budget, citation support, correct abstention/clarification, false writes and stale-memory use. Also report ingest cost, query cost, retries, p50/p95 time, peak RAM, cached/uncached input and billed cost per successful task. Subscription usage is not necessarily zero cost; unavailable billing remains unknown.
- Preserve a stable prompt/tool prefix. Measure cold and warm cache conditions separately. Do not confound provider response caching with actual model execution or compare providers at different budgets and call the difference an algorithm improvement.
- Estimate paired deltas with uncertainty clustered by episode/project. Choose meaningful improvement and tolerated-regression margins before acceptance runs; size the later sample from pilot variance. Zero observed unsafe writes is necessary but not proof of zero risk. If uncertainty cannot distinguish gain from noise, retain the existing default.

## Next implementation sequence

1. Produce a reviewed failure catalog and case contract from current traces; mark heuristic scorer outputs accordingly.
2. Build a lossless, revision-pinned LongMemEval importer with evaluator-only labels and chronological sessions. Validate gold/session integrity before any model spending.
3. Connect one existing host adapter to isolated no-memory/current-memory trials and record full tool traces plus provider usage. Review a small paired pilot before expanding.
4. Calibrate semantic graders, then freeze acceptance cases and run candidate changes one at a time.

Keep all evaluation infrastructure developer-only. Users installing Graphmory should not need these datasets, judges or Python frameworks.
