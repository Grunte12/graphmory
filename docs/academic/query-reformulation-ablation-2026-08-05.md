# Query-Reformulation Ablation — 2026-08-05

## Why this ablation

`real-vault-retrieval-2026-08-02.md` and `verifier-retry-ablation-2026-08-04.md`
both name the same two real-vault queries as unrecoverable by plain BM25F or
by wikilink-widening: `semantic-write-gate` and `conflict-llm-free-retrieval`.
Both are pure vocabulary gaps — no link path connects the query to the target
document either. The open architectural question this project has not
resolved is whether a **dense/semantic retrieval lane** is the only fix for
this failure mode, or whether a cheaper alternative — the already-in-the-loop
LLM blindly rewriting the query in domain vocabulary, then re-running BM25F —
recovers the same ground without adding an embedding model.

An initial spot-check (2026-08-05, not previously written up in this repo)
ran blind reformulation against only those two known misses: 1 of 2 fixed
(`semantic-write-gate` → rank 1; `conflict-llm-free-retrieval` stayed
unresolved because its real hook, "provenance-grounded," wasn't guessable
from the query's own phrasing). **N=2 is not a sample size anything can be
concluded from**, and a cherry-picked pair of known failures cannot show the
one cost that matters for a wholesale-adoption decision: does blind
reformulation ever break a query that was already working? This ablation
reruns the same blind-reformulation methodology against the **full 34-query
real-vault set**, not just the two known failures, to measure both the fix
rate and the regression rate in one pass.

## Design

`scripts/eval-query-reformulation.mjs` takes the existing `eval/real-vault/`
fixture (54 documents, 34 queries) and a fixed set of **blind** LLM
reformulations (`eval/real-vault/reformulated-queries.json`) — one single-shot
rewrite per query, written from the query's own text only, without looking at
its `relevant` target document(s). This mirrors what a curator subagent would
actually have available: the query, not the answer. For every query it runs
plain `governedRank(..., "bm25f-sections")` (no wikilink-lane fusion, so the
reformulation effect is isolated from the escalation ladder already measured
in `verifier-retry-ablation-2026-08-04.md`) twice — once on the original
query text, once on the reformulated text — and classifies the outcome:

- **still-pass** — hit at k=3 before and after (no effect)
- **FIXED** — miss before, hit after (reformulation recovered it)
- **REGRESSION** — hit before, miss after (reformulation broke it)
- **still-fail** — miss before and after (reformulation didn't help)

## Results

| Outcome | Count | Share of N=34 |
|---|---:|---:|
| still-pass | 28 | 82.4% |
| FIXED | 1 | 2.9% |
| REGRESSION | 2 | 5.9% |
| still-fail | 3 | 8.8% |

**Fixed:** `semantic-write-gate` (rank miss → rank 1; the reformulation
"novelty detection deduplication decide whether to write new memory redundant
check" matched `wang2026sage.md` exactly), consistent with the earlier N=2
spot-check.

**Regressions (new in this run, invisible in the N=2 sample):**

| Query | Original top-3 (hit) | Reformulated top-3 (miss) |
|---|---|---|
| `semantic-forgetting` | `chao2026stale.md` at rank 1 | bumped by two MOC index notes and `asai2024selfrag.md` |
| `semantic-graph-vs-markdown` | `vogel2026codebasememory.md` at rank 1 | bumped by a MOC index note (`vogel2026codebasememory.md` fell to rank 2) |

Both regressions share a pattern: the reformulation's added vocabulary
(broader domain terms like "memory degradation staleness" or "graph code
retrieval") happened to match a **MOC (Map-of-Content) index note's own
title/heading vocabulary** more strongly than the original query's narrower
phrasing did, pushing the actual paper out of the top 3. This is a real,
mechanistic failure mode of naive reformulation on this corpus — broadening
vocabulary trades precision for recall in a way that BM25F's field weighting
doesn't protect against, and it's a cost the original 2-query test could not
have surfaced because neither of its queries had this MOC-collision risk.

**Still-fail:** `conflict-llm-free-retrieval` (same vocabulary-gap miss as
the original test — see `real-vault-retrieval-2026-08-02.md`).
`link-recovery-cranimem` and `link-recovery-selfrag` also show as still-fail
here, but that's expected and not a reformulation finding: this script
deliberately runs BM25F-only with no wikilink-lane fusion, and both of those
queries are already known (from `verifier-retry-ablation-2026-08-04.md`) to
require exactly the wikilink escalation lane, not reformulation, to resolve.

## What this changes versus the N=2 spot-check

The original 1-of-2 fix rate is **unchanged** — the same query fixes, the
same query still fails, for the same reasons. What's new is the regression
rate: **2 of 30 previously-passing BM25F-only queries (6.7%) broke** under
blind reformulation. A framing built only on the N=2 sample ("query
reformulation recovers half of the vocabulary-gap misses for free") is
incomplete — the honest framing is that naive single-shot blind reformulation
is a **net-negative trade on this fixture at N=34**: it fixed 1 query and
broke 2, for a worse hit count overall (29 net hits vs. 30 baseline hits) than
doing nothing.

## What this does and does not prove

**Proves:** on this 54-document, 34-query real-vault fixture, single-shot
blind LLM query reformulation (rewriting from the query text alone, no
access to the target document) is not a safe wholesale substitute for a
dense/semantic retrieval lane — it introduces its own real regression cost
(MOC-note collisions) that a 2-query sample could not detect, and on this
larger sample the regressions outweigh the fix.

**Does not prove:**
1. **N=34, single vault, single reformulation model/prompt.** A different
   reformulation strategy (e.g., iterative rewrite-retrieve-read instead of
   one-shot, or a prompt that biases toward the original query's specific
   nouns rather than broadening vocabulary) might have a different
   regression profile — this ablation tests exactly one strategy, not the
   design space.
2. **Not a live curator-agent decision.** As with `verifier-retry-ablation-2026-08-04.md`,
   this measures whether the retry menu item itself works, not whether a real
   curator subagent reliably decides *when* to reach for reformulation vs.
   accept a miss vs. escalate some other way.
3. **Does not test reformulation combined with the wikilink lane** (the
   `link-recovery-*` still-fails here are a fusion-scope artifact of this
   script, not a reformulation result — see Design above).
4. **Small absolute regression count (2).** Two regressions on N=34 is a
   real, measured, non-zero cost, but it is not enough data to fit a
   generalizable regression *rate* to a different or larger vault — the
   qualitative mechanism (broad rewrites collide with MOC-note vocabulary) is
   the more transferable finding than the exact 5.9% figure.

**Grounded in:** `scripts/eval-query-reformulation.mjs`,
`eval/real-vault/reformulated-queries.json`,
`docs/academic/raw-logs/query-reformulation-2026-08-05.json`, `eval/real-vault/`,
`real-vault-retrieval-2026-08-02.md`, `verifier-retry-ablation-2026-08-04.md`.
