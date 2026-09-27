# Retrieval evidence delivery: process and current decision

Graphmory's curator searches Markdown notes and decides what evidence to send
to the lead agent. This series changed the **tool output**, not the curator's
system prompt or the canonical vault. The goal was fewer host turns and less
irrelevant text without losing relevant source notes or encouraging claims
that the notes do not support.

## Sequence

| Step | Change and measurement | Outcome | Decision |
| --- | --- | --- | --- |
| 1. Paged previews | Added short source text to ten-path pages; compared with path-only on six fresh task families. | On five unambiguous cases, both methods answered correctly; preview lowered median time and host input counters in that small pilot. | [Keep opt-in](preview-fresh-six-2026-09-27.md). |
| 2. Adaptive bundle | `--auto` chooses focused ten-path output or a 32 KB evidence bundle, with `--offset` continuation. | On four fresh path-only pairs, core answer/evidence was 4/4 in both arms; median time 28.8 vs 48.1 s and tool calls 5.5 vs 11. Both arms had an unsupported extra claim on one task. | [Keep opt-in](adaptive-vs-paths-fresh-four-2026-09-27.md). |
| 3. Matched previews | A first filter across all modes hid gold previews for four of 34 structured queries. We recorded that failure, restricted the filter to wide mode, then froze a new five-case suite. | Structured gold previews recovered to 34/34. On five fresh conversation pairs, core answer/evidence was 5/5 in both arms; cited-claim support was 5/5 with matched previews vs 4/5 ordinary `--auto`. Median first response was 7,011 vs 32,204 bytes. | [Keep opt-in](matched-preview-experiment-2026-09-27.md); a small A/B cannot establish a causal quality gain. |
| 4. Routing wording | Removed false wide triggers from incidental “at all” and “across” wording. | Structured queries changed from 31 focused / 3 wide to 34 focused / 0 wide; first-response gold groups and previews stayed 34/34. Conversation evidence paths stayed 5/5. | [Retain the rule](adaptive-routing-language-2026-09-27.md); host effects remain unmeasured. |

## How the trials were protected

The live comparisons used OpenCode with the same Luna model, identical
Markdown note trees, read-only instructions, fresh sessions and alternating
arm order. Question files excluded gold. A separate grader reviewed anonymous
answers against frozen rubrics before arm identity was revealed. The reports
record source, runner, config and vault hashes; sanitized row data are in
[`eval/competitor-pilot`](../../eval/competitor-pilot/). Raw answers and traces
stay outside this public repository. The local vault and trial vaults were not
modified by readers.

These are **development pilots**, mostly one run per task. LongMemEval S
question families and labeled evidence sessions were excluded from earlier
pilots, but wider conversation history may overlap. The structured 34-query
vault has been inspected during development. Neither source is a fresh,
independent acceptance set for a superiority claim. Host token counters do
not reveal subscription billing; provider cache state also varied.

## Current product state

The ordinary path-only flow remains the safe default. `--auto` and
`--auto --matched-previews` are available as optional curator commands.
Neither is ready to become the install default: sample sizes are small, there
is only one new abstention case in the latest filter pilot, repeated latency
trials are missing, and citation support has not met the
[promotion criteria](optimization-loop-2026-09-27.md) on a broad independent
set. Faster retrieval is demonstrated on the tested pairs; superiority over
other memory tools, lower billed cost and safer memory writes are not.

Next gate: use a new source with independently reviewed answers and enough
unanswerable and conflicting cases, run repeated paired readers, audit each
material cited claim, and measure latency/token distribution across coding
hosts. Promote only after the quality and cost gates pass together.
