# MVP package audit — 2026-10-01

This source-only report audits the final documentation-refresh tarball for `graphmory@0.5.0-rc.4`. It is intentionally excluded from the npm package. The native trial used the earlier frozen candidate; the refresh contains documentation and package-file-list changes only.

## Package identity and installed behavior

| Check | Result |
|---|---|
| Final tarball SHA-256 | `c4f5ae7bd9858adfabbc75ff145aea2917c7cb076d3a2d9f03d0107b1b1ee837` |
| Size and entries | 262,431 bytes; 118 files |
| Package identity | `graphmory@0.5.0-rc.4`; Node engine `>=20`; expected CLI bins present |
| Native-tested candidate | SHA-256 `8d2555ed5233381f67533ba98cbe8aa431e8d6977d7ad4a2e27bd0ff8814c65d`, 232,071 bytes, 110 files |
| Refresh delta | Eight documentation files added; `package.json` and `docs/guides/trial-mvp.md` changed; zero changes under `src/`, `scripts/`, `bin/`, `skills/`, or `adapters/` versus the native-tested candidate |
| Final package install | Release owner confirmed Pack B installs offline; packaged CLI and setup help were verified from the unpacked archive. |
| Runtime observed | Node `v24.18.0`; Node 20 was not exercised, so `>=20` remains a compatibility target |
| Optional dependency | `@huggingface/transformers` remains optional; the isolated native install did not contain it |

The native install was project-scoped under `outputs/native-mvp-trial-20261001/`. It contained `node_modules/graphmory`, `.codex/agents/graphmory_curator.toml`, and `.agents/skills/memory-curator/` with `protocol.md`, `note-schema.md`, and `trial-workflow.md` references. The installed role selected `gpt-5.6-luna` at low reasoning.

I unpacked the final archive outside the source checkout and ran its bundled CLI help. It lists `render-patch` (stdout projection), `verify-patch-persistence --full`, checkpoint `prepare`, `status`, `finish`, and `restore --expected ... --approve [--review-lock <reviewed dead-owner SHA256>]`. The separate setup helper help describes preview as the default and says it will not overwrite existing files. These help checks did not write a vault or exercise recovery.

The recorded `npm run check` on the native-tested candidate passed 394/394 tests, examples, and configured deterministic evals. Its setup test covers project-scoped preview, repeat apply, and refusal to overwrite modified role or skill files. That does not establish native dispatch on each supported host or test a real user's global settings. The documentation refresh does not change the checked runtime or skill files.

## Shipped documentation and support scope

A Markdown-aware scan covered 19 shipped guide, skill, report, protocol, and plan files. It checked 60 real relative links after ignoring fenced and inline-code examples. All 60 resolved within the package. The three research reports referenced by `managed-retrieval.md` are now included. Plan/readiness references to an older source-only report are plain text rather than package-relative links; that old report, which contains a local vault path, was not added.

The trial guide links to the packaged native acceptance report and states the tested configuration: Codex CLI `0.146.0`, Node `24.18.0`, and `gpt-5.6-luna` at low reasoning for Lead and Curator. It distinguishes that run from the setup helper's `gpt-6-luna` default and from other host/model versions. The host guide documents Codex, Cursor, and Claude Code setup; tests cover generated setup files and overwrite refusal, while native acceptance is scoped to Codex. No cross-host native pass is claimed.

The acceptance report records G1–G8 as passed on the synthetic trial scope, with one initial delegation failure retained alongside its linked repair. At this independent audit's completion, G9 still required the release owner's evidence preservation and cleanup. The owner's completion note below closes that gate. The trial does not establish Node 20 behavior, real-vault generalization, arbitrary external-editor race safety, or model superiority.

## Cleanup boundary

After evidence and hashes are preserved, the exact workspace cleanup target is `outputs/native-mvp-trial-20261001/`, which contains the disposable package install and project-scoped role/skill. The release owner handles cleanup after retaining sanitized evidence. Remove only task-owned disposable fixture/evidence roots; do not delete real vault data, user-scoped `~/.codex` or `~/.agents` files, global Graphmory configuration/state, or unrelated temporary files.

## Release-owner completion note

G9 is complete. Private evidence preserves 290 files, including nine host rollouts, canonical sanitized projections and a self-contained verifier; all four published projection hashes reproduce. No pending operation or state lock remained before cleanup. Nine disposable install/fixture/cache roots and three subsequent build roots were removed; global host configuration/sessions and the real vault were preserved.

The delivered tarball refreshes only the two Markdown reports' final gate statuses relative to audited package B. Final SHA-256: `f70f78073b6352c3fb537e904d513c1eadd805665a4c05a9388b434629b9dfcc`; 118 files, 263,184 bytes. All 50 runtime/schema/skill/adapter files are byte-identical to native-tested package A. All packed files match the source tree, and the same 60 real relative links resolve. The native trial was not rerun for this report-status update. The delivery manifest is stored alongside the local tarball; nothing has been published.

No application tests or model calls were run for this audit. I compared tarball contents, scanned packaged Markdown, and invoked help from the unpacked package.
