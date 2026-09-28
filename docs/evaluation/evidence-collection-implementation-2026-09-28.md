# Evidence collection: implementation checkpoint, not an answer benchmark

## Why this change

The [architecture decision](../research/architecture-decision-2026-09-28.md) chooses original collection and provenance accounting over more ranking tweaks. Luna's code inventory confirmed that static contextual prefixes mostly repeat existing path/title/metadata/heading fields in `src/retrieval.mjs`; generated semantic context remains distinct and untested. The decision adapts GraphRAG's map/reduce pattern without claiming to reproduce its results or adding graph extraction infrastructure.

## Implemented experimental interface

`src/evidence-collection.mjs` reuses `readSourceNotes` from `src/source-read.mjs`. The existing CLI exposes this optional mode; ordinary `read-notes` is unchanged:

```sh
node scripts/brain-sync.mjs read-notes --vault /path/to/vault \
  --paths '["project.md","decision.md"]' \
  --collect-state /path/outside/vault/collection.json --bundle-bytes 16000
```

Repeat the identical command while `hasMore` is true. Paths are the explicit reading scope; there is no top-k limit on their number. Large originals continue by UTF-8 byte offset and can be reconstructed exactly. The byte bound applies to JSON stdout excluding its trailing newline. A page budget limits transport, not related evidence. The collector does not discover additional semantically relevant notes or remove lifecycle filters; the caller must supply the authorized source scope. Exhaustive history questions require all eligible notes from that history, not merely lexical hits.

Each task must own its state file; concurrent writers to one state are unsupported. The file is written with mode 0600 and replaced atomically. Keep it outside the vault and Git: ledger quotes/facts may contain private memory. Do not overwrite another task's state. Source drift or a scope mismatch is refused rather than silently restarting collection.

After a source is fully delivered, the same command can append an evidence record:

```sh
node scripts/brain-sync.mjs read-notes --vault /path/to/vault \
  --paths '["project.md","decision.md"]' \
  --collect-state /path/outside/vault/collection.json \
  --record-span '{"path":"project.md","sourceSha256":"<hash-from-page>","startLine":2,"endLine":2,"quote":"<exact-line>","fact":"<candidate-fact>"}'
```

Line numbering is one-based; quote text must equal the complete specified line range, including original CR characters where present. Exact duplicate records are idempotent. `spanVerified` means text/hash identity only; `entailment` and `semanticCompleteness` remain `unverified`. Full delivery does not prove the Curator read, understood, or exhaustively extracted every fact. The ledger stores candidate facts, not automatically trusted claims.

## Actual verification

Six tests exercised real temporary Markdown files and the actual CLI: multiple pages with a late source, long Thai/emoji/quoted originals and exact JSON byte bounds, partial delivery/invalid spans, changed/deleted originals, traversal/symlink/duplicate-path rejection, tiny-budget non-advancement and empty sources, private CLI state continuation and unchanged state after source drift. All six passed. These are implementation checks, not experiments demonstrating model quality or general latency.

Repository `npm run check` passed 337/337 tests and configured deterministic gates. `git diff --check` passed. Read-only personal-vault status returned `SYNC_CONFIG_NOT_FOUND`, as before.

No live Curator/Lead trial was run, no official benchmark scores or sealed holdout were changed, and no personal vault notes were written. The existing experimental runner remains the integration owner; this adds a source-delivery primitive, not another model orchestrator. Curator extraction/reconciliation and final synthesis integration remain open.

## Performance limitation and next gate

The correctness-first implementation currently validates and reads the explicit source scope on every page; work and transient memory scale with total scoped original bytes. CLI continuation also checks the scope snapshot before using persisted state. Large-scope performance is therefore unproven and must be measured before default promotion. This is not a reason to silently skip integrity checks or declare a latency win from small tests.

Freeze the eight source-verified development slots and all actual resource ceilings from the architecture memo before generation. Ensure both comparators can read originals/continue equivalently, integrate the existing Curator runner, then execute only the planned 24 workflows. Full supported completeness, abstention and unsupported-claim gates come first; the memo's token/time caps are engineering screening rules, not research-derived guarantees. One implementation/protocol-defect revision is allowed with preserved old artifacts, not an unlimited tuning loop. No promotion follows from this checkpoint.
