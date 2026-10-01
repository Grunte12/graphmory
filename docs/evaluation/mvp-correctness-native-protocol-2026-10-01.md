# MVP correctness repair: native-session protocol

Date: 2026-10-01. This protocol covers the three primary fresh native sessions for the rc.5 repair candidate. The candidate tarball is identified and installed-project parity is checked before any session. R13 rc.4 checkpoint compatibility is recorded by the separate linked compatibility runner.

## Prepare and freeze

Run from the Graphmory repository root. Choose a new run ID for every native attempt. The evaluator creates the synthetic HelioForge fixture, prompts, and approved inputs under `outputs/graphmory-mvp-repair-20261001/native/runs/<run-id>/`. Its private oracle, state, preimages, and evidence are kept separately under `outputs/graphmory-mvp-repair-20261001/native/private/<run-id>/`.

Run `repair-native-01` is retained as a failed preflight attempt; no native session started. The installed graph output contained the required depth-two Index → Runbook → source trail as edge objects (`source`/`target`), while the first scorer version looked for a nonexistent edge `.path`. The preserved diagnosis and command-output hash are in `native/private/repair-native-01/evidence/preflight-harness-erratum.json`. The linked `repair-native-02` uses the same candidate, fixture, and semantic gold, and checks the exact ordered edge chain. Run 01 also exposed a setup-preflight conflict: the earlier runner wrote a short custom role before invoking Graphmory's installer, which correctly refused to overwrite a different existing role. No global Codex files were written. Run 02 leaves role/skill creation to the installed candidate's project-scoped helper and freeze verifies its copied skill/model/effort.

```sh
node scripts/eval-mvp-correctness-repair.mjs prepare --run-id repair-native-02
npm install --prefix ../graphmory-mvp-repair-20261001/native/runs/repair-native-02/project --offline --ignore-scripts --omit=optional ../graphmory-mvp-repair-20261001/artifacts/graphmory-0.5.0-rc.5.tgz
node ../graphmory-mvp-repair-20261001/native/runs/repair-native-02/project/node_modules/graphmory/scripts/setup-curator-agent.mjs --host codex --scope project --project ../graphmory-mvp-repair-20261001/native/runs/repair-native-02/project --model gpt-5.6-luna --apply
node scripts/eval-mvp-correctness-repair.mjs freeze --run-id repair-native-02 --candidate-tarball ../graphmory-mvp-repair-20261001/artifacts/graphmory-0.5.0-rc.5.tgz
node scripts/eval-mvp-correctness-repair.mjs seed-pending --run-id repair-native-02
```

The freeze step requires rc.5, compares every extracted archive file with the installed package, hashes the installed skill/role and evaluator, writes a private candidate freeze, generates source handoffs, and runs deterministic page/graph preflight. The held-out source must be absent on the first `k=2` page and first appear at offset 4; graph preflight must expose the required depth-two project/runbook/source trail. Native sessions must not start if freeze fails.

The installed setup helper creates `.codex/agents/graphmory_curator.toml` and `.agents/skills/memory-curator/` inside the disposable project. It does not touch global Codex files. Its project role sets `model = "gpt-5.6-luna"` and `model_reasoning_effort = "low"`; freeze checks that exact role model/effort and byte-equal installed/copied skill.

For each Lead invocation, use the actual `codex exec` CLI with the project-scoped named role explicitly bound, a fixed state-root environment, and only the active vault/private state added as writable paths. For example, from the repo root (substitute one session's paths):

```sh
PROJECT="../graphmory-mvp-repair-20261001/native/runs/repair-native-02/project"
ROLE="$PROJECT/.codex/agents/graphmory_curator.toml"
VAULT="../graphmory-mvp-repair-20261001/native/runs/repair-native-02/vault/helioforge"
STATE="../graphmory-mvp-repair-20261001/native/private/repair-native-02/state/primary"
PROMPT="$PROJECT/prompts/session-1-update-lead.md"
GRAPHMORY_STATE_DIR="$STATE" codex exec --ignore-user-config --skip-git-repo-check -C "$PROJECT" -m gpt-5.6-luna -c 'model_reasoning_effort="low"' -c features.multi_agent=true -c "agents.graphmory_curator.config_file=\"$ROLE\"" --sandbox workspace-write --add-dir "$VAULT" --add-dir "$STATE" --json -o ../graphmory-mvp-repair-20261001/native/private/repair-native-02/evidence/update-lead-last.txt - < "$PROMPT" > ../graphmory-mvp-repair-20261001/native/private/repair-native-02/evidence/update-lead.jsonl
```

For session 2 use the same primary vault and primary state root. For session 3 use `pending-vault/helioforge` and `state/pending`. Keep the role binding and no-history child dispatch in each session. The local `codex exec --help` confirms dotted `-c key=value` overrides and `--ignore-user-config`; the installed Graphmory setup helper is the source of the role path and TOML model/effort fields. It must print `action: create`, `skillAction: create`, `mode: apply` on this fresh project before its first run.

The three lead prompts are generated at:

- `runs/repair-native-02/project/prompts/session-1-update-lead.md`
- `runs/repair-native-02/project/prompts/session-2-clear-recall-lead.md`
- `runs/repair-native-02/project/prompts/session-3-pending-refusal-lead.md`

Each prompt directs one fresh Lead to dispatch one `graphmory_curator` child with no inherited conversation context and no model override or extra prompt context. Use the host's supported no-history field, and record the exact raw dispatch call (for example `fork_turns: "none"` or `fork_context: false`, according to the exposed native schema). Both must actually run `gpt-5.6-luna` at low effort. Keep the session's inherited `GRAPHMORY_STATE_DIR` fixed at the prompt's assigned private primary or pending state root. Do not place the private oracle or score evidence inside the project or either vault.

The native Codex trace schema used here records the nested no-history dispatch as an `exec` code-tool call containing `tools.multi_agent_v1__spawn_agent({agent_type:"graphmory_curator", fork_context:false, ...})`; the Lead then calls `multi_agent_v1__wait_agent` with the exact child ID. The evaluator validates that raw call and wait target, not a Lead's prose. Each candidate freeze now archives the exact evaluator bytes under that run's private `evidence/frozen-evaluator-<sha256>.mjs` and checks the archive hash before scoring.

`seed-pending` uses the installed candidate to prepare one fresh checkpoint in the separate pending vault, then appends a deterministic partial edit to exactly the declared MOC target. It records hashes and status before the refusal session. The update or recall session must not be substituted for this pending-state case.

## Session order

1. Run the update lead prompt. Preserve the lead and child raw Codex rollout traces and actual dispatch/model metadata. After the attempt has ended, capture independently hashed vault and checkpoint evidence:

   ```sh
   node scripts/eval-mvp-correctness-repair.mjs capture-update --run-id repair-native-02
   ```

2. Run the clear-recall lead prompt in a new session and child against the updated primary vault. It must make no file changes, cite current and historical notes, preserve applicability and exclusions, and abstain on the unrecorded routine-sync quantity.
3. Run the pending-refusal lead prompt in a new session and child against the separate pending vault/state. It must report blocked/pending state without answering the pending current-policy question, bypassing through raw/original reads, or changing any file.

Do not retry a failed session under the same run ID. Preserve its traces and snapshots. An authorized repair gets a linked fresh run ID and must keep the original denominator and failure.

## Trace evidence format

Create a private JSON file, for example `native/private/repair-native-02/evidence/native-traces.json`, after collecting the actual raw JSONL rollout files. Do not synthesize trace contents. The scorer reads the trace files and checks tool calls/model metadata; the `dispatch` fields below are copied from actual host/child metadata, not inferred from prompt text.

```json
{
  "runId": "repair-native-02",
  "sessions": {
    "update": {
      "launchStateRoot": "/absolute/path/native/private/repair-native-02/state/primary",
      "dispatch": {
        "agentType": "graphmory_curator",
        "forkTurns": "none",
        "modelOverride": false,
        "childThreadId": "actual-child-id",
        "leadModel": "gpt-5.6-luna",
        "leadEffort": "low",
        "childModel": "gpt-5.6-luna",
        "childEffort": "low"
      },
      "leadTraceFiles": ["/absolute/path/to/lead.jsonl"],
      "curatorTraceFiles": ["/absolute/path/to/child.jsonl"]
    },
    "clearRecall": { "...": "same fields, actual fresh-session evidence" },
    "pendingRefusal": { "...": "same fields, pending state root and actual evidence" }
  }
}
```

Score each attempt once, preserving each score file:

```sh
node scripts/eval-mvp-correctness-repair.mjs score-update --run-id repair-native-02 --evidence ../graphmory-mvp-repair-20261001/native/private/repair-native-02/evidence/native-traces.json
node scripts/eval-mvp-correctness-repair.mjs score-clear --run-id repair-native-02 --evidence ../graphmory-mvp-repair-20261001/native/private/repair-native-02/evidence/native-traces.json
node scripts/eval-mvp-correctness-repair.mjs score-pending --run-id repair-native-02 --evidence ../graphmory-mvp-repair-20261001/native/private/repair-native-02/evidence/native-traces.json
node scripts/eval-mvp-correctness-repair.mjs score --run-id repair-native-02
```

The scorer writes capture/score JSON under the private evidence directory. Each task score includes SHA-256/line counts for its raw trace files, extracted `turn_context` model/effort rows, the actual lead dispatch tool-call inputs, and the supplied dispatch facts. `dispatch.forkTurns="none"` or `dispatch.forkContext=false` is accepted as the no-history setting; other/missing settings fail. Update acceptance conjuncts semantic fields, exact target-only mutation, immutable source/unrelated-file hashes, complete matching receipt, source identity, workflow route trace, dispatch/model evidence, and the frozen state root. Clear-recall acceptance conjuncts current/history/unsupported semantics, citations, unchanged file hashes, fresh dispatch/model traces, and root integrity. Pending acceptance conjuncts the seeded pending manifest, blocked envelope, no authoritative answer, no direct/raw bypass, unchanged vault hashes, actual dispatch/model traces, and root integrity. The aggregate score reports three primary tasks separately; R13 is reported by its companion compatibility artifact.

## Retained repair attempts

`repair-native-02` used the original rc.5 tarball (`978c764123e18510ac2175fa51698722d517208b13cca11cee4c78d4c8127cdd`) and the frozen HelioForge gold. Its native update is an immutable FAIL: full persistence verification passed, but `finish` returned `AFFECTED_AUDIT_FAILED`, wrote no receipt, and left the operation pending. The complete affected audit names one finding, `active-note-has-stale-language`, on `01 Projects/HelioForge/Migration Runbook.md`. The saved text says `[[Batch Policy]] for the superseded prior rule`; its predecessor and successor have exact reciprocal full-path metadata, and the Runbook links both that predecessor and the active successor. This was a parser false positive: the lifecycle audit recognized `... superseded predecessor` but not `... superseded prior rule`. The package correction is a separately frozen iteration, not a rewrite of this failed attempt.

The first post-session `capture-update` call is retained at `native/private/repair-native-02/evidence/capture-update-guard-failure.json`. It correctly refused to score after the runner had changed since the original freeze. A single linked scorer-only revision then recorded original runner SHA `883634882995cda04f0673f4d7e49af98f17c1531cb69af89e9ccd06fa92e1bc`, revised runner SHA `330d5b491e91b324df47e3b9b472565062698f4ea69bf52fe6d5495d3107c95a`, and private exact revised runner bytes. It confirms the frozen candidate, semantic oracle, fixture, patch, and prompts were unchanged. The resulting R10 score remains FAIL at `native/private/repair-native-02/evidence/update-score.json`; do not treat evaluator false negatives as product evidence or change the preserved denominator.

Review of that score found three limitations in its current checks. The source-anchor helper tests a `.md#fragment` string with an end-only `.md` suffix remover, so it reports the saved D1/D2 links missing. The state-root check lowercases the trace text before extracting the path, then compares it case-sensitively to `path.resolve`; the raw trace assignments all name the exact primary state root and contain no `--state-root` override. The first recall command uses the documented default offset 0 without spelling `--offset 0`, then explicitly uses offsets 2, 4, and 6; the current score requires explicit 0, 2, and 4. These are retained scorer findings, not reasons to revise the native02 result: the missing finish receipt independently makes its task a failure.

`repair-native-03` is the authorized linked native repair with unchanged synthetic source, patch, prompts, and semantic gold. It uses the distinct iteration-02 archive `outputs/graphmory-mvp-repair-20261001/artifacts/iteration-02/graphmory-0.5.0-rc.5.tgz` (SHA-256 `aa2b23f1dc502a01f55b135205012f85261ad066e7b284695b0a5d9f20b77a80`), whose 119 archive files match the installed project. Its freeze records the same fixture digest `860be8e57d9907413be68129bb0b867b8d1cdbf727332f76d1819ced91e103bd`, patch SHA `b5f4a4f590e4ab81dd2bdb2abb3ef23394b8af03d85feb5f221de2cf0fb81717`, source SHA `e984158e70044b74afa2883940b875f9cf5939984ca97c13a0bc666a17b5c8fb`, the expected offset-4 source preflight, and a two-round graph preflight. The exact evaluator bytes are privately archived as `frozen-evaluator-330d5b491e91b324df47e3b9b472565062698f4ea69bf52fe6d5495d3107c95a.mjs`. The session outcome and capture error are recorded below; there is no native success claim.

That `repair-native-03` primary session is a retained R10 FAIL. The Curator stopped before checkpoint preparation because its pre-edit read treated the explicitly approved new target, `01 Projects/HelioForge/Recovery Window Policy.md`, as requiring an existing original body. It made no edits; the private state directory was never created. The independent inventory confirms all 12 vault files match the frozen baseline digest, with zero changed paths and no operation or receipt. Parent and child rollouts were copied after their `task_complete` events; the actual no-history spawn and model metadata are in `native/private/repair-native-03/evidence/native-evidence.json`. The evaluator's `capture-update` error (`ENOENT` on that absent target) is preserved in `native/private/repair-native-03/evidence/capture-update-enoent.json`; the raw missing-file exception is not a native receipt or a successful task score. R11 was not run.

After N03, the named-role generator and installed Curator guidance were clarified: read every existing source/target; permit absence only for a target whose exact path the trusted task explicitly authorizes creating; include that path in checkpoint preparation; confirm `existed: false` and a null original hash before writing; otherwise block. The setup test passes 2/2 and no native R10 rerun was authorized, so this behavior is implemented but not natively verified. `repair-native-04` is freshly prepared with the same fixture and no pre-created role files for the single authorized R12 pending-refusal session. Its project/vault/inputs are not yet candidate-frozen; Root installs the final guide candidate, runs the canonical project setup helper, and freezes before any native call.

## Limits

These are synthetic correctness and workflow checks for one host/model setup. Trace review verifies observed tool calls and declared state root, but it does not sandbox host-native filesystem access. A pass does not establish unattended production safety, a general error rate, or comparative model superiority. If Codex cannot provide the required raw trace/model metadata, record the task as unscored/NOT RUN; do not infer it from a configured role or final answer.
