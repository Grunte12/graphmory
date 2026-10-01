# Installed Luna update and fresh-session hybrid recall — 2026-10-02

## Result

**PASS for this synthetic Codex workflow.** An actual named `graphmory_curator` child updated memory through the installed package, received a matching completion receipt, and a second fresh Codex session dispatched another named child to recall current and historical facts. This closes this particular update → receipt → subsequent hybrid recall test; it is not certification of all hosts or the whole MVP acceptance matrix.

## Frozen setup and evidence

- Codex CLI 0.146.0; lead and actual child turn contexts: `gpt-5.6-luna`, low reasoning.
- Project-scoped named role, no personal config edits. Both children are independently identified by retained session metadata and read-only host thread metadata as `graphmory_curator`, Luna/low. Lead self-reports are not the role/model proof.
- Installed `0.5.0-rc.6` archive SHA-256: `38ce538d53dc63fb9a547eb88b7202639d688348b36a07fec55560295cadfe1a`.
- Synthetic vault: approved evidence, previous policy, and an explicitly authorized new policy. No user vault was read or changed.
- Existing local BGE fp32 weights and linked dependency runtime were reused; this does not establish a clean dependency download/install.
- Private retained evidence: `outputs/graphmory-hybrid-summary-20261002/native-run-01/`. Includes frozen inputs/identities, launch scripts, lead and child traces, exact source/preimage hashes, receipt, independent checks and `native-evidence.json`. Prior failures remain intact.

## Observations

| Check | Result |
|---|---|
| Actual named update child | Observed in dispatch and retained child metadata/turn context |
| Matching operation/patch completion receipt | PASS; `83f0c45f-0480-41c6-a75b-1874bbeade9b` |
| Original evidence and previous note body preserved | PASS; byte hashes and preimage body comparison |
| Code generated previous note lifecycle | `status: superseded`, canonical replacement `New.md` |
| Fresh model session and distinct named recall child | PASS |
| Actual hybrid CLI response | Sparse BM25/BM25F, semantic-vector and graph lanes reported in child tool output |
| Supported current and historical answer | Four hours from `New.md`/`Evidence.md#Current`; two hours from `Old.md`/`Evidence.md#Previous` |
| Recall made no source/target edits | PASS; hashes still match receipt |

Historical inclusion was explicit for the comparison. Ordinary current-only retrieval is checked separately in deterministic CLI tests. The completion receipt certifies persistence/structural checks, not semantic entailment. We manually inspected the simple authored claim against its immutable evidence.

The update child incorrectly labeled `New.md` as its “Child ID.” The recorded actual child ID is `01a0f8ac-07d4-7fc1-810a-cd455917c953`; recall child is `01a0f8b1-c2f2-77e3-bccf-667e06d89769`. This illustrates why we use dispatch/host evidence rather than agent wording for instrumentation.

## Latency and token observations

Retained update child trace spans approximately 78.4 seconds; recall child approximately 33.7 seconds. These include guide reading, reasoning and CLI operations; they are not retrieval latency alone or p50/p95 measurements. Lead turn accounting reports update input 176,897 (155,904 cached), output 914; recall input 240,562 (208,896 cached), output 1,155. These cumulative host counters are not a billing estimate or proof of ideal caching. Broad installed-guide searches and repeated instruction reads are visible; agent overhead remains a later optimization target despite fast local search.

## Review boundaries

After this archive was frozen, independent review identified two more source issues: same-target shorthand replacement links were rejected, and scoped summary dependencies from raw roots were classified differently from full-vault freshness checks. Their fixes and targeted regressions are recorded separately. This native run does not certify those later source edits, nor does it retrospectively repair the failed native-05 run.

Still separate: clean first-install/download, other hosts, native pending/refusal cases, summary creation through a native Curator, broader independent quality benchmarks and an isolated Hindsight comparison.
