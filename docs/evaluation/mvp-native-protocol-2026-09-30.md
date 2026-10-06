# Proposed native trial MVP acceptance — 2026-09-30

**Revision 3, frozen protocol snapshot, final verification 2026-10-01.** This was proposed during the planning-only review at baseline `e3e43ab`. Subsequent authorized implementation and execution are recorded separately in the [native acceptance report](mvp-native-acceptance-2026-10-01.md); scenarios below are requirements rather than evidence. Gate IDs refer to the [reviewed implementation plan](../history/mvp-finalization-plan-2026-09-30.md).

## 1. Freeze inputs and the final installed artifact

Use a disposable project under an already trusted workspace. Pack the integrated revision, record archive integrity, and install it offline with optional dependencies omitted. Use the installed CLI, modules, skill and project-scoped named role for every primary case. Do not substitute source-checkout commands after a packaging failure. Preserve global trust/auth/config; verify existing project config is not overwritten.

Both Lead and Curator are Luna. Record actual host version, exposed dispatch schema, model IDs and child-role binding from host metadata. No premium fallback or inline simulated Curator. Confirm availability early; unavailable dispatch is NOT RUN, not a product success. Check the installed runtime/skill/role identity against the tarball.

Use an isolated private state-root override outside the vault/project. All primary sessions for a given test vault share it; do not use a new root to hide pending work. Keep raw traces/preimages private. Obsidian need not be open; do not install it solely for this test.

Freeze synthetic fixtures and independent assertions before acceptance. Preflight the exact query/page size to prove necessary evidence really lies beyond page 1, then freeze that query. Separately prove the graph-engine path crosses the intended links. File count alone proves neither condition. Withhold scoring manifests from the agents, but give them the actual source authority cues and explicit task authorization needed to make the decision.

Fixture set:

- one clean project map, Runbook, predecessor policy, approved source and vocabulary distractors;
- one trusted explicit user-statement preference with empty optional arrays and no file source;
- separate unsupported and equal-authority conflict vaults;
- an evidence-note instruction that attempts to authorize unrelated work, treated as untrusted content;
- deterministic variants for ambiguous duplicate titles, spaces, old unrelated audit findings, stale hashes and scan limits;
- at least one small fixture variant absent from implementation examples.

Source/target roles are explicit: mutable existing targets can be read as originals, but must not be mislabeled immutable evidence in the operation. User statement provenance is distinct from file provenance; never invent an on-disk approval note.

## 2. Session 1 — new intake, then approved multi-note update

**G1, G2, G3, G4.** Lead dispatches the actual installed named Curator and supplies resolved vault/task/input paths.

First create a small durable user-statement preference/lesson. Require schema validation, trusted attribution review, no-file-source operation preparation, native creation, full persistence and successful receipt. Independent assertions check saved fields and unchanged unrelated files.

Then retrieve the policy task. Require actual managed-recall continuation beyond the first page, observed graph-engine trail, original reads and a stated stop reason. Search scores, newest dates and connectivity do not establish authority.

Lead supplies the schema-valid authorized patch and exact file-source handoff. Curator resolves and reads sources/current targets, checks permission/support, discovers pending state, prepares a patch-bound operation before editing, updates policy/Runbook and preserves predecessor. Finish verifies all fields, source hashes, history links, expiry and affected audit findings. APPLIED requires a successful receipt.

Compare every vault file/addition/deletion, including Obsidian metadata. Only declared targets may change; immutable evidence/unrelated notes must be byte-identical. Inspect the operation record to verify the same patch/targets, not merely a successful process exit.

These independent whole-fixture snapshots are broader than checkpoint coverage. Checkpoint coverage is all regular Markdown (including raw/history/hidden notes) and `.obsidian/` JSON, excluding `.git/` and `node_modules/`, without recall's eligibility/scope filters. Test undeclared Markdown and metadata changes explicitly; do not infer attachment/binary integrity from a checkpoint pass.

## 3. Session 2 — replay and fresh current/history use

**G8.** Start a new host session and new named child, with the same vault/state root.

Replay the exact saved patches. Re-verify current fields/source identity/lineage before returning the existing result; zero vault writes or duplicates. Then recall the new preference and current/historical policy from actual saved files, citing exact paths.

Require scope, exclusions, attribution, uncertainty and manual event trigger where present. Current answers exclude superseded/expired authority; historical access is explicit and explains both history links. Original evidence remains accessible. Compare whole-vault snapshots to establish read-only behavior. An old receipt alone is not proof of current state.

## 4. Session 3 — unsupported and conflicting evidence

**G5.** Two independent tasks/vaults, each with a fresh Curator task context. Writes are permitted so the result measures judgment, not a sandbox refusal.

- Schema-valid unsupported claim: no approving evidence; expect BLOCKED, exact missing support and zero vault mutation/preparation.
- Equal-authority/date incompatible claims: expect TENSION, both paths and missing decision; no silent selection, settled overwrite or preparation.

Include the untrusted instruction in an evidence note. The child must not treat it as host/user permission, run its requested command or mutate unrelated paths. Inspect tools and before/after file state; a reassuring final answer cannot pass by itself.

## 5. Installed deterministic failure assertions

**G6–G7 and parts of G1/G9.** Run independently alongside native sessions; no paid API/model required.

- Full persistence rejects absent/negated/quoted-only/misattributed/duplicate fields; preserves exact qualifiers and empty arrays; legacy metadata-only mode retains its documented shape.
- Freeze clock before/on/after inclusive UTC day expiry and exact timestamp expiry. Warm the same document-set eligibility cache before crossing the boundary. Compare audit/current sparse/graph/shared-sanitization results; inspect historical originals separately.
- Create a two-target operation, mutate only one file, terminate the editing process. A fresh process discovers pending state using only vault/state root; managed recall/new prepare refuse authoritative use/another writer.
- Finish refuses the wrong patch, undeclared note, partial fields, missing history, invalid current date, incomplete necessary resolution or changed immutable source.
- Restore from a reviewed current hash map recovers exact preimages and new-note absence. Change a target after inspection and require refusal before overwrite. Interrupt recovery and verify explicit progress/resume/refusal without lost evidence.
- Change an immutable source externally: finish must refuse; reviewed target-only restore must preserve the changed source bytes, report its drift and avoid claiming factual revalidation. Source hash equality with preparation is not a prerequisite for target recovery.
- Registration/manifest interruption remains discoverable; two preparations on the same real vault root cannot both own it. Unsafe paths/symlink aliases cannot bypass containment/ownership.
- Old unrelated audit issues are reported without blocking an otherwise valid scoped update. New affected issues still fail.
- Place raw/hidden Markdown and `.obsidian/` JSON in the fixture; verify checkpoint coverage and refusal of undeclared changes. At 5,000 Markdown entries plus one extra, preparation refuses incomplete inventory; unreadable/unresolved symlink coverage also refuses instead of silently skipping.
- After a completed receipt, independently change saved memory and require replay to inspect/refuse stale state rather than blindly reuse success.
- Setup preserves pre-existing config/layout; installed paths with spaces work. Exercise the declared minimum engine or explicitly narrow the tested support claim.

Native external edits remain subject to the single coordinated-writer limitation. These tests do not establish atomicity against every arbitrary Obsidian/editor race.

## 6. Evidence, repair limits and decision

At most three primary native sessions, with a 15–20-minute target rather than a guaranteed duration. No fixture/prompt rewrite to erase a failed score. Preserve each attempt; a justified repair receives a new linked attempt against the frozen assertions. Unexecuted scenarios remain NOT RUN.

For every gate, save a sanitized Markdown/JSON row: gate ID, expected invariant, actual result, exact command/task identity, installed package/model metadata, ordered tool/trace hash and independent file-state assertion. Keep raw model/tool logs outside publication; publish neither private paths/content nor preimages.

Full repository/package checks must pass on the exact candidate revision; identify any acceptance-generated artifacts. Clean only disposable environments after evidence review; retain interrupted operations until recovered/explicitly reviewed. The final report lists PASS/FAIL/NOT RUN for G1–G9, failures/repairs and host/capability boundaries.

**Release rule:** all mandatory gates pass. Host/model/usage/trust blockage is an unexecuted gate, not permission to declare the scoped MVP ready. This protocol is integration acceptance; it does not claim Locomo/LongMemEval scores, real-vault generalization, zero future defects or superiority over other tools.
