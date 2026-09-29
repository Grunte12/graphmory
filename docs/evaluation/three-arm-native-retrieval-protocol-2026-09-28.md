# Three-arm native retrieval diagnostic: frozen design before execution

## Decision this experiment can make

Compare Graphmory's real CLI, Basic Memory's real hybrid CLI, and ordinary Markdown file search on the **same** exposed LongMemEval-S development vaults. The third arm is `scripts/native_file_baseline.py`, which uses the installed `rg` executable. This is a retrieval and delivery diagnostic. It cannot rank answer quality or prove which memory assistant is better overall.

The [prior two-arm run](matched-cli-retrieval-2026-09-28.md) found Complete Evidence@10 of 12/12 for both indexed Basic Memory and Graphmory. Reuse its case-selection/data hashes as a reference, but run **all three arms again** in one scheduled process for matched host conditions. Do not merge measurements from the old run into new paired latency statistics.

## Frozen cases and treatment

- Reuse exactly the 14 IDs in `eval/longmemeval/pilot.json` and the pinned local cleaned-S dataset whose SHA-256 matches that manifest. Twelve answerable cases contribute to evidence-recall denominators; two abstention cases contribute to candidate, failure, latency and output accounting only. Do not select cases or tune queries after observing third-arm results.
- Render identical original Markdown bodies for each case. Graphmory and ordinary-file arms operate on verified copies of those originals. Basic Memory 0.23.2 indexes its own copy with native `reindex --search --embeddings`, verifies all notes embedded with zero errors, and uses native `tool search-notes --hybrid`. Record its ingestion time and changed indexed-body hashes separately.
- All arms receive only the exact original question. Graphmory uses its existing `recall-loop --agent --k 10`; Basic Memory uses native `search-notes --hybrid --page-size 12`; ordinary files use `native_file_baseline.py search` with its frozen Unicode token/OR/word-boundary policy, page size 10 and stable snapshot. Do not silently relabel the ordinary-file arm as BM25, semantic search, or agentic retrieval.
- Run three warm repeats per arm per case. Rotate first arm across cases and repeats, recording the actual sequence. Use one machine and pin the executable/version and script hashes in a pre-run manifest. If any arm fails, preserve its failure row and all planned identities; never replace or discard the failed case.

## Metrics and complete-candidate accounting

Primary retrieval measure is **Complete Evidence@10**: every required evidence group has at least one original note among the first ten paths, on the twelve answerable cases. Secondary measures: Complete Evidence@3, Recall@3/@10, first matching rank per evidence group, all-candidate evidence reachability, candidate count, page count, duplicate/missing paths, original-body hash checks, native ingestion seconds, total search/page and original-read seconds, exact stdout bytes and tool-call count. Report per case and arm before aggregates. An unranked path-ordered file search may return many candidates; enumerate every page to measure reachability, while retaining @3/@10 for comparability. Do not cap retrieval at ten paths or mistake all-candidate reachability for a good answer.

The baseline helper currently re-runs `rg` on each continuation; count all such calls in full-path time and bytes. Its `snapshotId` binds candidate paths, not note-body bytes, so verify every original body against the frozen rendered-corpus manifest before and after the case. Record process-startup-inclusive wall time and helper native time as different quantities. Report medians and per-case distributions; avoid ratio claims when serialization contracts differ. Model tokens and subscription cost are **not measured** in this offline experiment.

## Boundaries and stop conditions

Gold labels stay outside tool and model inputs. The selected development conversations are already exposed; new question IDs from them are not source-disjoint holdout evidence. Do not render the sealed LoCoMo/LongMemEval holdout or the user's Obsidian vault. Before scoring, verify the frozen case IDs, dataset/script hashes, original-body hashes, executable versions, planned attempt matrix and all pagination invariants. Stop on an unexpected source path, broken snapshot, missing continuation or changed corpus and publish the failure rather than repair outcomes silently.

If Graphmory loses required evidence at @10 relative to either comparator, investigate candidate discovery/ranking before any answer-level optimization. If @10 ties, use an end-to-end Curator/Lead trial with the same models and source-read contract to test supported completeness, abstention, citation entailment, latency and host usage. The prior RAGTruth support-judge pilot failed calibration (16/24), so that judge is diagnostic only and cannot decide these tool wins. No promotion or general superiority claim follows from the fourteen exposed cases.

## Implementation gate

Before running all fourteen cases, implement the third arm in a new versioned matched runner and add synthetic tests for exact case accounting, all-page continuation, source hash preservation, path-order determinism, invalid-path rejection and failure retention. Execute a **one-case smoke** with all three real CLIs; preserve a report even if it fails. Only then run the full predeclared batch. Write a Markdown report for the smoke and full experiment, including unsuccessful attempts, before interpreting outcomes.
