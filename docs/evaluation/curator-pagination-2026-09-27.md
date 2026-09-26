# Curator pagination regression — 2026-09-27

This development diagnostic used an existing private 139-note physical Markdown vault and 29 previously inspected questions. It is not a held-out benchmark or a live Luna answer evaluation. Private queries, paths and note contents are not published.

| Ranking policy | Complete evidence in first 10 paths | First 20 paths | All candidate paths |
| --- | ---: | ---: | ---: |
| Fuse all matching candidates directly | 24/29 | 27/29 | 29/29 |
| Preserve the previous shortlist, append unseen candidates | 27/29 | 28/29 | 29/29 |

The optimization preserves the first ten paths from the previous per-lane shortlist, then appends unseen paths from the complete fused ranking. The shortlist size controls ranking priority, not the total number the curator may inspect. A regression test checks first-page path parity and that later pages cover every matching synthetic note without duplicates.

Exhausting all candidates would average 12.4 pages and about 6.7 KB of path text per question, excluding JSON overhead and note reads. This is an upper-bound diagnostic, not a recommendation to read everything. The curator stops when evidence is sufficient, and continues or reformulates when gaps remain. Gold labels are used only by this evaluator; the runtime never sees them.

`scripts/eval-curator-pages.mjs` computes the ranking once per question to measure candidate availability. It does not measure repeated CLI page latency, billed tokens, citation support, summary correctness or model abstention. Earlier all-page execution was stopped because repeated full ranking made it unnecessarily expensive. Timing from the diagnostic is not an end-to-end latency claim.

Run on your own labeled fixture:

```sh
node scripts/eval-curator-pages.mjs --vault /path/to/eval-vault --queries /path/to/queries.json --config /path/to/curator-config.json --out /path/to/private-report.json
```

Query labels use `relevant` (all required paths) or `relevant_groups` (one acceptable path per group). Keep labels outside the agent-visible vault.

Next acceptance experiment: blind live-curator trials that inspect note contents and return Brain Briefs, with evidence support, missed evidence, actual token usage and latency recorded. Existing development labels must not be described as independent acceptance data.
