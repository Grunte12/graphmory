# Docs Index

Files listed here are the **engineering docs** — architecture, operations,
and the project's own ongoing eval/positioning notes. The thesis/academic
layer that used to live alongside them has moved to its own repository,
**[`i-mem`](https://github.com/Grunte12/i-mem)** — see `academic/README.md`
for the pointer and what little remains there (dev-run evidence for
experiments executed on this branch).

Nothing here has been renamed or moved — this is a navigation aid only.

## Architecture & design

- `architecture.md` — the lead-agent/curator responsibility split and system components.
- `repository-patterns.md` — why the repo is shaped the way it is (install/eval/fork ergonomics).
- `learning-loop.md` — the verified-loop model for how a note becomes durable memory.

## Evaluation & metrics (project-maintained, living documents)

These are the project's own canonical eval docs — updated in place as the
suite evolves. For **dated, point-in-time reproduction snapshots** used as
citable evidence in the paper, see `academic/README.md` instead; those never
get edited after the fact, they get superseded by a new dated file.

- `evaluation.md` — the living deterministic eval suite writeup (retrieval baseline, acceptance gate, curator/patch-quality proxy tables). Kept current; superseded numbers are corrected in place with a note, not silently overwritten.
- `live-model-eval.md` — methodology: how to run and score a live-model comparison (what to compare, how scoring works). Process doc, not results.
- `live-model-results.md` — the living live-model results doc, explicitly separate from the deterministic proxy evals in `evaluation.md`.
- `cost-and-scale.md` — includes the private, non-reproducible 30-question scoped-vault eval (semantic-hybrid dense-fusion gain) plus cost-reduction claims; flagged in the academic layer as a reproducibility gap precisely because that fixture isn't committed.
- `hot-context-demo.md` — the `render-hot-context` script demonstrated on real output, not a metrics doc.

## Research positioning

- `rag-positioning.md` — the project's own first-pass self-assessment of where it sits in the RAG landscape (English + Thai). Superseded/stress-tested by `academic/rag-classification-analysis.md`, which re-derives the same question from evidence rather than intuition — read that one for anything citable.
- `research-foundations.md` — which components are directly supported by prior published work vs. engineering synthesis without a claimed precedent.
- `research-source-map.md` — a log of which external sources changed the architecture vs. were reviewed and excluded (bilingual EN/TH).
- `improvement-research.md` — research-backed improvement-area notes from the v0.5.0-rc.3 era.
- `notebooklm-review.md` — an independent external review (2026-06-27), kept as outside-eyes feedback, not authored by this project.

## Operations & guides

- `install.md` — installation and adapter setup.
- `troubleshooting.md` — start with the doctor command, not guesswork.
- `demo-workflow.md` — a walkthrough turning a verified incident into durable memory.
- `portable-brain-sync.md` — syncing the same curated vault across machines/accounts/agents.
- `thai-strategy-guide.md` — Thai-language concept guide.
- `v0.3-development-plan.md` — historical development plan (v0.2 → v0.3 branch start).

## Academic / thesis materials

Moved to the [`i-mem`](https://github.com/Grunte12/i-mem) repository — the
frozen, citable research artifact (dated snapshots, verified bibliography,
paper drafts, reproducible raw logs). The paper cites files there, never the
living docs above. `academic/` here keeps only dev-run evidence for
experiments executed on this branch.
