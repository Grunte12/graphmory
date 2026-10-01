# MVP deterministic safety holdout — 2026-10-01

## Frozen protocol

**Protocol:** `graphmory-mvp-holdout-safety-2026-10-01-v1`

**Protocol state:** frozen before evaluation execution

**Candidate:** `graphmory@0.5.0-rc.4`, assigned offline tarball `graphmory-0.5.0-rc.4.tgz`

**Candidate SHA-256:** `f70f78073b6352c3fb537e904d513c1eadd805665a4c05a9388b434629b9dfcc`

**Runner:** [`scripts/eval-mvp-holdout.mjs`](../../scripts/eval-mvp-holdout.mjs)

This is a new deterministic evaluation of the assigned packaged artifact. It does not reuse the older native-session score or convert a repository test count into holdout evidence. The evaluation extracts the tarball into a fresh run directory and calls its packaged CLI and exported ES modules directly. Every vault and checkpoint state root is synthetic, fresh, and outside the source checkout. The runner uses a local curator config, no live model or network calls, no private vault, no user-level config, no npm install, and no optional dependency download.

### Public contract and oracle source

Expected results come from the shipped guarded workflow and trial guide, especially [the packaged Curator workflow](../../skills/memory-curator/references/trial-workflow.md) and [the local Curator trial guide](../guides/trial-mvp.md). Those documents require read-only recall, current versus explicitly requested historical retrieval, pending-operation blocking, separate immutable sources and declared mutable targets, full persistence verification, a successful completion receipt before APPLIED, exact replay without duplicate writes, and reviewed target-only restoration that preserves and reports source drift. The [Memory Patch contract](../../schemas/memory-patch.schema.json) and CLI help define supported patch fields and command inputs.

The oracle uses public outcomes and independent fixture inspection: complete file inventories and SHA-256 hashes, exact byte reads, decoded CLI/API results, and direct reads of persisted manifests and receipts. Internal flags alone do not establish a pass. No assertion is changed after execution begins. Any unexpected result stays in the run record.

### Frozen tasks and expected outcomes

| ID | Scenario | Expected result and independent oracle |
|---|---|---|
| H01 | Full patch round trip | A valid multiline Markdown patch completes after the declared edit. Independent reads preserve the original source bytes and existing target context; the record retains multiline claim/rationale and file provenance; receipt target/source hashes equal raw-file hashes; the only changed vault path is the declared target. |
| H02 | Scope and current/history retrieval | Scoped recall returns the current note and no outside-scope note. Superseded memory stays out of current recall and appears only with the explicit historical option. The vault inventory stays byte-identical. |
| H03 | Stale and expired memory | A live note is a positive control. A `stale` note and an `active` note whose date-only `valid_until` is in 2000 are absent from current recall on the frozen evaluation date, 2026-10-01. The vault stays byte-identical. |
| H04 | Equal-authority disagreement | Both in-scope `tension` notes remain available as candidates with tension status; an out-of-scope competing note stays absent. This checks retrieval evidence only; it does not score model conflict judgment. |
| H05 | Invalid patch refusal | Schema validation and checkpoint preparation both refuse a patch without provenance. The synthetic vault remains byte-identical and the checkpoint state root is not created. |
| H06 | Immutable source drift | After preparation, an injected source edit causes finish to refuse with `SOURCE_CHANGED`. Independent snapshots before and after the attempted finish are equal, and the operation remains pending. |
| H07 | Undeclared note drift | After preparation, an injected edit to an undeclared Markdown note causes finish to refuse with `UNDECLARED_DRIFT`. The refusal itself changes no vault file and the operation remains pending. |
| H08 | Simultaneous writers | Two separate CLI processes prepare different patches against one vault/state root at the same time. Exactly one preparation succeeds and the other refuses as busy or pending; the vault remains byte-identical and one pending operation is recorded. |
| H09 | Reviewed recovery | A stale independently computed target hash is refused without file changes. A fresh independently read hash map is then reviewed and approved; restoration returns an existing target to its exact original bytes, removes a target that was absent at preparation, changes only declared targets, and reports while preserving injected source drift. |
| H10 | Receipt and replay integrity | A complete operation's digest is independently recomputed from canonical JSON; persisted receipt target/source hashes equal independent file hashes. Exact replay returns the same operation with no vault change or duplicate operation. After an external target edit, replay refuses with `REPLAY_REVERIFY_FAILED` and makes no further vault change. |

### Scoring and retained evidence

- **Task pass:** every assertion for that task matches the frozen expected behavior. A refusal required by the public contract is a pass when its reason matches the expected guard.
- **Refusal false positive:** a command/API action expected to succeed refuses. This is counted at the action level, including a valid recovery or replay substep.
- **Refusal false negative:** an action expected to refuse is accepted. This is reported separately from ordinary assertion failures.
- **Unexpected vault mutation:** any tool-attributable file delta outside the case's explicit target allowlist, or any mutation in read-only/refusal cases. Fixture edits used to inject drift are snapshotted before the command under test and are not attributed to the tool.
- **Denominators:** report all 10 tasks; also report the number of expected-refusal actions, expected-refusal passes, false-positive refusals, false-negative refusals, and unexpected vault paths.

The runner writes `progress.json` after every task and a final `result.json` under `../graphmory-mvp-eval-20261001/private-safety/<run-id>/`. It does not delete earlier evidence or reuse a run directory. The output includes each task's status, command output, independent hashes, and before/after inventories; all fixture contents are synthetic.

## Results

### V1 run

Command: `node scripts/eval-mvp-holdout.mjs --run-id holdout-2026-10-01-01`

Runtime: Node `v24.18.0`; candidate tarball SHA-256 matches the frozen `f70f7807…b9dfcc` artifact.

Runner SHA-256: `63dc6c4c61917cef022058dea6c6644a66b812274b8695270104354efd4c2f26`.

| Measure | Result |
|---|---:|
| Tasks | **9/10 passed; 1 failed** |
| Expected-refusal actions | **7/7 matched** |
| Refusal false positives | **0** |
| Refusal false negatives | **0** |
| Unexpected vault mutation paths | **0** |

| Task | Result |
|---|---|
| H01 — full patch round trip | **FAIL** — frozen raw-text assertion expected literal `**three replicas**` in the note bytes. |
| H02 — scope and current/history recall | PASS |
| H03 — stale and expired memory | PASS |
| H04 — equal-authority tension candidates | PASS |
| H05 — invalid patch refusal | PASS |
| H06 — immutable source drift refusal | PASS |
| H07 — undeclared note drift refusal | PASS |
| H08 — simultaneous writers | PASS |
| H09 — reviewed target restoration | PASS |
| H10 — receipt and replay integrity | PASS |

H01 had already passed CLI full-persistence verification and checkpoint completion. The source byte-equality assertion and pre-existing target-context assertion also passed, and the whole-vault delta contained only the declared target. The failing assertion compared the raw target text with unescaped Markdown. The saved record uses Markdown-safe serialization (`\u002a` for the stars and JSON `\n` for the line break).

The failure remains scored as **FAIL** in the v1 result. A separate read-only diagnostic then parsed the saved owned-record rows as JSON and compared claim, rationale, and provenance with the frozen patch. All three matched exactly; the operation and receipt were complete; receipt hashes matched independently read target/source bytes. Diagnostic hashes: target `4b4f737923c43efc89df3e4941fa3fff25e8a8bfccf6e2790e9fe73b4b874c0b`, source `78f509d1952f2e5febc9a6888ac100c65d21dbcfda34c5c049a2eb44283d6747`. Evidence is retained in `../graphmory-mvp-eval-20261001/private-safety/holdout-2026-10-01-01/`, including the untouched `result.json` and `diagnostic-h01.json`.

### Linked v2 run

The representation oracle correction and its reason are frozen separately in [the linked v2 protocol](mvp-holdout-safety-v2-2026-10-01.md). It independently parses the owned JSON fields and checks exact patch values; the original v1 failure remains unchanged.

Command: `node scripts/eval-mvp-holdout-v2.mjs --run-id holdout-v2-2026-10-01-01`.

| Measure | Result |
|---|---:|
| Tasks | **10/10 passed** |
| Expected-refusal actions | **7/7 matched** |
| Refusal false positives | **0** |
| Refusal false negatives | **0** |
| Unexpected vault mutation paths | **0** |

All H01–H10 passed under the linked v2 protocol. The decoded H01 owned-record values exactly equal the multiline patch fields, and independent source/target hash reads match the completion receipt. V2 evidence is retained in `../graphmory-mvp-eval-20261001/private-safety/holdout-v2-2026-10-01-01/result.json`. The v1 and v2 outputs remain separate; the v2 pass does not erase or relabel the v1 failure.

## Limits

This deterministic holdout tests the packaged CLI and local Node APIs on Node 24.18.0. It does not use a live Lead/Curator model, prove semantic truth, establish native delegation behavior, establish real-vault generalization, or simulate arbitrary external editor and sync races. H04 checks that contradictory candidates are both retrievable; it does not claim that a model will judge them correctly. H08 checks the checkpoint's local process guard only. No result here establishes competitor superiority or production-vault safety.
