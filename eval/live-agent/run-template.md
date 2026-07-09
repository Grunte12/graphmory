# Live Model Run Template

Use this file as a copyable worksheet for a real model or prompt run. Do not commit private transcripts, secrets, or project-specific names.

## Run Metadata

- Date:
- Model / provider:
- Prompt variant:
- Token or cost budget:
- Tool access:
- Incident set:
- Human reviewer:

## Task Goal

What is the single task or question the model must address? Keep this concise so the scorer can compare intent vs. outcome.

## Expected Memory Behavior

Describe which of the following the model should produce:

- **Brain Brief**: bounded prior-context summary (max 7 items, 3 direct-read paths)
- **Memory Patch**: structured claim with provenance, scope, lifecycle
- **Curator decision**: `APPLIED` / `TENSION` / `BLOCKED`
- **Other** (specify)

## Procedure

1. Pick incidents from `eval/live-agent/incidents.json`.
2. Hide expected memory actions and expected future effects from the tested model.
3. Ask the model to produce candidate Brain Brief, Memory Patch, and curator outputs.
4. Save outputs outside the repo or under ignored `tmp/`.
5. Run the deterministic scoring wrapper:
   ```sh
   node scripts/eval-live-agent-score.mjs \
     --run-dir ./tmp/live-agent-runs/<run-id> \
     --incidents eval/live-agent/incidents.json \
     [--json]
   ```

## Scoring Rubric

| Criterion | Weight | Description |
|---|---|---|
| Memory behavior matches expected | 30% | Did the model produce the correct action (save/block/tension)? |
| Provenance present and accurate | 20% | Are evidence sources cited correctly without fabrication? |
| Scope correctly bounded | 15% | Does the output limit itself to the incident scope? |
| Lifecycle metadata complete | 15% | Are status, revalidation, and supersedes fields present when expected? |
| No false memory/overclaim | 10% | Does the output avoid inventing unsupported facts? |
| No secret/provenance leakage | 10% | Does the output avoid storing sensitive data? |

## Tool Calls

Record every distinct tool or capability the model used during the run:

| Tool | Call count | Purpose | Notes |
|---|---|---|---|
| e.g., grep | 3 | Search for relevant notes | |
| e.g., recall | 2 | Vault lookup | |
| ... | | | |

## Token Estimate

Approximate usage for the run:

- Input tokens (prompt + incident + tools):
- Output tokens (response + any generated files):
- Estimated total cost:

Use tokenizer tools or provider APIs for estimates. If unavailable, mark as "estimated" with method noted.

## Correction Count

Record each time the human reviewer had to intervene or correct the model output:

| # | Incident | Correction | Reason |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

## Human-Time Metrics

- Start time:
- End time:
- Total wall time:
- Active review time:
- Number of manual corrections:

## Results

| Metric | Value |
|---|---:|
| Curator pass rate | |
| Average patch score | |
| False-memory failures | |
| Conflict handling failures | |
| Missing lifecycle failures | |
| Estimated input tokens | |
| Estimated output tokens | |
| Latency | |
| Human correction time | |
| Overall rubric score | |

## Error Classification

| Incident ID | Error type | Detail | Severity (critical/major/minor) |
|---|---|---|---|
| | | | |

Error types: false-memory, missing-provenance, scope-creep, lifecycle-omission, secret-leak, over-retrieval, under-retrieval, wrong-action, fabrication.

## Notes

- Strong examples:
- Failure examples:
- Prompt changes to test next:
