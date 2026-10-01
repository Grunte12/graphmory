# Windows CI follow-up — 2026-10-02

## Original result, retained

Commit `b752aa5` was pushed after local code, installed-package, native Luna and retrieval checks passed. [GitHub CI run 36910606034](https://github.com/Grunte12/graphmory/actions/runs/36910606034) then passed both Linux release gates and all four Linux/Windows install-smoke jobs, but failed both Windows release gates. Windows Node 22 reported 34 failed tests; Node 20 reported 35. This original run remains a failure.

## Confirmed issues and fixes

- The real interrupted-restore test compared a slash-specific suffix to Windows filesystem paths. The hook now uses host path separators; the process kill, retained same-host lock and reviewed-owner-hash recovery assertions remain intact. Production checkpoint behavior was not changed by this repair.
- Evidence collection asserted POSIX `0600` from `stat.mode` on Windows, whose reported bits do not represent NTFS ACLs. The permission-bit assertion is now POSIX-specific. The Windows test still executes actual CLI collection, continuation and refusal of changed originals. This change does not certify private NTFS access controls.
- Python tests now use a configured interpreter and convert file URLs with `fileURLToPath`; content assertions normalize platform newlines. CI explicitly installs Python. Mock Codex/OpenCode/Basic Memory hosts run through validated argv prefixes and Node instead of Unix executable bits; commands are spawned without a shell. Default real host commands remain unchanged.
- RAGTruth fixture cleanup retries transient directory-not-empty errors on Windows. No dataset/label/content assertions or Windows test cases were skipped.

Focused checkpoint/evidence-collection tests and six BEIR/native-summary/RAGTruth tests pass locally. The first local release-gate attempt reached package checks but failed writing the preexisting global npm cache. It was rerun using a private temporary cache; no ownership or user-cache changes were made. Private original job results/logs and focused repair logs are retained under `outputs/graphmory-push-eval-20261002/verification/`.

## Outcome

Local `npm run release:gate` passes all three gates (unit/schema/core evals, report artifact contracts and 140-file package dry-run). GitHub matrix verification of the repair remains pending. The earlier native run and its frozen installed archive remain independent of these test-harness changes.
