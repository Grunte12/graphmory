# Bounded retrieval loop (experimental)

The default remains local lexical recall. `recall-explore` is a read-only experiment for explicit questions about related notes or papers. It follows valid Obsidian links and backlinks for at most two rounds, preserves a lexical candidate pool, and returns compact paths with `evidenceStatus: "unverified"`. A linked note is a navigation hint, not proof that it answers the question.

## Decision boundary

```text
query → scoped BM25 + focused BM25F fusion
      → direct answer: return lexical candidates
      → explicit note/paper relationship: follow bounded links + backlinks
      → no new eligible note, candidate cap, or round cap: stop
      → lead reads selected Markdown and checks provenance
```

The experiment reuses the vault's link resolver, resolves against the full note catalog before scope/lifecycle filtering, skips ambiguous aliases, and keeps stale notes out of traversal. It does not call Jev or create embeddings. The default cap is 12 unique candidate notes, with up to four new notes per round. The CLI returns at most three paths to an agent. Graph edges and assessor calls have separate limits.

## Possible Jev extension

Only after an independently authored evaluation shows routing misses, test one optional Jev `Choice` over a short project/MOC menu. Keep the top two branches and a global lexical rescue path; a wrong first choice must not hide the answer. Jev may then choose `enough`, `partial`, `none`, or `conflict` from bounded excerpts and explicit requested facets. `partial` permits one targeted expansion, `conflict` returns to the lead, and provider errors stop the Jev branch. Any `enough` response must cite IDs from the exact excerpts judged. Jev never writes memory or invents paths.

This follows the adaptive effort pattern in [Adaptive-RAG](https://arxiv.org/abs/2403.14403), corrective retrieval in [CRAG](https://arxiv.org/abs/2401.15884), and recoverable beam routing in TypeSafe's [hierarchical Choice cookbook](https://docs.typesafe.ai/cookbooks/hierarchical_classification). These papers and examples motivate tests; they do not establish that this implementation improves answer quality on a user's vault.

## Promotion gate

Compare sparse baseline, gated graph navigation, and any future Jev routing at the same candidate and excerpt budget. Use new relation, ordinary, ambiguous-link, scoped, stale, conflicting, Thai, and no-answer queries. Measure all-required-evidence recall, Hit@3, ranking regressions, false evidence acceptance, full command latency, decision calls, token use, and billed cost. Keep the graph command experimental until it improves held-out tasks without ordinary-query regressions. Do not promote Jev based on the existing 34 development questions alone.
