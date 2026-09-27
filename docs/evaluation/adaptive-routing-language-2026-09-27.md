# Experiment: avoid false wide routing from incidental wording

## Hypothesis and frozen check

The current `--auto` router treats any `all` or `across` in a query as a reason
to send a wide bundle. In the 34-query structured Markdown fixture, three
otherwise narrow questions route wide: two use the idiom "at all" and one
uses "across heterogeneous datasets" to describe a benchmark. The retrieved
paper titles are distinct and the desired answer is a single paper in each.
This is a deterministic routing error, not a claim that the answers failed.

Change one rule: reserve wide output for explicit enumeration, counting,
comparison or repeated generic note titles. Treat standalone `across` and
the idiom `at all` as ordinary wording. Keep "all notes/documents/papers"
wide. Do not change retrieval ranks, preview text or byte budget.

Before promotion, rerun all 34 structured queries and a separate conversation
set. Record mode counts, gold evidence group coverage on the first response,
response bytes and local CLI latency. Verify explicit exhaustive queries still
route wide and that complete paginated paths remain available. This offline
experiment measures routing/output only; it cannot show model answer quality,
provider cache behavior or end-to-end latency. If a gold evidence group is
lost from the first response, revert this rule.

## Results

The 34-query structured-vault rerun changed mode selection from 31 focused /
3 wide to **34 focused / 0 wide**. Gold evidence groups and previews remained
on the first response for **34/34** queries. Median response size was 10,530
bytes (previous 10,632); median in-process recall time was 6.3 ms. For the three
affected queries, focused responses were 11,117, 10,750 and 10,395 bytes.
The old wide behavior, reproduced with the same 32 KB forced bundle, returned
32,102, 31,601 and 22,382 bytes respectively. That is a 50–66% reduction
on these specific false-wide cases, not a vault-wide token-cost result.

On a separate five-question conversation vault, four questions still routed
wide. One "how much more expensive" two-source arithmetic question changed
to focused; both required notes remained in its first ten paths. All five
questions still had every required evidence path on the first response.
Pagination and ranking tests passed. We did not run a live model comparison
for this routing-only change, so answer quality, provider cache savings and
end-to-end latency remain unverified. Keep `--auto` opt-in.
