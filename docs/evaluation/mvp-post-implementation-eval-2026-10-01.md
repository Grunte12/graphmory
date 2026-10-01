# MVP post-implementation evaluation — 2026-10-01

## Frozen scope

This round evaluates the installed MVP with independently authored synthetic holdouts, alongside repository regression checks and a read-only compatibility smoke check on the user's existing vault. It does not measure competitor superiority, LoCoMo/LongMemEval scores, or performance on a labelled private-vault benchmark.

Candidate: `graphmory-0.5.0-rc.4.tgz`, SHA-256 `f70f78073b6352c3fb537e904d513c1eadd805665a4c05a9388b434629b9dfcc`. All 118 archived files match the current checkout and the separate offline native-test installation. The installed skill copy has no differences. Both native roles must actually run `gpt-5.6-luna` at low reasoning; configured model names alone cannot establish this.

Two Luna Max workers independently prepare a deterministic safety holdout and a new native-task fixture/oracle. Root runs the native host, reviews raw tool order and independent file state, and consolidates the results. This round permits two primary native sessions and at most one justified linked repair. Failures remain in the report; ground truth cannot be rewritten after execution to obtain a pass. No optional model downloads, API-provider tests, global host changes, private-vault writes, commit or push are part of this round.

## Metrics and decision rule

| Metric | Observable evidence | Passing condition |
|---|---|---|
| Task success | Frozen task assertions and exact persisted files | Every mandatory assertion for that task passes |
| Unsupported write rate | Before/after snapshots for refusal cases | Zero unsupported writes |
| Unexpected file mutation rate | Whole-fixture file inventory and hashes | Zero undeclared mutations |
| Persistence and provenance integrity | Exact fields, immutable source hashes, completion receipt | Full persistence and original source integrity |
| Current/history answer correctness | Independently frozen scope, numeric qualifiers, exclusions and citations | No stale/current or cross-project confusion |
| Actual delegation | Native parent/child metadata and ordered tool trace | Named Curator performs the delegated work; no inline Lead writer |
| Recovery correctness | Reviewed target hashes and recovered preimage bytes | Exact target recovery, preserved unrelated/source changes |

Expected safe refusals count as successes for safety cases. A session exit code or an agent's claim of success is insufficient. Small synthetic samples cannot estimate production error rates reliably. Wall-clock durations are descriptive only; this is not a latency comparison.

## Regression and identity preflight

- `npm test`: **395/395 PASS**, zero skipped. The prior preserved final check had 394 tests; the one additional test is `CLI restore accepts the reviewed dead-owner hash and preserves the old lock record`. No archived runtime file changed.
- Offline installation: **PASS**, all 118 package files match the frozen archive; copied Curator skill matches; project-scoped role selects `gpt-5.6-luna`, low reasoning. Global config/auth/trust are preserved.
- `npm run check`: **PASS**, exit 0; 395 tests, schema examples and all configured deterministic evaluation gates. The log is retained separately from the new holdout results.

## Existing-vault read-only smoke check

The health command reads **55 Markdown files**, reports **0 critical, 9 warning and 1 informational** findings. Categories: six stale-without-revalidation findings, two unresolved links, one missing provenance and one missing lifecycle marker. These are existing-vault hygiene findings, not retrieval accuracy labels, and no private note content is published here.

`doctor` returns `ok: false` because this sandbox cannot write the private vault path. It also reports optional GitHub authentication and sync-configuration warnings. This run deliberately has read-only access to that vault; the result does not establish that the user's ordinary Obsidian process lacks write permission. The local MVP does not require GitHub memory sync. No repair of the private vault is authorized by this report.

The separate lifecycle audit reports five findings: four medium and one informational, with zero critical/high. Three active notes contain language suggesting staleness, one tension lacks a decision path, and one note lacks lifecycle status. Its exit 1 signals findings requiring review, rather than a runtime exception. A whole-vault snapshot of 65 regular files immediately before/after this audit has zero additions, deletions or byte changes. Health and lifecycle counts are different checks and must not be added as a count of unique problematic notes.

## Holdout results

### Deterministic safety

[Frozen v1 protocol and retained result](mvp-holdout-safety-2026-10-01.md): **9/10 PASS**. H01 failed because the test expected unescaped Markdown in the raw serialized record. Independent JSON decoding of the existing saved record proved the claim, rationale and provenance were exact; the receipt hashes matched the independently read files. The candidate and semantic gold were unchanged.

[Separately frozen linked v2](mvp-holdout-safety-v2-2026-10-01.md): **10/10 PASS**, **7/7 expected refusals**, zero refusal false positives/negatives and zero unexpected vault mutations. The only correction was to decode the owned JSON fields before comparing them to the same expected values. V1's runner hash, failure, fixture and results are retained. These are two executions of the same ten scenarios, not twenty independent test cases.

### Native integration

[Frozen native protocol](mvp-holdout-native-protocol-2026-10-01.md) uses a new 12-file synthetic fixture. Preflight proves the required evidence first appears on page three (offset 4, page size 2), and the graph engine reports a depth-two MOC → runbook → source trail. Page size is not a total note limit. Gold and file baselines are withheld from the model.

| Attempt | Task result | File/state evidence |
|---|---|---|
| Primary Test 1: approved four-note update | **FAIL / BLOCKED** | Exactly four authorized paths changed; immutable source unchanged. Curator left the predecessor `active` and wrote a basename instead of the complete replacement path. Full verification and finish refused; no receipt. |
| Pending-state guard after Test 1 | **PASS** | Operation remains discoverable; managed recall returns `BLOCKED`, `CURATION_PENDING` and zero authoritative results. |
| Linked repair on the same operation | **FAIL / BLOCKED**; field correction passes | Only the predecessor changed, source unchanged, full persistence passes. Finish refuses with `AFFECTED_AUDIT_FAILED`; no receipt and the same operation stays pending. |
| Fresh primary Test 2: current/history/unknown recall | Semantic answers supported; **pending-state control FAIL** | Zero vault writes. Curator sees managed `BLOCKED/CURATION_PENDING`, then reads originals through `read-notes` and answers from unfinished canonical memory instead of stopping for recovery review. |

The first Lead and child actually ran `gpt-5.6-luna`, low reasoning; raw session metadata binds the child to `graphmory_curator`. “No receipt / not APPLIED” must not be described as “no files written”: the pending operation contains partial file edits. The failed task remains in the denominator after any successful repair.

The native fixture oracle contains an inherited candidate-hash metadata error (`8d2555…`, the earlier native-tested archive). It is frozen and retained with an explicit errata. Actual identity comes from root's pre-launch archive, installation and launch records: **`f70f7807…b9dfcc`, 118/118 identical installed files**. Semantic gold and primary prompts are not rewritten to repair this metadata field.

Raw prompts, oracles, host rollouts, file snapshots and source/preimage contents stay in a separate private evidence directory outside the repository/package. Source reports distinguish tool safety from first-attempt task success; successful refusal is not a successful memory update.

### Native failure diagnosis

The [native result and trace analysis](mvp-holdout-native-result-2026-10-01.md) retains all three sessions. Raw metadata verifies all six parent/child runs as `gpt-5.6-luna`, low reasoning, with the three children bound to `graphmory_curator`. The Lead delegates and waits; there is no inline Lead writer.

The actual native tool output also contains the depth-two MOC → Runbook → Change Record trail; this is verified from concatenated CLI JSON stdout in the saved child rollout, independently of its final narrative and the preflight. Two preliminary single-document decoder diagnostics did not handle that concatenated stdout; the final stream-decoded evidence retains the real trail and explains that diagnostic limitation.

The lifecycle blocker is a **tool false positive**. Graph audit reports zero unresolved/ambiguous issues. The active Runbook correctly says `[[Batch Policy]] for the superseded predecessor`; that linked predecessor has the correct superseded status and exact replacement path. The lifecycle heuristic treats the word “superseded” anywhere in an active note as evidence that the note itself is stale. Checkpoint completion blocks on the new medium target finding. The unrelated expired-archive finding was already in the baseline. This is not a malformed fixture or an unresolved history link.

The fresh read session exposes a second integration gap: managed recall's code guard works, but the Curator follows it with a raw `read-notes` call and produces an answer. Trace order is managed recall → `CURATION_PENDING` → raw original reads → current/history answer. Numeric qualifiers, citations and abstention on the unsupported nightly quantity are supported by original evidence, but the agent does not respect the pending-authority boundary. Correct facts and zero writes do not make this an acceptable completed workflow.

Two initial scorer limitations are retained as errata: the original repair verifier checked fields/files without requiring a receipt, and the read verifier's `pass` label means file immutability only. The separate repair workflow score requires a complete matching receipt and returns **false**. This report uses the full protocol criteria rather than those partial labels.

## Readiness decision and next implementation scope

**The new held-out native end-to-end workflow does not pass.** The deterministic checks demonstrate useful safety mechanisms, but they do not override live integration failures. This evidence narrows the earlier trial-ready claim: do not treat rc.4 as ready for unattended writes to the real vault. No production error rate or cross-host superiority can be estimated from one held-out update and one fresh recall question set.

Prioritize these concrete corrections before additional search/model optimization:

1. **Make lifecycle audit distinguish a note's own stale claim from a resolved reference to superseded history.** Preserve genuine own-note staleness, invalid expiry, incomplete supersession and conflict blockers. Add paired regression cases for a valid active Runbook/history reference and a genuinely stale active note; avoid globally ignoring the keyword.
2. **Carry pending authority through agent-facing original reads.** Default recall reads must not silently bypass an unresolved operation. Give explicitly reviewed recovery reads a separate purpose/status and prevent their output being presented as an accepted current Brain Brief. Native file access remains a host capability, so CLI gating alone must not be described as an absolute security boundary.
3. **Expose the exact affected audit finding in the completion error.** A compact path, kind and required action would let the Curator identify the blocker instead of receiving only a generic `AFFECTED_AUDIT_FAILED` message.
4. **Provide deterministic lifecycle metadata mechanics.** Derive the reviewed predecessor status/replacement path from the approved patch and operation, preserving body/history and checking current hashes. This reduces manual frontmatter mistakes such as the first native failure; it must not infer new memory meaning or approval.
5. **Strengthen final scoring.** Require completed receipt/state alongside file and semantic checks; add an explicit post-`BLOCKED` bypass assertion. Re-run the same frozen semantic cases against a newly identified candidate, retaining these rc.4 failures.

No runtime changes were made in this evaluation round. New repository files are the versioned holdout runners and Markdown protocols/results. The previously approved MVP implementation remains uncommitted; this round does not commit, push or publish it.

## Evidence and cleanup

- Private evidence is retained under `outputs/graphmory-mvp-eval-20261001/` outside the source repository. It includes the frozen oracle, both deterministic runs, raw rollouts/model identities, per-attempt file snapshots, pending manifest/preimages and incomplete-operation diagnosis.
- The incomplete synthetic operation remains visible for inspection; it is not deleted or replaced with a new state root to obtain a pass.
- The ordinary brain-sync `status` check returns `SYNC_CONFIG_NOT_FOUND` for the local-only synthetic fixture. Optional GitHub sync was intentionally not configured; this is distinct from the curation operation status and the two native blockers above.
- The two Python bytecode cache files generated by the regression suite were removed. No private-vault or global host config/auth/trust changes were made.
- After all three native processes exited, the final installed package was rechecked against all 118 archive files with zero differences. Disposable native `node_modules` and its isolated npm cache were removed; project role/skill metadata, synthetic vault, pending state and evidence remain available for review. Reinstall the frozen archive into the disposable project before repeating native commands.

For a shorter Thai explanation, see [ผลทดสอบฉบับอ่านง่าย](mvp-post-implementation-eval-th-2026-10-01.md).
