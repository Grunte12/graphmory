# Count-label preflight: fixed slot `conv-43:17`

Status: **ambiguous for a strict count of distinct won games; not qualified**. This is a source-label audit, not a model experiment. No answer generation was run, no official reference or score was changed, and the sealed holdout was untouched.

The candidate book selects `conv-43:17` with upstream answer `6`. All 29 original Markdown notes in its declared history matched their prepared SHA-256 hashes. A targeted scan of John's game and win passages identified relevant text outside the annotated evidence turns. The private source-bound audit, including exact quotes, original paths, line numbers and hashes, is `/private/tmp/graphmory-collection-count-label-preflight-v1.json` (SHA-256 `874b9eafcaa368e74a4220e21ed03ed4bf36961d97f02fa4dd90a0897a892a65`). This was not an independent full-history semantic adjudication.

Three identity problems prevent treating `6` as a verified count of distinct events:

1. `session_13.md`, John turn D13:4, mentions plural wins without identifying games. The source does not establish whether those wins overlap later described games.
2. `session_21.md`, John turn D21:16, discusses winning a trophy. The history does not clearly identify it as the earlier trophy or a separate event.
3. `session_24.md`, John turns D24:2, D24:4 and D24:6, revisit one apparent win. Counting each mention as a separate game would be an error.

The first extraction script stopped on an incorrect heading-versus-body line offset before creating an audit artifact. Exact body line numbers were then rechecked against the Markdown and the successful audit was saved. This is an audit-script correction before any model output; it is not a reference repair or post-answer case substitution.

**Gate decision:** stop the fixed eight-slot, 24-workflow collection experiment before generation. The preregistered plan requires eight source-qualified slots and disallows replacing an ambiguous slot after inspecting treatment answers. An independent event-identity review could qualify this slot or leave it excluded. Any different question set requires a new preregistration before running, with the original candidate and this failure retained. Hash matches and cited turn IDs alone cannot establish a precise count.
