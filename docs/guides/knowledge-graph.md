# A small, explicit memory graph

Keep Markdown notes canonical. Graphmory derives the graph locally when requested; no graph database, embedding model, migration, or background service is required. The graph routes readers to evidence. A link alone does not prove an answer.

## Structure for new memory

Use existing project folders as retrieval scopes. Add one project index only when it helps navigation. Keep each decision, constraint, or reusable entity in a focused note, with a short English title, aliases for real alternate names, status, and source evidence. A note path is its graph identity: use full vault-relative paths when names repeat. Keep paths stable; moving existing notes requires link repair and a reviewed migration.

A minimal example (folder names are illustrative, not required):

```text
Projects/Cedar/Index.md
Projects/Cedar/Decision.md
Entities/Queue.md
Evidence/Load-test.md
```

The index links to the decision. The decision links to the entity it depends on and to supporting evidence. Connect notes because the source asserts the relationship; shared keywords alone are insufficient. Keep indexes short enough to inspect; use focused sub-indexes when there are many unrelated branches. Do not create translated duplicate notes or summaries of every possible entity.

```yaml
---
aliases: [Cedar queue decision]
status: current
part_of: Projects/Cedar/Index.md
depends_on:
  - Entities/Queue.md
evidence_for: Projects/Cedar/Deployment.md
---
```

These optional properties are scalar paths or YAML lists of paths/quoted wikilinks. They are simple top-level properties, not nested objects. Supported directed relations:

| Property | Meaning: this note … |
| --- | --- |
| `part_of` | belongs to the target project or entity |
| `depends_on` | depends on the target |
| `implements` | implements the target decision/specification |
| `evidence_for` | supplies evidence for the target claim/decision |
| `related` | has an explicit, otherwise unspecified relationship |

Include the supporting explanation/source in the body. The properties record assertions, not independently verified facts. Ordinary `[[wikilinks]]` remain valid; local inline Markdown links such as `[test](../../Evidence/Load-test.md)` also form edges. Markdown links resolve relative to their source; wikilinks use Obsidian path/title/alias resolution. Code examples and HTML comments are ignored. Reference-style Markdown links are not currently parsed. Ambiguous targets and excluded lifecycle/scope targets are not traversed.

## Use with an agent

```sh
graphmory graph-audit --vault /path/to/brain --agent
graphmory recall-explore --vault /path/to/brain --query "What other notes are linked to Cedar?" --agent
```

`graph-audit` is read-only. It reports counts, up to 20 unresolved/excluded/ambiguous references, up to 20 isolated notes, and 10 high-degree notes. Isolation is a review hint, not automatically an error; a standalone fact can be valid. External links are evidence references, not local graph edges. A hub is not automatically bad either.

`recall-explore` remains optional. It starts from search, selects query-relevant neighbors, traverses at most two rounds, and returns at most three results by default from a 12-note candidate budget. Each traversed result includes a bounded trail with source, destination, direction, and relation. A backlink reverses traversal direction, not the asserted relationship. Existing search candidates can still act as bridges. The default autonomous traversal starts at the strongest seed; an evidence assessor can choose among up to three seeds.

Limits: 64 examined references per note, 20,000 graph edges, 5,000 loaded notes; truncation is reported. The parser supports common Markdown patterns, not the complete Obsidian plugin ecosystem. Results remain `unverified`: the lead agent must read the evidence and handle conflicts/no-answer cases. Normal recall remains the simple default; graph traversal does not replace semantic retrieval for vocabulary gaps.

## Why this design

[HippoRAG](https://arxiv.org/abs/2405.14831) supports graph association for multi-hop retrieval. [HippoRAG 2](https://arxiv.org/abs/2502.14802) also documents factual-retrieval regressions in earlier graph approaches and motivates retaining passage relevance. [Microsoft GraphRAG's indexing methods](https://microsoft.github.io/graphrag/index/methods/) explain the cost/noise tradeoffs in generated graphs. Our bounded explicit-link implementation is an engineering adaptation, not a reproduction of those systems or their reported gains.

See [local evaluation and limitations](../evaluation/graph-structure-2026-09-26.md).
