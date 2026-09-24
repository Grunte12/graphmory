# Where This Fits in the RAG Landscape

## English

### Short answer

Graphmory is **not a complete Agentic RAG system today**.

It is an **agent-controlled memory retrieval architecture** over a canonical, linked Markdown wiki. It has some agentic retrieval behavior and a dependency-free BM25F section retrieval pipeline, but it does not yet include the full iterative retrieval loop, persistent search index, or reranking-by-model pipeline normally expected from a production Agentic RAG system.

### A practical RAG taxonomy

The names below overlap in the literature. Treat them as architectural patterns, not mutually exclusive product categories.

| Pattern | Typical flow | Main additions |
|---|---|---|
| Naive RAG | chunk -> embed/index -> top-k retrieve -> generate | One fixed retrieval pass |
| Advanced RAG | improve query/chunks -> hybrid retrieve -> rerank/filter -> generate | Query rewriting, smarter chunking, metadata, BM25 + vectors, reranking |
| Modular RAG | route among interchangeable retrieval and generation modules | Multiple sources, retrievers, validators, caches, memory, or tools |
| Agentic RAG | agent plans -> chooses retrieval tools -> evaluates evidence -> retrieves again if needed -> answers/acts | Planning, iterative search, reflection, tool use, stopping policy |
| GraphRAG | retrieve entities, relations, neighborhoods, or communities from a graph | Relationship-aware and multi-hop retrieval |

### What this harness has now

| Capability | Status | Current mechanism |
|---|---:|---|
| External durable knowledge | Yes | Canonical Markdown/Obsidian wiki |
| Agent decides what memory is relevant | Yes | Memory curator |
| Bounded retrieval | Yes | Brain Brief with 1-7 items and 0-3 direct-read paths |
| Multi-step link following | Partly | Curator follows project maps and wikilinks |
| Retrieval provenance | Yes | Exact note and evidence paths |
| Conflict handling | Yes | `TENSION` rather than silent overwrite |
| Chunking | No | Notes are already human/agent-sized semantic units |
| Embeddings/vector database | No | Not needed at the current scale |
| BM25/full-text section retrieval | Yes (default) | Dependency-free BM25F section ranking with lifecycle filtering and scope narrowing |
| Hybrid sparse+dense retrieval | Optional | `recall-semantic` fuses BM25F with local Transformers.js embeddings; optional install, not core default |
| Section-focus reranking | Optional | `sectionFocusRerank` via `--rerank` flag; deterministic section-heading signal, not a learned model |
| Automated retrieval-quality loop | No | The curator does not yet score sufficiency and retry systematically |

### So what should we call it?

Preferred:

> Agentic memory retrieval with a compiled Markdown wiki.

Also accurate:

> A RAG-ready memory governance layer.

Avoid for now:

> Full Agentic RAG, Advanced RAG, or GraphRAG.

Those labels would imply retrieval components that are not implemented yet.

### Why not add every RAG technique now?

Each component solves a different measured failure:

- **Smart chunking** helps when source documents are too large or split across bad boundaries. Canonical notes already act as semantic chunks.
- **Embeddings** help when vocabulary differs between the query and the note. They add indexing cost and can return semantically similar but operationally wrong notes.
- **BM25** helps with exact terms, identifiers, error messages, and names.
- **Hybrid retrieval** combines exact and semantic recall when either alone misses evidence.
- **Reranking** helps when the initial retriever returns too many weak candidates.
- **Agentic retrieval loops** help when a single query cannot answer a multi-step question, but they increase latency, cost, and failure surface.

Do not add a component because it is considered "advanced." Add it when an evaluation identifies the failure it fixes.

### Upgrade path

```text
Phase 1 - Current
Project map + wikilinks + bounded curator recall

Phase 2 - Deterministic search (current default)
Dependency-free BM25F section retrieval with lifecycle filtering, scope narrowing, and release-gate thresholds. Persistent indexing is deferred until per-query BM25F latency becomes the bottleneck.

Phase 3 - Hybrid retrieval
Add embeddings plus BM25 when semantic recall failures are measured

Phase 4 - Reranking
Rerank only when candidate precision becomes the bottleneck

Phase 5 - Agentic RAG loop
Let the curator reformulate, retrieve, judge sufficiency, and retry under a cost/step budget

Phase 6 - Graph-assisted retrieval
Use code graph or source-map tools as derived indexes, never as evidentiary truth or canonical operational memory
```

Context compression and graph/source-map tools may complement this architecture later, but neither should silently replace canonical Markdown or provenance.

The repository uses governed BM25F section retrieval as the default recall path. On synthetic stress tests, it meets the release gate thresholds (Recall@3 >= 0.90, current-memory accuracy >= 0.90, MRR >= 0.90, zero polluted queries). Reranking, hybrid semantic lanes, and persistent indexing are deferred until evaluation measures a gap that those components fix.

### Sources

- RAG taxonomy: https://arxiv.org/abs/2312.10997
- Agentic RAG survey: https://arxiv.org/abs/2501.09136
- Agentic RAG systematization and risks: https://arxiv.org/abs/2603.07379
- Contextual chunks, hybrid retrieval, and reranking: https://www.anthropic.com/research/contextual-retrieval

---

## ภาษาไทย

### คำตอบสั้น

Graphmory **ยังไม่ใช่ Agentic RAG แบบเต็มระบบ**

ตอนนี้มันคือ **ระบบค้นคืนความจำที่ agent เป็นผู้ควบคุม** โดยใช้ Markdown/Obsidian wiki ที่เชื่อมโยงกันเป็นแหล่งความรู้หลัก มีลักษณะ agentic บางส่วน เพราะ Curator ตัดสินใจว่า note ใดเกี่ยวข้อง แต่ยังไม่มี indexing และ ranking pipeline แบบ RAG ที่ใช้ในระบบ production ทั่วไป

### ประเภทของ RAG แบบเข้าใจง่าย

ชื่อประเภทเหล่านี้อาจซ้อนกันได้ ควรมองเป็น pattern มากกว่าหมวดผลิตภัณฑ์ที่แยกขาดจากกัน

| รูปแบบ | ลำดับการทำงานทั่วไป | สิ่งที่เพิ่มเข้ามา |
|---|---|---|
| Naive RAG | แบ่ง chunk -> embed/index -> ดึง top-k -> ให้ LLM ตอบ | ค้นคืนรอบเดียวตาม pipeline ตายตัว |
| Advanced RAG | ปรับ query/chunk -> ค้นแบบ hybrid -> rerank/filter -> ตอบ | Query rewriting, smart chunking, metadata, BM25 + vector, reranking |
| Modular RAG | เลือกและประกอบโมดูล retrieval/generation หลายแบบ | หลาย data source, retriever, validator, cache, memory และ tools |
| Agentic RAG | agent วางแผน -> เลือกเครื่องมือค้น -> ประเมินหลักฐาน -> ค้นเพิ่มเมื่อยังไม่พอ -> ตอบหรือลงมือทำ | Planning, iterative retrieval, reflection, tool use และ stopping policy |
| GraphRAG | ค้น entity, relation, neighborhood หรือ community จาก graph | เหมาะกับความสัมพันธ์และคำถามหลายทอด |

### ตอนนี้ harness ของเรามีอะไรแล้ว

| ความสามารถ | สถานะ | วิธีที่ใช้ |
|---|---:|---|
| ความรู้ถาวรภายนอก context | มี | Canonical Markdown/Obsidian wiki |
| Agent เลือก memory ที่เกี่ยวข้อง | มี | Memory Curator |
| จำกัดปริมาณ context | มี | Brain Brief 1-7 รายการ และ direct-read 0-3 paths |
| เดินตาม link หลายขั้น | มีบางส่วน | Curator ตาม project map และ wikilinks |
| อ้างที่มาของ retrieval | มี | Exact note paths และ evidence paths |
| จัดการข้อมูลขัดแย้ง | มี | ใช้ `TENSION` แทนการเขียนทับ |
| Chunking | ไม่มี | Atomic notes ทำหน้าที่เป็น semantic chunk อยู่แล้ว |
| Embedding/vector database | ไม่มี | ยังไม่จำเป็นกับขนาดปัจจุบัน |
| BM25/full-text section retrieval | มี (ค่าเริ่มต้น) | Dependency-free BM25F section ranking พร้อม lifecycle filtering และ scope narrowing |
| Hybrid sparse+dense retrieval | มีเป็นตัวเลือก | `recall-semantic` ใช้ BM25F ผสานกับ local Transformers.js embeddings |
| Section-focus reranking | มีเป็นตัวเลือก | `sectionFocusRerank` ผ่าน `--rerank` flag ใช้สัญญาณจากหัวข้อ section |
| Retrieval-quality loop อัตโนมัติ | ไม่มี | Curator ยังไม่ได้ให้คะแนนความเพียงพอและ retry อย่างเป็นระบบ |

### ควรเรียกระบบนี้ว่าอะไร

คำที่แนะนำ:

> Agentic memory retrieval with a compiled Markdown wiki

หรือ:

> RAG-ready memory governance layer

ยังไม่ควรเรียกว่า Full Agentic RAG, Advanced RAG หรือ GraphRAG เพราะจะสื่อว่าเรามี retrieval components ที่ยังไม่ได้สร้าง

### ทำไมไม่ใส่ RAG technique ทุกอย่างทันที

แต่ละเทคนิคแก้คนละปัญหา:

- **Smart chunking** แก้เอกสารใหญ่หรือจุดตัดเนื้อหาไม่ดี แต่ atomic note ของเราคือ semantic chunk อยู่แล้ว
- **Embedding** ช่วยตอนคำถามใช้คำคนละชุดกับ note แต่มีต้นทุน index และอาจดึงสิ่งที่ความหมายคล้ายแต่ใช้ผิดบริบท
- **BM25** เหมาะกับชื่อเฉพาะ identifier error message และคำที่ต้องตรง
- **Hybrid retrieval** ใช้เมื่อ exact search หรือ semantic search อย่างใดอย่างหนึ่งพลาดบ่อย
- **Reranking** ใช้เมื่อ retriever ส่ง candidate ที่ไม่เกี่ยวข้องมามาก
- **Agentic retrieval loop** ใช้กับคำถามหลายขั้นที่ค้นครั้งเดียวไม่พอ แต่เพิ่ม latency, token cost และจุดผิดพลาด

อย่าเพิ่มเพราะมันดู advanced ให้เพิ่มเมื่อ evaluation แสดง failure ที่มันแก้ได้

### เส้นทางการพัฒนา

```text
Phase 1 - ตอนนี้
Project map + wikilinks + bounded curator recall

Phase 2 - Deterministic search (ค่าเริ่มต้นปัจจุบัน)
Dependency-free BM25F section retrieval พร้อม lifecycle filtering, scope narrowing และ release-gate thresholds

Phase 3 - Hybrid retrieval
เพิ่ม embedding + BM25 เมื่อพบ semantic recall failure จริง

Phase 4 - Reranking
เพิ่มเมื่อ candidate precision กลายเป็นคอขวด

Phase 5 - Agentic RAG loop
ให้ Curator reformulate query, retrieve, ประเมินความพอ และ retry ภายใต้งบที่กำหนด

Phase 6 - Graph-assisted retrieval
ใช้ code graph/source-map tools เป็น derived index ไม่ใช่หลักฐานต้นทางหรือ canonical operational memory
```

context compression และ graph/source-map tools สามารถเสริมระบบนี้ภายหลังได้ แต่ไม่ควรแทน canonical Markdown หรือ provenance แบบเงียบ ๆ

ตอนนี้ governed BM25F section retrieval เป็นค่าเริ่มต้นของระบบ recall บน synthetic stress tests ผ่าน release gate thresholds (Recall@3 >= 0.90, current-memory accuracy >= 0.90, MRR >= 0.90, ไม่มี polluted queries)

### แหล่งอ้างอิง

- RAG taxonomy: https://arxiv.org/abs/2312.10997
- Agentic RAG survey: https://arxiv.org/abs/2501.09136
- Agentic RAG systematization and risks: https://arxiv.org/abs/2603.07379
- Contextual chunks, hybrid retrieval และ reranking: https://www.anthropic.com/research/contextual-retrieval
