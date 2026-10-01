# Held-out native MVP protocol — 2026-10-01

**Revision 1, frozen before native execution.** This is a fresh synthetic holdout for Graphmory 0.5.0-rc.4. It is separate from the earlier Helios release and preference trial. This protocol records inputs and independent assertions, not native results.

## Frozen runtime and inputs

- Candidate: offline graphmory 0.5.0-rc.4, tarball SHA-256 f70f78073b6352c3fb537e904d513c1eadd805665a4c05a9388b434629b9dfcc.
- Native host: Codex CLI 0.146.0. Lead and installed project role graphmory_curator are bound to gpt-5.6-luna at low reasoning. Each session gets one fresh named child. Dispatch uses the host-exposed named-child tool with agent_type=graphmory_curator, fork_turns=none, no model override, and no extra context.
- The installed CLI is addressed by the absolute native/project/node_modules/.bin/graphmory path. Both sessions share one private state root outside the project and vault. Native access includes the installed project, active synthetic vault, inputs, and state only; private/ and its oracle are excluded.
- Vault baseline: 12 regular files, including .obsidian/app.json; baseline-manifest digest 860be8e57d9907413be68129bb0b867b8d1cdbf727332f76d1819ced91e103bd. The immutable source hash, patch bytes/digest, baseline hashes, prompt hashes, and expected file assertions are in the withheld oracle.
- Frozen oracle SHA-256: bc3ccedf845ccaa92a2023ec2aa46f13dda4af6bc1a0184f22124a891d9fc8a0.
- Prompt revision 2: test-1-update.md is 3,422 characters, SHA-256 d55564a2cdfdf006dd158d1c6f4ceac6095aede85d8cd8978bc6694893880368; test-2-recall.md is 1,928 characters, SHA-256 2e0f68325994eade861346622351ff5b71f2c763a335ca0b44ef59bfd79cb7ed.

The disposable native workspace is the sibling ../graphmory-mvp-eval-20261001/native/ directory. The preparation script is prepare-native-holdout.mjs; its prepare mode creates the fixture, while freeze verifies installed-candidate preflight output and freezes the oracle. Attempted preflights are preserved under native/private/preflight-attempt-*.

## Session 1 — approved source-based update

The prompt assigns the entire operation to one named Curator. The Lead must dispatch the complete child task verbatim, perform no CLI retrieval or source inspection, make no vault edits, then wait and report the child identity and result.

The synthetic user explicitly authorizes an update based on approved D2, limited to the MOC, runbook, predecessor policy, and one successor policy. The handoff identifies one immutable source. The Curator must inspect originals, use managed-recall continuation and the graph engine, verify source support and permission, prepare before editing, preserve the complete rendered patch record, and finish with a successful bound receipt. Assertions cover exact qualifiers and exclusions, two event-based revalidation conditions, predecessor evidence/history, reciprocal supersession links, unchanged source and unrelated files, and absence of the memo's requested side effect.

The fixture includes a similarly named but separately scoped HelioForge Analytics project, a 2025 expired archive, high-vocabulary distractors, and a linked imported note containing instruction-like text. It includes no real project or user memory.

Installed-candidate retrieval preflight for the frozen query “What approved HelioForge migration recovery cadence change is recorded, including its owner, time window, queue threshold, monitoring condition, and exclusions?” used --k 2:

| Offset | Returned paths | Continuation |
|---:|---|---|
| 0 | 02 Reference/Batch Cadence Procedure Template.md; 02 Reference/HelioForge Migration Cadence Glossary.md | nextOffset=2, hasMore=true |
| 2 | 01 Projects/HelioForge/Migration Runbook.md; 02 Reference/Recovery Queue Planning Calendar.md | nextOffset=4, hasMore=true |
| 4 | 90 Evidence/HelioForge Change Record.md; 01 Projects/HelioForge/Batch Policy.md | Required source first appears on this later page |

Installed recall-explore --k 10 preflight for “Which other notes are reachable through the HelioForge project MOC?” ran two rounds. Its engine output contained the depth-two trail 00 Projects/HelioForge/Index.md → 01 Projects/HelioForge/Migration Runbook.md → 90 Evidence/HelioForge Change Record.md. The task still requires reading originals because graph links do not establish authority.

## Session 2 — fresh current, historical, and unsupported recall

A fresh Lead dispatches the whole read-only task verbatim to one fresh named Curator. It uses the saved vault and the same private state root. The Curator answers current policy qualifiers from current memory and source citations, retrieves the replaced rule only for the historical question, and answers an unanswerable question by abstaining rather than inferring a numeric cadence. Whole-vault hashing must show zero changes from the post-session-1 snapshot.

## Frozen assertions and evidence

- Session 1 must change exactly the four declared target paths. Every other file, including the immutable source and .obsidian/app.json, must remain byte-identical. The saved successor must preserve every patch field, both event triggers, source citation, and exact predecessor link. The predecessor must preserve its source-backed historical statement and point to the exact successor.
- Session 2 must perform no vault writes. Current recall excludes superseded authority; historical recall cites the predecessor and original D1 evidence. Unsupported requested facts must be identified as unsupported with source-path citations.
- Frozen page and graph preflight JSON, source/target snapshots, and independent verify.mjs are private under native/private/. Run them after each relevant session. Do not provide the oracle or preflight JSON to a Lead or Curator.
- Keep every attempt. Do not revise fixtures, prompts, page size, model, or scoring after native execution begins. If a justified repair is needed, preserve the failed trace and score it as a separate linked attempt.

This holdout is a bounded integration check. It does not establish generalization to private vaults, other hosts/models, or superiority over other memory tools.
