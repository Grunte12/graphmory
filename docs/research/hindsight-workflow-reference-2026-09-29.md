# Hindsight as a workflow reference

Luna reviewed official repository documentation on 2026-09-29. This is a design comparison, not an installation, experiment or performance claim. User priority is a complete usable Graphmory workflow before incremental comparative tuning.

## Verified documented mechanisms

[Hindsight](https://github.com/vectorize-io/hindsight) separates `retain`, `recall` and `reflect`. [Retain](https://github.com/vectorize-io/hindsight/blob/main/skills/hindsight-docs/references/developer/api/retain.md) processes supplied material into facts and entities. Its asynchronous path returns an operation ID; [operation tracking](https://github.com/vectorize-io/hindsight/blob/main/skills/hindsight-docs/references/developer/api/operations.md) makes progress observable. Caller-supplied identifiers support retry idempotency according to these API docs.

[Recall](https://github.com/vectorize-io/hindsight/blob/main/skills/hindsight-docs/references/developer/api/recall.md) combines semantic, keyword, graph and temporal retrieval and can preserve links from observations to source facts/chunks. These are documented capabilities, not evidence that a particular question is answered completely or better than Graphmory.

The documented `world`, `experience` and `observation` memory categories describe kinds of memory. Graphmory's `active`, `superseded` and `tension` describe governance/lifecycle; do not equate the two taxonomies or replace lifecycle with generated observations.

The [Codex integration](https://github.com/vectorize-io/hindsight/blob/main/hindsight-docs/docs-integrations/codex.md) documents recall before prompts and asynchronous retention of conversations after turns, backed by Cloud or a local daemon. Graphmory's current contract is lead-authored supported patches, a cheap host Curator and canonical Markdown. Automatic transcript capture, a daemon and vector storage are additional design choices, not prerequisites to finish that contract.

## Ideas to apply

1. **Separate the workflow into observable stages:** recall evidence, curate a lead-authored patch, verify the durable update, return a brief to the Lead. Expose success, conflict and incomplete outcomes explicitly. Operation IDs/idempotent retries are a useful future reliability pattern if a real repeated-write or asynchronous-work gap appears; do not add a job system before proving the native workflow.
2. **Keep derived memory traceable:** every summary/updated note retains original evidence IDs/paths and original access. Graphmory already has this authority contract in the Curator skill; test it through actual native file edits and subsequent recall.
3. **Use the graph to reach supporting originals:** inspect the notes reached across links/relations rather than treating graph connectivity as proof. Graphmory's existing Markdown graph supplies this path. The Hindsight service stack does not need to be adopted to verify it.

## Immediate decision

Finish the [installed native-host workflow smoke](../evaluation/native-workflow-smoke-2026-09-29.md): installed package → configured named cheap Curator → multi-note original reads → supported patch applied with old history preserved → lifecycle/graph audit → Lead answer. Hindsight is a reference for clear stage boundaries and source lineage. Defer additional retrieval engines, automatic transcript hooks and fine benchmark tuning until this workflow is proven.

## Host diagnosis sources

The [official Codex subagent docs](https://developers.openai.com/codex/multi-agent/) document standalone `.codex/agents/*.toml` definitions with `name`, `description` and `developer_instructions`; the installed file follows that format. The [configuration reference](https://developers.openai.com/codex/config-reference/) discusses trusted project configuration. The first native attempt had no observed dispatch tool call, so neither unavailable custom roles nor a registration defect has been proved. Next verify named-role dispatch in a trusted project and retain the first incomplete outcome; do not invent extra registration as a fix.


## Additional repository check: maintained knowledge pages

The [current README](https://github.com/vectorize-io/hindsight#mental-models--knowledge-pages) documents mental models as stored answers to standing questions, refreshed when supporting memory changes. Knowledge pages expose this as wiki-like documents that can be projected to ordinary Markdown. This suggests a lightweight Graphmory adaptation: the existing project index can link to a Curator-maintained project brief with source links and revalidation conditions. Reading an existing brief avoids repeated synthesis only while its sources remain current; actual latency/token savings require a later comparison. Do not introduce a second authoritative store or automatically replace original evidence.

The same [README recall description](https://github.com/vectorize-io/hindsight#recall) still combines BM25, semantic, graph and temporal paths, then fusion/reranking. It does not establish that keyword search should be removed. Its server/storage architecture and benchmark claims are separate from this design reference. No Hindsight installation, direct comparison or superiority claim was made.
