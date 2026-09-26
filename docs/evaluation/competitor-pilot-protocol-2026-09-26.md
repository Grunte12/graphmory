# Local competitor pilot protocol — 2026-09-26

## Budget and sequence

User requested Luna research, isolated installation/evaluation by a subagent, primary-agent audit, then an evidence-backed optimization and Thai report. Account snapshot at start: 71% five-hour remaining, 18% weekly remaining. Percentages are shared and cannot be converted reliably into a per-task token budget.

- Research at most three candidates; install one feasible tool first, with one fallback only if blocked.
- Use Luna for research and implementation, without Astra in this round.
- No paid model calls, global installation, private-vault ingestion, or background services left running.
- Recheck account usage before a major additional phase; avoid consuming the remaining weekly quota for a broad leaderboard.

## Frozen comparison

Use the 14 IDs in `eval/longmemeval/pilot.json` and the dataset byte hash documented there. This is a **development pilot**, previously inspected, not a new holdout or official answer-accuracy benchmark. Each case receives its complete, identical timestamped Markdown sessions from `prepareCase`; no gold answers, evidence IDs, summaries, or generated links enter retrieval.

For each tool, follow its documented local ingest/search interface, pin the installed version and save commands. Isolate state per case. Use original question plus question date, identical to the existing Graphmory evaluator. Return up to 12 distinct source sessions and measure top 3 and top 12. Record result ordering and any deduplication, query transformation, truncation, or unsupported behavior explicitly. Native defaults and optional tuned settings must be separate arms.

Report complete-evidence@3/@12, evidence recall@3/@12, all failures, and abstention cases returning candidates. Candidate retrieval is not an answer and cannot establish hallucination or abstention quality. Do not treat search scores from different engines as comparable probabilities.

Record installation/ingestion time separately from search wall time, with three warm searches where practical. CLI startup is included when using a CLI and must be labeled. Record returned bytes as output size, not billed tokens. No RAM or cost claims without measurements. Use equal data, source-session budgets, and requested cases; report failed cases rather than silently dropping them.

## Optimization gate

Choose at most one change based on audited pilot errors. Keep it only if it passes a disjoint, preselected acceptance sample and relevant regression checks; otherwise document rejection. Existing v2 acceptance data is already observed and cannot serve as a fresh holdout. A native retrieval comparison does not establish overall memory/curator superiority. Final report must identify untested systems and remaining live-reader/API work.

Fresh acceptance IDs were saved before competitor evaluation in `eval/competitor-pilot/holdout-manifest.json`: two per category, excluding every question family seen in the pilot, strict-time pilot, v2 development, or v2 acceptance reports. This small sample is a regression screen, not a sufficiently powered superiority study. Do not open it unless a concrete candidate is selected.

## One diagnostic candidate

After the development pilot showed that Basic Memory returned no rows with question-plus-date queries despite successful known-item searches, inspect its native query preparation. Test question-only text in both tools as a separately labeled diagnostic (dates remain in input notes). On Graphmory's development sample this raises BM25 complete@3 from 8/12 to 10/12. Select removal of the automatically appended query date as the single candidate for the frozen holdout; compare both formats on identical IDs. This is an evaluator/input-contract change, not a production retrieval algorithm change: Graphmory production already accepts the user's query without appending this benchmark date.
