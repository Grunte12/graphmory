# Obsidian Memory for AI: workflow feasibility

Checked the public [`jrcruciani/obsidian-memory-for-ai`](https://github.com/jrcruciani/obsidian-memory-for-ai) README, current v4.1 specification, sample-vault instructions and scripts on 2026-09-29. The README identifies v4.1 as current stable; v4.0 and v3 remain supported. Pinned source: `f87548aad314ab385d4784a618297e363b859238`. Installed the example vault's `PyYAML>=6.0` requirement (PyYAML 6.0.3) in a temporary local venv and ran the bounded smoke protocol in a disposable copy; no private vault, global install, API, or model was used. The root Git tree has no LICENSE/COPYING file; license remains unverified.

## What is runnable

This is a portable example-vault/toolkit, not a package, daemon, Obsidian plugin, or prompt-only recipe. For a v4.1 copy, the documented setup is:

```sh
cd examples/v4.1-minimal-vault
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python tools/lint.py --strict
MEMORY_TODAY=2026-09-21 tools/rebuild-views.sh
python3 tools/rebuild_indexes.py
tools/query.sh facts --entity elena-voss
```

The spec says tools run offline with Python 3 and PyYAML; the pinned sample requires `PyYAML>=6.0`. Git supplies version/history and revision-checked transaction behavior. Smoke execution used the copied v4.1 fixture, isolated Git baseline, and local `.venv`; see the [pre-registered protocol](../evaluation/obsidian-memory-offline-smoke-protocol-2026-09-29.md) and [metadata-only results](../../eval/reader-pilot/obsidian-memory-offline-smoke-2026-09-29.json). Do not assume permissive licensing while no license is identified.

V4.1 supports two write paths. For an ordinary atomic change, `tools/transact.py begin --idempotency-key ... --agent ...`, one or more `add` operations, then `commit --yes` stage and publish a transaction. For governed changes, `tools/propose.py create ...` creates a Markdown/YAML proposal, `tools/review.py approve ... --reviewer ...` records a separately authorized, hash-bound review, and `tools/propose.py apply --proposal-id ... --yes` applies approved operations. `roles.yaml` controls proposer/reviewer roles and approval counts; self-approval is forbidden. Applying rechecks proposal content hash and live authorized reviews. The README and spec document these as commands, not just an agent prompt.

## Comparison contract and limits

| Synthetic case | Evidence status | What the documented contract tests—and does not test |
|---|---|---|
| Approved update | Capability analogue; smoke passed | Proposal → separate authorized reviewer → apply created a fact in the disposable fixture. This verifies those mechanics only; the sample's reviewer identity is synthetic and this is not a Graphmory semantic approved-update result. |
| Retry | Capability analogue; smoke passed | Replaying an applied proposal and a committed transaction returned success; target file count/hash and matching journal count stayed unchanged. It does not establish equivalence to Graphmory's retry semantics. |
| Missing evidence | Documented policy/structure only; not run | `derived_from`, trust/assertion fields, external-source review policy and dangling-reference diagnostics exist. These fields are optional by default and do not establish semantic source sufficiency or truth; no missing-evidence case was run. |
| Conflict | No equivalent result claimed | The smoke checked unauthorized-review refusal and hash-bound stale-review refusal. It did not run the `expected_revision` conflict case; neither result is a Graphmory semantic memory-conflict comparison. |

Canonical state remains Markdown/YAML: one typed fact per Markdown file with YAML frontmatter; append-only event Markdown; proposals/reviews and transaction journals are also Markdown. `_views/` and `_indexes/` are generated, rebuildable read models, not canonical truth. V4.1 has an explicit graph index and filesystem fallback, but this is a local file-backed graph/search layer, not a graph database.

Rollback is documented for failed or interrupted staged transactions: the transaction tool keeps preimages/journals, `recover --yes` restores pending staging, and transaction lifecycle includes `rollback`. The inspected spec does **not** document an undo command for an already committed transaction. Git history, retained superseded fact versions, and a compensating proposal are the apparent correction path; verify the concrete committed-change recovery procedure before treating it as equivalent rollback.

## Fit and evidence

The strongest adaptation candidates for Graphmory are (1) content-hash-bound proposal/review/apply with separate reviewer identity; (2) transaction idempotency plus staged preimage recovery; (3) explicit evidence lineage and trust policy; and (4) deterministic derived indexes with canonical-filesystem fallback. The project also documents consolidation that emits non-executable diagnostic proposals rather than guessing repairs. These are workflow patterns to compare, not evidence that one system is better.

The README reports regression tests and 21 offline exact-query evaluations; these were not run. They are deterministic query contracts, not a published coding-agent task benchmark, live-model evaluation, or comparative result. The bounded workflow smoke ran 21 CLI commands across 11 pass gates: strict lint, view/index rebuild, query, authorized proposal apply and replay, unauthorized review refusal, transaction idempotent replay, and stale-review hash refusal without a canonical write. Results contain command/environment metadata and hashes, not raw memory content. These are capability checks, not aggregate quality or semantic comparison. The project is oriented to personal/project facts rather than repository/code-change memory, so adapting it would still require Graphmory-specific task lifecycle, code-evidence, and curator integration.

**Remaining gaps:** the smoke did not run the project's full regression/query-eval suite, a model session, retrieval-quality scoring, semantic evidence support, a stale Git revision case, or a Graphmory head-to-head. The temp checkout/copy is retained briefly for parent audit; no upstream source was copied into Graphmory.

## Primary sources

- [README and quick start](https://github.com/jrcruciani/obsidian-memory-for-ai/blob/main/README.md)
- [SPEC-v4.1: transactions, review governance, indexes, evidence, and evaluation contract](https://github.com/jrcruciani/obsidian-memory-for-ai/blob/main/SPEC-v4.1.md)
- [Reference vault](https://github.com/jrcruciani/obsidian-memory-for-ai/tree/main/examples/v4.1-minimal-vault)
- [Automation guide](https://github.com/jrcruciani/obsidian-memory-for-ai/blob/main/automation-guide.md)
