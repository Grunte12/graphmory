# Managed retrieval and model roles

Run `graphmory config` in a terminal to select one of four workflows. All remain available; users choose according to their agent plan, Jev API access, and local hardware. See [four coexisting workflows and local model candidates](../research/four-workflow-models-2026-09-23.md). New configurations are saved in `~/.config/graphmory/runtime.json`; an existing `~/.config/memory-patch-harness/runtime.json` is reused for compatibility. Override either with `GRAPHMORY_CONFIG_PATH`, legacy `MPH_CONFIG_PATH`, or `--config`. Use `graphmory config show` to inspect the effective settings. The file holds model identifiers and an API-key *environment variable name*, never the key itself.

| Workflow | Evidence judge | Lead agent role |
| --- | --- | --- |
| Curator | Luna, Haiku, or another host sub-agent judges local BM25F results | Authors Memory Patches; receives a curator Brain Brief |
| Hosted Jev | TypeSafe Jev judges retrieved candidates; requires separate API access and explicit opt-in before sending vault excerpts | Reads selected evidence, answers, and authors Memory Patches |
| Local decision | A local server implementing the TypeSafe System One HTTP request/response shape judges candidates | Reads selected evidence, answers, and authors Memory Patches |
| Local rerank | A local `/v1/rerank` server reorders retrieved candidates; raw rank scores are not decision probabilities | Reviews the ranked evidence and decides whether it answers the question |

The Jev/local workflow replaces the curator sub-agent for evidence judgment; the existing lead agent handles prose and durable patch authorship. Jev returns structured decisions, not Brain Briefs or Markdown. The CLI calls Jev directly in hosted mode, config asks for curator details only in curator mode, and the OpenCode adapter routes decision evidence directly to the lead. See the [replacement design](../design/jev-replaces-curator.md) for the remaining work. Agent hosts still need their own model credentials and agent registration. This CLI does not spawn Claude, Gemini, or Luna processes or change a host's agent settings automatically.

Curator mode returns ranked Markdown **paths** in pages of ten by default; `--k` changes the page size (1–10), not the total number the curator may inspect. If evidence is incomplete, call `recall-managed` again with `--offset` set to `nextOffset` while `hasMore` is true. The curator inspects relevant sections, stops when evidence is sufficient or candidates are exhausted, and sends the lead a compact Brain Brief with supported claims and source paths. No note bodies go to the lead automatically. Decision modes retain a three-result default because selected candidates may carry excerpts or invoke a model. Paging does not guarantee recall when vocabulary misses relevant notes; reformulate or use another retrieval lane when needed. The vault scanner currently caps each lookup at 5,000 Markdown files and reports `scanLimitReached` when it may have stopped there.

Example:

```sh
graphmory config
graphmory recall-managed --vault /path/to/vault --query "What is our deployment policy?" --agent
graphmory recall-managed --vault /path/to/vault --query "What is our deployment policy?" --offset 10 --agent
```

For an explicit question about a prior state, curator mode can add `--include-superseded`. This includes notes marked `superseded` in the candidate ranking while still excluding `raw`, `stale`, `archived`, and `deprecated` notes. The agent packet marks `historicalCandidatesIncluded: true`; it does not decide which dated claim answers the question. Read original notes and compare attribution, scope, and dates. Omit this flag for current-state questions. The flag is unavailable in decision modes.

```sh
graphmory recall-managed --vault /path/to/vault --query "What was the deployment policy before March?" --include-superseded --agent
```

For hosted Jev, choose either TypeSafe direct or Vercel AI Gateway in `graphmory config`. The direct route uses `TYPESAFE_API_KEY` and `https://api.typesafe.ai/v1/systemone`. If TypeSafe registration is full, [create an AI Gateway key in the Vercel dashboard](https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys), set `AI_GATEWAY_API_KEY` in the process environment, and choose the gateway route. It uses model `typesafe-ai/jev` at Vercel's [TypeSafe-compatible endpoint](https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe). Gateway usage is billed through Vercel; check [current rates and credits](https://vercel.com/docs/ai-gateway/pricing) before a live benchmark. Do not paste keys into config files, chat, or the vault. The console asks for explicit consent before sending candidate excerpts to the selected hosted route.

One request sends the query, note path/title, and up to 2,500 characters from the two sections with the most query-term overlap for each shortlisted note. Jev evaluates one yes/no relevance question per candidate in that request, and the CLI sorts by the returned probability. The threshold and candidate cap are set in the console. If none pass, the command returns no evidence with `needsExpansion: true`; `--semantic-expansion` tries the optional local semantic lane once before abstaining. Candidates from that lane pass through the same decision gate. The semantic lane requires `@huggingface/transformers` and its embedding model. Model download may require network access on first run. Semantic vectors are cached outside the vault by note-content hash; the cache is private and only changed notes are re-embedded. On the [development vault benchmark](../evaluation/managed-modes-2026-09-23.md), semantic hybrid was slower to start and did not beat the optimized sparse default, so it remains opt-in.

For a local decision server, the console offers an OpenThai-SystemOne preset. Install its Python package and run its server as described by [OpenThai](https://huggingface.co/iapp/OpenThai-SystemOne); use `http://127.0.0.1:8000/v1/systemone` and model `iapp/OpenThai-SystemOne`. The server must accept `{model,state,questions}` and return `answers` with `noul` values between 0 and 1. OpenThai is a useful option to evaluate for Thai-first vaults. On the 55-note English research vault used in development, its local relevance gate reduced Hit@3 from 88.2% to 64.7% across 34 frozen questions at the default threshold; do not use that result to predict Thai-vault quality.

For local retrieval reranking, use a server exposing `POST /v1/rerank` with `{model,query,documents,top_n}` and returning `results` with an `index` and finite `relevance_score` for each candidate. [mlx-serve](https://github.com/menaje/mlx-serve) documents this API and supports Qwen3 rerankers on Apple Silicon. Choose workflow 4 in the console and select Qwen3 4B, MiniLM, Qwen3 0.6B, or a custom model. Qwen3 4B is a quality candidate for a 24 GB Apple Silicon Mac, but we could not measure it in the sandbox because Metal access was unavailable. MiniLM is a measured CPU-light option; see the [local vault benchmark](../evaluation/managed-modes-2026-09-23.md). This mode returns `decisionGate: rank-only`; it does not apply the relevance probability threshold or claim to replace a calibrated Jev decision model. The lead agent must verify whether the selected note actually answers the query.

[Laya](https://github.com/NandhaKishorM/laya) is another open decision model, with English, multilingual, and typed-decision checkpoints. The separately published [laya-serve](https://pypi.org/project/laya-serve/) package now exposes a Jev-compatible `POST /v1/systemone` endpoint. Install `laya-serve[inference]` and run with `LAYA_SERVE_BACKEND=laya LAYA_SERVE_PRELOAD=true laya-serve`; the default backend is a fake test backend. The console has a Laya preset using the local URL and model `laya`. The published default context limits are much shorter than Jev's, and Laya's authors report that base checkpoints need calibration for their use case. Run a relevance benchmark on this vault before relying on its probabilities. TypeSafe's [model catalog](https://docs.typesafe.ai/models) lists Jev as hosted; neither OpenThai nor Laya is TypeSafe Jev weights. Generic Ollama/OpenAI-compatible chat endpoints do not implement this contract by default.

`--agent` emits one compact JSON line. In decision modes it follows [EvidencePacket](../../schemas/evidence-packet.schema.json): `ready` contains bounded excerpts, canonical paths, scores, and excerpt hashes; `abstain` contains empty evidence. Local rerank evidence uses `rankScore` in place of a probability. Transport or malformed-response failures remain command errors. `retrievalConfidence` describes sparse retrieval, not Jev confidence. Use `--json` for human debugging. This keeps tool output small and makes a CLI call practical in agent loops without a resident MCP process. Managed retrieval keeps lifecycle filtering and scoped candidate generation from the existing retriever. A positive score is evidence for ranking, not proof that a note is true or current. The threshold is an initial setting, not a calibrated guarantee on this vault; benchmark it on labeled queries before automating decisions. The lead agent should inspect the returned Markdown and provenance before answering or writing a patch.

Compare managed workflows with `node scripts/eval-managed-recall.mjs --vault /path/to/vault --queries eval/real-vault/queries.json --config /path/to/runtime.json`. The query set must contain frozen gold paths matching the selected vault. The report labels the vault private and omits query text, but per-query retrieved paths are included when `--json` is requested; keep that report private for a personal vault.

## Optional semantic candidates for Curator

For paraphrases that lexical search may miss, explicitly add
`--semantic-expansion` to Curator recall. It adds the local BGE semantic lane
before pagination, on every requested page. Follow `nextOffset` with the same
query, scope and flags until `hasMore` is false. The page size limits transport,
not the total number of candidates available to Curator.

```sh
graphmory recall-managed --vault /path/to/vault --query "How do we preserve long-lived memories?" --semantic-expansion --agent
```

The compact response marks `expanded: true`, `semanticModel` and
`candidateLanes`. These describe candidate discovery, not verified relevance
or answer completeness. Curator still reads originals and checks provenance.
Semantic candidates obey current lifecycle, scope and canonical-memory rules.
Historical questions can combine this with `--include-superseded`.

This requires the optional Transformers dependency and a downloaded embedding
model; it uses local inference, not a hosted LLM. First use may download model
files. `--model-cache /path/to/cache` selects a reusable cache outside the
vault. Missing dependencies or inference failures remain command errors.
Omitting the flag preserves dependency-free lexical recall. The existing
large-corpus benchmark used approximately two GiB of peak RAM: this option is
not a lightweight default. See the [frozen integration protocol](../evaluation/curator-semantic-integration-protocol-2026-09-29.md).

## Experimental link navigation

### Optional persistent sparse index

On Node 24 or newer, Curator recall can reuse focused-section BM25F postings:

```sh
graphmory recall-managed --vault /path/to/vault --query "deployment policy" --index-cache /path/to/private-cache --agent
```

Choose a dedicated cache directory outside the vault. First use builds a private SQLite file; later calls compare current Markdown hashes and transactionally update changed notes. Cached scoring keeps the existing eligible candidates, scores, links and output shape. No model, vector database or additional package is needed. Default recall remains unchanged. The cache contains vault-derived terms and paths; keep it private and delete the designated cache directory when no longer needed.

Node 20, a busy cache or a cache error uses ordinary recall and emits at most one `INDEX_FALLBACK` line to stderr. An in-vault cache path is rejected. This experimental option is currently for Curator mode only. The [product screen](../evaluation/persistent-index-optin-report-2026-09-29.md) found a 30.7% median reduction on the exposed 5,000-note SciFact slice with exact results, but a slower p95 on a small vault. First use costs several seconds on the large slice. It does not improve retrieval relevance or establish answer quality; use it when repeated searches on a large vault justify building the index.

The normal `recall` and `recall-loop` commands keep `canonical_memory: false` navigation notes in the ranked corpus but omit them from the answer results. Managed recall inherits this rule, including when optional semantic expansion proposes extra candidates. Use `--include-navigation` with the ordinary recall commands when intentionally inspecting a MOC or derived index. This preserves source-note slots in the returned candidate list without deleting the index or its links.

For a question that explicitly asks about related notes, papers, or a route through a shared index/MOC, `graphmory recall-explore --vault /path/to/vault --query "Which other papers are linked to this design?" --agent` tries a bounded link and backlink expansion after local sparse retrieval. It does not call a model, create embeddings, or write to the vault. The compact response lists candidate paths and marks them `unverified`; the lead agent must read the notes before answering. Ordinary questions keep the sparse ranking. This is an opt-in experiment, not a replacement for `recall-managed`. See the [design](../design/adaptive-retrieval-loop.md) and [pilot results](../evaluation/adaptive-graph-pilot-2026-09-24.md).

## Conversation histories

`graphmory config` now asks whether memory contains mixed project notes or conversation histories. The conversation choice uses one governed BM25 lane before the selected curator/decision workflow; the default mixed-note choice preserves sparse fusion. Existing configuration files keep their previous behavior.

This opt-in choice follows a [controlled LongMemEval retrieval experiment](../evaluation/comparable-benchmarks-2026-09-26.md), not a claim that BM25 wins on every vault or that downstream answer accuracy has been established. It adds no downloads or running services. For a one-off diagnostic, use `recall-loop --methods bm25 --agent`.

### Incomplete evidence previews

When a candidate has `sourceReadRequired: true`, read its original Markdown
note before relying on it or ruling it out. This flag covers both shortened
sections and omitted sections, even when every displayed section is short.
`truncated: true` means a section
preview ends before the section does. `previewOmitted: true` means no preview
was selected; it does not mean the note is irrelevant. Inspect that original
when its path or topic may supply required evidence. These flags are retrieval diagnostics,
not judgments that the evidence supports an answer. An unmarked preview still
does not establish that other notes or evidence are unnecessary; inspect
originals when completeness is uncertain.

### Experimental full-source batching

`recall-managed --auto --agent --prefetch-wide-originals` can attach
`originalSources` (full Markdown, exact path and SHA-256) on a complete wide
first candidate page. Curator can use those originals immediately; a preview's
`sourceReadRequired` flag does not require rereading an already supplied original.
Attached originals do not establish relevance or semantic completeness.

`prefetch.status: skipped` preserves normal selective reads for focused queries,
continuation pages, more candidates, scan limits, or over 256,000 raw original
bytes. This budget limits eager transport only: no original is shortened and
no candidate is removed. Use normal reads/pagination when skipped. Source
changes during snapshot delivery are errors. This is opt-in experimental
behavior; default adapters are unchanged. See the [A/B report](../evaluation/prefetch-ab-2026-09-28.md).

### Read selected originals together

```sh
graphmory read-notes --vault <path> --paths '["projects/one.md","decisions/two.md"]'
```

This local read-only command returns full Markdown per path, SHA-256 of file
bytes, byte count, and line count as compact JSON. Select the notes needed
for the question; output is not truncated or summarized. An unsafe or missing
path fails the entire request. Hashes identify originals and do not validate
the meaning of a claim. A host's existing batched file-read tool is also fine;
this command is useful when separate source envelopes are needed.

For a Lead → Curator consolidation handoff, the Lead can freeze exact source
and target file identity without sending note bodies in the handoff:

```sh
graphmory source-handoff --vault <path> --paths '["90 Evidence/Approval Record.md","01 Projects/Example/Runbook.md"]' > <handoff-outside-vault.json>
graphmory read-notes --vault <path> --manifest <handoff-outside-vault.json>
```

The second command verifies the vault and every named file's SHA-256/byte count
before returning any original content. A changed, missing or unsafe file
blocks the complete read. Give the Curator the manifest path and patch path;
it must read and verify the actual originals before editing. The Lead selects
paths from exact discovered results. Evidence anchors such as `#E1` and `#E2`
refer to sections within a named Markdown file, never separate file names.
This handoff proves file identity only; it does not prove semantic support or
authorize the proposed memory change.

### Experimental section coverage previews

In curator mode, `recall-managed --auto --coverage-previews --agent` selects up to three nested sections by query overlap in body and heading, skipping the root metadata section. It changes preview selection only; read originals when evidence is incomplete and continue pagination using `nextOffset`. Notes without nested sections keep the existing preview. This option cannot be combined with `--matched-previews`.

It is opt-in: [development experiments](../evaluation/locomo-coverage-preview-2026-09-28.md) show improved average evidence visibility with some regressions and an incomplete live answer. It is not a semantic search replacement or a guarantee of completeness.
