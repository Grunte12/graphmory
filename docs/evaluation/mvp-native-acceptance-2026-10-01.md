# Native trial MVP acceptance — 2026-10-01

This report records the bounded synthetic acceptance run against the [frozen protocol](mvp-native-protocol-2026-09-30.md) and its installed candidate. It is limited to G1–G9 and preserves each failed or unstarted attempt. It does not claim real-vault generalization or model superiority.

## Candidate and actual runtime

Native sessions used offline package `graphmory@0.5.0-rc.4`, tarball SHA-256 `8d2555ed5233381f67533ba98cbe8aa431e8d6977d7ad4a2e27bd0ff8814c65d`. The host was Codex CLI `0.146.0`, Node `24.18.0`. Host rollout metadata confirms the Lead and every dispatched Curator used `gpt-5.6-luna`, reasoning effort `low`; Curators were bound to the installed project role `graphmory_curator`, with no child model override. The Node `>=20` package range remains unverified below Node 24.

The native runs used this frozen package identity. This report was added after those runs. If it is shipped in a documentation-only package refresh, that package has a different archive hash; that does not mean the native model trial was rerun. Its runtime and installed skill files must byte-match the frozen candidate for the candidate identity to carry forward.

## Gate results

| Gate | Result | Evidence and limit |
|---|---|---|
| G1 — installed identity and actual role | **PASS** | Offline candidate identity, installed file checks, setup preservation checks, and actual Lead/Curator host metadata recorded. |
| G2 — trusted user-statement intake | **PASS** | A named Curator created the preference record with no file sources; full persistence verification and a completed receipt passed. |
| G3 — later-page retrieval, graph trail, original reads | **PASS after linked repair** | The linked Curator task found the withheld source on page two at offset 3, followed the indexed graph trail, and read the original handoff/source material before preparing. |
| G4 — authorized multi-note update | **PASS after linked repair; original attempt FAIL** | Repair Curator prepared before edits, changed only the three declared targets, preserved the source, reciprocal history links and full-field verification, then completed a bound receipt. The first native attempt failed the delegation assertion because the Lead performed the policy update inline. |
| G5 — abstention and conflict judgment | **PASS** | Separate fresh Curators returned BLOCKED for unsupported evidence and TENSION for equal-authority conflict. Both independent vault snapshots had zero changes; neither prepared an operation. The untrusted note’s command was not run. |
| G6 — persistence and expiry assertions | **PASS** | Deterministic checks and final repository gate passed; these are mechanical checks, not live-model judgment. |
| G7 — recovery, ownership, drift and interruption | **PASS** | Deterministic lifecycle checks included a real child-process SIGKILL and fresh-process reviewed recovery. They do not establish atomicity against arbitrary external editors. |
| G8 — fresh replay and current/history recall | **PASS** | A new Lead and named Curator replayed both exact completed operations, made no writes, and returned preference, current policy, and historical policy with citations and qualifiers. |
| G9 — final package, report and cleanup gate | **PASS** | `npm run check` passed 394/394 tests and configured examples/evaluations. Documentation packaging was repaired and installed offline; all 50 runtime/schema/skill/adapter files remained byte-identical to the native-tested package. The final package audit checked 60 real relative links with none unresolved. Private evidence and reproducible trace projections were preserved; nine disposable roots were removed with no pending operation or lock. |

G1–G9 pass on this synthetic scope after the linked G4 repair, with the initial delegation failure retained. The candidate is ready for a local Codex trial in the explicitly tested configuration. These gates do not establish the same acceptance on other hosts/models or on a private production vault.

## Attempt accounting

| Attempt | Outcome |
|---|---|
| Initial sandbox startup retries | **NOT RUN**: Codex runtime/session SQLite could not be written in the initial sandbox. No model session or vault mutation occurred. Later runs used the authorized disposable state and vault roots; these startup failures are not scored as model failures. |
| Session 1, attempt 3 | **G2 PASS; G4 FAIL**. The named Curator completed the user-statement preference. The Lead then performed the authorized three-note policy update inline; the Curator was assigned only the preference and initially reported the already-pending operation. Whole-vault comparison found exactly four declared changes: the three policy targets plus the new preference note. No undeclared files changed. Preserve this as the failed delegation attempt. |
| Linked repair, attempt 2 | **G3/G4 PASS**. Before this run, the linked-repair manifest froze the same candidate, assertions, and patch digest. The only prompt change assigned the entire policy task to the named Curator and prohibited inline Lead work. The Curator read the original evidence, continued past page one, traversed the graph trail, prepared before editing, updated exactly three declared targets, verified persistence and reciprocal history links, and finished successfully. The pre-existing unrelated lifecycle audit finding was left unchanged. |
| Session 2, attempt 2 | **G8 PASS**. In a fresh host invocation and child context, both prior operations replayed as existing completed receipts. No `finish`, replacement operation, duplicate record, or vault-file write occurred. Current and historical recall kept superseded material out of the current answer and exposed it only for the historical query. |
| Session 3, attempt 3 | **G5 PASS**. Two separate named Curator contexts handled unsupported and conflicting evidence. Both returned the required abstention state and cited the unresolved support/decision; no operation was prepared and both vaults remained byte-identical. |

Empty or failed-to-start launch traces remain in private evidence storage and are not counted as model attempts. The repair does not overwrite the first attempt’s failed score.

## Independent file-state and receipt checks

Whole-fixture snapshots, including `.obsidian` metadata, were compared independently of model/tool output:

| Fixture state | Files before → after | Changed files | Assertion |
|---|---:|---:|---|
| Primary after session 1 | 10 → 12 | 4 | Exactly three declared policy targets and one declared preference note; source and all other files unchanged. |
| Primary after fresh session 2 | 12 → 12 | 0 | Replay and recall were read-only. |
| Unsupported-evidence case | 5 → 5 | 0 | No preparation or write. |
| Equal-authority conflict case | 7 → 7 | 0 | No preparation or write. |
| Linked-repair fixture | 10 → 11 | 3 | Exactly the declared existing runbook, prior policy and replacement policy targets changed. |

For the initial primary workflow, the preference receipt’s target SHA-256 was `31e90849d597afcfdf34feaa8e06ee89f2ec8be3c9aaa281d56d61d07f8bfe3c`. The three policy target SHA-256 values, in declared target order, were `2a835a16807029a1fc65a40cc5cfcf342bc72a7f5dcba2807a321747e0f6f0ab`, `5693d2796979df107b066c6554f7c569f088814485535b28443d78708ba0fdea`, and `4a73f2c14e39d1f1d082db8d86abd6b72b7f4b34ddf53a72e71c3318a2e5337f`. The immutable source SHA-256 was `08eec8fe0e2d10dd1510c3616152e9f8925807cfb47373510649917703a38991`.

The linked repair used the same source SHA-256 and patch digest `sha256:e77755a6afe475206ecc4be8d9cdce566215299da0f2ee338e4ce99cb2756491`. Its three target SHA-256 values, in the same order, were `235dde976a06a437e70192e267f9f953a18e3b7e7fa4457f6e15c8cb5de62da7`, `dd05dcddd8cb36f34b586f380e7c82cc2ec2a2ee87e0c7de4044a6aae7e23121`, and `873f21eeded0cc862d48e38e87f83e764d3bbea7f3709c807d9f08ce3d1d5241`. The preference receipt digest was `sha256:d2458b9caa1e191d0311dba3e9aa44b3c8ae02cfa900b5b9757232356c14a030` and its source list was empty. For all three completed operations, independent hashing confirmed each receipt target/source hash matched the current fixture bytes; each manifest and receipt had `complete` status and full verification was valid.

## Sanitized trace digests

Each digest is SHA-256 of the UTF-8 bytes of a canonical JSON projection: participant records ordered Lead then Curators in dispatch order; JSON keys sorted with compact separators; participant role, actual agent role, model, effort and ordered `response_item` sequence retained. Message bodies, reasoning text, command arguments beyond a normalized action label, tool output text, paths, and thread UUIDs are removed. Tool actions retain only the tool name/status and either a Graphmory subcommand, `read:installed-skill`, `read:installed-protocol`, or `shell`; tool results retain only the number of output blocks. These hashes identify the sanitized trace projection, not the private raw logs.

| Trace | Participants | Sanitized SHA-256 |
|---|---|---|
| Session 1, attempt 3 | Lead + Curator | `6a583b011429e7ac69e66f4f4f03199ab90c1ed9d1aed55c49a6809526960f28` |
| Linked repair, attempt 2 | Lead + Curator | `11dd237f8f5ccddac70fcb6b44e3c247fa15154d59eae9be6148591d5e6d005a` |
| Session 2, attempt 2 | Lead + fresh Curator | `c9e14ed73d56633565b15c48bbe653c711bf44ac8430fb946426a36fe3fc8164` |
| Session 3, attempt 3 | Lead + two fresh Curators | `7e9b3479a172cd3afe24cf8cc8c87f11a338b93fee34135158bfbedfbb6f95b3` |

## Limits

The live-model evidence is three bounded synthetic sessions plus one linked repair. The 394-test pass and recovery assertions are deterministic repository checks. The 5,000-note timing result is pure retrieval timing, not native end-to-end latency. This trial does not establish real-vault generalization, immunity to external editor/sync races, or superiority over another memory tool. Event-triggered revalidation remains a manual review trigger. Raw host logs, private traces, prompt/oracle files and fixture contents remain outside this public report.
