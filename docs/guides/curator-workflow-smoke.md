# Manual native-host curator smoke

Use this once after installing Graphmory to verify the host can discover and actually dispatch the named curator, retrieve linked memory, apply a lead-authored patch, and check lifecycle/link state. This is a manual integration check; deterministic CLI tests do not prove native host dispatch.

The commands below use Codex. The curator model override is an explicit smoke choice, not a Graphmory default. Substitute a small model ID available to the account if `gpt-5.6-luna` is unavailable.

## Prepare an isolated project and vault

Install the CLI and verify it with the [host setup guide](agent-hosts.md). Keep the project and vault disposable; these commands create only synthetic files under a fresh temporary directory.

```sh
SMOKE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/graphmory-curator-smoke.XXXXXX")"
git -C "$SMOKE_ROOT" init -q
VAULT="$SMOKE_ROOT/brain"
mkdir -p "$VAULT/01 Projects/Release" "$VAULT/90 Evidence"

cat > "$VAULT/01 Projects/Release/Runbook.md" <<'EOF'
---
status: active
canonical_memory: true
---
# Production release runbook

Before production approval, follow the [[Release map]] and record the approval in this runbook.
EOF

cat > "$VAULT/01 Projects/Release/Release map.md" <<'EOF'
---
status: active
canonical_memory: false
---
# Release map

The ownership decision is in [[Release ownership]].
EOF

cat > "$VAULT/01 Projects/Release/Release ownership.md" <<'EOF'
---
status: active
canonical_memory: true
---
# Release ownership

Assign one named release owner before production approval. The owner coordinates readiness and records the handoff in the runbook.

Evidence E1: [[90 Evidence/Release decision#E1]]

Historical policy: [[Old approval rule]].
EOF

cat > "$VAULT/01 Projects/Release/Old approval rule.md" <<'EOF'
---
status: active
canonical_memory: true
---
# Old approval rule

The release owner may approve their own production release.

Evidence E0: [[90 Evidence/Release decision#E0]]
EOF

cat > "$VAULT/90 Evidence/Release decision.md" <<'EOF'
---
status: active
canonical_memory: false
---
# Release decision evidence

## E0 — prior rule

The release owner may approve their own production release.

## E1 — ownership

Assign one named release owner before production approval. The owner coordinates readiness and records the handoff in the runbook.

## E2 — current approval rule

Effective 2026-09-29: production releases require a separate named approver who is not the release owner, and the approver must be recorded in the runbook.
EOF

cp "$VAULT/90 Evidence/Release decision.md" "$SMOKE_ROOT/Release decision.baseline.md"
shasum -a 256 "$VAULT/90 Evidence/Release decision.md" "$SMOKE_ROOT/Release decision.baseline.md"
grep -F 'Evidence E1: [[90 Evidence/Release decision#E1]]' "$VAULT/01 Projects/Release/Release ownership.md" > "$SMOKE_ROOT/E1.baseline.md"

graphmory doctor --vault "$VAULT" --json
graphmory graph-audit --vault "$VAULT" --json
```

Install the project-scoped Codex role in this disposable project. Trust the project through Codex's normal host flow, then start a fresh session with ordinary user configuration. Do not use `--ignore-user-config` for this check; do not script changes to global trust settings.

```sh
graphmory-setup --host codex --scope project --project "$SMOKE_ROOT" --model gpt-5.6-luna --apply
```

## Verify actual discovery and read-only recall

In the fresh Codex session opened on `SMOKE_ROOT`, replace `<VAULT>` below with the printed absolute value of `$VAULT`, then ask the lead to delegate a read-only task to the installed `graphmory_curator`:

> Use native named-agent dispatch to ask `graphmory_curator` what ownership rule the production runbook reaches by following its map. Give it the vault path `<VAULT>`. It should use `graphmory recall-managed --vault "<VAULT>" --query "What ownership rule does the production release runbook use?" --scope "01 Projects/Release" --agent`, inspect returned originals, then use `graphmory recall-explore --vault "<VAULT>" --query "What ownership note does the runbook reach through its MOC?" --scope "01 Projects/Release" --agent`. Follow the ownership note's historical-policy link to the old rule and E0. Return the source-backed path chain and quote E1. State explicitly that E1 proves who owns readiness, not who approves a release; report E0's conflicting approval rule or say approval remains unverified if E0 was not returned. Do not edit.

Confirm the host shows a native child run for `graphmory_curator` and that the child read the installed `memory-curator` skill. A role file on disk or a lead's text claiming it delegated is not proof of dispatch. The recall result should identify the runbook-to-map-to-ownership route and cite the original evidence; graph traversal is a navigation aid, so the child must open the notes before treating the rule as supported.

If the child did not start, report `dispatch unverified` and stop this smoke before asking the lead to simulate the child inline. Recheck project trust and session reload through the host, then repeat once.

## Apply a supported patch and check lifecycle

Ask the lead to author and pass this bounded patch to `graphmory_curator`:

```json
{
  "claim": "Production releases require a named approver separate from the release owner, recorded in the runbook.",
  "why_it_matters": "Separating ownership from approval prevents self-approval and leaves an auditable release record.",
  "scope": {
    "applies": ["production release approval"],
    "excludes": ["development deployments", "release-owner assignment"]
  },
  "provenance": [
    {
      "kind": "file",
      "value": "90 Evidence/Release decision.md#E2: Effective 2026-09-29: production releases require a separate named approver who is not the release owner, and the approver must be recorded in the runbook."
    }
  ],
  "confidence": "high",
  "suggested_type": "decision",
  "lifecycle": {
    "status": "active",
    "revalidate_when": ["the production approval process changes"],
    "supersedes": ["01 Projects/Release/Old approval rule.md"]
  }
}
```

Save that JSON as `"$SMOKE_ROOT/patch.json"` outside the vault and run the schema preflight before dispatching the edit:

```sh
graphmory validate-patch --input "$SMOKE_ROOT/patch.json" --agent
```

Proceed only when it returns `valid: true`. This checks the patch shape only; it does not verify evidence, authorization, or lifecycle meaning. The lead still must explicitly authorize the E2 policy update and the named supersession below.

When delegating, the lead must say: “The synthetic user explicitly authorizes the E2 policy update and superseding only `01 Projects/Release/Old approval rule.md`. Preserve the E0/E1 evidence records.” The curator should open the E2 source and both target notes, apply the patch with the host's normal file-editing tools, retain E1, mark the old rule superseded with a replacement link, and return `APPLIED` with paths. In this default curator workflow it should not call `curate-plan`; that command is for hosted Jev/local decision workflows and does not edit notes.

Then verify the resulting files and reports:

```sh
test -f "$VAULT/01 Projects/Release/Old approval rule.md"
grep -nE 'E1|E2|supersed|replacement' "$VAULT/01 Projects/Release/Release ownership.md" "$VAULT/01 Projects/Release/Old approval rule.md"
grep -F 'Evidence E1:' "$VAULT/01 Projects/Release/Release ownership.md" > "$SMOKE_ROOT/E1.after.md"
cmp "$SMOKE_ROOT/E1.baseline.md" "$SMOKE_ROOT/E1.after.md"
shasum -a 256 "$VAULT/90 Evidence/Release decision.md" "$SMOKE_ROOT/Release decision.baseline.md"
cmp "$VAULT/90 Evidence/Release decision.md" "$SMOKE_ROOT/Release decision.baseline.md"
graphmory graph-audit --vault "$VAULT" --json
graphmory lifecycle-audit --vault "$VAULT" --json
```

The workflow smoke passes when the native child actually ran, recall returned the linked ownership route with source evidence, the E2-authorized approval rule is active, the old rule remains present and superseded, the E1 citation line is unchanged, and the full evidence file is byte-identical to its baseline. Audit cleanliness is a separate result: inspect and report every graph/lifecycle finding, including heuristic lifecycle warnings. Repair only supported metadata/link issues; do not hide warnings or change claim meaning to force a clean report. Stop with a blocker if a critical/high finding cannot be safely resolved. Record CLI installation, skill discovery, dispatch, patch status, evidence integrity, and audit results separately. Remove only the printed temporary directory after reviewing its path if you want to clean up.
