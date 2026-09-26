# Preregistered retrieval experiment v2

Written before running this candidate on the split below (2026-09-26).

Hypothesis: combining document-level lexical matches with focused section matches misses evidence when a long session dilutes the whole-note score or query focusing removes important terms. Add an unfocused BM25 section lane to the existing two-lane reciprocal-rank fusion. No models, invented aliases, gold-derived links or extra output candidates.

Arms: governed BM25; existing two-lane fusion; candidate three-lane fusion. All use the same full-history Markdown rendering, preserve upstream timestamps, query/date, tokenizer and 12-session cap. Count added ranking work in latency. This is a retrieval-only ablation, not a comparison with Mem0/Graphiti or official answer accuracy.

Split: group question IDs after removing a terminal `_abs`. All previously selected pilot families are development. Other families use the first 32 bits of SHA256('graphmory-split-v2:' + family), even=development, odd=acceptance. This is a question-family split; conversation overlap across unrelated question IDs remains a limitation, so call acceptance an internal holdout, not contamination-free generalization.

Selection: fixed hash ordering within the seven categories; at most 10 per category from development; then at most 10 per category from acceptance. No failed case dropping. Primary: complete-evidence@3; secondary complete@12 and mean evidence recall. Require no aggregate loss on development to open acceptance. A positive point estimate with tiny counts is insufficient for a superiority claim. Do not tune after looking at acceptance; any subsequent fix needs a fresh holdout.

No production default change unless both primary and complete@12 are non-regressing on acceptance plus earlier fixtures. Otherwise keep the candidate experimental or reject it. Never use this score as answer accuracy. Report paired wins/losses and family-bootstrap uncertainty on acceptance.

## Development decision (before opening acceptance)

The three-lane candidate failed development: complete@3 33/58 vs existing fusion 34/58, complete@12 44/58 vs 50/58. Reject it; do not evaluate it on acceptance or ship it.

The preregistered governed BM25 control instead achieved complete@3 44/58 and complete@12 52/58. Next candidate is simplification to the already supported single BM25 lane, with no new parameters. Freeze this choice before opening acceptance. Compare only BM25 vs existing fusion on acceptance, at the same 12-note cap. This is selection from development results, not a preregistered claim that BM25 would win.
