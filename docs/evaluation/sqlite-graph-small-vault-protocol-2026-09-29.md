# Index eligibility: graph links and small real vault

## Why this screen

The 5,000-note managed Curator test passed, but its SciFact notes contain no controlled Obsidian graph links. A persistent index can also be a bad trade for a small vault because it must be built and validated. Freeze these screens before deciding whether to expose or automatically use the index.

## Graph correctness

Generate a disposable 12-note Markdown vault with a non-answer hub linking to two answer notes, a two-hop chain, a cycle, two identically named ambiguous targets, an archived note and multiple sections. Freeze 12 queries including hub terms, target terms, reversed term order, no hit and broad search. Compare the complete `managedRecall` Curator JSON between the existing scorer and the experimental eligible SQLite ranker for default, `includeSuperseded` and a project scope: **36 paired responses**, exact bytes. A hub-only query must surface at least one linked answer note whose body lacks the hub query terms; otherwise the graph part of the fixture is invalid. Stop on first mismatch, preserving the row and root cause.

## Small-vault cost

Read the user-authorized local Obsidian vault without modifying it or sending note content to a remote model. The frozen ten generic queries are `memory`, `project`, `decision`, `workflow`, `graph`, `design`, `setup`, `evaluation`, `latency`, `retrieval`. Build the experimental index once in a private temporary directory, measure build time and bytes, and alternate 10 pairs of fresh-process `managedRecall` calls. Require byte-identical complete response for every pair before comparing p50/p95 wall time, output bytes and RSS. Record per-query hashes, counts, timing and failures, **not** note content or returned paths in the committed report. Verify every source hash before and after; remove the temporary symlink, manifest and DB after the run. Preserve only sanitized measurements and code/source-set hashes.

Treat a small-vault regression or build-cost failure as evidence against automatic indexing there. This is a same-host local mechanical screen, not an answer-quality or competitor comparison. It cannot change the default until a supported Node 20 fallback, automatic cache lifecycle and independent answer tests exist.
