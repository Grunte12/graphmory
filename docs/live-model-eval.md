# Live Model Evaluation

The repository includes deterministic proxy candidates, but real confidence comes from scoring outputs produced by actual agents and models.

## What To Compare

Run the same incidents with:

- **A - Direct Writer**: the main agent writes memory directly.
- **B - Curator Inference**: the main agent sends a summary and the curator decides what to remember.
- **C - Memory Patch**: the main agent writes a structured patch and the curator applies it.

Keep the model, budget, and available files constant when comparing A/B/C.

## Incident Set

Use `eval/live-agent/incidents.json` as the public anonymized scenario set. Each incident describes:

- what happened,
- evidence available,
- expected memory action,
- expected future effect.

Do not show expected scoring details to the tested model.

## Output Shapes

Curator behavior candidates use the same shape as:

```text
eval/curator/candidates/C-memory-patch.json
```

Patch-quality candidates can be a single file or a directory of files shaped like:

```json
{
  "name": "Model X incident 01",
  "expected_min_score": 80,
  "patch": {
    "claim": "...",
    "why_it_matters": "...",
    "scope": { "applies": ["..."], "excludes": ["..."] },
    "provenance": [{ "kind": "file", "value": "..." }],
    "confidence": "high",
    "suggested_type": "decision",
    "lifecycle": {
      "status": "active",
      "revalidate_when": ["..."],
      "supersedes": []
    }
  }
}
```

## Score A Run

### Quick Score (deterministic proxy)

```sh
node scripts/eval-agent-run.mjs \
  --curator-output path/to/curator-output.json \
  --patches path/to/patch-candidates
```

Use `--allow-failures` when collecting comparison data without failing CI.

### Structured Score (weighted rubric)

```sh
node scripts/eval-live-agent-score.mjs \
  --run-dir ./tmp/live-agent-runs/<run-id> \
  --incidents eval/live-agent/incidents.json \
  --json
```

Requires `curator-output.json` in the run directory. Optionally reads `patches/`, `tool-calls.json`, and `metadata.json` for richer metrics. The rubric scores action correctness (30%), provenance (20%), scope (15%), lifecycle (15%), no fabrication (10%), and no leakage (10%).

### Worksheet

Use `eval/live-agent/run-template.md` as a copyable worksheet for recording model, prompt, token budget, tool calls, correction count, human-time metrics, and the rubric score. The template now includes structured sections for each of these fields, plus an error-classification table.

## Recommended Report

For each model/prompt setup, record:

- pass rate on curator behavior,
- average patch-quality score,
- false-memory failures,
- conflict handling failures,
- missing lifecycle failures,
- token/latency if available,
- human correction time.

Do not claim one architecture is better from proxy candidates alone. Use the deterministic proxy results as a harness sanity check, then publish live model results separately.
