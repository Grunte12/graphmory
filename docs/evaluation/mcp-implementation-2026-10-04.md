# MCP implementation — 2026-10-04

Branch: `feat/mcp-server`; uncommitted local changes. SDK 1.32.0, MIT; dependency notices checked locally. No paid/external API calls or personal vaults; tests use synthetic temporary vaults and local MCP clients. Network was used only for the authorized SDK package installation; subsequent dependency/packaging operations were offline.

MCP provides three one-line tools (`recall`, `read`, `remember`), annotations and five guide resources. Stdio and authenticated stateless Streamable HTTP POST share the in-process engine. A startup-only vault path, controlled errors, per-request bearer authentication, explicit remote-bind gate, origin rejection and request-size limit guard HTTP. The parsed vault index and existing lazy BGE pipeline are retained; bytes and source/summary freshness are rechecked, and pending state blocks ordinary reads. No per-call CLI subprocess or hosted decision call exists.

Write design: the host reviews support, conflicts, permission and exact placement, supplies the complete Memory Patch and target/source hashes, and the server executes the guarded transaction. New canonical notes and authorized supersession are supported. The prepare/apply remember family returns a typed needs_curation checkpoint and can complete only that bound placement. Full finish validates saved fields, immutable sources, covered-file drift, affected graph/lifecycle and receipts. Existing arbitrary note-body merges and conflict resolution remain the host/CLI workflow; review booleans do not establish semantic truth. Interrupted writes remain pending for reviewed CLI recovery; no automatic rollback is claimed.

Verification: the MCP suite passed 13/13 across in-memory, stdio and HTTP. Related retrieval/candidate suites passed 36/36, including seven new candidate tests. CLI ranked-path parity, compact paging, stale hashes/cursors, source boundaries, read authority during awaits, APPLIED/TENSION/BLOCKED, wrong checkpoint binding, supersession and replay are covered. HTTP initially could not bind under the sandbox; the approved synthetic loopback run passed. The initial full check exposed an offline empty-cache fixture assumption; the fixture now uses cached runtime dependencies without network and verifies the packed MCP launcher. The corrected offline fixture freezes versions to the repository lockfile and exercises packed recall and guide resources. The final `npm run check` passed: 465 tests total, 460 passed, five pre-existing skips, zero failures; five example contracts validated; all eight configured deterministic eval suites passed. `git diff --check` passed. Synthetic local-only vault status returned `SYNC_CONFIG_NOT_FOUND` as expected because no Git sync configuration was created. The architecture SVG was rendered locally with Sharp and visually inspected.

All new retrieval candidates remain opt-in. See [candidate results and unrun held-out gates](retrieval-candidates-2026-10-04.md). No benchmark/speed/token savings claims.

| Film item | Product status |
|---|---|
| 1: four agents share MCP memory | Interface and four host templates implemented; four-host native discovery/workflow not tested |
| 2: recall/read/remember tools | Implemented and tested on both transports |
| 3: keyword + meaning, eight seeds | Existing hybrid engine retained and tested with synthetic semantic hooks; actual BGE model inference/large-vault run not performed here |
| 4: three-hop links | Existing BFS and candidate PPR caps tested; graph connectivity is discovery only |
| 5: lifecycle exclusion | Existing filters retained; MCP supersession regression passes |
| 6: RRF then rerank | RRF k=60 active; post-fusion margin section rerank opt-in only; unconditional default rerank beat is not true |
| 7: Curator reads/verifies, cited brief | Tools/resources/skill support this; live host Curator synthesis not tested in this task |
| 8: remember outcomes and supersession | APPLIED receipt, TENSION/BLOCKED, pending guards and authorized supersession tested |
| 9: vault/cache/fingerprints/private sync | Existing contracts retained; no personal vault/sync accessed here |

Open gates: native MCP discovery and complete host workflow on each named agent; real BGE inference and residency measurements; all held-out promotion gates; review whether deterministic new-note placement suffices before expanding into existing-note merges; independent semantic review remains a host responsibility. Keep the film's capability qualifiers and optional rerank honest.

## Deterministic evaluation numbers

These are synthetic regression results, not live-model superiority evidence.

| Check | Result |
|---|---|
| Retrieval baseline | 8 notes / 15 queries; BM25F section Hit@3 93.3%, Recall@3 84.4%, MRR 0.861, nDCG@3 0.807 |
| v0.5 acceptance | Seven runs, 250–5000 notes; Recall@3 99%, current-memory accuracy 100%, MRR 0.990, zero polluted queries; all eight gates passed |
| Lifecycle | 10/10 checks; six findings and six review actions |
| Conflict assist | 15/15 checks over synthetic local Git histories |
| Curator | 8/8 deterministic scenarios; no host/model invocation |
| Patch quality | 3/3 expected-score cases |
| Learning loop / future task | 2/2 each |
| Frozen graph-hard baseline/BFS | 209 notes / 30 questions; Hit@3 23/23, complete@12 19/23; seven unanswerable cases still return candidates; paired complete@12 p=1.0 |

Temporary full-check log: `/tmp/graphmory-mcp-check-final.log`. No historical result file was overwritten. Held-out candidate metrics, warm/cold rotated latency and native Curator citation accuracy remain unmeasured; no stage is promoted.

## Files changed

Runtime and packaging: `scripts/graphmory-mcp.mjs`, `src/mcp-server.mjs`, `src/mcp-engine.mjs`, `src/retrieval-candidates.mjs`, `src/curation-checkpoint.mjs`, `src/decision-recall.mjs`, `src/memory-recall.mjs`, `src/hybrid-recall.mjs`, `scripts/brain-sync.mjs`, `package.json`, `package-lock.json`.

Tests: `test/mcp.test.mjs`, `test/retrieval-candidates.test.mjs`, `test/fresh-install.test.mjs`.

Guidance/assets: `README.md`, `PRIVACY.md`, `THIRD_PARTY_NOTICES.md`, `skills/memory-curator/SKILL.md`, `docs/guides/mcp-recall.md`, `docs/guides/mcp-remember.md`, `docs/guides/managed-retrieval.md`, `docs/design/architecture.md`, `docs/assets/graphmory-architecture.svg`, `docs/assets/graphmory-architecture.html`, this report and `retrieval-candidates-2026-10-04.md`. The provided handoff and retrieval proposal remain untracked inputs; no commits, pushes, PRs, publishing or attribution trailers were created.
