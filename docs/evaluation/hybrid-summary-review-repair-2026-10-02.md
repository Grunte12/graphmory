# Independent review repair — 2026-10-02

## Findings and changes

A Luna review found two concrete bugs after the native archive was frozen:

1. Existing same-target shorthand such as `[[Recovery Window Policy]]` was rejected by lifecycle finish because it differed from the canonical successor path. Finish now uses the existing vault link resolver and canonicalizes only a uniquely resolved link to the **exact** declared successor. Ambiguous, different, case-only different, undeclared and self-referential targets remain blocked. Original bodies/newline style remain preserved; no semantic replacement is inferred.
2. Scoped summary dependency loading bypassed raw-root classification used by normal scans. Named dependencies now receive the same default `raw` status as initially loaded `00 Inbox`/`Clippings` documents; explicit statuses remain intact. Mixed-case `memory_kind: Summary` also receives freshness checks consistently. Thus scoped recall cannot silently treat an unreviewed raw capture as a current summary source while a full-vault check rejects it.

## Verification

- `node --test test/lifecycle-transition.test.mjs test/hybrid-recall.test.mjs`: **11/11 PASS**.
- Regression coverage includes unique resolver matches, ambiguous basename links leaving predecessor unchanged and operation pending, different/case-only paths rejected, same-target transition completed through checkpoint finish, and scoped vs full-vault raw-summary classification.
- Final `npm run check`: **443/443 PASS**, zero failures/skipped, plus schema/example validators and existing deterministic eval gates.
- Private full log: `outputs/graphmory-hybrid-summary-20261002/verification/final-check-rc6-reviewed.log`.

The installed native update/recall test used the earlier frozen archive. Its success is preserved under that exact identity; these subsequent source edits are established by code regressions, not another native model run. We did not rerun the same development quality fixture because these repairs target lifecycle binding and freshness correctness, rather than semantic ranking quality. Existing BGE metrics and failed native runs remain unchanged.
