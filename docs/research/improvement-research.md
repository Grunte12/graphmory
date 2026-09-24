# Improvement Research Notes

This document records research-backed improvement areas for Graphmory after the `0.5.0-rc.3` retrieval and sync work.

The harness should stay local-first, Markdown-readable, and agent-friendly. Improvements should reduce context waste and memory corruption before adding heavier infrastructure.

## Research Inputs

- Anthropic, [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Anthropic, [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- Anthropic, [Writing effective tools for AI agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- Anthropic, [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Anthropic, [Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)
- OpenAI Cookbook, [Practical guide for model selection](https://developers.openai.com/cookbook/examples/partners/model_selection_guide/model_selection_guide)
- OpenAI Cookbook, [Temporal agents with knowledge graphs](https://developers.openai.com/cookbook/examples/partners/temporal_agents_with_knowledge_graphs/temporal_agents)
- Hu, Wang, and McAuley, [MemoryAgentBench](https://arxiv.org/abs/2507.05257)
- Wu et al., [LongMemEval](https://arxiv.org/html/2410.10813v2)
- Uddin et al., [Memora / FAMA](https://arxiv.org/html/2604.20006v1)
- Kim et al., [Can LLM Agents Know When Their Memories Are No Longer Valid?](https://arxiv.org/html/2605.06527v1)

An external AGY research lane independently highlighted the same three high-value gaps: selective forgetting/stale memory, optional reranking for difficult retrieval, and structured conflict-resolution workflow.

## What The Current Harness Already Does Well

- Keeps canonical memory as Markdown rather than opaque vectors.
- Filters raw/stale/superseded memory by default.
- Uses scoped, bounded recall instead of broad vault reads.
- Provides deterministic health, sync, conflict, and curation commands.
- Separates lead-agent meaning from Memory Curator placement.
- Treats embeddings and indexes as derived, not canonical.
- Uses eval gates for retrieval, patch quality, learning loop, future task utility, sync behavior, and package safety.

## Highest-Value Improvement Areas

### 1. Stale Memory And Selective Forgetting

Memory systems should not only remember; they must know when a memory is obsolete, uncertain, low-utility, or unsafe to reuse.

Why this matters:

- MemoryAgentBench names selective forgetting as one of the core competencies of memory agents.
- LongMemEval includes knowledge updates, temporal reasoning, and abstention, not just recall.
- Memora/FAMA penalizes reliance on obsolete or invalidated memory.
- Implicit-conflict research shows agents may miss invalidation when the new evidence does not explicitly say "this replaces the old fact."

Implementation direction:

- Add a `stale-scan` or `memory-lifecycle-audit` command.
- Score notes with lightweight signals: lifecycle, `updated`, `revalidate_when`, backlinks, query-hit count if available, contradiction markers, and age.
- Return actions such as `revalidate`, `mark-stale`, `promote-current`, `merge-tension`, or `needs-human-decision`.
- Do not auto-delete or silently supersede. The tool should produce a review plan.

Success metrics:

- FAMA-style current-memory accuracy.
- Stale/raw/superseded pollution remains zero.
- Conflict cases produce `TENSION` or human decision prompts instead of silent overwrite.

Priority: high.

### 2. Conflict Resolution As A Structured Decision Artifact

Current `conflict-assist` is read-only and useful, but it should produce a more structured decision surface for humans and lead agents.

Why this matters:

- Git can merge files while semantic memory remains wrong.
- Human-in-loop should happen at decision gates, not every mechanical step.
- Long-running harness work benefits from clear artifacts that future sessions can resume from.

Implementation direction:

- Add a conflict decision schema or JSON output section with choices:
  - `merge-compatible`
  - `prefer-local`
  - `prefer-remote`
  - `supersede-local`
  - `supersede-remote`
  - `create-tension`
  - `blocked-needs-evidence`
- Add an optional `conflict-plan --out <file>` command that writes a review artifact but does not apply it.
- Later, add `conflict-apply --plan <file> --approve` with the same safety style as restructure apply.

Success metrics:

- Conflict eval includes same-note, non-overlapping, dirty-local, and implicit-conflict cases.
- No command merges or rebases automatically.
- Human decision is captured in durable provenance.

Priority: high.

### 3. Curation-First Retrieval Improvement

Current private eval misses are mostly buried gold, vocabulary mismatch, or note-structure issues. That means the next improvement should first improve the memory graph and aliases, not add heavy retrieval by default.

Why this matters:

- Anthropic context engineering recommends the smallest high-signal context and warns against tool/context bloat.
- Anthropic tool guidance warns that overlapping tools confuse agents.
- Current v0.5 eval already shows strong deterministic performance while private real-vault misses point to curation gaps.

Implementation direction:

- Keep `recall` as the default.
- Keep `recall-loop` diagnostic only.
- Expand `curation-recommend` to support optional output modes:
  - `alias-patch-candidate`
  - `moc-link-candidate`
  - `scope-fix-candidate`
  - `grouped-gold-review`
- Let agents apply only clearly reversible metadata/link additions when evidence is explicit.

Success metrics:

- Re-run frozen private eval after curation-only changes.
- Recall@3 and MRR improve without increasing context size or optional dependencies.
- Miss classifier shows fewer `buried-gold` cases.

Priority: high.

### 4. Optional Reranking, Not Default Reranking

Contextual Retrieval reports large retrieval gains from contextual BM25/embeddings and reranking. But adding reranking as a default would conflict with the harness goal of being dependency-light and local-first.

Why this matters:

- Reranking can improve top-k quality when sparse retrieval finds the answer but buries it.
- It adds model dependency, latency, cache management, and privacy questions.
- v0.5 sparse fusion did not beat default BM25F enough to justify default promotion.

Implementation direction:

- Keep semantic/rerank lanes opt-in.
- Add eval-only reranking experiments before runtime promotion.
- If added, expose as `recall-rerank` or `recall-semantic --rerank`, never as default.

Success metrics:

- Human-labeled frozen set improves materially.
- Token/context budget remains bounded.
- First-run latency and model download are documented.

Priority: medium.

### 5. Live Agent Eval With Tool-Trace Metrics

The deterministic suite is strong, but public claims should stay conservative until live-model behavior is measured.

Why this matters:

- Anthropic eval guidance recommends 20-50 real tasks from failures to start.
- Agent evals should combine code-based, model-based, and human graders.
- OpenAI guidance recommends golden sets, tool-error tracking, cost guardrails, and edge-case testing.

Implementation direction:

- Add `eval/live-cases/` templates that record:
  - task goal,
  - expected memory behavior,
  - tool calls used,
  - token estimate,
  - correction count,
  - whether the agent asked at the right gate,
  - whether memory improved future work.
- Do not store private transcripts in the repo. Store schemas, anonymized examples, and scoring wrappers.

Success metrics:

- 20+ anonymized cases.
- Three isolated trials per tested agent setup when comparing.
- Report failure classes, not only aggregate scores.

Priority: medium-high.

### 6. Initializer / Resume Artifacts

Long-running agent harnesses benefit from a stable artifact that tells the next session what to do without re-reading everything.

Why this matters:

- Anthropic's long-running harness pattern separates initial environment setup from later incremental sessions.
- Clear progress artifacts reduce context reconstruction cost.
- This aligns with the harness goal: the next agent should recover state from memory tools, not raw chat.

Implementation direction:

- Add a `brain-session-brief` command that reads health, recent sync state, and selected recall queries, then emits a compact Markdown handoff.
- Keep it derived and disposable; canonical memory remains Markdown notes.

Success metrics:

- New-session startup uses fewer broad vault reads.
- Handoff eval passes with smaller context.

Priority: medium.

## Implementation Status

All five items below are now implemented. The order was followed and the harness remains simple while addressing the key failure modes.

| # | Item | Status | Key command/file pointers |
|---|---|---|---|
| 1 | `memory-lifecycle-audit` for stale/current/conflict review | **IMPLEMENTED** | `brain-sync.mjs lifecycle-audit --vault <path>`, `scripts/eval-lifecycle-audit.mjs` |
| 2 | Conflict decision artifact/schema on top of `conflict-assist` | **IMPLEMENTED** | `brain-sync.mjs conflict-assist` (with `decisionOptions`), `conflict-plan`, `conflict-apply`, `scripts/eval-conflict-assist.mjs` |
| 3 | `curation-recommend` expanded into reversible patch candidates | **IMPLEMENTED** | `brain-sync.mjs curation-recommend`, `curation-apply --plan <file> --approve`, `scripts/recommend-curation.mjs` |
| 4 | Live-agent eval templates and scoring wrappers | **IMPLEMENTED** | `eval/live-agent/run-template.md`, `scripts/eval-live-agent-score.mjs`, `eval/live-agent/incidents.json` |
| 5 | Optional reranking (prototyped after curation improvements) | **IMPLEMENTED** | `brain-sync.mjs recall-rerank`, `recall --rerank`, `scripts/eval-rerank.mjs`, `eval:rerank` npm script |

### Remaining roadmap items

- **Live-model benchmark results**: all evaluation infrastructure is in place (`eval/live-agent/`, scoring scripts, worksheet template), but real model runs have not been completed. See `docs/evaluation/live-model-results.md`.
- **Write lock helper**: deferred until an automated apply-to-vault path is added (no change from original plan).
