# Exact source handoff and fresh-session recall protocol

Status: preregistered development acceptance before native execution. Baseline `692d9a1` plus the source-handoff code/guidance diff. This protocol follows the [earlier path-guessing deviation](graph-history-repair-2026-09-29.md); earlier evidence remains unchanged.

## Question

Can a Lead pass exact source/target Markdown paths to its native cheap Curator without copied source text, have the Curator verify and read the originals before a supported durable edit, then start a new Lead/Curator session and retrieve current and historical policy with source-backed qualifiers?

## Frozen synthetic case and controls

Use the existing Helios E1/E2 fixture generator. Pack and install the modified Graphmory package in one disposable project and vault. One Codex CLI Lead `gpt-5.6-sol` low and named `graphmory_curator` `gpt-5.6-luna` low per session. Use fresh `codex exec` sessions for write and subsequent read; both must dispatch the actual named child with `fork_turns=none`. No generic-role/inline fallback and no hidden model reruns. Preserve package integrity, source hashes, exact host IDs and ordered traces. No private Obsidian vault, provider API key, official benchmark or comparator involved.

## Session 1: authorized write

The Lead uses the installed `source-handoff` CLI with **exact fixture paths** `90 Evidence/Approval Record.md`, `01 Projects/Helios/Release Policy.md`, `01 Projects/Helios/Runbook.md` and redirects the metadata-only JSON outside the vault. The E1 and E2 references are section anchors inside the first file. The Lead provides this manifest and the existing lead-authored patch file to the named child and explicitly authorizes only the E2 production approval update and superseding the prior policy.

Before a durable edit, the child validates the patch, reads the manifest through `read-notes --manifest`, confirms E1/E2 support and the exact current targets. On any failed source read/hash/identity check it stops `BLOCKED` before a write; this protocol permits no guessed-file recovery after dispatch. The child applies the supported update, preserves source bytes and both history links, runs the lifecycle persistence postcheck, graph/lifecycle audits, then returns `APPLIED` with exact paths. Proposal-only `curate-plan` is not part of default Curator mode.

## Session 2: fresh-reader check

After session 1 is terminal, root captures every vault file hash outside the vault. Start a **new Codex session**, not a resumed context. The Lead delegates a read-only current/historical question to a newly dispatched named Curator. The child uses current recall without `--include-superseded`, explicit historical recall with that flag, and opens named original evidence and canonical policy notes. It returns a compact Brain Brief with current rule, old rule and temporal status, evidence E1/E2 paths/sections, scope/exclusions, and unresolved uncertainty if any. The Lead answers from that brief without adding unsupported obligations. No vault file may change in this session.

## Gates and interpretation

Required gates: fresh installed CLI and role discovery; two actual parent/child runtime bindings; manifest has exact three paths/hashes/bytes and no Markdown bodies; no guessed path/read error; original read follows manifest creation and precedes first write; valid patch preflight precedes first write; child postcheck precedes `APPLIED`; approved claim/rationale/scope/event/provenance in active successor; old note E1 preserved and superseded with forward link, successor backward link, Runbook current link; source bytes unchanged; graph issues absent with historical exclusion informational; fresh reader actual original reads and source-backed current/historical answer; all vault bytes unchanged during fresh read.

Record each gate independently, including failures and unobserved trace details. Do not treat clean audit as semantic support, metadata check as full-patch verification, matching file paths as a complete answer, or a synthetic pass as generalization. This is one known development case; no official benchmark score or superiority/latency-cost claim follows. If native account/runtime cannot execute, report the exact blocker while keeping deterministic checks and the unrun native result separate. Archive only exact terminal sessions, then remove disposable copies after sanitized report and JSON are saved.
