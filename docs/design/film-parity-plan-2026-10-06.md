# Film parity plan (2026-10-06)

Goal: the product does everything the launch films show (full-r21, short-r11). The films are approved and stay as they are; the code changes to match them.

- **Sources compared:**
  - The final narration (take A, ElevenLabs Scribe transcript).
  - Every on-screen label in the final scenes (v24-*/index.html).
  - research/PRODUCT-DECISIONS-2026-10-04.md (D1–D6).
  - This repo at 3c5abbc.
- **Baseline:** `npm test` gives 465 tests: 460 pass, 0 fail, 5 skipped.
- **Rules:**
  - No commit or push unless the owner asks.
  - No speed, accuracy or token-saving claims.
  - Synthetic notes only in evals.

## 1. Already true (no work, keep covered by tests)

| Film claim | Evidence |
|---|---|
| 3 tools: recall · read · remember | src/mcp-server.mjs:22-45 |
| Keyword + meaning find the seeds; follow links up to 3 hops | src/hybrid-recall.mjs:33-36 (trail ≤ 4 notes); src/runtime-config.mjs:9 (`retrievalMode: "hybrid"` default for new configs) |
| Every lane fuses into one ranking (RRF) | src/memory-recall.mjs:242-256 |
| Stale notes drop away; superseded is kept as history but not recalled | src/retrieval.mjs:89-98 |
| No evidence → "No supporting note" | ABSTAIN_FLOOR, src/mcp-engine.mjs:79 |
| Low-confidence memory is not saved silently | LOW_CONFIDENCE, src/mcp-engine.mjs:123 (but see P0-3: the film says it *waits for review*) |
| Curator files the patch without changing a word; receipt hash | Deterministic `renderPatchRecord` + `writeFileAtomic`, receipt: src/mcp-engine.mjs:153-175 |
| Replace a memory → the old note stays as history | MCP supersession marks the predecessor `superseded` + `superseded_by` (test/mcp.test.mjs:146-162) |
| Plain Markdown with status / valid_until / revalidate_when / evidence | skills/memory-curator/references/note-schema.md:14-28 |
| Sync with Git, every agent shares one memory | brain-sync push/pull, FF-only auto-pull |
| Summary shows source hashes; a changed source makes it stale and it leaves recall | src/summary-memory.mjs:44-66, src/memory-recall.mjs:75 |
| Setup asks for a vault and a small Curator model | adapters/generic-agent/INSTALL.md:16 |
| "Start on GitHub", open source | Install from clone (docs/guides/install.md:19-32); npm package not published, and the film does not claim it |

## 2. Gaps: film shows it, code does not (yet)

### P0: claims made in narration

**P0-1. Brief contract: explicit no-evidence outcome and stop reason (D2 + D1)**
- **Film:** recall ends in a "CITED BRIEF" ("hands back a brief with sources"). The abstain scene shows "No supporting note" with an empty SOURCES tray.
- **Now:**
  - `schemas/brain-brief.schema.json` requires `relevant_memory` with `minItems: 1`, so a valid brief cannot say "nothing found".
  - The brief has no stop reason.
- **Do:**
  1. Add `outcome: "answered" | "no-evidence" | "partial"`. Allow an empty `relevant_memory` / `note_paths` only when the outcome is `no-evidence`.
  2. Add `stop_reason: "nothing-relevant-left" | "evidence-sufficient" | "budget" | "scan-limit"` and `pages_read` (integer).
  3. Add `sources` per item (path + hash) so "with sources" is checkable.
  4. Validate briefs in src/contracts.mjs (or wherever brain-brief is validated). Update examples/ and `validate:examples`.
  5. Update the recall guide resource text (`graphmory://guide/recall` in src/mcp-server.mjs) and SKILL.md: the Lead must surface `no-evidence` as "no supporting note", never a guess.
- **Tests:**
  - Schema accepts no-evidence with empty items.
  - Schema rejects `answered` with empty items.
  - Example briefs validate.
- **Effort:** ~1 h.

**P0-2. Adaptive paging: "works down the list … stops when nothing relevant is left" (D1)**
- **Film:** the Curator reads PAGE 1, 2, 3, then shows "stop · nothing relevant".
- **Now:**
  - SKILL.md MCP section says "It may page once more", which contradicts the CLI section of the same file ("continue until evidence is sufficient or `hasMore` is false").
  - The server has no page budget.
  - `src/adaptive-recall.mjs` is an opt-in experiment, not the default path.
- **Do:**
  1. **SKILL.md and the recall guide:** one stop rule for both MCP and CLI.
     - Keep paging while the last page gave at least one relevant item.
     - Stop after the first page with zero relevant items (allow one extra empty page for a multi-part question).
     - Hard budget: 8 pages / 80 candidates.
     - Report `stop_reason` and `pages_read` in the brief (P0-1).
  2. **MCP `recall`:**
     - The signed cursor carries a page number.
     - Every response returns `page`.
     - After page 8, return no `nextCursor` and set `budgetReached: true`. The server only enforces the budget; the host Curator still judges relevance.
  3. **Eval:** add `scripts/eval-deep-paging.mjs`.
     - Synthetic vault: multi-hop questions whose needed notes rank 11–30.
     - Pass: the needed notes appear in the brief.
     - Show that `stop_reason` is `nothing-relevant-left` on questions that need nothing beyond page 1.
     - Add to `npm run eval`.
  4. Leave `src/adaptive-recall.mjs` as an experiment. Document that the default Curator flow does not use it.
- **Tests:** cursor page count, budget cutoff, cursor tamper still rejected, existing STALE_CURSOR tests unchanged.
- **Effort:** ~3–4 h including the eval.

**P0-3. Low-confidence memory "waits for your review"**
- **Film:** remember with confidence low → "LOW · BLOCKED", "BLOCKED · needs your review", with a Review button.
- **Now:** MCP refuses ("needs owner review outside MCP"). Nothing waits; the patch is lost unless the agent keeps it.
- **Do:**
  1. On LOW_CONFIDENCE, the server stores the full reviewed request in a pending-review queue under the private state root, outside the vault, so it is never recalled.
     - Return `{ status: "BLOCKED", code: "LOW_CONFIDENCE", reviewId, step: "owner_review" }`.
  2. Add the CLI command `graphmory review list | show <id> | approve <id> | reject <id>` for the owner only. There is no MCP approve tool, because the agent must not approve its own memory.
  3. `approve` re-checks source and target hashes. On drift it reports STALE and does not write.
     - Then it runs the normal checkpoint flow with owner authorization.
     - It records `approved_by: owner` in the receipt.
     - `reject` deletes the queued item.
  4. Run the secret scan before queueing: secrets are refused, not queued.
- **Tests:**
  - The queued item is invisible to recall.
  - Approve applies with a receipt.
  - Approve after source drift → STALE, no write.
  - Reject leaves the vault untouched.
  - A secret is never queued.
- **Effort:** ~2–3 h.

**P0-4. `graphmory doctor` matches the setup scene**
- **Film:** `graphmory doctor` prints "vault ok", "curator model ok", "mcp tools: recall · read · remember".
- **Now:** doctor checks node, git, gh, vault path, permission and sync config. It does not check the Curator model or MCP tools (scripts/brain-sync.mjs:579-680).
- **Do:**
  1. **`curator-model` check:** find the agent definition written by `graphmory-setup` for each host (paths in docs/guides/agent-hosts.md:32-33).
     - Pass when a model is pinned and is not `inherit`.
     - Warn when no host agent is installed.
  2. **`mcp-tools` check:** start the engine in-process (no network), list the tools, and require exactly recall/read/remember.
  3. **`semantic-backend` check:** warn when `@huggingface/transformers` or the BGE model is unavailable, so "meaning" search is not silently missing.
  4. **Human output:** add short summary lines (`vault ok`, `curator model ok (<model>)`, `mcp tools: recall · read · remember`) above the detailed list. Keep `--json` backward compatible (only new check ids).
  5. INSTALL.md: guided setup ends by running doctor (D4).
- **Tests:** each new check pass, warn and fail; the JSON shape stays a superset.
- **Effort:** ~1.5 h.

**P0-5. "When a source changes, the notes built on it are flagged for a recheck"**
- **Now:** a stale summary is silently excluded from recall. `summary check` exists only per note. `lifecycle-audit` does not list summaries whose sources changed.
- **Do:**
  1. `lifecycle-audit` adds the finding `summary-source-changed` (medium) for every stored summary whose `summary_sources` hashes no longer match. It names the changed sources. It stays read-only.
  2. MCP `recall` adds `recheck: [{ path, changedSources }]` when a summary was dropped for freshness, so the agent can tell the user. Recall stays read-only.
  3. Add an MCP-level test for D3: change a source, recall no longer returns the summary, and it is listed in `recheck`.
- **Effort:** ~1.5 h.

### P1: shown on screen, partially true

**P1-1. "If a change would replace a memory, it asks your agent"**
- **Now:** the engine detects no conflicts. It trusts the host flag `conflictsReviewed: true` and only returns TENSION when the host passes `conflictPath`.
- **Do:**
  1. Before placement, recall within the patch scope for active notes of the same `suggested_type` whose title or claim strongly overlaps (BM25F top hits above a set threshold) and that are not listed in `lifecycle.supersedes`.
  2. If any exist, return `TENSION` with `conflictingNotes: [{path, hash}]`, unless the request carries `reviewedConflicts: { path: hash }` for each of them.
  3. The host still decides. The engine only refuses to skip the question.
- **Tests:**
  - New pricing decision vs old pricing decision → TENSION.
  - With the reviewed hashes → APPLIED.
  - Unrelated note → no TENSION.
  - A changed hash after review → TENSION again.
- **Effort:** ~2 h. Tune the threshold on the existing conflict eval (15 cases) so it does not fire on unrelated notes.

**P1-2. Hosts shown in the film (D5)**
- **Film chips:** Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Antigravity, Windsurf, OpenCode, Cline, Zed, plus "Any MCP client".
- **Now:**
  - README has one generic `mcpServers` snippet.
  - agent-hosts.md covers Codex, Claude Code and Cursor only.
  - Curator dispatch is verified on Codex and OpenCode only.
- **Do:**
  1. Add `docs/guides/mcp-hosts.md` with one checked config snippet per host, each from that host's current official docs, with links and a check date.
  2. Run a manual smoke on Claude Code and Cursor: native MCP discovery, recall/read/remember, Curator sub-agent dispatch. Record it in docs/evaluation/.
  3. Update the README sentence "native MCP discovery has not been tested…" to match the results. Never say "verified" for hosts that were not run.
- **Effort:** ~2 h of docs plus the owner's time for the two smokes (needs logged-in hosts).

**P1-3. Write outcomes are explicit (D6)**
- **Now:** APPLIED (receipt) / TENSION / BLOCKED exist.
- **Do:**
  - Check that the tool descriptions, the remember guide and the README name all three outcomes and the receipt hash.
  - Add one MCP test per outcome if any is missing.
- **Effort:** ~30 min.

**P1-4. "Keyword and meaning" on every install**
- **Now:** legacy configs without `retrievalMode` stay lexical. The semantic backend is an optional dependency with a one-time model download.
- **Do:**
  - Guided setup installs the optional dependency and pre-downloads the model (after the user agrees).
  - doctor warns (P0-4).
  - `mph config` offers to switch legacy lexical configs to hybrid. Never switch silently.
- **Effort:** ~1 h.

### P2: polish

- **P2-1.** SKILL.md: remove the contradictory paging sentences (covered by P0-2) and add the `no-evidence` and `recheck` handling.
- **P2-2.** README: embed `full-r21-github.mp4` (9.2 MB, under GitHub's 10 MB limit) at the top. Add Quick Start lines that match the film: ask your agent to install, then doctor.
- **P2-3.** CHANGELOG entry for every item above.

## 3. Order and gates

| Step | Items | Gate before the next step |
|---|---|---|
| 1 | P0-1, P0-4, P1-3 | `npm test` green, `validate:examples` green |
| 2 | P0-5, P0-3 | new tests green; manual run of `review list/approve` on a temp vault |
| 3 | P0-2 | `eval-deep-paging` passes; existing evals unchanged |
| 4 | P1-1, P1-4 | conflict eval 15/15 still passes, no false TENSION |
| 5 | P1-2, P2 | owner runs the Claude Code / Cursor smokes; docs updated to the result |

Total: about 15–18 h of work across several sessions. Every step ends with `npm run check` (test + examples + eval) and a short note in CHANGELOG.

## 4. Out of scope (not in the film)

- 3D or graph viewer UI (`graphmory view`): not decided.
- `prune` to archive: not decided.
- Publishing to npm: the film says "Start on GitHub".

## 5. Status (end of session, 2026-10-06)

Gate commands: `npm run check` exit 0 after every step. Tests: 500 total, 495 pass, 0 fail, 5 skipped. Nothing is committed.

| Item | State | Where |
|---|---|---|
| P0-1 brief outcome / stop_reason / pages_read / hash | Done | src/contracts.mjs, schemas/brain-brief.schema.json, examples/brain-brief-no-evidence.json, test/contracts.test.mjs |
| P0-4 doctor checks and summary lines | Done | src/doctor-checks.mjs, test/doctor-checks.test.mjs. New checks are warnings (MCP tools fail only if the tool list is wrong); a copy without node_modules warns instead of failing |
| P1-3 outcomes named | Done | tool description, README, mcp-remember guide, test/mcp.test.mjs |
| P0-5 recheck | Done | src/summary-memory.mjs (`summaryFreshness`), src/memory-lifecycle-audit.mjs, src/mcp-engine.mjs, test/summary-recheck.test.mjs |
| P0-3 review queue | Done | src/review-queue.mjs, `graphmory review`, test/review-queue.test.mjs. Approve needs an interactive terminal (checked by hand with a pseudo-terminal) |
| P0-2 adaptive paging | Done | one stop rule in SKILL.md and mcp-recall.md; page counter and 8-page budget in src/mcp-engine.mjs; `npm run eval:deep-paging` |
| P1-1 engine-side conflict check | Done | src/conflict-detection.mjs, test/conflict-detection.test.mjs. The plan said to tune on the 15-case conflict eval, but that eval covers Git conflicts, not note overlap, so it was probed on the bundled eval vault instead (0 of 54 flagged) |
| P1-4 meaning search on every install | Done | `graphmory semantic-warmup`, guided setup question, doctor warning, `config` states a legacy config is keyword-only |
| P2-2 README | Done | Quick Start and the full 2-minute film, uploaded as a GitHub attachment so the 90 MB file stays out of git | |
| P1-2 per-host MCP docs | Docs written: docs/guides/mcp-hosts.md. Only 5 hosts have vendor docs behind them; Cursor, Windsurf and Zed rest on third-party pages; Gemini CLI and Antigravity have no snippet. Gathered by a Haiku research agent, not re-opened by hand. Smokes on Claude Code and Cursor: **not run** (need logged-in hosts) | |

Behavior changes to know about: `remember` now returns `TENSION` when an active note of the subject overlaps and `reviewedConflicts` does not name it by hash; low-confidence `remember` is queued instead of only refused.
