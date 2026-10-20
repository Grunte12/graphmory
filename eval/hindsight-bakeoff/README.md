# Graphmory vs Hindsight bake-off (2026-10-20)

Same corpus for both: `eval/real-vault/vault` (54 notes) and its 34 questions with known answer notes. Hindsight 1.0.0 ran locally (embedded Postgres, `openai-codex` provider, `gpt-6-luna` low for ingest extraction). Graphmory ran from this checkout. No Claude model was used in either test.

## 1. Retrieval only (`run.mjs`, no LLM at query time)

| System | hit@5 | MRR | p50 | p95 | Avg response |
|---|---|---|---|---|---|
| Graphmory `recall` | 0.971 | 0.806 | 31 ms | 99 ms | 4,990 chars |
| Hindsight `recall` (default) | 0.941 | 0.834 | 1,210 ms | 1,893 ms | 82,425 chars |
| Hindsight `recall` max_tokens=1200 | 0.941 | 0.834 | 1,181 ms | 1,327 ms | 25,980 chars |

Hindsight ingest of 54 notes: 27 s. MCP tool list: Graphmory 6 tools / 8,047 chars; Hindsight 36 tools / 63,250 chars.

## 2. Agents (`agents.mjs`, headless Cursor CLI, 5 questions per system)

Each run: the agent sees one memory MCP server and must answer with the source note.

| Model | System | Correct source | Median time | Median tool calls (simple Qs) | Median input tokens incl. cache |
|---|---|---|---|---|---|
| Grok 4.7 low fast | Graphmory | 4/5 | 27.8 s | 3 | 99k |
| Grok 4.7 low fast | Hindsight | 4/5 | 42.1 s | 10.5 | 218k |
| Gemini 3.7 Flash | Graphmory | 3/5 | 50.9 s | 5.5 | 154k |
| Gemini 3.7 Flash | Hindsight | 4/5 | 57.5 s | 10 | 218k |

Observed behavior:
- Graphmory simple questions: `recall` then `read`, 3 calls. Hindsight: agents wander across its 36 tools (`list_documents`, `list_memories`, `get_document`, knowledge-base tools), and Grok re-ran tool discovery up to 10 times in one run.
- Both systems loop on the multi-hop question (25-34 calls). Graphmory needs a way to return linked neighbors in one call.
- When MCP calls were blocked (first smoke run), Gemini Flash invented a source path instead of saying it had no memory.
- The correctness check is coarse (any expected path or slug in the answer); 5 questions per cell is a small sample.

Hindsight does expose `delete_document`; whether derived facts are removed with it was not tested.

Raw JSON: `results-2026-10-20*.json`, `agents-*-2026-10-20.json`.

## 3. Graphmory v2 changes and re-test (same day)

Changes: `read` now returns `links` (resolved outgoing links and backlinks by exact path, max 40); `recall` description carries a short stop rule; the server instructions are a plain description. Re-scored with `rescore.mjs` (coverage = share of expected notes the answer names by path, slug or short title), because the first checker missed correct answers that cited only the seed note.

| Question | Model | Before (coverage / calls) | v2 (coverage / calls) |
|---|---|---|---|
| link-recovery-selfrag | Gemini Flash | 1.0 / 10 | 1.0 / 6 |
| link-recovery-selfrag | Grok 4.7 | 0.5 / 3 | 1.0 / 3 |
| multihop-agent-memory-foundations | Grok 4.7 | 0.67 / 25 | 0.67 / 22 |
| multihop-agent-memory-foundations | Gemini Flash | 0.67 / 29 | 0.67 / 35 |
| link-recovery-sage | both | not run | 0.5 / 3 (Grok), 0.5 / 8 (Gemini) |
| multihop-lifecycle-cluster | both | not run | 0.63 / 8 (Grok), 1.0 / 13 (Gemini) |

Findings:
- The "foundations" question asks for a "related-work section" that is not in the vault. Agents find the answer within 4 calls and then keep searching for the section; Hindsight agents looped the same way (32-34 calls). The stop rule in the tool description did not stop it.
- Cursor's auto-review rejected some Graphmory MCP calls (including read-only `recall`), reported as `isReadonly: false`, in 6 of 33 Graphmory runs, and never in Hindsight runs. Changing the server instructions to a plain description removed it in one re-test, but it came back once in the next batch. Cause not confirmed; it is decided inside Cursor.
- Samples are small (1 run per cell); treat differences of one or two calls as noise.
