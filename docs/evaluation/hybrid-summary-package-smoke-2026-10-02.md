# Installed rc.6 CLI smoke — 2026-10-02

Packed rc.6, installed its archive in an isolated project with `--offline --ignore-scripts --omit=optional`, and invoked the installed CLI from fresh Node processes. Omitting optional dependencies here deliberately isolates package closure/lifecycle/summary behavior; it is not the recommended hybrid setup and does not prove a clean embedding installation.

The synthetic CLI smoke passed:

1. Prepare pending checkpoint with exact source/target bindings.
2. Render successor and finish; code generates predecessor lifecycle metadata and issues a matching verified receipt.
3. Fresh process recalls current policy in explicit lexical diagnostics mode and excludes superseded history.
4. Generate source-linked summary metadata; verify freshness; change original evidence; ordinary retrieval excludes the stale summary.

Doctor passes. Package files are present after installation, and runtime hashes match the final real-BGE experiment. Artifact and hash are recorded privately in `outputs/graphmory-hybrid-summary-20261002/verification/package-identity.json`. This is a deterministic installed-CLI test, not actual Curator dispatch, evidence entailment validation, or native-host acceptance. The summary in this smoke is an explicitly synthetic test write.

Receipt, bindings and outputs: `verification/installed-cli-integration.json` in that evidence root. Its isolated installed dependency tree can be removed after verification; fixture/receipt/evidence and the archive remain.
