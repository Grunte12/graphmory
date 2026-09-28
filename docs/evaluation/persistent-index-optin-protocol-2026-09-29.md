# Optional persistent index: frozen product screen

## Scope

Expose a **manual opt-in** cache for `recall-managed` Curator mode. Keep the existing path and package dependency set unchanged by default. The caller gives a cache directory outside the vault; Graphmory names a private database by canonical vault path and scope. On a supported Node runtime, build it from the already loaded Markdown on first use and transactionally update changed, added, deleted and renamed notes. On Node 20 or any cache error, run the existing scorer and emit at most one compact fallback diagnostic to stderr; never use stale results. Cache files must be mode 0600 in a mode 0700 directory. Do not index or publish the user's Obsidian vault during development.

The [Node SQLite documentation](https://nodejs.org/api/sqlite.html) dates `node:sqlite` to Node 22.5, so the opt-in SQLite implementation requires Node 24 in this screen. Keep Graphmory's `node >=20` installation contract by dynamically loading the module only on supported runtimes. [SQLite's atomic-commit documentation](https://www.sqlite.org/atomiccommit.html) motivates one transaction per incremental update; this is a correctness hypothesis to test rather than proof our integration is crash-safe.

## Frozen gates

1. **Default and fallback:** no flag yields byte-identical managed JSON. A simulated Node 20 capability decision never loads SQLite and yields the same JSON. Missing, corrupt or busy cache must not reach the Curator as stale evidence. The CLI must reject a cache directory inside the vault.
2. **Lifecycle:** on the existing six generic mutation states and 12 frozen queries, compare opt-in results with baseline after each add/edit/delete/rename; require exact full JSON and source hashes. A failed update before commit must leave the previous DB valid; the next request must recover or fall back correctly. Run two simultaneous cold-cache calls and require both outputs to match baseline and the final index to be readable.
3. **Whole-command parity and cost:** on exposed SciFact's first 5,000 loaded notes, compare the first 30 frozen queries with the installed `recall-managed` CLI using one shared warmed cache and alternating fresh-process baseline/index calls. Require 30/30 exact full JSON, p50 at least 20% lower, p95 and output bytes no worse. Record cache build/update time, bytes and first-call penalty separately. This is not a full 5,183-note official BEIR score.
4. **Small-vault guard:** the opt-in flag works on the 55-note read-only local vault without changing it, but no automatic size threshold or default is introduced from the ten-query noisy result. Only aggregate hashes/timings may be committed.

Record all attempts and failures. A pass permits documenting an experimental opt-in; it does not satisfy supported-complete answer quality, independent holdout, Node 20 runtime testing on an actual Node 20 binary, or matched competitor workflow. No universal superiority claim follows.
