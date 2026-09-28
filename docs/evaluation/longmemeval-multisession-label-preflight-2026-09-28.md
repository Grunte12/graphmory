# Alternative public-corpus label preflight

The fixed LoCoMo collection batch stopped before generation because `conv-43:17` cannot yet support a strict count of distinct won games. This audit inspects a **different, already exposed LongMemEval-S development corpus** rather than changing that reference or substituting a question after observing treatment answers. The local source file matches pinned SHA-256 `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.

Two multi-session questions in the previously fixed 14-case LongMemEval pilot are better candidates for the collector's aggregation mechanism:

| Case | Source-bound calculation | Preflight status |
| --- | --- | --- |
| `gpt4_d84a3211` | Three paid bike items: $25 chain + $40 lights + $120 helmet = **$185**. Later mentions of the same lights repeat the $40 purchase; the rack is a plan, not a purchase. | Provisionally supported |
| `67e0d0f2` | User states **8 edX courses** and **12 completed Coursera courses** = **20** across distinct providers. Other course discussions are plans or give no additional completed count. | Provisionally supported |

All 48 and 52 prepared original Markdown notes, respectively, match their reader-input hashes. The source-bearing audit records original paths, line numbers, exact passages and calculations at `/private/tmp/graphmory-lme-multisession-label-preflight-v1.json` (SHA-256 `e600a35a6eea0611994ad8214db29ff98a84e80182ed395f02006f59b9c06818`). This is one author review of targeted passages, **not** independent full-history semantic adjudication. Official answers, question IDs and scores remain unchanged.

**Decision:** these two questions can anchor a new, separately preregistered *development* comparison after independent review of event identity and all remaining slots. They cannot repair the stopped LoCoMo batch, certify the original @10 retrieval diagnostic as answer quality, or serve as a source-disjoint holdout. No model calls or three-arm answer scores were produced in this preflight. A future comparison must report these public-corpus results separately from any controlled synthetic cases and from sealed holdout confirmation.
