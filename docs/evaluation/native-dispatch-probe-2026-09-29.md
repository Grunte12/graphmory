# Trace-preserving native dispatch probe result

The preregistered dispatch-only probe passed. A fresh installed package and project-local role were used; the source baseline was `5ae87c6` plus the reviewed setup-reminder/guide change. The generated role itself was unchanged.

The actual persisted parent rollout records a `collaboration.spawn_agent` call selecting `agent_type="graphmory_curator"`, `fork_turns="none"`, with no `fork_context` or model override. Its corresponding tool response names the child task. Independent runtime parent-child metadata proves `agent_role=graphmory_curator`, model `gpt-5.6-luna`, reasoning `low`. The child actually executed installed `graphmory doctor --json`, returned `ok: true`, and has a terminal task-complete event. Eight predeclared checks passed; Lead used `gpt-5.6-sol` low.

The run took 36.629 seconds, including dispatch and read-only doctor work. Doctor's required Node/Git checks passed; optional GitHub authentication reported a warning. No vault was supplied or read. This is not a latency comparison and does not verify lifecycle writes, answer quality, full workflow reliability or cross-host behavior.

The earlier failed native lifecycle attempt remains recorded separately, with its exact root cause unverified. This successful source-guided probe supports the documented V2 invocation shape, not a retrospective claim about that failure. The full approved-patch postcheck still needs a fresh native workflow run.

Sanitized arguments, response, binding, package integrity and trace hashes are in `eval/reader-pilot/native-dispatch-probe-2026-09-29.json`; message text, raw logs and private runtime IDs are not published. The temporary package/project was removed, and both exact completed test sessions were archived through the app, independently confirmed in runtime state. Global rollout files and unrelated sessions were left intact.

After updating the setup reminder and host guide, `npm run check` passed (363/363 unit tests plus repository example/evaluation checks); `git diff --check` passed. Private-vault status remains `SYNC_CONFIG_NOT_FOUND`; no private vault/config writes were made.
