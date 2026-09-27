# Curator session/cache A/B diagnostic — 2026-09-28

## Question

Does keeping the cheap Curator in one Codex CLI session and sending only newly opened source text reduce whole-workflow input and latency? This follows the [live LongMemEval source-read pilot](longmemeval-live-reader-2026-09-28.md). The case is the same already exposed development question `a40e080f`; this is **one paired diagnostic**, not a quality or efficiency acceptance result.

## Matched setup and intentional differences

Both arms used the same pinned 48-session Markdown vault, raw question, `recall-managed --auto --agent` page, mediated `read-notes`, Luna model at low reasoning, three-round cap, output schemas, separate fresh Lead, and source-hash/protocol checks. Both chose the rank-1 gold source, opened the same 4,621-byte original, and returned the same two named companies with the source path. The first Curator prompt was byte-identical (32,177 bytes).

- **Fresh/full:** new ephemeral Codex session per call; the second Curator prompt repeated the page plus original source. [Sanitized run](../../eval/reader-pilot/longmemeval-live-a40-2026-09-28.json).
- **Persistent/compact:** first Curator call persisted, second used `codex exec resume` with the explicit session ID and only the newly opened original plus continuation instruction. The Lead remained fresh. [Sanitized run](../../eval/reader-pilot/longmemeval-live-a40-persistent-2026-09-28.json). The experiment-created Codex session file was removed after the report was preserved.

The two changes (persistence and compact follow-up) are **confounded**. Prompt wording, run order and host state were not counterbalanced. The prepared case is public and previously inspected. Neither arm gives an official LongMemEval answer score or an independent blinded support label.

## Observations

| Measure | Fresh/full | Persistent/compact |
|---|---:|---:|
| Completed Curator + Lead calls | 3 | 3 |
| Source reads / pages | 1 / 1 | 1 / 1 |
| Second Curator prompt bytes | 37,016 | 4,994 |
| Total submitted prompt bytes | 69,680 | 37,947 |
| Host input tokens, including cache | 62,423 | 95,738 |
| Host cached input tokens | 0 | 23,296 |
| Host noncached input tokens (subtraction) | 62,423 | 72,442 |
| Host output tokens | 144 | 269 |
| Wall time | 24.398 s | 23.654 s |
| Answer names and cited source | Same | Same |

The resumed Curator call alone reported 56,703 input tokens, including 23,296 cached, versus 24,001 input and zero cached for the fresh second call. **Caching did work**, but the persistent arm still reported 10,019 more *noncached* input tokens over the whole three-call workflow. The tiny 0.744-second wall-time difference is not evidence of a latency gain. Submitted prompt bytes fell by 45.5%, yet reported host input rose; this is consistent with conversation history and host context being included on resume, but the trace does not isolate each source of added tokens. Subscription billing is unknown, so no dollar-cost comparison is possible.

## Decision

Verification: `npm run check` passed 282/282 tests and configured gates. The added protocol test verifies that the second Curator call resumes the explicit session while the Lead stays fresh. It does not prove answer quality or cache efficiency. The Obsidian status check still returns `SYNC_CONFIG_NOT_FOUND`; the experiment did not change the user's vault.

Do not switch the default Curator protocol to persistent sessions or claim cache savings from this case. Run a counterbalanced, family-diverse comparison with the same source-selection freedom and quality labels before changing user setup. Record gross, cached and noncached input separately; output and actual latency matter too. A fresh compact follow-up is an untested third arm that could help isolate continuation-prompt size from session history. The predeclared quality and efficiency gates remain open.
