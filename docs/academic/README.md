# Academic Materials — moved to I-MEM

**The thesis/academic layer of this project has moved to its own repository:
[`github.com/Grunte12/i-mem`](https://github.com/Grunte12/i-mem)** (private).
That repo is the frozen, citable research artifact: all dated evaluation
snapshots, the verified bibliography (`references.bib` + `citation-notes.md`),
prior-art analysis, paper outlines and drafted sections, and the reproducible
raw logs backing every number in the paper. Cite files there, not here.

`memory-patch-harness` (this repo) is the personal R&D environment: free
iteration on tool performance, retrieval experiments, and release tooling.
The full academic file set that used to live in this folder is preserved on
the `research/rag-eval-academic` branch and, in its current corrected form,
in the i-mem repo.

## What remains in this folder

Development-run evidence for experiments executed on this branch — kept so
the eval scripts here stay reproducible without checking out another branch:

- `query-reformulation-ablation-2026-08-05.md` — blind LLM query-reformulation
  ablation extended from N=2 to the full 34-query real-vault set. Result:
  net negative (1 fix, 2 regressions vs. baseline). The citable copy of this
  document lives in i-mem's `docs/academic/`.
- `raw-logs/` — query-level JSON for the run above
  (`query-reformulation-2026-08-05.json`).

Reproduce with:

```bash
npm run eval:query-reformulation -- \
  --vault eval/real-vault/vault \
  --queries eval/real-vault/queries.json \
  --reformulations eval/real-vault/reformulated-queries.json
```

The dated-snapshot rule still applies to anything left here: files are never
silently edited after the fact — a new dated file supersedes the old one.
