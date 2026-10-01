# R13: rc.4 checkpoint compatibility

Date: 2026-10-01. Status: **PASS for the frozen rc.5 archive tested below.** This is a narrow checkpoint compatibility result, not an aggregate MVP readiness decision.

## Frozen identities and method

- rc.4 archive: `graphmory-0.5.0-rc.4.tgz`, SHA-256 `f70f78073b6352c3fb537e904d513c1eadd805665a4c05a9388b434629b9dfcc`.
- rc.5 candidate archive: `graphmory-0.5.0-rc.5.tgz`, SHA-256 `978c764123e18510ac2175fa51698722d517208b13cca11cee4c78d4c8127cdd`.
- The experiment installed each archive offline in a separate project per lane, with optional dependencies omitted and install scripts disabled. Before checkpoint calls, every archive member matched the installed package: 118/118 rc.4 files and 119/119 rc.5 files. The candidate's installed `src/curation-checkpoint.mjs` SHA-256 was `e8cb75791301d112f4e83b70ca0f5fc6828db0b8784a5fbb467f9f65ea9cd1aa` in both lanes.
- Both lanes began from an independently hash-checked 12-file synthetic vault. The exact frozen patch SHA-256 was `b5f4a4f590e4ab81dd2bdb2abb3ef23394b8af03d85feb5f221de2cf0fb81717` (checkpoint digest `sha256:e8d17fa2fc554a2280fe44290572ed4ecf875e4922dc3526743ac255589ed570`); the immutable source was `90 Evidence/HelioForge Change Record.md`, SHA-256 `e984158e70044b74afa2883940b875f9cf5939984ca97c13a0bc666a17b5c8fb`.
- The four approved target paths and saved afterrepair hashes came from the frozen synthetic fixture. Each rc.4 prepare recorded the same three existing target preimages byte-for-byte and one target as absent. The test copied the saved afterrepair bytes, then independently confirmed that only the four declared paths differed and that the source remained unchanged.
- Each command captured before/after full vault and state file hash maps, patch/source hashes, and the operation manifest/receipt summary. The two lanes had separate vault and state roots; no command used or changed the earlier pending fixture.

## Results

| Lane | Commands | Result |
|---|---|---|
| Finish | rc.4 `prepare` → rc.5 `finish` | **PASS.** rc.5 returned `complete`; the matching persisted receipt had `verification.valid: true`, exact target/source bindings, and hashes matching all four saved afterrepair files. The full resulting vault had the exact expected 13-file inventory (the original 12 plus the declared new note). |
| Restore | rc.4 `prepare` → rc.5 `status` → rc.5 approved `restore` → rc.5 `status` | **PASS.** `status` reported the matching pending operation and reviewed target hashes. `restore` returned `recovered`; all 12 original vault file hashes were restored exactly, the terminal state had no completion receipt, and final status was unblocked `recovered`. |

The run completed at 2026-10-01 03:36 UTC. No model or native Codex session was used. The installed candidate passed full package-member parity before either candidate command ran.

## Preserved harness attempts

Two initial harness attempts are retained in the private evidence tree and are excluded from the compatibility result. The first checker assumed rc.4 `prepare` included a `blocked: false` field; the command had succeeded and returned `status: pending`, so the checker stopped before candidate execution. The next runner attempt mistakenly used the rc.4 project for follow-up commands as well; its rc.4 self-finish failure is not candidate evidence. Attempt 3 corrected the version binding, installed both archives independently, checked full member parity, and produced the PASS above. These records remain at the sibling output's `native/private/r13-compatibility-2026-10-01/`, `...-run-02/`, and `...-run-03/` directories.

## Reproduction

From the `outputs/graphmory` directory, run:

```sh
node ../graphmory-mvp-repair-20261001/r13-compatibility.mjs
```

The runner refuses to overwrite an existing output directory or report. Its script is kept outside the package at the sibling repair-output root. Detailed private records, including per-command stdout/stderr and snapshots, are under `graphmory-mvp-repair-20261001/native/private/r13-compatibility-2026-10-01-run-03/`.

## Final candidate replay — run 04

Root independently inspected the machine result after the final lifecycle grammar repair. The fresh replay `r13-compatibility-2026-10-01-run-04` is **PASS** in both lanes. Its candidate is the separate iteration-02 archive, SHA-256 `aa2b23f1dc502a01f55b135205012f85261ad066e7b284695b0a5d9f20b77a80`, version `0.5.0-rc.5`, with 119/119 installed archive-member parity. The candidate checkpoint member SHA-256 is `e8cb75791301d112f4e83b70ca0f5fc6828db0b8784a5fbb467f9f65ea9cd1aa`.

The rc.4 prepare → final rc.5 finish lane produced a matching complete receipt/full persistence. The independent rc.4 prepare → final rc.5 reviewed restore lane returned `recovered`, exact 12-file baseline, and no receipt. `originalPendingStateTouched` is false. Run 03's earlier candidate PASS and attempts 1–2's harness failures remain separate evidence.

Private result: `../graphmory-mvp-repair-20261001/native/private/r13-compatibility-2026-10-01-run-04/result.json`. This development report is excluded from the candidate package; this addition does not change the frozen archive or runtime.

## Final guide candidate replay

Root replayed both lanes against iteration-03 archive SHA-256 `11725097611ba5e65ecf2ee6ea39fbf5562061b0053c0e811946e3afe90ff04a` (119 files; checkpoint member SHA unchanged). The machine result is **PASS** for finish and restore; original pending state was not touched. Evidence: `../graphmory-mvp-repair-20261001/native/private/r13-compatibility-2026-10-01-r13-final-guide-20261001/result.json`. Earlier candidate results and harness failures are preserved separately.
