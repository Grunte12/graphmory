# RAGTruth train schema audit

Pinned corpus: ParticleMedia/RAGTruth at 1d52a81c9e28e79e252a1945d858eb8dfd975c23, files dataset/response.jsonl and dataset/source_info.jsonl. Schema description: [pinned official RAGTruth README](https://github.com/ParticleMedia/RAGTruth/blob/1d52a81c9e28e79e252a1945d858eb8dfd975c23/README.md).

## File identity

| File | Bytes | SHA-256 |
|---|---:|---|
| response.jsonl | 21,458,735 | e4c2e4ac24fff676d8984cc61c35d791612fadc58015335d97dd632375e18073 |
| source_info.jsonl | 15,117,971 | 0dffc26ea9f3c1c3d7c7e8336b56ef1646e3cec876edffcca3c9c624d12d578b |

Only the split field was counted for heldout rows: train 15,090, test 2,700. No heldout examples or annotations were inspected. Train text and annotations were inspected only after filtering to quality=good.

## Train schema and counts

response.jsonl records: id:str, source_id:str, model:str, temperature:float, labels:list, split:str, quality:str, response:str. Train quality values: good 14,942; incorrect_refusal 120; truncated 28. The eligible good set has 8,244 responses with no spans and 6,698 with one or more spans, across 2,515 unique sources.

Annotation items have start:int, end:int, text:str, label_type:str, meta:str|null, due_to_null:bool, and implicit_true:bool. Observed label types: Evident Baseless Info, Evident Conflict, Subtle Baseless Info, Subtle Conflict. All 12,693 annotated spans were within response bounds and response[start:end] exactly matched the annotation text. No duplicate good response IDs, missing source joins, source ID mismatches, or duplicate matching source records were found.

source_info.jsonl records have source_id:str, task_type:str, source:str, prompt:str, and task-specific source_info:

- QA: question:str, passages:str
- Summary: source_info:str
- Data2txt: name, address, city, state, categories as strings; hours as a weekday map or null; attributes as nested dictionaries/scalars; business_stars:float; review_info as a list of {review_stars:float, review_date:str, review_text:str}.

Task enums and eligible good train response strata:

| Task | No spans | With spans | Unique sources, no spans / with spans |
|---|---:|---:|---:|
| QA | 3,346 | 1,546 | 826 / 686 |
| Summary | 3,275 | 1,480 | 789 / 749 |
| Data2txt | 1,623 | 3,672 | 816 / 883 |

A capacity-one source-group assignment can fill all six task/presence cells with four distinct source IDs each (24 total).

## Prompt alignment and reference mapping

The official README describes source_info as the base RAG content, prompt as the prompt used to generate responses, and source as original-content provenance. In matched good train records, every nonempty source_info string value is present in the original prompt after allowing for JSON/Python escaping: QA 1,678/1,678, Summary 793/793, Data2txt 15,263/15,263. All 18,715 observed non-string Data2txt scalar key/value pairs also align; the 13 unmatched address values are empty strings. No answer, gold, or annotation fields occur in the source_info schema.

Use the exact original prompt plus response for review. Exclude source_info duplication and all response.labels data from the judge packet.

For the binary reference, zero annotated spans maps to sourceSupport=yes; any annotated span maps to no, including 1,814 of 12,693 annotated spans marked implicit_true (correct content that is absent from supplied context). These are response span labels, not exhaustive claim-level truth or completeness labels. No span annotation does not establish that an answer is complete or fully true.

## Execution and corrections

A Luna Max agent independently audited the downloaded files without selecting the reviewer cases. An earlier Luna probe failed twice with DNS errors and produced no schema result. After a network permission grant, bounded root curl downloads completed successfully. The transport/context difference was not established as the cause of the failures.

The initial raw-substring Data2txt check suggested context differences. Escape-aware checks corrected that interpretation before any model review; there was no demonstrated omission of nonempty source facts. The audit itself produces no model agreement or Graphmory retrieval score. Raw corpus and source-containing artifacts remain local; only this source-free report is published.
