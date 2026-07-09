# Live Agent Evaluation Dataset

This folder contains anonymized incidents for running real model comparisons.

Use it to ask different agents or prompts to produce:

- Brain Brief outputs,
- Memory Patch outputs,
- Memory Curator `APPLIED/TENSION/BLOCKED` outputs.

Then score those outputs with:

```sh
node scripts/eval-agent-run.mjs --curator-output path/to/output.json --patches path/to/patches
```

The incidents are not expected-answer prompts. They are realistic tasks that should expose false memory, stale memory, over-retrieval, missing provenance, and weak lifecycle handling.
