# Obsidian Memory for AI: installed offline workflow smoke

## Frozen setup

Followed the preregistered [protocol](obsidian-memory-offline-smoke-protocol-2026-09-29.md). Cloned the [upstream toolkit](https://github.com/jrcruciani/obsidian-memory-for-ai) at `f87548aad314ab385d4784a618297e363b859238`, copied its v4.1 example vault, initialized a synthetic Git baseline, and installed the pinned source's requirements into a private temporary virtual environment. Observed Python 3.12.10 and PyYAML 6.0.3. The requirement is `PyYAML>=6.0`, so source pin alone does not pin dependency resolution; the recorded installed version matters for reproduction. No global install, private vault, API or model calls.

This is a deterministic upstream capability screen using its own example/schema. It is not a matched Graphmory comparison or a conversational memory benchmark. Structural authorization and stale proposal hashes are not semantic evidence sufficiency or disagreement between sources.

## Actual execution

The worker ran 21 recorded commands and passed 11 declared gates. Two intentionally refused operations exited 1; these expected refusals count as passing their own gates, not successful writes.

| Capability | Observed result |
|---|---|
| Baseline strict lint, view/index rebuild, exact fact query | Exit 0; fixture facts visible |
| Unauthorized reviewer | Exit 1; policy diagnostic |
| Synthetic authorized review and proposal apply | Exit 0; exactly one target fact |
| Proposal apply retry | Exit 0; target SHA-256 and matching journal count unchanged |
| Transaction commit and same-key retry | Exit 0; same transaction returned, target hash unchanged, one matching journal |
| Post-write strict lint and fact query | Exit 0; both new synthetic facts visible |
| Reviewed proposal altered after approval | Apply exits 1 with hash diagnostic; target remains absent |

The permitted reviewer identity is a synthetic fixture role. This is not authentication of a real human. The final disposable proposal was deliberately invalidated for the stale-review test; no final all-vault clean-lint result is claimed for that state.

## Independent parent audit

Before cleanup, the parent confirmed the checkout revision, both saved fact hashes against worker records, and absence of the rejected target. The parent independently repeated the approved proposal apply: exit 0, all 11 checked Markdown fact/transaction files byte-identical before and after. Six independent parent checks passed. Earlier worker before/after evidence is retained separately; parent verification does not retrospectively observe every prior command.

Exact commands, effective environment conventions, exit codes, output hashes and artifact counts are in [metadata-only evidence](../../eval/reader-pilot/obsidian-memory-offline-smoke-2026-09-29.json). Inherited PATH values were replaced with a portable venv-prepend description plus hashes. No upstream code or raw logs are published. The exact temporary checkout, copied vault and venv were removed after terminal execution and parent audit; no background service was started.

## Consequences for Graphmory

The tested toolkit demonstrates useful deterministic write mechanics: idempotency keys, review bound to content hashes, and refusal after approved content changes. These are candidates for Graphmory workflow design, not evidence of superior answer quality. A next matched experiment should use identical synthetic facts/updates/questions but adapt each tool to its documented schema, label model/human/tool responsibilities, and independently verify canonical state and answer support. Do not compare this offline duration or 11 gates to Graphmory's model-backed native workflow duration/gates.

The pinned tree has no identified license file; license remains unverified and no upstream source was copied into Graphmory. A-MEM is a separate model-backed retrieval/organization candidate, not an equivalent approved MemoryPatch writer; its source findings are recorded in [the feasibility note](../research/amem-workflow-feasibility-2026-09-29.md).
