# Docs Index

Files here are the engineering docs — architecture, operations, evaluation
evidence, and the project's own research/positioning notes — grouped by
purpose. Nothing has been deleted, only regrouped; this is a navigation aid.

## Guides (`guides/`)

Operational how-tos for installing, running, and troubleshooting the harness.

- `install.md` — installation and adapter setup.
- `troubleshooting.md` — start with the doctor command, not guesswork.
- `demo-workflow.md` — a walkthrough turning a verified incident into durable memory.
- `portable-brain-sync.md` — syncing the same curated vault across machines/accounts/agents.
- `hot-context-demo.md` — the `render-hot-context` script demonstrated on real output, not a metrics doc.
- `thai-strategy-guide.md` — Thai-language concept guide.

## Design (`design/`)

The system's architecture and the reasoning behind its shape.

- `architecture.md` — the lead-agent/curator responsibility split and system components.
- `repository-patterns.md` — why the repo is shaped the way it is (install/eval/fork ergonomics).
- `learning-loop.md` — the verified-loop model for how a note becomes durable memory.

## Evaluation (`evaluation/`)

The project's canonical eval docs — updated in place as the suite evolves —
plus dated, point-in-time reproduction snapshots that are never edited after
the fact; they get superseded by a new dated file instead.

- `evaluation.md` — the living deterministic eval suite writeup (retrieval baseline, acceptance gate, curator/patch-quality proxy tables). Kept current; superseded numbers are corrected in place with a note, not silently overwritten.
- `live-model-eval.md` — methodology: how to run and score a live-model comparison (what to compare, how scoring works). Process doc, not results.
- `live-model-results.md` — the living live-model results doc, explicitly separate from the deterministic proxy evals in `evaluation.md`.
- `cost-and-scale.md` — includes the private, non-reproducible 30-question scoped-vault eval (semantic-hybrid dense-fusion gain) plus cost-reduction claims, flagged as a reproducibility gap precisely because that fixture isn't committed.
- `query-reformulation-ablation-2026-08-05.md` — blind LLM query-reformulation ablation extended from N=2 to the full 34-query real-vault set. Result: net negative (1 fix, 2 regressions vs. baseline).
- `raw-logs/` — query-level JSON backing the dated ablation snapshots above (e.g. `query-reformulation-2026-08-05.json`).

## Research (`research/`)

The project's own positioning and research-sourcing notes.

- `rag-positioning.md` — the project's own first-pass self-assessment of where it sits in the RAG landscape (English + Thai).
- `research-foundations.md` — which components are directly supported by prior published work vs. engineering synthesis without a claimed precedent.
- `research-source-map.md` — a log of which external sources changed the architecture vs. were reviewed and excluded (bilingual EN/TH).
- `improvement-research.md` — research-backed improvement-area notes from the v0.5.0-rc.3 era.
- `notebooklm-review.md` — an independent external review (2026-06-27), kept as outside-eyes feedback, not authored by this project.

## History (`history/`)

- `v0.3-development-plan.md` — historical development plan (v0.2 → v0.3 branch start).
