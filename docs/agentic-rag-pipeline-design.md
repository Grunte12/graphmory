# Agentic RAG Pipeline Design

Status: Phase A implemented. Phase B and Phase C are planned (not yet built).

This document records the approved architecture for deterministic query
understanding, budgeted retrieval, and extractive answer composition on top
of the existing governed BM25F retrieval core. It exists so Phase B/C work
has a repo-recorded reference instead of relying on chat history.

## Architecture overview

1. **`src/query-understanding.mjs` (Phase A, implemented).** Deterministic
   language/script detection, `Intl.Segmenter`-based Thai word segmentation,
   regex/lexicon query classification, and vault-mined alias expansion. No
   model calls, no network calls, fully unit-testable in isolation.
   Source: Adaptive-RAG (query-complexity-routed strategy, precedent for
   adaptive effort) https://arxiv.org/abs/2403.14403; ICU tokenizer
   (dictionary-based Thai/CJK segmentation as the standard fix)
   https://www.elastic.co/guide/en/elasticsearch/plugins/8.19/analysis-icu-tokenizer.html;
   doc2query (corpus-internal expansion) https://arxiv.org/abs/1904.08375.
   Caution on LLM-driven expansion (why alias expansion is vault-mined, not
   LLM-generated): https://arxiv.org/abs/2505.12694.
2. **`src/retrieval-planner.mjs` (Phase B, planned).** A budgeted 4-rung
   retrieval ladder: scoped BM25F -> alias-expanded retry -> `followLinks` +
   structural rerank -> fail-closed semantic escalation -> abstain. Rung
   selection is class-conditioned (an `out-of-scope` classification short-
   circuits straight to abstain; `temporal`/`aggregation` classes always run
   link expansion before returning). The ladder has a fixed call-count budget
   per query so behavior stays deterministic and cost-bounded.
   Source: FLARE (active retrieval only when needed)
   https://arxiv.org/abs/2305.06983; Self-RAG
   https://arxiv.org/abs/2310.11511; CRAG https://arxiv.org/abs/2401.15884;
   Adaptive-RAG https://arxiv.org/abs/2403.14403; RRF (deterministic
   rank-list combination for a future second retrieval method)
   https://dl.acm.org/doi/10.1145/1571941.1572114; BEIR (BM25 as a strong
   zero-shot baseline, why rung 1 stays lexical)
   https://arxiv.org/abs/2104.08663; Anthropic Contextual Retrieval (hybrid
   BM25+embeddings direction for a later semantic rung)
   https://www.anthropic.com/engineering/contextual-retrieval. See
   `research-foundations.md`'s caution: FLARE/Self-RAG/CRAG use LLM-judged
   loop control, cited here for adaptive-effort precedent only — this
   harness's ladder uses deterministic staged budgets instead.
3. **`src/answer-composition.mjs` (Phase B, planned).** Extractive-only
   answer spans with citations: `answer: { mode, spans: [{ path, section,
   text, score }], citations, confidence, needsVerification: true }`. Includes
   an explicit abstain mode. Additive to the existing Brain Brief contract —
   no schema break.
   Source: Attributed QA https://arxiv.org/abs/2212.08037; ALCE
   https://arxiv.org/abs/2305.14627; Atlas (small model + strong retrieval
   beats larger model without it) https://arxiv.org/abs/2208.03299; REPLUG
   https://arxiv.org/abs/2301.12652.
4. **`src/ingest-triage.mjs` + `ingest` CLI (Phase C, planned).** Produces
   `triage-plan.json` review artifacts: classification, draft frontmatter,
   suggested aliases, near-duplicate detection. Never writes canonical
   memory. A companion `stale-scan` CLI runs over `memory-lifecycle-audit.mjs`
   to produce archival-candidate artifacts, and a conflict-decision artifact
   (`supersedes` / `coexists-TENSION` / `duplicate`) extends the existing
   conflict-plan shape.
   Source: Mem0 https://github.com/mem0ai/mem0; MemGPT/Letta
   https://arxiv.org/abs/2310.08560; Zep/Graphiti
   https://arxiv.org/abs/2501.13956; Lilian Weng, LLM Powered Autonomous
   Agents https://lilianweng.github.io/posts/2023-06-23-agent/.

### Rejected approaches

- LLM query rewriting (non-deterministic, adds cost/latency to every recall).
- Always-on embeddings (semantic recall stays opt-in via `--escalate auto`
  and fails closed when the optional dependency is missing).
- Auto-canon writes from any triage/ingest tooling — everything in Phase C
  produces review artifacts, not canonical memory mutations.
- Unbounded retry/expansion loops — every rung is capped and deterministic.
- Abstractive answers — Phase B answer composition is extractive-span-only
  with citations, matching the harness's evidence-first design.

## Phase A: deterministic query understanding

### A1. Thai/CJK-aware segmentation (`src/retrieval.mjs`)

`tokenize()` is the single choke point for both corpus indexing and query
parsing (`WORD = /[\p{L}\p{M}\p{N}_-]+/gu`). Thai script has no inter-word
spaces, so a whole Thai phrase previously indexed/queried as one giant token.

Implementation: after the existing `WORD` match, any token containing a
character in the Thai Unicode block (`฀`-`๿`) is segmented with a
cached `Intl.Segmenter("th", { granularity: "word" })` instance, keeping only
`isWordLike` segments. Tokens with no Thai characters take the original path
unchanged (compound-identifier splitting on `-`/`_`), so the Latin
tokenization path is byte-identical to pre-change behavior. The Thai block
range is a named constant (`NON_LATIN_SEGMENTABLE_RUN`) and the segmentation
call is isolated in a small helper (`segmentNonLatinRun`) so extending to
other non-space-delimited scripts later is a small, local change rather than
locale branching spread through `tokenize()`.

### A2. `src/query-understanding.mjs`

Pure, deterministic module. `analyzeQuery(query, vaultIndex)` returns:

- `lang`: `"latin" | "thai" | "mixed"`, by Unicode range detection.
- `segments`: tokenized query (reuses `tokenize()`).
- `classes`: `["temporal"]`, `["aggregation"]`, or `["factual"]` by
  regex/lexicon rules (English and Thai markers). Out-of-scope classification
  needs corpus-overlap signal the pure query-understanding layer doesn't have
  — it is deliberately deferred to Phase B's retrieval planner, which has
  direct access to candidate scores.
- `expansions`: vault-mined alias-synonym expansions,
  `{ term, source: "alias", weight }`, built from a canonical-token <->
  alias-sibling map (`buildAliasMap`) mined once per recall from the vault's
  own `aliases` frontmatter (already parsed by `parseMarkdown` — not
  re-parsed here).
- `variants`: alias-substituted query variants for the retry rung (currently
  one variant: the original query with expansion terms appended once).

### A3. Wiring into recall (`src/memory-recall.mjs`)

- Default path is unchanged: rung 1 is governed BM25F on the raw,
  now Thai-aware-tokenized query.
- **Rung 2 (new):** if rung 1 confidence is `low` or `none`, retry governed
  BM25F with the alias-expanded query variant. The retry is kept only if it
  reaches `bounded` confidence; otherwise rung 1's result stays authoritative
  so the existing opt-in semantic escalation (`--escalate auto`) sees the
  same signal it always did.
  - `bm25fRank` has no per-term query weighting today, so "reduced weight for
    expansion terms" is approximated by appending expansion terms to the
    query text once (rather than duplicating them), while the original query
    text is untouched. This is documented as an approximation; real
    per-term weighting is a candidate Phase B improvement to the BM25F query
    interface.
- Report gains additive fields only: `queryAnalysis: { lang, classes,
  expansionsUsed }` and `retrievalRung: 1 | 2 | "semantic"`. No existing
  Brain Brief/report field is removed or renamed.

Abstention (separate confidence-band metric, not folded into Hit@k):
Source: SQuAD 2.0 (abstention as a distinct learnable skill)
https://arxiv.org/abs/1806.03822; Selective QA under domain shift (one
confidence signal does not cover every abstention case, why this harness
uses `bounded`/`low`/`none` bands rather than a single scalar threshold)
https://arxiv.org/abs/2006.09462.

### Phase A gate

- Multilingual Hit@3 >= 0.80 (target); paraphrase-zero-overlap Hit@3 >= 0.50
  (floor) with 0.65 as an aspirational target via alias retry.
- All previously-passing hard-eval categories/floors hold; abstention
  accuracy must not regress below its baseline (33.3%).
- Private-vault regression tripwire (`governed-bm25f-sections`, 30-query gold
  set) stays at 100% Hit@3 — this is the primary signal that the Thai
  segmentation change did not disturb the Latin tokenization path.

See the implementation report for actual measured numbers and a documented
gap: the `eval/fixtures-hard` corpus notes referenced by the pure-Thai and
zero-overlap-paraphrase queries carry no Thai or synonym vocabulary in their
frontmatter/body, so there is no vault-mined bridge for the alias-expansion
rung to expand into. Segmentation alone cannot manufacture lexical overlap
that does not exist anywhere in the corpus; closing that specific gap needs
either enriched fixture content (added aliases) or a genuinely multilingual/
semantic bridge, which is out of scope for a dependency-free, deterministic
Phase A. This is called out as an explicit escalation trigger rather than
silently passed over.

**Multilingual fixture split (follow-up, same Phase A gate cycle).** The
above gap was closed for the *bilingual-curated* case and deliberately left
open for the *cross-lingual* case, splitting one category into two so the
eval doesn't conflate a fixable gap with an out-of-scope one:

- `multilingual` (scored, floor applies): the four `globex-*` gold notes now
  carry natural Thai `aliases:` frontmatter translating their actual topic
  (e.g. `globex-remote-work-policy` -> `ทำงานจากที่บ้าน`,
  `นโยบายทำงานทางไกล`). This is this harness's documented curation-first
  remedy for missing vocabulary — add real Thai vocabulary the corpus was
  missing, rather than asking the retriever to translate. All four pure-Thai
  queries now hit at rung 1 via the aliases BM25F field (field weight 4);
  no alias-retry rung or semantic escalation is needed. Measurable, held to
  the category floor.
- `multilingual-crosslingual` (new category, reported separately, not held
  to the `multilingual` floor): two pure-Thai queries target two other gold
  notes (`helix-security-handbook`, `quasar-retry-limit`) that intentionally
  receive no Thai aliases. Both queries miss today, which is the honest,
  expected baseline for true cross-lingual retrieval (query language != any
  corpus vocabulary) under a lexical/BM25F pipeline — no lexical method can
  bridge vocabulary that exists nowhere in the corpus. This category is the
  live documented gap for the semantic/cross-lingual rung mentioned in Phase
  B below. See `eval/fixtures-hard/README.md`.

## Phase B: budgeted retrieval planner + extractive answers (planned)

- `retrieval-planner.mjs`: 4-rung ladder as described above, with a fixed
  per-query call budget (deterministic, no unbounded loops). Class-
  conditioned: `out-of-scope` short-circuits to abstain; `temporal` and
  `aggregation` classes always run link expansion (`followLinks`) before
  returning, since those classes are more likely to need a MOC/backlink hop
  to find a current answer.
- `answer-composition.mjs`: extractive spans with citations, `needsVerification:
  true`, additive to Brain Brief.
- Gate: abstention accuracy > 0.5, extractive-answer eval >= 0.8
  span-contains-gold, plus a semantic end-to-end test.
  Source (eval-gate design generally): Hamel Husain, Your AI Product Needs
  Evals https://hamel.dev/blog/posts/evals/; RAGAS
  https://arxiv.org/abs/2309.15217; BEIR (multiple distinct query
  distributions, not one aggregate number) https://arxiv.org/abs/2104.08663.

## Phase C: ingest/lifecycle triage tooling (planned)

- `ingest-triage.mjs` + `ingest` CLI: classify, draft frontmatter, suggest
  aliases, detect near-duplicates. Produces `triage-plan.json` review
  artifacts only — never writes canonical memory.
- `stale-scan` CLI over `memory-lifecycle-audit.mjs`: archival-candidate
  artifacts.
- Conflict-decision artifact (`supersedes` / `coexists-TENSION` /
  `duplicate`), extending the existing conflict-plan shape.
- Gate: contract tests, a near-duplicate precision fixture, and a
  zero-canon-write assertion (every artifact produced by Phase C tooling
  must be reviewable, not auto-applied).
