# Matched native Curator preflight — 2026-09-28

## Purpose and frozen design

The [matched CLI retrieval diagnostic](matched-cli-retrieval-2026-09-28.md) did not measure what a Curator and Lead do with search results. This preflight extends the existing [mediated Curator runner](../../scripts/run-curator-paging-pilot.py) with an isolated Basic Memory 0.23.2 hybrid adapter. It tests whether both native search, note-read and answer paths can complete under the same Codex CLI Curator/Lead contract. The [manifest](../../eval/reader-pilot/matched-native-curator-manifest-2026-09-28.json) was frozen before model generation. It declares one **previously exposed** LongMemEval-S development case, `a40e080f`, Basic Memory first, Graphmory second, Luna Curator and Lead, low reasoning, three Curator rounds, and structured citations. This is an integration and failure-attribution test, not an independent quality or efficiency benchmark.

The 48 original Markdown sessions were rendered once from the pinned cleaned-S dataset. Graphmory read the original vault. Basic Memory indexed a separate copy using its native `reindex --search --embeddings`; preflight output confirmed 48/48 indexed, 48 entities embedded with `bge-small-en-v1.5:384`, and zero embedding errors. Native ingestion changed the copied Markdown; source hashes are recorded separately for originals and indexed files. Basic Memory then used its real `bm tool search-notes --hybrid --json --page-size 10` and `bm tool read-note --json`. Graphmory used `recall-managed --auto --agent` and `read-notes`. Both paths passed only observed candidate paths to the Curator, verified original/indexed file immutability, and checked that Lead citations named sources actually opened and cited by the brief. Gold labels remained outside model inputs.

The first Basic Memory attempt [stopped before generation](../../eval/reader-pilot/matched-native-basic-prepermission-failure-2026-09-28.json): sandbox access prevented Codex CLI from writing its session database. Its failed call and zero usage are retained. After the necessary local state/network permission was granted, the two successful arms ran into new output directories; no failed trial was overwritten. Raw Codex traces were inspected locally, then removed with the disposable case workspaces after the sanitized reports were saved.

## Observations

| Measure | Basic Memory hybrid | Graphmory managed auto |
|---|---:|---:|
| Completed Curator / Lead model calls | 2 / 1 | 2 / 1 |
| Native search pages / full notes read | 1 / 1 | 1 / 1 |
| Verified gold note read | Yes | Yes |
| Lead answer | Patagonia and Southwest Airlines | Patagonia and Southwest Airlines |
| Structured citation | `sessions/0031-334e97a0e66d.md` | Same |
| Whole-workflow wall time after prepared index | 23.210 s | 16.730 s |
| Host gross input tokens | 81,742 | 62,491 |
| Host cached input tokens | 0 | 22,272 |
| Host noncached input tokens | 81,742 | 40,219 |
| Host output tokens | 194 | 186 |
| Submitted prompt bytes across calls | 147,289 | 70,241 |

[Basic Memory run](../../eval/reader-pilot/matched-native-basic-live-2026-09-28.json) and [Graphmory run](../../eval/reader-pilot/matched-native-graphmory-live-2026-09-28.json) preserve the answers, briefs, paths, body hashes, each model call's usage/timing and failure state. Manual inspection found both company names in the cited original session at lines 47 and 49; the original answer label matches them. This is a narrow source-supported observation, not an official LongMemEval score or independently blinded support judgment.

Basic Memory's first native search returned 10 candidates and about 70 KB of JSON with `content` and `matched_chunk`; Graphmory's managed auto page returned 30 paths/previews. Both placed the gold note first. The Curator opened that note in each arm before briefing the Lead. Basic Memory's native read returned normalized content, while Graphmory delivered the original bytes. The runner verified both identities and preserved their different hashes.

## Interpretation and next experiment

Both native tool workflows can reach a cited answer on this case. The observed 6.48 s wall-time difference is **not** an efficiency finding: there is one trial per arm, Basic Memory ran first, Graphmory's second Curator call received 22,272 cached input tokens, candidate counts and result formats differ, and Basic Memory's index construction was outside the workflow timer. Subscription billing is unknown. The Graphmory `toolOutputBytes` field in this runner version is a JSON reserialization estimate; Basic Memory records native stdout bytes. Do not use those fields as a precise paired byte or token-cost comparison.

The next version should record exact Graphmory stdout bytes and native read times, then run counterbalanced, repeated trials on several source-disjoint development families with answerable, multi-hop, update and abstention questions. It must score supported completeness and citation entailment separately from reference-string match, and preserve cache categories and failed calls. Freeze that protocol before opening the independent LoCoMo holdout. This preflight does not change Graphmory's retrieval or Curator defaults.

## Verification

The new fake-host Basic Memory adapter regression and all existing mediated Curator regressions passed 13/13. `npm run check` passed 293/293 repository tests and configured gates; `git diff --check` passed. The required status check returned `SYNC_CONFIG_NOT_FOUND` for `/Users/grunte/Obsidian`. The successful run reports each have three completed model calls, one full note read, a valid structured citation and no source mutation. Basic Memory read its normalized indexed note; Graphmory read the original Markdown. No private Obsidian vault content was used.
