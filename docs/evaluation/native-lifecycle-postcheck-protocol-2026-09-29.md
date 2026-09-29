# Native lifecycle postcheck acceptance

Freeze before execution: one fresh, project-scoped installed Graphmory package from revision `5ae87c6`, native Codex Lead (`gpt-5.6-sol`, low) and named Curator (`gpt-5.6-luna`, low). Reuse the existing synthetic fixture generator and approved E2 update only. This is a follow-up to the previous omission, not a replacement or repair of that frozen result.

## Gates

- Host metadata proves actual `graphmory_curator` role/model binding.
- Child validates the patch before its first vault write and reads the original approval evidence.
- Saved active canonical note retains the exact approved `revalidate_when` event as a YAML list, supported claim and E2 link.
- Actual child `verify-patch-persistence` returns valid before child completion with `APPLIED`.
- Independent installed-CLI postcheck agrees. Immutable source hashes remain unchanged; prior E1 note remains superseded with a replacement link. Runbook points to the replacement.
- Record graph and lifecycle audit warnings separately; do not erase the date-oriented audit's informational event-trigger warning.

One attempt, no generic-agent fallback or prompt tuning. If dispatch cannot be verified, classify the run as unverified. If any gate fails, preserve failure evidence rather than claim success. Wall time describes this workflow only; no comparative latency, cost or superiority claim.

Use only synthetic temporary vaults, project-local setup and isolated package installation. Record package integrity, role hash, source hashes, ordered actual events and independent results in sanitized JSON and Markdown. Remove the temporary workspace after terminal execution and evidence capture. Official benchmarks and holdout datasets remain untouched.
