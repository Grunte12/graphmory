# Matched native Curator development cases — 2026-09-28

## Frozen question and controls

After the [one-case native preflight](matched-native-curator-preflight-2026-09-28.md), test whether both memory tools let the same cheap Curator and Lead answer two more difficult LongMemEval-S questions. The [pre-generation manifest](../../eval/reader-pilot/matched-native-two-family-manifest-2026-09-28.json) freezes the pinned dataset/hash, runner and native-index builder hashes, two previously exposed development case IDs, arm order, Luna low-reasoning models, four Curator rounds, structured citations, all-attempt accounting and metrics. The cases have no identical original Markdown bodies. Gold answers were in separate local label files and never supplied to model prompts. The two cases and their result inspection are **development evidence**, not a sealed holdout.

Each Basic Memory 0.23.2 arm indexed a separate copy of the same original notes with native FTS and `bge-small-en-v1.5:384` embeddings: [48-note index](../../eval/reader-pilot/matched-native-945e-basic-index-2026-09-28.json) and [52-note index](../../eval/reader-pilot/matched-native-67e-basic-index-2026-09-28.json) both report every note indexed/embedded and zero errors. Ingest took 34.474 and 34.298 s respectively and sits **outside** answer-workflow wall time. Native ingestion normalized the copied Markdown; original and indexed source hashes are separate. Basic Memory ran `search-notes --hybrid` and `read-note`; Graphmory ran `recall-managed --auto --agent` and `read-notes` on the originals. The same mediator checked observed paths, source identity, citation provenance, no-tool host traces and source immutability. This runner revision measures native stdout bytes for Graphmory search **and** reads, not reserialized JSON estimates.

## Results

| Case / tool | Protocol | Gold sources read | Answer | Wall time | Input / cached tokens | Native search / read stdout |
|---|---:|---:|---|---:|---:|---:|
| Yoga update / Basic Memory | 3 calls, 1 page | 2/2 | “twice or three times a week” | 26.613 s | 87,670 / 8,960 | 74,914 / 29,583 B |
| Yoga update / Graphmory | 3 calls, 1 page | 2/2 | “about 2–3 times per week” | 19.102 s | 67,794 / 14,080 | 30,329 / 29,341 B |
| Online courses / Graphmory | 3 calls, 1 page | 2/2 | “20” | 21.803 s | 58,505 / 14,080 | 9,517 / 35,410 B |
| Online courses / Basic Memory | 4 calls, 2 pages | 2/2 | “20” | 34.903 s | 125,136 / 42,240 | 134,405 / 35,652 B |

All four planned arms completed and returned structured citations naming both opened gold notes. The [yoga Basic](../../eval/reader-pilot/matched-native-945e-basic-run-2026-09-28.json), [yoga Graphmory](../../eval/reader-pilot/matched-native-945e-graph-run-2026-09-28.json), [courses Graphmory](../../eval/reader-pilot/matched-native-67e-graph-run-2026-09-28.json) and [courses Basic](../../eval/reader-pilot/matched-native-67e-basic-run-2026-09-28.json) artifacts preserve each tool page/read, call usage, brief, answer, citations, hashes and stop state. Cached input is included in gross input; noncached input is gross minus cached. Output tokens were 440/346 on the yoga arms and 329/456 on the course arms, respectively. These host counters are not billed dollars.

### Answer audit

- **Yoga update (`945e3d21`): both arms missed the reference answer.** The older user statement in `sessions/0004-8fded2794ce3.md` (2023-08-11, line 93) says twice weekly. The later user statement in `sessions/0022-8a6092bbc216.md` (2023-11-30, line 37) says three times weekly. The reference answer is “Three times a week.” Both Curators read and cited both sources, then left the update unresolved; their Leads repeated a 2–3 range. The frequency values are grounded in source text, but the answers fail the current-state/temporal-resolution requirement. The question's anxiety wording is associated with the broader conversation rather than repeated in the later frequency sentence, so this manual judgment does not claim perfect phrase-level entailment of that purpose.
- **Online courses (`67e0d0f2`): both arms found and cited the two needed user statements.** `sessions/0038-e070111f44b2.md` (line 155) says 12 completed Coursera courses; `sessions/0007-730ea6f80239.md` (line 165) says 8 previous edX courses. Both briefs add them to 20; both Leads answer 20, matching the reference. This is an unblinded manual source check, not an official LongMemEval score or independently calibrated support label.

The concrete failure is **update resolution after successful retrieval and reading**. A retrieval-only Complete Evidence@k score would mark the yoga case as a success even though neither final answer gave the newest frequency. This supports a targeted Curator decision intervention: when facts about the same subject conflict, compare source dates and attribution, then answer the requested current or previous state explicitly; retain uncertainty when ordering or scope is unclear. Test that rule on both a current-state update and a previous-state control before changing a product prompt or tool default.

## Limits and next gate

Two exposed cases with one generation per arm cannot establish noninferiority, superiority, p95 latency or monetary cost. Basic Memory and Graphmory have different native candidate counts, output formats and normalization. Runs were sequential with different reported cache shares despite opposite first-arm order by case; no causal latency/token savings claim follows. The source/citation check validates identity and reading, not semantic entailment. A later independent evaluation needs source-disjoint families, explicit supported-complete labels, official benchmark scoring beside stricter support review, repeated/counterbalanced host conditions, and failure accounting.

The next experiment will keep the tools fixed and change only the Curator's conflict-resolution instruction on exposed development cases. It will include a question asking for a **previous** state so that “always pick the latest value” cannot pass by accident. No Graphmory retrieval default changed here.

## Verification

`npm run check` passed 293/293 tests and the configured deterministic gates. `git diff --check` and artifact accounting passed: runner/builder hashes match the frozen manifest, all four planned runs completed without a failed model call, all four report valid citation provenance, and both native indexes have zero embedding errors. The required `/Users/grunte/Obsidian` status command returned `SYNC_CONFIG_NOT_FOUND`; this experiment used disposable public benchmark vaults and did not change the user's vault.
