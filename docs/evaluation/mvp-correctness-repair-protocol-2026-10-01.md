# MVP correctness repair — acceptance protocol

Date: 2026-10-01. Contract frozen before repair acceptance; candidate/fixture manifests are frozen separately before each installed run. Proposed checks are not results.

## Claim and scope

Follow [the repair plan](../history/mvp-correctness-repair-plan-2026-10-01.md), gates R1–R13. Establish the scoped Codex/Luna workflow: supported update, exact full persistence and reciprocal history, completed receipt, fresh current/history/unsupported recall, and safe handling of pending authority. Preserve real vault/global config and all earlier failed runs. No optional models/providers, ranking tuning, competitor benchmark, commit or push.

Baseline captured before repair at `../graphmory-mvp-repair-20261001/baseline.json`: Git HEAD and pre-existing dirty tree plus 453 source/test/guide/manifest file hashes. Baseline `npm test`: 395/395 PASS, zero skipped (`baseline-test.log`). Candidate version for new artifacts is `0.5.0-rc.5`; the version name alone is not package identity or readiness evidence.

## Deterministic checks

1. Valid linked superseded history, including the actual Runbook shape without receiver metadata, is distinguished from an independent self-stale assertion. Broken/ambiguous/expired/unproven relations retain findings. Valid exact cross-folder chains remain supported.
   R4 additionally includes the reproduced pre-existing false negative `TENSION` + `No decision yet.`: a bare or negated keyword is not an affirmative decision path. Pair it with documented explicit positive markers. This refines the existing missing-decision invariant; it does not change native semantic gold.
2. Every finite content-producing agent route refuses ordinary reads under pending state, before provider calls and content output. Operation-bound recovery reads are limited to manifest paths and correctly identify source drift and partial target bytes. Diagnostics remain non-authoritative and body-free.
3. Ordinary first-use/legacy reads remain compatible; prepare/finish/restore internal readers are not self-blocked. A state-token change during retrieval discards assembled output, including the normal prepare→finish transition.
4. Compact finish failures name affected paths and kinds, preserving generic error codes and pending state. No note/source values or preimage bodies in errors.
5. Reproduce legacy checkpoint compatibility using the actual installed rc.4 archive to prepare a new equivalent operation. Use new candidate finish and, on an independent equivalent fixture, reviewed restore. No manual real-root/digest rebinding; the original saved failed operation is untouched.
6. Focused cases, existing safety behavior and full `npm run check` must pass. Record commands, candidate/runner identities and independent mutations/state assertions for each experiment. Preserve any initial FAIL and distinguish a justified scorer repair from a runtime change.

## Installed native checks

After deterministic acceptance, pack and offline-install the final candidate into a fresh disposable project with optional dependencies omitted. Verify all archive files and installed Curator skill/role. Freeze candidate manifest, prompt hashes, fixture baseline, semantic oracle and launch settings in private evidence. Candidate hashes must not be inherited from a prior run.

Use Codex CLI and the known-working Luna configuration for both Lead and named `graphmory_curator`; validate actual role/model/effort in parent and child raw metadata. The Lead dispatches and waits; it does not perform inline memory writes. Use one fixed state root across every call in each run.

Three primary sessions:

| Session | Required outcome |
|---|---|
| Approved source-based update | Relevant later-page evidence and actual graph trail/originals are used; exactly approved targets changed; source/unrelated files unchanged; full fields/lineage/qualifiers/exclusions are exact; successful matching receipt and complete state. |
| Fresh clear recall | Current and historical answers preserve scope and citations; excluded/unsupported quantity abstains; no files changed; no state substitution. |
| Fresh pending refusal | A separately interrupted operation is found. Curator reports BLOCKED/partial edits without current-authority answer from direct/raw/native reads, and makes zero writes. |

At most one justified linked repair; preserve the primary failure, freeze its repair input and explain the changed failed condition. No repeated blind attempt, weaker model/semantic gold substitution, or deletion of pending state to get a PASS. Host/model unavailable means NOT RUN.

## Decision rule and limits

Separate semantic correctness, file integrity, source identity, receipt/state, actual delegation, and pending authority control. Write success requires their conjunction; read-only hashes or a plausible answer do not establish workflow success. Safe refusals count as expected safety success, not as applied updates. Report partial edits accurately even when finish refuses.

CLI gating is a cooperative boundary, not native filesystem isolation. Deliberate alternate `--state-root`/environment substitution and concurrent deletion of terminal state records are outside the token guarantee; installed guidance forbids substitution and trace scoring rejects it. External edits after the last check are not atomic isolation. Passing this synthetic trial establishes bounded host/model acceptance, not unattended production safety or superiority to other tools.

Retain raw sessions/oracles/preimages in private evidence outside the repo/package; publish sanitized Markdown reports. Stop when required gates pass and the consolidated report is complete. If a gate fails or is unexecuted, report it explicitly instead of marking the MVP ready.
