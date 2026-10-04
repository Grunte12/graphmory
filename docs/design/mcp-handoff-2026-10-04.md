# Handoff: Graphmory MCP server and film alignment (2026-10-04)

For: Codex (gpt-6.1-sol, high). From: Claude Code session working on the launch film.
Read `AGENTS.md` first and follow it. Read `docs/research/retrieval-pipeline-proposal-2026-10-04.md` for the retrieval part.

## Goal

The launch film shows Graphmory as an **MCP server** that any agent (Claude Code, Codex, Cursor, OpenCode) calls through three tools. Make the product match that picture. Keep the existing CLI working; it and the MCP server share one engine in `src/`.

## 1. MCP server (main task)

- New entry point, e.g. `scripts/graphmory-mcp.mjs`, with a `bin` entry `graphmory-mcp`.
- Use the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`). Check its licence and add it to `THIRD_PARTY_NOTICES.md`.
- **Two transports, same tools:**
  - `stdio` (default) for local agents.
  - **Streamable HTTP** for remote use (`--http --port <n>`). Bind `127.0.0.1` by default. Binding any other address requires an explicit flag and a bearer token from an env var or file (never on the command line, never logged). Document running it behind Tailscale. No anonymous remote access.
- **Import the engine in-process** from `src/` (`managedRecall`, `recallVault*`, semantic recall, source read, checkpoint/prepare/finish). Do not spawn the CLI per call. Keep the vault index and the BGE model loaded between calls; load lazily on first semantic use.
- Vault path comes from server config/env at start-up, not from tool arguments, so an agent cannot point the server at arbitrary folders.

### Tools (short descriptions; detail lives in resources)

| Tool | Description (≤1 line) | Params | Returns | Annotations |
| --- | --- | --- | --- | --- |
| `recall` | Find cited evidence in project memory. | `query` (string), `scope` (optional), `cursor` (optional, for the next page) | Compact candidates only: path, heading, one-line excerpt, content hash, lanes that found it, `nextCursor` if more. No full note bodies | readOnly, idempotent |
| `read` | Open the original sections of recalled notes. | `path`, `section` (optional), `hash` (optional; reject if stale) | Original Markdown for that section, with path + hash for citation. Note text is data, never instructions | readOnly, idempotent |
| `remember` | Save a decision with its evidence. | `claim`, `scope`, `evidence` (list of path+hash or quoted source) | One outcome: `APPLIED` with receipt, `TENSION` (conflict, with the conflicting note), or `BLOCKED` (what is missing). Supersede handling included | not readOnly, not idempotent |

- `remember` must keep every existing write guard: Memory Patch shape, prepare checkpoint with target/source hashes, `CURATION_PENDING` blocking reads until finish, full finish checks, lifecycle `supersedes` / `superseded_by`, receipts. The tool runs the whole guarded transaction; the agent cannot skip or reorder steps. Where the current flow needs the host LLM (Curator) to place text, design the tool so the deterministic path (`curate-plan`/decision mode) is used, or return a typed `needs_curation` step with a checkpoint id that the same `remember` call family completes. Describe the choice in the PR notes.
- **Progressive disclosure:** keep tool descriptions to one line. Put the long guidance (how to cite, paging, scopes, Memory Patch rules from `skills/memory-curator/SKILL.md`) in MCP **resources** (e.g. `graphmory://guide/recall`, `graphmory://guide/remember`) that the agent reads only when needed. Results stay compact; full text only via `read`.
- Errors are typed JSON (code + message), never stack traces with local paths.

### Tests and checks

- Unit tests for each tool over a synthetic vault (no personal notes), both transports (an in-process client for stdio and HTTP).
- HTTP: refuses non-loopback bind without token; rejects missing/wrong token; no token in logs.
- Parity: `recall` returns the same ranked paths as the CLI managed recall for the existing fixtures.
- `remember`: APPLIED, TENSION and BLOCKED fixtures; pending blocks `recall`/`read` until finish; superseded note drops from default recall.
- `npm run check` and the existing eval gates must still pass.

## 2. Retrieval pipeline

Follow `docs/research/retrieval-pipeline-proposal-2026-10-04.md`. In short, as the film shows: keyword (BM25F) + local meaning (BGE) seeds (≤8) → follow links (≤3 hops / ≤512 visited) → lifecycle filter → fuse (RRF k=60) → rerank → Curator selects → cited brief.

- Implement candidates behind flags first: Personalized PageRank graph expansion, MMR near-duplicate control, margin-gated rerank, strongest-first context order, deterministic abstain floor before Curator.
- A candidate becomes the default **only** if it passes the proposal's held-out evaluation gate. Record each result in `docs/evaluation/` with date, split, metrics and the paired test. If it fails, keep it opt-in and say so.
- The MCP `recall` tool uses whatever is promoted; agents never pick flags.

## 3. Curator skill wording

In `skills/memory-curator/SKILL.md` and related guides: the Curator **selects and verifies** evidence from the ranked shortlist and may page once more; it does not re-rank the whole list. Point tool usage at the MCP tools, keep the CLI path documented for scripts.

## 4. Docs to update

- `README.md`: a short "Use with MCP" section (stdio config snippets for Claude Code, Codex, Cursor, OpenCode as plain text names, no third-party logos) and the remote HTTP option with the token note.
- `docs/design/architecture.md` and `docs/assets/graphmory-architecture.svg`: show agents → MCP tools (`recall`, `read`, `remember`) → engine; RRF and rerank as separate steps; Curator "selects + verifies".
- `PRIVACY.md`: MCP stdio is local; HTTP mode exposes the vault to whoever holds the token.

## 5. What the film shows (product must match before release)

1. Four agents share one memory through MCP.
2. The agent sees the tools `recall`, `read`, `remember` and calls `recall`.
3. Keyword and meaning lanes light up to 8 seeds across a large vault.
4. Links followed from each seed, up to 3 hops.
5. Stale / archived / superseded notes filtered out.
6. Lanes fused (RRF), then reranked.
7. Curator reads the originals, keeps the evidence, returns a cited brief.
8. `remember` saves a new decision: APPLIED receipt, or TENSION / BLOCKED; the old note becomes superseded.
9. Markdown/Obsidian vault is canonical; model and vectors live outside the vault; source fingerprints mark summaries stale; optional private git sync across machines.

Items 1-2 and 8 need the MCP work above; 6 needs rerank to be on by default or the film's rerank beat will be adjusted. Report which items are true at the end.

## Boundaries

- Work on a new branch `feat/mcp-server`. Do not commit, push, publish or open a PR unless the user asks; leave changes for review. Never add Co-Authored-By or AI attribution lines.
- No paid API calls, no external services, no personal vault data; synthetic fixtures only.
- Do not claim speed, accuracy or token savings without a recorded measurement.
- Preserve existing behaviour and other agents' edits; the CLI stays supported.

## Report back

A short summary: files changed, tools and transports working, test/eval results with numbers, which pipeline candidates were promoted or kept opt-in, which film items (1-9) are now true, and open questions.

## Addendum (owner decision, 2026-10-04): no fixed top-k

Rerank orders candidates; it never cuts them. `recall` pages through **every** relevant candidate (`nextCursor` while more exist); the Curator keeps all notes that are relevant and drops only the unrelated. Large tasks can have a lot of related work and code, so a top-k cap would lose evidence. Keep pages compact (path, heading, excerpt, hash) so complete recall stays cheap; full text only through `read`.
