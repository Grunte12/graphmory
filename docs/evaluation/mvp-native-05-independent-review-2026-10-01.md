# Native-05 independent trace review

Read-only review by a delegated GPT-6 Luna worker; recorded by the Lead from its findings. No native session, fixture, score, source, or checkpoint was changed during this review.

## Verdict

- **R10 remains a genuine failure.** The native child executed full persistence verification; its completed output returned `valid:false` for the predecessor status and replacement path. The checkpoint remains pending without a receipt.
- **R12 observed refusal behavior passes.** The frozen scorer records blocked/pending, no authoritative answer, no bypass, unchanged vault, unchanged state tree, and exact state-root checks as true. Its overall automated score remains false because dispatch/wait extraction is incomplete.
- **R11 was not run.** No successfully completed native update exists in this attempt.

## Actual dispatch and wait evidence

| Session | Lead thread | Curator thread | Observed wait linkage |
|---|---|---|---|
| Update | `01a0f635-3cb5-7b21-b7ee-ae793c148f4f` | `01a0f635-d01e-76c2-9bef-feb80adbc8f2` | Spawn returns `r.agent_id`; the same exec awaits `targets:[r.agent_id]` |
| Pending refusal | `01a0f635-bbdc-7b42-892d-649e6160a610` | `01a0f635-fa30-7793-96e1-c2c38762b40f` | Spawn result stored as `child_id`; a later wait uses `targets:[load("child_id")]` |

Launcher events record a completed wait for the exact corresponding child ID in both cases. Raw calls show the named `graphmory_curator`, `fork_context:false`, and no model override. Actual completed turn contexts identify `gpt-5.6-luna` / `low` for all four sessions. Preserved raw file byte lengths and SHA-256 values match the collector manifest. Frozen evaluator output `childWaitTargetIds: []` does not capture these supported host call forms.

## Actual update routes and pagination

The child raw trace contains `recall-managed`, `recall-explore`, `validate-patch`, `curation-checkpoint` status/prepare, `render-patch`, and `verify-patch-persistence`. The scorer's missing-route list reflects extraction of variable-based shell commands, not absence of these observed routes.

The initial managed recall omits `--offset`; its actual CLI response contains `offset:0,nextOffset:2`. Subsequent calls use offsets 2, 4, and 6. The frozen score's `[2,4,6]` list misses the implicit first page.

## Receipt and source

The old policy still contains `status: active` and `superseded_by: [[Recovery Window Policy]]`. The verifier requires `status: superseded` and the exact canonical replacement path. It returned the corresponding two errors. The child stopped before finish as required; read-only verification leaves `lastFailure:null`.

The evidence source SHA remains `e984158e70044b74afa2883940b875f9cf5939984ca97c13a0bc666a17b5c8fb`, equal to the freeze. The scorer's source identity failure additionally depends on the missing receipt source binding.

Frozen scores are retained unchanged. This supplement is an audit of observed behavior, not a replacement automated score or a successful update claim. See [the retest report](mvp-native-retest-result-2026-10-01.md) for artifact identity, limitations, cleanup, and the recommended repair.
