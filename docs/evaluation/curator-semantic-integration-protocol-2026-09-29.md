# Curator semantic integration: frozen verification protocol

## Defect and permitted change

The Curator branch returns before the existing semantic-expansion handler. Consequently, explicitly requesting `--semantic-expansion` currently does not give that workflow a semantic candidate lane. Integrate the existing BGE embedding implementation with Curator candidate discovery before pagination. Keep this optional: dependency-free lexical recall remains the default.

This is a correctness integration, not a latency optimization or a new model experiment. Reuse the existing model, whole-note representation, pooling and vector cache. Do not ship the rejected parsed-cache prototype. Do not tune using the sealed NFCorpus or memory holdouts.

## Gates fixed before evaluation

1. Without semantic expansion, results, order and pagination remain identical to the prior lexical API; no embedding pipeline runs and no semantic metadata is added.
2. With expansion, semantic-only candidates can appear beyond the first ten results. Following every `nextOffset` must return the complete eligible merged sequence exactly once. Repeat with ordinary, byte-budget and adaptive pagination. A page size is not a total retrieval limit.
3. Current loaded documents remain authoritative. Unknown paths, duplicates, out-of-scope notes, raw/stale notes and notes explicitly marked noncanonical cannot enter the answer pool through a supplied lane. Superseded notes require the existing historical opt-in. Preview and original-source guards continue to apply.
4. Missing optional dependencies and failed semantic inference produce explicit errors, not successful lexical-only reports. Requested expansion metadata must survive the compact agent CLI output. Corpus scan truncation remains explicit.
5. The standalone legacy semantic API must preserve all original-ID rankings in the existing complete 300-query SciFact baseline. Run the unchanged existing exporter and BEIR scorer; compare complete query sets, original-ID orders and published aggregates. Do not conflate the legacy top-ten output with Curator's unrestricted candidate pool.
6. Exercise the new Curator path with actual cached local BGE inference on a physical, public synthetic Markdown vault. Freeze source texts and queries before invoking it, hash them before/after, and report all attempts. Controlled injected-lane tests prove filtering/pagination; they do not prove real-model relevance.

## Reporting and stop rules

The physical synthetic runner fixes 23 files (18 eligible notes and five
governance/scope controls), two queries and three pagination transports: six
API traversals. Before treatment execution, two cold CLI checks of the first
query at offsets 0 and 3 were added to verify the already-declared compact
metadata gate. This adds two transport checks, not queries or relevance
labels. The pre-integration failure ledger retains its original six-slot
plan. Twelve separately saved lexical baseline cases cover three queries and
four page/bundle options for exact response comparison after the refactor.

Record each gate as passed, failed or not run. Preserve failed-run ledgers. Fix implementation defects and rerun affected checks; do not alter frozen queries, relevance labels or thresholds to obtain a pass. Stop default promotion if any correctness gate fails. No new default, answer-quality win, speed win or comparator superiority can be inferred from this integration alone.

Report local inference latency, source count, returned candidate count and resource usage descriptively. Model installation/indexing time and warm inference are distinct. Existing approximately two-GiB large-corpus RAM use is unresolved. Complete-answer, citation, abstention and matched comparator trials remain separate required gates for the active goal.

## Existing evidence

See [existing BGE results](existing-bge-screen-results-2026-09-29.md), [official scorer](beir-official-scorer-2026-09-29.md) and [rejected cache experiment](semantic-cache-optimization-results-2026-09-29.md). These establish a tested retrieval component worth integrating and a resource optimization that must not be shipped; they do not establish end-to-end Curator quality.
