# Codex curator A/B: source completeness flags

## Frozen protocol

Use Codex CLI, `gpt-6-luna`, low reasoning, fresh ephemeral sessions, read-only
sandbox, and the same prompt and synthetic Markdown vault in both arms. The
control strips only `truncated` and `sourceReadRequired` from retrieval output;
treatment preserves them. A wrapper calls the same current retrieval code.
Thus this isolates metadata rather than comparing different code versions.
The prompt mentions what flags mean in both arms. Alternate A/B order per
question, one pair per question for this pilot. No private vault is used.

Six questions are fixed before trials: answer at end of long section,
owner/deadline split across notes, contradictory unresolved decisions,
unknown approver, explicitly superseded historical decision, and negation.
Score required facts, exact supporting paths, and source reads from JSONL
tool traces. Capture wall time and host-reported usage separately; cached
input is a subset of input for Codex, not additional input. One repeat does
not establish a latency effect. No default promotion or competitor claim.

Gold expectations: encrypted backup; Mira and October 12; unresolved SQLite
versus PostgreSQL; approver unknown; PostgreSQL replaces SQLite; Friday is
prohibited. Freeze these labels before reading answers.

## Preflight failure and protocol amendment

The installed CLI rejected `gpt-6-luna` for this ChatGPT account. A no-tool
smoke test succeeded with the locally listed `gpt-5.6-luna`; pin that model.
Initial shell-driven trials could not inspect files: nested sandbox execution
failed with `sandbox_apply: Operation not permitted`. Stop those trials;
answers saying the workspace is inaccessible are infrastructure failures,
not quality scores. No sandbox bypass is used.

Before restarting, amend the workflow: the runner computes retrieval output,
and asks Codex to return a structured JSON source-read request. It validates
paths against the fixture allowlist and supplies requested originals in a
second fresh call, then collects the final answer. Both arms use the same
instructions and one source-read batch. This tests curator decisions through
a mediated read interface, not native Codex shell execution or persistent
session behavior. Count all model calls and their repeated context. The CLI
still injects installed skills; those fixed costs are part of reported usage.
Latency includes host startup and model time; it is not retrieval latency.

## Results: six complete pairs

CLI version: 0.146.0; Graphmory baseline: 430a870. Model: `gpt-5.6-luna`,
low reasoning. All 12 final answers were manually inspected by the author;
this is not independent or blinded grading. Public row data contains answers,
requested paths, usage, elapsed time, and explicit labels:
`eval/competitor-pilot/codex-source-flags.json`.

| Metric | Control, flags removed | Flags present |
|---|---:|---:|
| Required facts correct | 6/6 | 6/6 |
| Required source paths cited | 5/6 | 6/6 |
| No misattributed out-of-scope requirements | 5/6 | 4/6 |
| All three criteria pass | 4/6 | 4/6 |
| Unknown approver correctly unknown | 1/1 | 1/1 |
| Unresolved conflict correctly unresolved | 1/1 | 1/1 |
| Median total elapsed seconds | 15.50 | 17.44 |
| Median total input tokens | 32,015.5 | 32,116 |
| Median cached input tokens | 4,480 | 15,104 |
| Median uncached input tokens | 27,256 | 16,963.5 |
| Total source paths requested | 20 | 23 |
| Total model calls | 12 | 11 |

Flags were faster in only 3/6 pairs. Input totals sum all calls per trial;
uncached input is input minus cached input. Cache hits were reported by the
host, but different warm prefixes and run order prevent attributing the
uncached difference to the flags. These are not billed dollar measurements.

Both variants requested and received the long recovery source, and both
found its final backup instruction. Both also listed owner/deadline/deployment
facts as recovery requirements, although those notes never establish that
relationship. The flags variant similarly added recovery to a question about
deployment restrictions. The control restriction answer omitted exact source
paths. These distinctions separate finding the core fact from delivering a
complete, relevant, cited answer.

Every flagged path was requested in the long and split-evidence trials (2/2
applicable treatment trials); control read the same five paths in each.
The same behavior without flags means this sample does not demonstrate
incremental benefit. Source notes remained unchanged; all completed trials
used read-only Codex sessions and an allowlisted source-read runner.

## Decision

Keep the flags as inexpensive diagnostics, not as an answer-quality guarantee.
Do not promote adaptive retrieval defaults based on this pilot. It offers no
quality advantage under the strict criterion, and median elapsed time rose
about 13%. The useful next hypothesis is reducing irrelevant cross-topic
reads while retaining every required evidence note. Test that separately;
otherwise changing prompts or retrieval at the same time obscures causality.
This synthetic suite is small and authored by us. It cannot establish broad
real-vault performance or superiority over another tool.

Reproduction (requires authenticated Codex CLI and a new temporary path):

```sh
python3 scripts/eval-codex-source-flags.py --workspace /private/tmp/graphmory-codex-flags-new
```

`npm run check` passed. The runner's Python syntax was checked. Test vaults
and execution wrappers were removed after preserving trial evidence locally;
no personal Obsidian files or credentials were copied into the repo.
