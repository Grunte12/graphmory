# Native Curator synthetic acceptance protocol

Date: 2026-09-29. This protocol checks one complete, synthetic Lead → native Curator → recall → patch → lifecycle workflow. It does not claim general retrieval quality or benchmark performance.

## Prepare the fixture and installed role

Create a fresh fixture directory; the generator refuses any existing output path:

```sh
node scripts/prepare-native-curator-smoke.mjs --out /private/tmp/graphmory-native-curator-fixture
```

Use the generated `scenario.json` as the run manifest. It contains three independent Obsidian Markdown vaults, patches outside those vaults, SHA-256 source manifests, and full baseline manifests. Keep the output disposable and synthetic.

Build and install the package artifact into an isolated prefix. Record the package name, version, tarball path, and integrity from `npm pack --json`; do not install globally. In the fixture root, install the project-scoped Curator role with the packaged `graphmory-setup` command, choosing and recording a cheap model ID supported by the host account. Trust/open the fixture project through the host’s normal flow and use a fresh Lead session. Do not change global trust or model defaults.

## Prove native dispatch

Run the three cases sequentially in one Lead session. Use the named `graphmory_curator` child for each delegated task. Preserve the host-generated parent/child trace or run metadata showing the Lead session ID, child ID, exact role binding, configured model, and reasoning effort. A role file on disk, a child’s self-description, or a Lead claiming it delegated is not dispatch evidence. If the host does not independently show the named child, stop and report dispatch unverified; do not retry as inline work or use a generic role.

Capture ordered host tool/command events. In every case, the `validate-patch` result must precede the first vault Edit/Write. Scratch JSON preparation outside the vault is separate from a durable memory write. It emits schema status only; the Curator still has to inspect cited original evidence and preserve explicit user authorization. Check source hashes before and after every case against `source-hashes.json`. Compare the complete vault to `vault-baseline-manifest.json` after cases 2 and 3.

## Cases

1. **Approved supersession and retry:** Follow Index → Runbook → current Release Policy by managed recall and direct reads. Apply the supplied E2 patch only after schema preflight. The synthetic user explicitly authorizes the policy update and superseding the named prior note. Preserve the prior note, mark it superseded with a replacement link, update the Runbook, and leave the original evidence unchanged. Retry the exact same patch after the first `APPLIED`; confirm the retry creates no second replacement or duplicate evidence. Repeat current-state recall without `--include-superseded` and report whether the superseded policy is hidden.
2. **Missing provenance:** The otherwise equivalent patch omits `provenance`. Preflight should fail, the Curator should return `BLOCKED`, and every vault file must match its baseline. The validator error is about schema only; do not add evidence on the Curator’s authority.
3. **Unresolved current conflict:** Preflight accepts the tension patch. Inspect both current source records, preserve the disagreement, and return `TENSION` without writes. This case requests a read-only conflict report, so `TENSION` is expected. `BLOCKED` is a distinct outcome only if the agent explains it cannot complete that report; neither outcome authorizes selecting a value or writing policy.

## Report

Record package identity, host and session IDs, each verified child binding, model/reasoning settings, ordered preflight/edit events, case outcome, before/after source hashes, failure-case vault comparisons, graph/lifecycle audit findings, and warnings. Report warnings separately: unresolved critical or high findings block acceptance; medium warnings remain visible and do not convert a workflow pass into a clean audit. A successful synthetic workflow verifies only this acceptance path, not general model capability.
