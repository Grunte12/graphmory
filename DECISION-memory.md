# Decision: optimize Graphmory, do not move to Hindsight (2026-10-20)

Decided by Claude Code (Opus 5.5) at Grunte's request via Grok Bot. Read-only analysis; no config was changed.

## Decision

Keep Graphmory and fix the workflow. Do not migrate to Hindsight now. Re-test Hindsight only if the exit criteria at the end fail.

## Why

1. **The reported problem is the protocol, not the engine.** The latency and repeated discovery come from the rule that the main agent must dispatch a Curator sub-agent for every recall (global CLAUDE.md "dispatch the named graphmory-curator"). The engine's `recall` tool already returns cited candidates and can be called directly. Hindsight would remove the sub-agent only because it has no such rule; the same change is a small instruction and protocol edit in Graphmory.
2. **Graphmory already meets the remote requirement.** `graphmory-mcp --http` (Streamable HTTP, bearer token, `--bind --allow-remote`, see `docs/guides/mcp-http.md`) can run on a VPS. Sync between Mac and VPS already exists through Git (`sync` tool). No Docker or Postgres.
3. **Scale does not need Hindsight.** The vault has about 60 notes. Hindsight's reported win (context bloat at tens of millions of tokens) does not apply here. Its own benchmark drops to 64.1% at 10M tokens, and the benchmark is the vendor's.
4. **Hindsight has no true delete.** Wrong or private memories cannot be removed cleanly. Graphmory notes are plain Markdown that Grunte can read, edit and delete in Obsidian.
5. **Cost and ops.** Graphmory needs Node plus a Git repo and runs on a small VPS. Hindsight needs Docker plus Postgres and about 2 GB RAM.
6. **Graphmory is Grunte's own product.** Fixing the workflow improves the product; migrating abandons it.

Risk accepted: several orchestrators writing at once. Mitigation: one writer process (the VPS server); every agent, including the Mac, talks to it.

## Evidence (bake-off, 2026-10-20)

Measured in `eval/hindsight-bakeoff/README.md` on the same 54-note corpus and questions, with Grok 4.7 and Gemini 3.7 Flash agents (no Claude):
- Retrieval quality is close (hit@5 0.97 Graphmory vs 0.94 Hindsight); Graphmory recall is about 40x faster (31 ms vs 1.2 s p50) and returns about 5x-16x less text.
- Agents with Graphmory answered simple questions in 3-5.5 tool calls; with Hindsight 10-10.5, because they explore its 36 tools. Hindsight used about 1.4-2.2x the input tokens.
- Both loop on multi-hop questions. That is the next Graphmory fix.
- The Curator is now a fixed specialist: its full contract is in its prompt, with only the five vault tools. A test recall took 17 s and 4 tool calls, with no skill loading or tool discovery.
- Correction: Hindsight does expose `delete_document`; derived-fact deletion was not tested.

## Plan

1. **Measure the baseline (before changes).** Time `recall` called directly vs. via the Curator, and count repeated recall/status calls per task in recent transcripts. Not measured yet.
2. **Fast fixed Curator for recall (owner decision 2026-10-20).** Hosts with sub-agents dispatch the Curator on a fast tier (Haiku, gpt-6-luna); its full contract is in its prompt, so it starts with `recall` instead of discovering tools or skills. Orchestrators without sub-agents (Grok Bot, Hermes) call `recall`/`read` directly; the tool descriptions carry the stop rule. Done for Claude Code, Cursor and Codex.
3. **Lighter writes.** The main agent calls `remember` directly at the end of verified work. Keep the safety gates (provenance, hashes, no secrets). Use the Curator only for link maintenance and cleanup, in batches, not per task.
4. **One long-running server.** Run one HTTP server so the embedding model stays loaded, instead of each host starting its own stdio process.
5. **VPS (after steps 1-4 work on the Mac).** Small VPS (1-2 GB, check RAM use of the BGE model first). Vault Git repo on the VPS is the primary copy. `graphmory-mcp --http` behind Tailscale Serve (HTTPS) with a separate token per client. Mac keeps a Git clone for Obsidian and offline reading.
6. **Connect clients.** Grok Bot (Linux VM), Hermes (~/.hermes), Claude Code, Codex and Cursor all use the VPS MCP URL plus their token.

## Exit criteria (revisit Hindsight if any fail after step 4)

- Direct `recall` p50 latency is still too slow for interactive use (target to be set from the step 1 baseline).
- Agents still repeat discovery on most tasks after the instruction change.
- Shared writes from several orchestrators cause conflicts that the single-writer server does not prevent.

If one fails, run Hindsight for one week on the same tasks and compare with numbers, not benchmark claims.
