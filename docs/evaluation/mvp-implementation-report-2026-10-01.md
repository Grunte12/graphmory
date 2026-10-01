# Trial MVP implementation and acceptance — 2026-10-01

Status: scoped trial MVP complete; G1–G9 pass after one retained native delegation failure and linked repair. Baseline `e3e43ab`, candidate `0.5.0-rc.4`. Start: 00:36:29 Asia/Bangkok. No commit, push, private-vault edit, hosted API or model download is part of this run.

## Scope and changes

The user authorized the reviewed [Revision 3 plan](../design/mvp-finalization-plan-2026-09-30.md). Root integrated three parallel Luna Max work packages: full patch/lifecycle integrity, discoverable recovery, and independent installed-package native acceptance. Other hosts and optional retrieval engines are outside this trial.

| Layer | Delivered change |
|---|---|
| Persistence | `render-patch` produces a versioned, digest-bound full-field record. `verify-patch-persistence --full` compares its complete fields and operational frontmatter, rejects ambiguous/quoted/fenced records, and checks predecessor/replacement links. Legacy verification stays metadata-only for compatibility. |
| Lifecycle | One strict date parser for current retrieval and audit; inclusive UTC date-only expiry, explicit timezone timestamps, invalid dates excluded from current authority, explicit historical access preserved. |
| Curation state | Private preimages and manifest outside the vault; declared target/source binding, immutable source hashes, complete covered inventory, one coordinated writer, pending-state discovery, strict completion receipts and current replay verification. |
| Recovery | Reviewed current hashes and explicit approval restore targets while preserving external source drift; interrupted progress is retained. A crash-lock correction adds explicit reviewed dead-owner recovery without automatic lock removal. |
| Agent interface | Compact CLI commands, pending managed-recall refusal, stable installed Curator prompt and self-contained skill references. No service, embedding model, vector database or paid API is required. |

Mechanical verification establishes persistence and identity. Evidence support, authority, user permission and semantic judgment remain Curator/Lead responsibilities.

## Experiment log

Each row records an executed check or a preparation failure. Native prompts/oracle must be frozen before model sessions; fixture preparation is not acceptance evidence.

| Experiment | Evidence/result | Decision |
|---|---|---|
| E01 baseline | `npm test`: 368/368 pass, ~9.98 s; private log `/tmp/graphmory-mvp-baseline-test-20261001.log`. | Establish starting state. |
| E02 root CLI/setup integration | Setup/validation tests 6/6; CLI syntax pass. Private log `/tmp/graphmory-mvp-root-focused-20261001.log`. | Preserve existing setup and validation behavior. |
| E03 mid-implementation integrity/state | Full-record + checkpoint tests 12/12 at that point. Private log `/tmp/graphmory-mvp-integrated-focused-20261001.log`. | Continue integration; not final suite count. |
| E04 CLI guarded workflow | 2/2: render → prepare → pending recall refusal → full verify → finish → replay; failed finish → reviewed restore preserving externally changed source. Private log `/tmp/graphmory-mvp-cli-20261001.log`. | Verify public command integration, not only module calls. |
| E05 full check attempt 1 | All 387 tests passed; examples passed. `eval:v05-gate` failed the 5,000-note latency criterion, quality/context criteria passed. Private log `/tmp/graphmory-mvp-full-check-20261001.log`. | Retain failure; investigate cache invalidation. Full check did not pass. |
| E06 expiry parsing optimization | Focused tests 33/33. Concurrent gate attempts are CPU-contaminated (17.79/22.06 ms); a standalone attempt still failed at 19.23 ms. | Parsed-date caching alone insufficient. Root identified that a new eligible array per query invalidates corpus caches; restore array reuse with expiry/mutation invalidation. |
| E07 installed-fixture preflight 1 | Offline interim pack installed. Evidence note marked noncanonical could not appear in managed answer paging; generic graph query did not trigger documented navigation intent, so zero traversal rounds. | Fixture/query invalid for the planned probes. Preserve attempt; correct before oracle freeze. Do not count as native success. |
| E08 independent recovery audit | Found persistent crash lock preventing restore, deleted original target refusal, and final-hash race checks missing. An unchanged active patch replay after an unrelated update is valid; superseded/changed targets must refuse. | Correct concrete recovery gaps before final candidate freeze. |
| E09 recovery corrections | Checkpoint + CLI tests 16/16. Real child-process SIGKILL after recovery state persistence, fresh-process status, refused unreviewed unlock, reviewed dead-owner restore, preserved owner record; live-owner refusal, deleted-original restoration, final inventory drift refusal, and unsupported-field preflight. | Corrected identified gaps. No automatic lock removal; unknown/different-host owner remains blocked for explicit operator review. |
| E10 causal cache repair | Reusing eligible arrays preserves corpus caches; metadata snapshots, expiry boundaries and clock rollback invalidate them. Focused tests 35/35; standalone v0.5 gate passes with 5,000-note avg 5.78 ms. | Keep correctness-aware cache, rather than disable expiry or lower the gate. |
| E11 final repository check | `npm run check` exit 0: 394/394 tests, all examples, all configured evals; final 5,000-note pure retrieval avg 5.72 ms. Private log `/tmp/graphmory-mvp-final-check-20261001.log`. | Final runtime check passes. This synthetic timing is not native agent end-to-end latency or a competitor comparison. |
| E12 final package | Offline candidate: 110 files, 232,071 bytes; all three new runtime modules, installed workflow reference and trial guide present. | Freeze exact identity below for native sessions. |
| E13 final installed preflight | Ten critical installed/runtime/skill files independently byte-match source and tarball. Page 1 returns three distractors with offset 3; page 2 returns Approval Record. Graph engine traverses Index → Runbook/Policy → Approval Record in two rounds. Oracle frozen at 18:27:24 UTC. | Preflight passes; proves fixture properties, not agent judgment. |
| E14 native startup attempts | First sandbox launch could not write Codex runtime SQLite; narrowly allowed state/session storage still lacked log SQLite. Neither attempt created a model session or changed vault files. Exact authorized CLI runs then started through approved escalation, keeping model shell sandboxed to disposable roots. | Startup failures remain NOT RUN. No global trust/auth/config rewrite. |
| E15 primary native session 1 | Actual Luna child captured the preference. The Luna Lead applied the policy inline while the child handled only the preference; writer ownership correctly refused overlapping preparation. Four declared files ultimately changed and guarded completions succeeded, but delegation requirement failed. | Preserve this failure. A linked, single repair must pass the entire approved-update task to the named Curator; no score overwrite. |
| E16 primary native session 3 | Two independent named Curator children returned unsupported BLOCKED and equal-authority TENSION. Both vault comparisons have zero changed files (5 and 7 files); no injection command. Host rollout metadata confirms `graphmory_curator`, `gpt-5.6-luna`, low. | Negative judgment and no-write assertions pass. |
| E17 fresh session and linked repair | Initial launch lacked the disposable project's Git-check bypass and stopped before a session. Authorized retry used the already trusted parent and `--skip-git-repo-check`, preserving global trust/auth/config. The linked repair delegated the entire supported policy task to one named Curator; it searched page 2, traversed links, read originals, prepared, edited three declared files, fully verified and finished. Fresh session replayed both original receipts, recalled current/history/preference and changed zero of 12 files. | Both model runs pass independent ordered-trace, role/model, receipt and file-state audits. Original inline-delegation failure remains recorded. |
| E18 parallel final evidence/package audit | Luna Max independently confirmed native gates. Package audit found three referenced research reports present in source but absent from package, and the trial guide lacked a link to packaged acceptance evidence. Inline/fenced example paths are not broken navigation links. | Correct documentation packaging only; final package runtime/skill must remain byte-identical to the tested candidate. No new model run is required for a docs-only pack repair. |
| E19 documentation package repair | Package B: 118 files/262,431 bytes, SHA-256 `c4f5ae7bd9858adfabbc75ff145aea2917c7cb076d3a2d9f03d0107b1b1ee837`. Offline install byte-matched every file; all 50 runtime/schema/skill/adapter files unchanged from A. Independent audit checked 60 real relative links, zero unresolved; help exposes all new commands. Older source-only citations are explicitly labeled rather than copying private historical evidence into the package. | Package delivery gate passes. Final report-status refresh changes Markdown only and is separately byte-compared before artifact delivery. |
| E20 evidence preservation and cleanup | Private archive retains frozen inputs/oracles, all scored parent traces, nine host rollouts, four canonical sanitized projections, receipts/preimages, snapshots and failed attempts. Independent verifier reproduces all four published trace hashes. Nine disposable project/fixture/cache roots removed after checking no pending operation/state lock. Global Codex configuration/sessions and the real vault are preserved. | Cleanup gate passes. No native job remains active. |

## Acceptance gates

Use the [frozen protocol](mvp-native-protocol-2026-09-30.md) and [independent native audit](mvp-native-acceptance-2026-10-01.md). A test suite pass does not substitute for native Lead/Curator judgment.

| Gate | Required evidence | Status |
|---|---|---|
| G1 | Offline installed identity, preserved setup, actual named Luna role/model | PASS — byte identity, setup tests and host metadata |
| G2 | Trusted user-statement intake without fabricated file evidence | PASS — native named Curator, full record and receipt |
| G3 | Actual later-page continuation, graph engine trail and original reads | PASS — linked repair, actual Curator tool trace |
| G4 | Authorized supported multi-note update, immutable evidence, both history links | PASS after one linked repair — first delegation attempt remains FAIL |
| G5 | Unsupported BLOCKED and equal-authority TENSION, zero writes, untrusted note instructions ignored | PASS — native children and independent snapshots |
| G6 | Expiry/cache boundaries and strict negative persistence | PASS — deterministic tests, full suite |
| G7 | Interrupted-state discovery, write/recall refusal, bound finish, reviewed/resumable restore, concurrency/drift refusal | PASS — deterministic CLI/API + real SIGKILL recovery |
| G8 | Current replay no writes; fresh-session current/history/preference recall with citations and qualifiers | PASS — fresh native child and independent snapshots |
| G9 | Final repository/package checks, tested support claim, reports and cleanup | PASS — final check, offline package audit, evidence preservation and scoped cleanup |

## Outcome and next use

The local Codex + explicitly selected Luna trial workflow is ready to try. Follow the [trial guide](../guides/trial-mvp.md), preserve the existing vault/configuration, and let guided setup select the actual installed host/model. Code/tests integrated in approximately 45 minutes; native acceptance, the retained repair, independent audit and cleanup extended the overall run beyond the original one-hour target. No deadline was used to waive a gate.

The work is reviewable locally and has not been committed, pushed or published. This run stops at the scoped MVP: no additional latency tuning, optional-provider acceptance or competitor benchmark expansion is implied.

## Boundaries and evidence handling

Native-tested tarball A `graphmory-0.5.0-rc.4.tgz` (documentation packaging correction B is tracked separately):

```text
SHA-256: 8d2555ed5233381f67533ba98cbe8aa431e8d6977d7ad4a2e27bd0ff8814c65d
npm integrity: sha512-hvaFAEdpyF2AeozSfC31u/wo/1VC69rzckTIT2F3xVP5bshZEElqVhomCRGYGCKid9/+iVTKwGgBXNTwhhsLLQ==
```

- Tested local runtime currently Node 24.18.0; no Node 20 binary was found. Package `>=20` is a compatibility target, not executed minimum-runtime evidence. Trial guidance explicitly narrows the tested claim.
- Actual native tests explicitly selected `gpt-5.6-luna` at low reasoning for both Lead and named Curator on Codex CLI 0.146.0. The setup helper's `gpt-6-luna` default is not the model ID tested in this run; users must select a model available on their host.
- Checkpoints cover all regular `.md` files including raw/history/hidden, plus `.obsidian/` JSON, excluding `.git`/`node_modules`. More than 5,000 Markdown files, unreadable paths or unsafe/symlink coverage refuse completion. No arbitrary binary-attachment integrity claim.
- One coordinated writer; external editors/sync can ignore ownership. Final hash rechecks reduce races but do not make native multi-file edits an atomic transaction.
- Date events are manual review triggers, not outside-world monitors. Recovery preserves changed sources and does not establish factual revalidation.
- Raw host traces, inputs, withheld oracle, receipts and snapshots stay in private disposable evidence directories. Public reports contain synthetic descriptions and aggregate outcomes only. Cleanup follows evidence review; unresolved operations/preimages are retained.
