# MVP lifecycle-context repair: focused verification

**Date:** 2026-10-01

**Status:** Focused source/tests complete; checkpoint integration and native evaluation remain pending.

## Behavior under test

The batch API `auditDocuments(documents, now, { inventoryComplete, contextDocuments })` suppresses only the lifecycle marker in the narrow body phrase `[[linked predecessor]] for the superseded predecessor` when a complete relationship inventory proves all of the following:

- the link resolves uniquely to a note with `status: superseded`;
- that predecessor has one exact replacement path to a supplied successor;
- the successor has an active/current/applied status, a valid non-expired `valid_until`, and an exact `supersedes` entry for the predecessor;
- the mentioning note also links to that same successor.

No same-folder requirement is used. Any unproven marker remains a finding. A separate self-stale marker in the same sentence remains a finding. `auditDocument(document, now)` retains its context-free behavior. Batch completeness defaults to false; truncated/filtered callers must not claim complete inventory. `auditMemoryLifecycle` keeps its prior audited-note selection and count, while using an all-path relationship inventory to detect ambiguity caused by raw Inbox/clipping notes. Reaching the relationship scan cap disables exemptions.

## Focused gates and result

Command:

```sh
node --test test/mvp-lifecycle-context.test.mjs test/patch-record-full.test.mjs
```

Final result after the bounded tension-path correction: **18/18 passed** (7 lifecycle-context cases and 11 existing patch-record cases). The three legacy CLI lifecycle-audit cases passed with `node --test --test-name-pattern='lifecycle-audit' test/brain-sync-cli.test.mjs`. `node --check` and `git diff --check` passed for the owned source/test files.

The lifecycle cases cover the saved Runbook shape with no `supersedes` field, a valid cross-folder exact chain, a same-sentence separate self-stale claim, unresolved/missing/ambiguous/filtered/unknown/mismatched/expired relationship endpoints, invalid-date and conflict blockers, and raw-note ambiguity without adding raw notes to the audited result.

The initial focused run was **15/16**. The first diagnosis called this a fixture defect because the conflict fixture included the word `decision`; that characterization was incomplete. The old predicate treated any mention of `decision`, `owner`, `blocked`, `next step`, `resolve`, or `evidence` as a sufficient path. The exact original fixture body is no longer retained, so this report does not reconstruct it. An independent reproducer with `status: tension` and body `The two accounts remain inconsistent. No decision yet.` returned no finding before the correction, despite there being no decision path. The test was kept keyword-free, and the implementation now requires a nonempty affirmative labeled path (`Decision:`, `Owner:`, `Next step:`, `Evidence:`, `Resolver:`, or review fields) or a concrete owner/reviewer action tied to a review condition. Empty and negated values do not qualify. Paired positive, bare-keyword, negated, and empty-field cases pass. The earlier **15/16** result remains a recorded failure; the later focused pass does not erase it.

## Scope and limitations

- This verifies the lifecycle API and its local persistence regressions only. It does not prove that checkpoint baseline/finish uses the batch API; that integration belongs to the checkpoint owner.
- The supported historical wording is intentionally narrow. Other phrasings remain findings until separately specified and tested.
- The tension-path check remains a deterministic text heuristic, not semantic conflict resolution. It establishes only that an explicit path is recorded; it does not verify that an owner, evidence, or proposed next step is substantively adequate.
- The relationship inventory must be complete. `auditMemoryLifecycle` fails closed at its scan cap; checkpoint integration should signal completeness only after its exhaustive inventory succeeds.
- No live vault, provider, model, package install, native session, or global configuration was used. All fixtures in the added test are synthetic and are removed after the test.

## Linked native02 wording correction

The actual native02 Runbook used `[[Batch Policy]] for the superseded prior rule`. Independent inspection confirmed exact reciprocal predecessor/successor metadata and the current successor link, so the stale-language finding was a false positive. The narrow historical phrase family now accepts `prior|previous|earlier` followed by `rule|policy|record|version`; exact-chain proof and occurrence-only exemption are unchanged. The actual native02 note/operation/FAIL remain preserved.

Focused lifecycle tests passed 8/8, including the actual sentence, independent same-sentence self-stale and broken-chain negatives. Final integrated checks passed 414/414, zero skipped. Native03 stopped before editing for a separate missing-new-target guidance issue, so it did not verify this corrected write flow. See the consolidated repair result for final readiness and archive identity.
