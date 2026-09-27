# LongMemEval abstention/reference conflict diagnostic — 2026-09-28

## Actual run

One exposed development case `09ba9854_abs` from the pinned cleaned-S dataset was prepared as 50 original Markdown sessions using the existing builder. Gold labels remained outside reader input. The unchanged live runner used Luna low reasoning, `--auto`, four Curator rounds maximum, structured Lead citations, verified original reads and a fresh Lead.

Question: “How much will I save by taking the bus from the airport to my hotel instead of a taxi?” The benchmark reference says information is insufficient because the bus cost was not mentioned. The [preserved run](../../eval/reader-pilot/longmemeval-abstention09-live-2026-09-28.json) instead answered “Approximately $40–$50,” citing `sessions/0006-74b40853759b.md`. This is an **observed non-abstention/reference mismatch**, not an official QA judge result.

## Evidence audit

The actually read original has a user statement of about $60 taxi cost at line 117 and an assistant estimate of $10–$20 airport bus fare at line 126, conditional on route/destination. The arithmetic $60 minus $10–$20 supports an approximate $40–$50 difference if that bus estimate applies. It does not establish the exact user's hotel route fare. Thus the reference claim that bus cost was not mentioned conflicts with visible assistant text, while the model may still overgeneralize a generic route estimate to the user's particular trip. Neither a blanket hallucination verdict nor overriding the benchmark label is justified from this inspection alone.

Keep the original question, reference and outcome unchanged. Count this run as non-abstention in any reference-based abstention analysis; report its evidential ambiguity separately. An independent reviewer should distinguish estimated versus confirmed price and user-provided versus assistant-suggested facts. Do not drop the case to improve scores, rewrite the reference, or include it as a clean product-risk abstention case.

## Cost and scope

The workflow completed three calls, one page and one source read (10,800 bytes), in 17.135 seconds. Host input was 64,000 tokens including 14,080 cached. Citation provenance was valid, but that proves path membership only. This single exposed development example cannot estimate abstention accuracy, general quality or efficiency, and is not a comparator test.

Next use clear controlled missing-evidence cases alongside unchanged official benchmark references, with separate blinded support labels and full failure accounting. Preserve this case as an ambiguity diagnostic.

Verification after recording this run: `npm run check` passed 284/284 tests and configured gates; `git diff --check` passed. The Obsidian status command returned `SYNC_CONFIG_NOT_FOUND`; no user vault data changed.
