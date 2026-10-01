# Windows CI follow-up — 2026-10-02

## Original result, retained

Commit `b752aa5` was pushed after local code, installed-package, native Luna and retrieval checks passed. [GitHub CI run 36910606034](https://github.com/Grunte12/graphmory/actions/runs/36910606034) then passed both Linux release gates and all four Linux/Windows install-smoke jobs, but failed both Windows release gates. Windows Node 22 reported 34 failed tests; Node 20 reported 35. This original run remains a failure.

## Confirmed issues and fixes

- The real interrupted-restore test compared a slash-specific suffix to Windows filesystem paths. The hook now uses host path separators; the process kill, retained same-host lock and reviewed-owner-hash recovery assertions remain intact. Production checkpoint behavior was not changed by this repair.
- Evidence collection asserted POSIX `0600` from `stat.mode` on Windows, whose reported bits do not represent NTFS ACLs. The permission-bit assertion is now POSIX-specific. The Windows test still executes actual CLI collection, continuation and refusal of changed originals. This change does not certify private NTFS access controls.
- Python tests now use a configured interpreter and convert file URLs with `fileURLToPath`; content assertions normalize platform newlines. CI explicitly installs Python. Mock Codex/OpenCode/Basic Memory hosts run through validated argv prefixes and Node instead of Unix executable bits; commands are spawned without a shell. Default real host commands remain unchanged.
- RAGTruth fixture cleanup retries transient directory-not-empty errors on Windows. No dataset/label/content assertions or Windows test cases were skipped.

Focused checkpoint/evidence-collection tests and six BEIR/native-summary/RAGTruth tests pass locally. The first local release-gate attempt reached package checks but failed writing the preexisting global npm cache. It was rerun using a private temporary cache; no ownership or user-cache changes were made. Private original job results/logs and focused repair logs are retained under `outputs/graphmory-push-eval-20261002/verification/`.

## Second CI result and final repairs

[Run 36913743650](https://github.com/Grunte12/graphmory/actions/runs/36913743650) for `f6f22be` passed the mock-host, checkpoint and evidence-collection repairs, both Linux gates and all install smokes. Windows retained one BEIR failure on Node 22 and that failure plus RAGTruth cleanup on Node 20; the run remains failed.

BEIR text-mode Markdown output changed LF to CRLF on Windows while its manifest hashed LF bytes. The preparer now writes the exact UTF-8 bytes it hashes. A regression compares the stored source bytes directly with the manifest hash; source-drift refusal is preserved. RAGTruth exception paths in streaming parsing now close the readline interface, destroy the underlying file stream and await its close event before returning. Both response and source-info loops use that helper, so invalid-row errors cannot leave a file handle for fixture cleanup to race. A regression observes actual backing streams closed before rejection.

## Outcome

Local `npm run release:gate` passes all three gates (unit/schema/core evals, report artifact contracts and 140-file package dry-run). [Final CI run 36914603192](https://github.com/Grunte12/graphmory/actions/runs/36914603192) for `c2f9813` passed **all eight jobs**: Linux/Windows release gates and install smokes on Node 20/22. This is the observed verification of both repair commits. The two prior failed runs remain retained. The earlier native run and its frozen installed archive remain independent of these test-harness changes.
