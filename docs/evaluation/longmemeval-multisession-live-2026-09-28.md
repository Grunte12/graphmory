# Multi-session live Curator diagnostic — 2026-09-28

## Frozen setup

One previously exposed LongMemEval development question `67e0d0f2` (multi-session) was rendered from the same pinned cleaned-S dataset used in the [CLI delivery report](longmemeval-cli-delivery-2026-09-28.md). All 52 original sessions were available as Markdown. Question: “What is the total number of online courses I've completed?” Labels stayed separate from reader input. The unchanged mediator ran `recall-managed --auto --agent`, verified original `read-notes` requests, and used fresh `gpt-5.6-luna` calls at low reasoning, with four Curator rounds maximum and a separate Lead. No production defaults changed.

[Sanitized run](../../eval/reader-pilot/longmemeval-live-multi-67-2026-09-28.json) preserves paths, hashes, usage, timing, brief and answer. This is one exposed development case, not an official answer score, blinded support judgment or general performance estimate.

## Result and failures within the successful workflow

The workflow completed five model calls (four Curator, one Lead), two retrieval pages and eleven original-source reads (146,103 bytes) in 42.675 seconds. Host input was 167,336 tokens, including 23,040 cached; output was 1,015 tokens. These are host usage categories, not dollar cost or Graphmory response tokens.

The Curator brief said 20 courses, comprising 12 Coursera and 8 edX, and cited both gold session paths. Manual source inspection found the user's explicit 12-course statement at line 155 of `sessions/0038-e070111f44b2.md` and their previous 8 edX courses at line 165 of `sessions/0007-730ea6f80239.md`. Both files were actually read. The final Lead answer was exactly **“20 online courses.”**, matching the benchmark reference number but **dropping both source citations** despite the prompt requesting them. Completion and number correctness therefore do not establish a fully compliant source-cited answer.

Nine additional files were read beyond the two annotated gold files. Calling them unnecessary is not proven: checking possible additional courses may be reasonable for a total-count query. The annotated gold originals total 34,558 bytes; the actual reads total 146,103 bytes (4.23×). This is an oracle diagnostic ratio, not achievable savings without a source-selection policy validated for completeness.

## Next intervention

Repository verification after recording this experiment: `npm run check` passed 283/283 tests and configured gates; `git diff --check` passed. The user's Obsidian status check still returned `SYNC_CONFIG_NOT_FOUND`; this experiment only read temporary benchmark vaults.

First preserve provenance through a structured Lead output contract and verify that cited paths came from sources supporting the Curator brief. Do not silently attach all read paths to an answer: that would misrepresent relevance. Then compare source-selection/continuation policies on multi-session, update, abstention and temporal cases, retaining failures and measuring whole-workflow usage. No global read cap or quality superiority claim follows from this single case.
