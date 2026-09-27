# Correctness-first external benchmark protocol

## Official sources and distinctions

- [LoCoMo official repository](https://github.com/snap-research/locomo) supplies
  ten conversations, dialog evidence labels and QA annotations. Pin commit
  `3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376`, not a floating branch.
- [Its answer evaluator](https://github.com/snap-research/locomo/blob/3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376/task_eval/evaluation.py)
  uses category-specific answer scoring, including stemmed token F1 and an
  adversarial phrase check. It also supports evidence recall. Evidence recall
  alone is not an answer score, and the phrase check does not establish that
  every assertion in a response is safe or supported.
- [LongMemEval official repository](https://github.com/xiaowu0162/LongMemEval)
  distinguishes retrieval from answer evaluation and excludes abstention
  instances from retrieval scoring. Its [QA evaluator](https://github.com/xiaowu0162/LongMemEval/blob/main/src/evaluation/evaluate_qa.py)
  uses a model judge with task-specific prompts (code inspected at commit
  `9e0b455f4ef0e2ab8f2e582289761153549043fc`). Existing Graphmory LongMemEval
  reports explicitly measure retrieval, not official answer accuracy.

## Frozen development experiment

Before scoring LoCoMo, sort conversation IDs by SHA-256 of
`graphmory-locomo-v1:<sample_id>`. First seven are development; final three
remain unscored holdouts. Do not split questions from the same conversation
between tuning and acceptance. This is not an upstream official split.

Render each entire session to Markdown, preserving turn text, speakers,
dialog IDs, timestamp and available BLIP captions. Do not include QA answers,
generated observations, summaries, annotated events or generated links. Map
each gold dialog ID to its source note; collapse multiple evidence turns in
one note to one required note. This measures session/note completeness and
does not claim turn-level recall or multimodal answer accuracy.

Run existing governed BM25 and existing two-lane fusion with unchanged
retrieval code. Report Recall@5/10/20 (mean required-note coverage) and
complete-evidence rate at each depth. Also report all-candidate reachability
so an arbitrary cutoff does not hide evidence the curator could paginate to.
Depths are evaluation checkpoints, not product retrieval limits.

Category 5 adversarial questions are reserved for reader/answer evaluation,
not scored as retrieval failures or successes. Missing evidence labels and
unresolved dialog IDs are explicitly excluded with reasons; do not repair
labels silently or treat empty evidence as perfect recall. No live model calls
or answer-quality claims in this stage. Do not optimize on the holdout.

```sh
node scripts/eval-locomo.mjs --input /private/tmp/graphmory-locomo10.json \
  --revision 3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376 \
  --out eval/locomo/development-v1.json
```

## Results and correctness audit

Pinned dataset SHA-256:
`79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4`.
The runner rejects a different revision/hash. The official file contains
1,986 QA records across ten conversations. The seven development conversations
contain 1,439 QA records: 1,099 scored retrieval cases, 330 adversarial records
reserved for answer evaluation, six unresolved evidence labels, and four
missing-evidence cases. The latter ten are quarantined, not counted as misses
or silently repaired. Three held-out conversations have not been scored.

| Metric, 1,099 scored questions | BM25 | Two-lane fusion |
|---|---:|---:|
| Mean evidence-note Recall@10 | 92.2% | 93.2% |
| Complete evidence @10 | 962/1,099 | 978/1,099 |
| Complete evidence @20 | 1,051/1,099 | 1,050/1,099 |
| Complete evidence somewhere in ranked candidates | 1,099/1,099 | 1,099/1,099 |
| Multi-hop complete evidence @10 | 85/180 | 96/180 |
| Multi-hop complete evidence @20 | 149/180 | 146/180 |

The broad average hides multi-hop weakness. Fusion helps at ten results but
is not better at every depth or category. All-candidate reachability can be
trivial when common query terms match nearly every session; it does not show
efficient retrieval or answer correctness. It says only that this adapter's
ranked pool did not discard gold note paths. No fixed product cutoff is added.
Do not promote an arm or claim superiority from development scores.

Verification: adapter tests preserve verbatim text, negation, captions and
turn identities; duplicate turn IDs fail; unresolved labels are explicit;
gold answers/questions do not enter history documents; empty evidence has no
recall score. `npm run check` passed. Runtime hashes, dataset hash, split IDs,
per-category metrics, exclusions and per-case paths are saved in
`eval/locomo/development-v1.json`. No provider calls or private-vault reads
occurred. Dataset remains locally available for reproduction, not committed.

## Next acceptance requirement

Optimize only using the seven development conversations. Before opening the
three held-out ones, freeze the implementation, reader/model, query/history
adaptation, official answer scoring, and an additional unsupported-claim audit.
Use the upstream LoCoMo category-specific F1 as a named answer metric, with
adversarial accuracy separately; do not relabel retrieval as accuracy. For
LongMemEval use its official task-specific judge and separately measure safe
abstention. If judge/model differs from a published run, disclose it rather
than comparing percentages as if conditions matched. A manual evidence audit
must accompany judge errors; a string or judge pass is not proof that every
claim is grounded. No official QA evaluation was run in this iteration.
