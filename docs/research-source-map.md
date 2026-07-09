# Research Source Map / แผนที่แหล่งวิจัย

This file records which sources change the architecture and which sources were reviewed but excluded.

ไฟล์นี้ระบุว่าแหล่งใดเปลี่ยน architecture ของเรา และแหล่งใดตรวจแล้วแต่ไม่เกี่ยวข้องโดยตรง

## Adopted Foundations

| Source | Evidence used | Architectural consequence |
|---|---|---|
| [Anthropic: Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Context is finite; load identifiers and evidence just in time | Brain Briefs and bounded direct reads |
| [LangChain: Context Engineering](https://www.langchain.com/blog/context-engineering-for-agents) | Write, select, compress, and isolate context; evaluate whether context changes help | Memory Patch, curator retrieval, section compression, isolated canonical/evidence layers |
| [HumanLayer: 12-factor agents](https://github.com/humanlayer/12-factor-agents) | Own prompts, context, and control flow; use structured outputs and focused agents | Explicit contracts and curator authority boundary |
| [Faulty continuous memory](https://arxiv.org/abs/2605.12978) | Forced consolidation can degrade useful memory; raw episodes should remain evidence | Significance gate, provenance, `BLOCKED`, no automatic rewrite |
| [Episodic-semantic architecture](https://arxiv.org/abs/2605.17625) | Bounded episodic and consolidated semantic memory reduce tokens; RAG remains useful for some historical retrieval | Canonical semantic wiki plus optional future RAG indexes |
| [StructMemEval](https://openreview.net/forum?id=a9vY2sJkf4) | Memory agents benefit from explicit organization | Typed atomic notes and project maps |
| [SimpleMem](https://openreview.net/forum?id=CMveUVer0m) | Structured compression and adaptive retrieval improve efficiency | Section-bounded retrieval and future adaptive gates |
| [CraniMem](https://openreview.net/forum?id=Tts94WVw40) | Gated, bounded memory resists distractor noise | Save only durable high-utility memory |
| [Anthropic: Contextual Retrieval](https://www.anthropic.com/research/contextual-retrieval) | Hybrid retrieval and reranking improve retrieval, with cost/latency trade-offs | Evaluate BM25, embeddings, and reranking separately before adoption |
| [STALE](https://arxiv.org/html/2605.06527v1) | Long-term agents must recognize when remembered state is no longer valid | Add stale-belief and premise-resistance cases to the evaluation plan |
| [Typed memory and provenance-role collapse](https://arxiv.org/html/2605.25869v1) | Provenance can blur when generated memory is treated like source evidence | Separate evidentiary truth from operational synthesis |
| [Codebase-Memory](https://arxiv.org/abs/2603.27277) | Deterministic code graphs can reduce broad code exploration for structural questions | Keep graph retrieval as an eval-gated derived index |
| [SQLite FTS5](https://www.sqlite.org/fts5.html) | Local BM25/full-text indexing is available without a separate retrieval service | Use persistent FTS only when corpus size or measured scan latency justifies it |

## Discovery Source

[Awesome Agent Harness](https://github.com/Picrew/awesome-agent-harness) is a useful catalog for discovering harnesses, benchmarks, observability, and context tools. It is not treated as primary evidence; claims must be traced to the linked project, paper, or official engineering report.

The broader discovery and filtering method is documented in [Independent NotebookLM Review](notebooklm-review.md).

## Reviewed but Excluded

[StockAgent / arXiv:2407.18957](https://arxiv.org/abs/2407.18957) studies LLM-based stock-trading simulation. It may be relevant to financial multi-agent systems, but it does not evaluate coding-agent memory, context retrieval, consolidation, or harness cost. It is therefore excluded from this project's architectural evidence.

## สรุปภาษาไทย

- Anthropic และ LangChain สนับสนุนการเลือก context เท่าที่จำเป็นแทนการโหลดทุกอย่าง
- งาน memory ปี 2026 สนับสนุนการแยก episodic evidence ออกจาก semantic memory และเตือนว่าการ consolidate บ่อยเกินไปทำให้ความจำแย่ลงได้
- HumanLayer สนับสนุน structured outputs, focused agents และการควบคุม context/control flow ด้วยตัว harness
- งาน RAG สนับสนุน hybrid retrieval และ reranking แต่ยอมรับต้นทุนด้าน latency และระบบ
- Architecture ของเราแยกหลักฐานต้นทางออกจาก Markdown ซึ่งเป็น canonical operational memory และเปิดทางให้ BM25, vector และ graph เป็น derived indexes ที่เพิ่มเมื่อ eval พิสูจน์ว่าจำเป็น
