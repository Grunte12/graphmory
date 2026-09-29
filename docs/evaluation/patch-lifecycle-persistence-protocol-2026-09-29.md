# Lifecycle persistence verification protocol

## Motivation

The frozen native Curator experiment reported in `native-curator-preflight-live-2026-09-29.md` omitted an approved event-based revalidation trigger from a newly written canonical note. Input validation and existing date audits did not detect that omission.

## Scope and acceptance criteria (defined before the independent run)

Verify one explicit canonical Markdown destination against the approved patch's lifecycle metadata. This is a read-only post-write check, not factual verification, write authorization, or verification of every patch field.

1. The previously observed note with its missing trigger must fail.
2. A note with the expected lifecycle status and every expected event trigger must pass. Trimmed exact trigger comparison permits reordered triggers and additional triggers.
3. Partial trigger loss must fail. A date must never substitute for an event trigger.
4. If the patch supplies `valid_until`, verify it separately; otherwise do not require a date.
5. Malformed input, missing destinations, path traversal and symlink escapes must fail without exposing patch/note content.
6. Verification must leave input and vault bytes unchanged.
7. Generated Curator guidance must require persistence and this check before reporting `APPLIED`, while preserving independent source, authority, graph and lifecycle checks.

Run focused tests and the full repository check after reviewing implementation. Record outcomes, failures and limitations in a separate Markdown report. Synthetic cases cannot establish general model reliability or superiority against other memory tools.

## Broader research

Independently inventory memory systems from the local I-MEM bibliography. Use original public papers and repositories for publishable source claims; distinguish paper evaluation, implementation availability, and an actual local comparison. This research does not change the frozen acceptance criteria above.
