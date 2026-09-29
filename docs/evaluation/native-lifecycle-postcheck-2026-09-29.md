# Native lifecycle postcheck — stopped before dispatch

One attempt followed the preregistered `native-lifecycle-postcheck-protocol-2026-09-29.md`. Revision `5ae87c6` was packed as `graphmory@0.5.0-rc.3` and installed offline in an isolated prefix with scripts and optional dependencies omitted. Installed doctor and project-local setup succeeded. Lead used `gpt-5.6-sol` low; the named Curator configuration specified `gpt-5.6-luna` low.

The Lead exited 0 after 19.197 seconds with `BLOCKED`, reporting that native `graphmory_curator` dispatch was unavailable due to an agent-type/fork constraint. The runtime database contains no child binding for this parent. All three generated vaults match their complete baseline manifests byte-for-byte, including Obsidian metadata. No lifecycle postcheck or memory write occurred.

**Result: dispatch unverified / no child created. The live lifecycle gate did not pass.** A successful process exit is not a workflow pass. The exact rejected spawn arguments/tool error were not available in the captured CLI JSON; the ephemeral parent had no persisted rollout record. Therefore the fork-constraint explanation is a Lead report, not an independently verified root cause. Do not infer that the configured Luna model ran or that the persistence implementation failed.

The previous successful native workflow and its metadata omission remain frozen. The deterministic persistence checks remain separate evidence. No prompt-tuning retry or generic-agent fallback was attempted. Sanitized package integrity, role/trace hashes, source-state comparisons and outcome are saved in `eval/reader-pilot/native-lifecycle-postcheck-2026-09-29.json`. The temporary package, project, fixture, and raw trace directory was removed after terminal execution and capture.

Next diagnostic should preserve the actual native spawn error/arguments before changing any role or prompt. Comparative workflow evaluation must record dispatch failures as failures rather than silently exclude them. This run does not support speed, cost, cross-host reliability or superiority claims; its 19.197-second duration includes no Curator work.

Repository verification after this run: `npm run check` exited 0 with 363/363 unit tests plus shipped example/evaluation checks passing. Required private-vault status still returns `SYNC_CONFIG_NOT_FOUND`; no private configuration or note was written. Passing repository checks does not override the failed native dispatch gate.
