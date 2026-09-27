# Evaluation skill research and repository installation

## Request and research method

The user requested research through the existing Grok Bot conversation
**Grok for codex**, repository-scoped skill installation, then an Astra
evaluation. Two messages were sent through the native app on 2026-09-28.
Grok returned five candidate projects and source links. No private vault
content or credentials were sent. The root agent independently fetched and
reviewed the selected upstream instruction files and license before installing.

## Selected skills

Source: [ai-evals-course/evals-skills](https://github.com/ai-evals-course/evals-skills/tree/80d5f7b0127c7572ed9e9339937adbfd7240ffeb).
Pinned revision: `80d5f7b0127c7572ed9e9339937adbfd7240ffeb`; Apache-2.0.

| Skill | Use in Graphmory | Limit |
|---|---|---|
| [eval-audit](https://github.com/ai-evals-course/evals-skills/blob/80d5f7b0127c7572ed9e9339937adbfd7240ffeb/skills/eval-audit/SKILL.md) | Inspect existing artifacts for faulty evaluators, contamination and unsupported conclusions | An audit does not measure product answer accuracy |
| [evaluate-rag](https://github.com/ai-evals-course/evals-skills/blob/80d5f7b0127c7572ed9e9339937adbfd7240ffeb/skills/evaluate-rag/SKILL.md) | Separate evidence retrieval, multi-hop completeness, grounding and answer relevance | Adapt chunk terminology to Markdown notes; suggested k is not a product retrieval cap |
| [validate-evaluator](https://github.com/ai-evals-course/evals-skills/blob/80d5f7b0127c7572ed9e9339937adbfd7240ffeb/skills/validate-evaluator/SKILL.md) | Assess future LLM judges against human labels with separate train/dev/test sets | Cannot claim calibration without human labels; sample-size and threshold advice is heuristic |

The copied folders contain only `SKILL.md` and `agents/openai.yaml`; no
executable files, hooks, mandatory services or runtime dependencies were
installed. SHA-256 hashes are in
`../../.agents/skills/evals-skills-provenance.json`. Full upstream Apache
license is retained; the pinned upstream tree contains no `NOTICE` file.

These are development instructions, not benchmark implementations or proof
of scientific validity. Keep official benchmark scoring separate from our
additional grounding and safety checks. Do not replace official LoCoMo F1
with a generic binary judge merely because a skill prefers binary verdicts.

## Other candidates returned by Grok

These were not installed or independently audited in this experiment:

- [muratcankoylan/Agent-Skills-for-Context-Engineering evaluation](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering/blob/6dbe1a1d868eab51a3bc9011b0f55e2891513e40/skills/evaluation/SKILL.md): general evaluation guidance; largely redundant for this immediate audit.
- [tmuskal/arc-agi-benchmarker LongMemEval judge](https://github.com/tmuskal/arc-agi-benchmarker/blob/main/plugins/longmemeval-benchmarker/skills/judge/SKILL.md): Grok reported scripts, API dependencies and no root license found; requires further review before vendoring.
- [supermemoryai/memorybench](https://github.com/supermemoryai/memorybench/blob/main/skills/memorybench/skill.md): a benchmark framework wrapper; useful future comparison candidate, not necessary to install a lightweight audit skill.
- [Memory-System-Eval-Harness LongMemEval skill](https://github.com/tech-innovation-group/Memory-System-Eval-Harness/blob/performance_refactor/benchmarks/skills/longmemeval/SKILL.md): Grok reported coupling to its own runner/backends.

## Installation and verification

Run from the Graphmory repository root:

```sh
SSL_CERT_FILE=/etc/ssl/cert.pem python3 \
  /Users/grunte/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo ai-evals-course/evals-skills \
  --ref 80d5f7b0127c7572ed9e9339937adbfd7240ffeb \
  --path skills/evaluate-rag skills/eval-audit skills/validate-evaluator \
  --dest .agents/skills --method download
```

The local helper path is machine-specific; the destination is repository
relative. No global agent files were changed. `SSL_CERT_FILE` selects the
system trust store because this Python installation lacks its default CA
bundle; certificate verification remained enabled. The installer confirmed
all three destinations. Original bytes were preserved and the root license
was downloaded separately from the pinned revision.

`npm test` passed **271/271** before the installation. Astra was explicitly
dispatched with the installed skill paths, so its audit does not depend on
the host discovering new skills mid-turn. Host discovery is expected on the
next turn; no new global configuration is required.

## Astra evaluation

See [Astra artifact audit and actual rerun](astra-eval-skill-audit-2026-09-28.md).
The requested scope is development-only LoCoMo reproduction, targeted
adapter tests, actual trace review, and a correctness evaluation protocol.
No held-out conversations are scored, no product ranking defaults changed,
and no paid model calls are needed for this audit.

Installation verification: every installed source/license hash matched the
provenance manifest. `npm pack --dry-run --json --cache
/private/tmp/graphmory-eval-skill-npm-cache` listed 95 package files, with
zero `.agents/` files. The default npm cache was not writable in this
sandbox; a temporary task cache was used without changing system ownership.

## Follow-up: selected combination and full-layer audit

Installed repository-only on 2026-09-28:

- `write-code-eval`, same pinned AI Evals Course revision above: objective contract/state checks.
- Context Engineering `evaluation` and `tool-design`, pinned revision `6dbe1a1d868eab51a3bc9011b0f55e2891513e40`, MIT: experiment design and agent-facing tool guidance. Their full resources and original license are retained; hashes are in `.agents/skills/context-engineering-provenance.json`.

The earlier candidate list describes the initial installation, not the current state. Both bundled Python scripts were parsed and imports inspected; they use standard-library imports. They were not executed. The evaluation example uses heuristic/default dimension scores and a weighted pass threshold: these must not replace exact state gates, official benchmark scorers, or independently labeled semantic correctness. Stars do not establish evaluator validity. No hooks, global config, runtime dependencies or paid services were installed.

DeepEval remains optional development tooling, not installed or executed. Its model initialization and judge-dependent metrics need a separate controlled pilot. The full-layer plan explains its proper boundary.

See [full-layer plan](full-layer-evaluation-plan-2026-09-28.md) and [coverage registry](layer-coverage-2026-09-28.json). Grok researched primary sources and Luna inspected code/skills; Astra produced a draft but hit a usage limit before completing its turn. The root reviewed the produced draft and verified registry file references; this is not a completed independent Astra approval or a new model benchmark.

Follow-up verification: 17 vendored source/license hashes matched; package dry-run still excludes every `.agents/` file. Authored documentation passes `git diff --check`. Vendored upstream files retain original whitespace (including trailing whitespace warnings) to preserve exact pinned-source hashes; they were not reformatted. `npm run check` passed 274/274 tests and configured deterministic gates after this follow-up.
