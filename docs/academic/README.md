# Academic Materials Index

This folder is the thesis-facing layer: dated, citable snapshots and paper
drafts, kept separate from the project's living docs in `../` (see
`../README.md`). The rule that keeps this folder trustworthy: **files here
are dated and never silently edited after the fact.** If a number changes,
a new dated file supersedes the old one and says so explicitly — it is not
patched in place. Nothing here has been renamed or moved during this
reorganization; this file is a navigation aid only.

Every number that ends up in the paper draft should trace back to one of the
dated snapshot docs below, not to a living doc in `../`, wherever both exist
for the same claim.

## Reading order (if starting cold)

1. `paper-outline.md` — the skeleton and the academic reasoning for each section (read this first; it explains *why* each section exists, not just what goes in it).
2. `evaluation-results-2026-08-01.md` → `real-vault-retrieval-2026-08-02.md` → `live-model-pilot-2026-08-01.md` — the three eval snapshots, in the order the paper's Results section uses them.
3. `rag-classification-analysis.md` and `competitive-landscape-2026-08-02.md` — positioning and prior-art, feeding Sections 3 and 7.
4. `related-work-plan-2026-08-02.md` → `related-work-draft-2026-08-03.md` — Section 3's plan, then its drafted prose.
5. `paper-sections-draft-2026-08-03.md` — drafted prose for Sections 1, 2, 4, 5, 6, 7, 10 (Sections 8-9 refreshed in place).
6. `references.bib` + `citation-notes.md` — the bibliography and what each entry is evidence for.

## Evaluation snapshots (dated, citable, reproduction-focused)

- `evaluation-results-2026-08-01.md` — full deterministic eval suite reproduction on `research/rag-eval-academic`. This is the citable snapshot for the numbers in `../evaluation.md`'s living tables; regenerate, don't hand-edit, if the suite changes.
- `raw-logs/` — committed, query-level JSON for the headline governed-vs-ungoverned ablation (§4) and the v0.5 acceptance gate (§3), plus a `manifest.json` pinning the exact git commit/environment they were generated from. Regenerate with `npm run eval:repro:headline`; a fresh run should match these exactly (verified 2026-08-03). This exists so the paper's single strongest claim (100% vs 40% current-memory accuracy) is checkable at the query level, not just as a summary table.
- `real-vault-retrieval-2026-08-02.md` — the project's first **public, reproducible** real-vault retrieval eval (54-document vault — 44 papers + 10 MOC notes — built from this project's own bibliography, 34 queries; see its 2026-08-04 correction note for a stale-prose bug this document itself had). Explicitly contrasted against the private 30-question vault eval in `../cost-and-scale.md`, which is real but not independently reproducible — cite this file, not that one, wherever both could support a claim.
- `verifier-retry-ablation-2026-08-04.md` — how much retry budget a bounded curator evidence-verification loop actually needs, measured per-query on the real vault: 88.2% resolve with no escalation, ~6% need exactly one retry, none benefit from a second. Direct evidence for capping retries at 1 rather than building a deep or unbounded escalation ladder.
- `query-reformulation-ablation-2026-08-05.md` — extends an earlier N=2 spot-check (blind LLM query reformulation as a cheaper alternative to a dense/semantic lane) to the full 34-query real-vault set. The fix count is unchanged (1/2 known misses recovered) but N=34 also surfaces 2 regressions on previously-passing queries invisible at N=2 — net negative on this fixture. Direct evidence against adopting naive single-shot reformulation as a wholesale substitute for a dense lane.
- `baseline-comparison-eval-plan-2026-08-04.md` — **a plan, not yet run.** Designs a 4-condition live-model comparison (no memory / manual Obsidian / an honestly-disclosed emulation of a third-party tool's pattern / this project) to answer the question none of the existing pilots address: is any of this worth adopting over what a person already does. Layered scoring so schema-less baselines aren't unfairly zeroed out. Read before running it, and don't cite its numbers — it has none yet.
- `live-model-pilot-2026-08-01.md` — the first real (non-proxy) data ever collected against `eval/live-agent/incidents.json`: actual model reasoning scored by rubric, not a hand-authored candidate checked against a rubric. This is the citable source for the live-model numbers; `../live-model-results.md` is the living doc it's distilled from.
- `cost-tier-curator-pilot-2026-08-03.md` — first data on running the curator on a cheap model tier (Haiku 4.5) vs. frontier (Sonnet 5): a bounded 5-incident check, not a full pilot. Also documents a 4th scorer bug (a `noLeakage` false-positive on policy prose) found and fixed here, which retroactively corrected `live-model-pilot-2026-08-01.md`'s own numbers — read this file for why those numbers changed.

## Positioning & prior-art (verified, citable)

- `rag-classification-analysis.md` — an independent, evidence-based verification pass over `../rag-positioning.md`'s self-assessment, re-derived from the eval snapshot above and direct code inspection. Cite this, not `../rag-positioning.md`, for the paper's RAG-landscape classification claim.
- `competitive-landscape-2026-08-02.md` — cross-validated prior-art survey (multiple research passes + independent GPT-5.6 cross-check). Every row in its comparison tables is independently verified against a primary source (arXiv API, GitHub, or direct page fetch) — see the file's own verification-status note.

## Bibliography

- `references.bib` — BibTeX entries, all independently verified (arXiv/OpenReview/ACM/publisher pages, or GitHub for tooling), never guessed.
- `citation-notes.md` — what each bib entry is evidence for, plus the citation-selection policy (recency-over-citation-count for 2026 preprints).

## Paper drafts

- `paper-outline.md` — the section skeleton with per-section content/rationale notes. Section 3's sketch inside this file is marked superseded; use the two files below instead.
- `related-work-plan-2026-08-02.md` — the 7-subsection organization plan for Section 3, including the "tempting phrasing → why not supportable → supportable instead" novelty-claims table.
- `related-work-draft-2026-08-03.md` — drafted prose for Section 3, following the plan above.
- `paper-sections-draft-2026-08-03.md` — drafted prose for Sections 1 (Abstract), 2, 4, 5, 6, 7, 10 (Conclusion), with Sections 8-9 refreshed to current numbers. Every section has a "Grounded in:" footnote naming its source file(s) above. Its own "Open items" list at the bottom tracks what's left before it replaces `paper-outline.md` wholesale.
