# คู่มือแนวคิด Graphmory

Graphmory คือระบบจัดการความจำให้ AI agent ทำงานต่อเนื่องได้ดีขึ้น โดยไม่ต้องยัด context ทั้งหมดกลับเข้าไปทุกครั้ง และไม่ปล่อยให้ agent จดทุกอย่างมั่ว ๆ ลง memory

ปัญหาที่มันแก้คือ:

- agent ทำงานสำเร็จวันนี้ แต่ session หน้าไม่จำบทเรียนเดิม
- เคยบอก preference แล้ว แต่ agent กลับไปทำผิดซ้ำ
- memory กลายเป็นไดอารี่ยาว ๆ ไม่รู้ว่าอะไรใช้ได้จริง
- agent อีกตัวสรุปงานแทน ทั้งที่ไม่ได้เห็นรายละเอียดจริง แล้วบทเรียนเพี้ยน
- memory เก่าหมดอายุแล้ว แต่ยังถูกใช้เหมือนเป็น truth
- graph/search/cache ถูกเข้าใจผิดว่าเป็นความจริง ทั้งที่เป็นแค่ตัวช่วยค้น

หลักคิดสั้น ๆ:

```text
จำเฉพาะสิ่งที่เปลี่ยนการทำงานครั้งหน้า
จำพร้อมหลักฐาน
จำพร้อมขอบเขต
จำพร้อมเงื่อนไขว่าตอนไหนต้องตรวจใหม่
```

## แกนของระบบ

ระบบนี้แยกหน้าที่เป็น 2 ฝั่ง

```text
Lead agent / Orchestrator
  -> เห็นงานจริง
  -> เข้าใจว่าทำอะไรไป
  -> รู้ว่าบทเรียนคืออะไร
  -> เขียน "ความหมาย" ของ memory

Memory Curator
  -> หาโน้ตเก่าที่เกี่ยวข้อง
  -> จัดหมวด
  -> เชื่อมลิงก์
  -> ตรวจซ้ำ/ชน/เก่า
  -> บันทึกโดยไม่แต่งเรื่องเพิ่ม
```

เหตุผลคือ agent ที่ทำงานจริงมี context มากที่สุด จึงควรเป็นคนบอกว่า “เรื่องนี้ควรจำว่าอะไร”

แต่ agent ที่ทำงานจริงไม่ควร browse/write vault เองแบบอิสระ เพราะจะเสี่ยงอ่านกว้างเกิน เขียนซ้ำ ลืม evidence หรือ overwrite memory เก่า

ดังนั้นเราให้:

```text
Lead agent เป็นเจ้าของความหมาย
Memory Curator เป็นเจ้าของโครงสร้าง
```

นี่คือ design decision หลักของ harness

## ทำไมไม่ให้ Curator ตัดสินใจเองทั้งหมด

ถ้า Curator ได้แค่ summary จาก Orchestrator แล้วต้องเดาเองว่าอะไรควรจำ คุณภาพจะตก

ปัญหาคือ:

- Curator ไม่ได้อยู่ใน task จริง
- ข้อมูลที่ส่งต่อมักถูกย่อ
- รายละเอียดที่สำคัญอาจหาย
- ถ้า Curator เติมช่องว่างเอง memory จะกลายเป็น hallucinated memory

Graphmory จึงไม่ให้ Curator “คิดแทน” ว่าบทเรียนคืออะไร

Curator ทำหน้าที่เหมือนคนดูแลคลังความรู้: จัดระเบียบ เชื่อมโยง ตรวจ conflict และบอกว่า memory นี้ใช้ได้หรือยัง

## Memory Patch คืออะไร

Memory Patch คือรูปแบบการส่งบทเรียนเข้า memory

มันไม่ใช่ summary ว่าเกิดอะไรขึ้น แต่เป็นบทเรียนที่ใช้เปลี่ยนพฤติกรรมครั้งหน้า

Memory Patch ต้องตอบให้ชัด:

- `claim`: ต้องจำอะไร
- `why_it_matters`: ทำไมต้องจำ
- `scope.applies`: ใช้กับกรณีไหน
- `scope.excludes`: ไม่ใช้กับกรณีไหน
- `provenance`: หลักฐานมาจากไหน
- `confidence`: มั่นใจแค่ไหน
- `lifecycle`: ตอนไหนต้องกลับมาตรวจใหม่

ตัวอย่างที่ไม่ดี:

```text
วันนี้ UI พัง แล้วแก้แล้ว
```

ตัวอย่างที่ดี:

```text
claim:
งาน visible UI ต้อง verify ด้วย visual evidence ไม่ใช่ปิดงานจาก build/lint อย่างเดียว

why_it_matters:
build ผ่านไม่ได้แปลว่า layout, spacing, responsive, interaction ถูกต้อง

applies:
frontend UI, dashboard, chart, interactive page

excludes:
backend API, database, auth, non-visual test

provenance:
visual QA artifact หรือ command result ที่พิสูจน์ปัญหา

lifecycle:
ตรวจใหม่เมื่อ visual QA workflow หรือ ownership policy เปลี่ยน
```

ความต่างคืออันแรกเป็นไดอารี่ อันที่สองเป็น memory ที่ทำให้ agent ทำงานดีขึ้นในอนาคต

## Brain Brief คืออะไร

Brain Brief คือ memory สั้น ๆ ที่ Curator ส่งกลับมาก่อนเริ่มงาน

แทนที่ agent จะเปิด vault ทั้งก้อน เราให้มันถามแบบเจาะ:

```text
งานนี้เกี่ยวกับ dashboard visual QA
มี memory อะไรที่ควรรู้ก่อนเริ่มไหม
```

Curator ควรตอบแค่ของที่เกี่ยว:

- memory สำคัญ 1-7 ข้อ
- note path ที่ควรเปิดไม่เกิน 3 ไฟล์
- stale warning ถ้ามี
- contradiction ถ้ามี
- rule หรือ preference ที่เปลี่ยนแผนงานได้

Brain Brief คือ context แบบจำกัด ไม่ใช่ dump ความรู้ทั้งหมด

เป้าหมายคือให้ agent เริ่มงานด้วย memory ที่เกี่ยวจริง ใช้ token น้อย และไม่โดน noise จากโน้ตเก่า ๆ

## Learning Packet คืออะไร

Learning Packet คือ Memory Patch รุ่นเข้มกว่า ใช้กับบทเรียนที่ควรเปลี่ยน behavior ของ agent ในอนาคตจริง ๆ

มันบังคับให้มี loop:

```text
recall -> act -> verify -> learn
```

Learning Packet ต้องมี:

- lesson: บทเรียนคืออะไร
- trigger: อะไรทำให้ต้องจำ
- future_behavior_change: ครั้งหน้าต้องทำต่างออกไปยังไง
- evidence: หลักฐาน
- verification: พิสูจน์แล้วหรือยัง
- loop_trace: recall/act/verify/learn เกิดอะไรขึ้น
- selectors: tag, file glob, tool name, error pattern ที่ช่วยเรียก memory นี้กลับมา
- lifecycle: เมื่อไหร่ควร revalidate

ตัวอย่าง:

```text
trigger:
agent บอกว่างาน UI เสร็จหลัง build ผ่าน แต่ยังไม่ได้ visual QA

verification:
visual QA เจอ layout issue จริง

future behavior:
ถ้างานเป็น visible UI ต้องมี visual evidence ก่อนปิดงาน

selectors:
tags: ui, visual-qa, false-done
tool_names: visual_qa
file_globs: src/**/*.tsx
```

Memory Patch ใช้กับบทเรียนทั่วไป

Learning Packet ใช้กับบทเรียนที่ verified แล้ว และควรเปลี่ยน decision ของ agent ครั้งหน้า

## Memory 4 ชั้น

ระบบนี้แยก memory เป็น 4 ชั้นเพื่อกันความมั่ว

### 1. Raw Evidence

หลักฐานดิบ เช่น file path, command output, visual QA artifact, user statement, URL

นี่คือของที่ใช้ตรวจสอบได้ ไม่ควรถูก rewrite เงียบ ๆ

### 2. Canonical Markdown Wiki

Markdown note ที่เป็นความเข้าใจปัจจุบันของระบบ เช่น decision, workflow, preference, root cause, gotcha

นี่คือ memory หลักที่ agent ใช้

### 3. Derived Views

สิ่งที่สร้างจาก memory เพื่อช่วยค้นหรือดูภาพรวม เช่น search index, graph, HTML report, summary

Derived view เป็นแผนที่ ไม่ใช่ความจริง

ถ้า graph บอกว่า note A เกี่ยวกับ note B มันเป็นแค่ hint ไม่ใช่ accepted memory

### 4. Hot Context Pack

context สั้น ๆ สำหรับเรื่องที่ใช้บ่อย เช่น current policy, preference, routing rule, known gotcha

มันช่วยลด token และเพิ่มความสม่ำเสมอ แต่ไม่ใช่ source of truth

ถ้า Hot Context Pack เก่า ต้องกลับไปดู canonical Markdown

## APPLIED / TENSION / BLOCKED

Curator ห้ามตอบแค่ “done”

ทุก memory write ต้องได้สถานะชัดเจน:

### APPLIED

ใช้เมื่อ memory มี evidence พอ scope ชัด และไม่ชนกับของเก่า

### TENSION

ใช้เมื่อ memory ใหม่ขัดกับ memory เก่า

ระบบไม่ควร overwrite ทันที เพราะบางครั้งของเก่าอาจยังจริงในอีก scope หนึ่ง หรือ policy เพิ่งเปลี่ยน

TENSION ทำให้ contradiction มองเห็นได้

### BLOCKED

ใช้เมื่อ memory ยังไม่ควรถูกบันทึก เช่น:

- ไม่มี evidence
- scope ไม่ชัด
- เป็นแค่ diary
- claim กว้างเกินไป
- confidence ต่ำเกินแต่เขียนเหมือนจริง

BLOCKED คือกลไกกัน false memory

## Flow การใช้งานจริง

ตัวอย่างงาน frontend:

```text
1. User ขอแก้ dashboard
2. Orchestrator ขอ Brain Brief จาก Memory Curator
3. Curator ส่ง memory ที่เกี่ยวกลับมา:
   - UI ต้อง verify ด้วย visual QA
   - chart เคย overflow บน mobile
   - Designer เป็น owner ของ visible UI
4. Designer ทำงาน
5. visual QA เจอปัญหา
6. Designer แก้และ verify ใหม่
7. Orchestrator เห็นบทเรียนใหม่
8. Orchestrator เขียน Learning Packet
9. Curator ตรวจ note เก่า
10. Curator คืน APPLIED, TENSION, หรือ BLOCKED
11. งานครั้งหน้า Brain Brief จะดึงบทเรียนนี้กลับมา
```

นี่คือ self-improvement แบบ local-first

มันไม่ได้ train model ใหม่ แต่มันทำให้ agent มีระบบเรียนรู้จากงานจริงแบบตรวจสอบได้

## Use Case ที่ระบบนี้เกิดมาเพื่อช่วย

### 1. Agent ทำผิดซ้ำในเรื่องเดิม

ตัวอย่าง:

```text
agent ชอบปิดงาน UI หลัง build ผ่าน
แต่จริง ๆ ต้องมี visual QA
```

Memory ที่ควรเก็บ:

```text
เมื่อ task เป็น visible UI ห้ามใช้ build/lint เป็น final proof ต้องมี visual evidence
```

ครั้งหน้า Brain Brief จะเตือนก่อนเริ่มงาน ทำให้ agent ไม่ต้องพลาดซ้ำ

### 2. Project มี preference เฉพาะ

ตัวอย่าง:

```text
เจ้าของ project ไม่ชอบให้ agent refactor กว้าง
ชอบให้แก้เฉพาะ scope
ไม่ชอบ commit/push โดยไม่ approve
```

Memory ที่ดีไม่ควรเขียนว่า “user prefers careful work” เพราะกว้างเกิน

ควรเขียนเป็น rule ที่ใช้ได้จริง:

```text
สำหรับ repo public ห้าม stage/commit/push โดยไม่มี approval ชัดเจน แม้งานจะผ่าน test แล้ว
```

### 3. Tool ใช้ผิดบ่อย

ตัวอย่าง:

```text
agent ใช้ Chrome DevTools ตลอด ทั้งที่มี visual QA harness ที่ถูกกว่าและ repeatable กว่า
```

Memory ที่ควรจำ:

```text
งาน visual verification ใช้ visual QA harness ก่อน Chrome DevTools ใช้เฉพาะ fallback ที่ต้อง live-control
```

อันนี้ทำให้ workflow ถูกลงและหลักฐานดีขึ้น

### 4. Decision เก่าอาจหมดอายุ

ตัวอย่าง:

```text
เคยเลือก model A เพราะถูกกว่า
แต่ provider pricing/model quality เปลี่ยน
```

Memory ต้องมี lifecycle:

```text
revalidate_when:
- provider pricing changes
- model benchmark changes
- user reports cost spike
```

ถ้าไม่มี lifecycle agent จะเชื่อ decision เก่าตลอดไป

### 5. ความรู้หลายแหล่งขัดกัน

ตัวอย่าง:

```text
โน้ตเก่าบอกให้ใช้ tool A
โน้ตใหม่บอก tool B ดีกว่า
```

Curator ไม่ควรลบทิ้งทันที

ควรคืน `TENSION` แล้วระบุว่า conflict อยู่ตรงไหน เพื่อให้ lead agent ตัดสิน

### 6. ต้องการเอา memory ไปใช้กับหลาย agent/provider

เพราะ memory อยู่ใน Markdown/JSON contract จึงไม่ผูกกับ model เดียว

ใช้ได้กับ:

- OpenCode
- Claude Code
- Codex
- custom agent harness
- Obsidian/Markdown vault
- future MCP/tool wrapper

แกนของระบบไม่ใช่ plugin แต่เป็น contract

## ตัวอย่าง Memory ที่ควรจำและไม่ควรจำ

### ควรจำ

```text
งาน UI ต้อง verify ด้วย visual evidence ก่อนปิด task
```

เพราะเปลี่ยน behavior ครั้งหน้า

```text
ถ้า Reddit MCP เจอ 403 ให้หยุด retry call เดิม และใช้ social/web fallback พร้อมบอกว่า direct Reddit ต้องมี OAuth
```

เพราะลด tool loop และลด token waste

```text
ก่อน public push ต้อง scan secret/private path/AI leak และต้องได้ user approval
```

เพราะเป็น safety rule ที่ใช้ซ้ำ

### ไม่ควรจำ

```text
วันนี้แก้ bug เสร็จแล้ว
```

เพราะเป็น diary

```text
agent ทำงานดีมาก
```

เพราะไม่มี behavior change

```text
น่าจะใช้ model X เพราะดูฉลาด
```

เพราะไม่มี evidence และไม่มี scope

```text
อ่าน docs แล้ว
```

เพราะไม่บอกว่าครั้งหน้าต้องทำอะไรต่างออกไป

## Anti-pattern ที่ระบบนี้พยายามกัน

### Memory Dump

เอาทุกอย่างลง vault เพราะกลัวลืม

ผลคือ retrieval แย่ลง agent อ่านเยอะขึ้น และ memory สำคัญจมหาย

### Diary Memory

เขียนว่าเกิดอะไรขึ้นทุกวัน แต่ไม่บอก lesson

ดีต่อมนุษย์ที่อยากอ่าน log แต่ไม่ดีต่อ agent ที่ต้องตัดสินใจครั้งหน้า

### Curator Hallucination

Curator ได้ summary สั้น ๆ แล้วเติมเหตุผลเอง

นี่อันตราย เพราะ memory ที่ผิดจะดูเป็นระเบียบและน่าเชื่อ

### Silent Overwrite

เจอ memory ใหม่แล้วลบ memory เก่าทันที

ควรใช้ TENSION ก่อน ถ้ายังไม่รู้ว่าอันไหนถูกกว่า

### Cache Becomes Truth

Hot Context Pack หรือ generated summary เก่าแล้ว แต่ agent ยังเชื่อ

ต้องมี lifecycle และ source path กลับไปหา canonical Markdown

### Graph Becomes Truth

graph ชี้ relation แล้ว agent เชื่อว่าเป็น accepted knowledge

graph เป็น hint เท่านั้น ถ้าจะกลายเป็น memory ต้องผ่าน Memory Patch

## วิธีคิดตอนตัดสินใจว่าจะจำไหม

ใช้คำถามนี้:

```text
ถ้า session หน้ารู้เรื่องนี้ตั้งแต่แรก งานจะดีขึ้นไหม
```

ถ้าไม่ดีขึ้น ไม่ต้องจำ

ถามต่อ:

```text
เรื่องนี้มี evidence ไหม
scope ชัดไหม
มีกรณีที่ไม่ควรใช้ไหม
หมดอายุได้ไหม
ถ้า memory เก่าขัดกัน ควรทำยังไง
```

ถ้าตอบไม่ได้ ให้ `BLOCKED` หรือเก็บเป็น open question ไม่ใช่ durable memory

## วิธีคิดเรื่อง Token และ Cost

Memory ที่ดีไม่ใช่ memory ที่สั้นที่สุดเสมอไป

Memory ที่ดีคือ:

```text
สั้นพอที่จะใช้ซ้ำได้
ละเอียดพอที่จะไม่ตีความผิด
มี evidence พอที่จะเชื่อได้
มี scope พอที่จะไม่ apply มั่ว
```

Learning Packet ยาวกว่า Memory Patch แต่ยาวเพราะมีข้อมูลที่ลดความผิดพลาด:

- trigger
- verification
- future behavior
- selectors
- lifecycle

ดังนั้นต้องวัดว่า token ที่เพิ่มขึ้นคุ้มไหม

ระบบนี้จึงมี eval ที่ดูทั้ง score และ estimated tokens

## ทำไม Markdown ยังเป็น Canonical

เหตุผลที่ใช้ Markdown เป็น canonical memory:

- คนอ่านได้
- git diff ได้
- review ได้
- แก้ด้วย editor ธรรมดาได้
- ไม่ผูกกับ vendor
- ใช้กับ Obsidian ได้
- backup ง่าย

Vector DB หรือ graph มีประโยชน์ แต่ควรเป็น derived layer

ถ้า index พัง เรายัง rebuild จาก Markdown ได้

ถ้า Markdown พัง ความจำจริงเสีย

## การต่อยอดที่ตั้งใจเปิดไว้

Harness นี้ deliberately เล็ก แต่เปิดช่องต่อยอด

### BM25 / full-text search

ใช้เมื่อ lexical search ธรรมดาหา memory ไม่เจอ

ควรเพิ่มเมื่อ eval บอกว่า Recall@k ดีขึ้นจริง

### Embedding / vector search

ใช้เมื่อ synonym/paraphrase ทำให้ค้นไม่เจอ

แต่ต้องคิดเรื่อง cost, privacy, stale index, false positive

### Graph-assisted retrieval

ใช้เมื่อ memory มี relation ซับซ้อน เช่น project -> subsystem -> decision -> incident

Graph ควรช่วยนำทาง ไม่ใช่เขียน truth เอง

### HTML report

ใช้เป็น review surface สำหรับมนุษย์ เช่น memory health, conflict map, eval report

HTML ไม่ควรเป็น canonical memory

### Hot Context Pack

ใช้กับ memory ที่ stable และถูกเรียกบ่อย

ควร regenerate ได้จาก Markdown

### MCP / Tool adapter

ใช้ให้ agent เรียก memory ผ่าน tool ได้สะดวกขึ้น

แต่ contract ควรยังทำงานได้แม้ไม่มี MCP

## ถ้าจะใช้กับทีมจริงควรวางกติกาอะไร

อย่างน้อยควรมีกติกา:

```text
1. ห้ามบันทึก secret หรือ raw transcript ทั้งก้อน
2. ทุก durable memory ต้องมี provenance
3. Routine summary ไม่ใช่ memory
4. Conflict ต้องเป็น TENSION ไม่ใช่ overwrite
5. Derived output ห้ามเป็น canonical truth
6. Memory ที่กระทบ behavior ต้องมี lifecycle
7. Public repo ต้องมี release safety scan ก่อน push
```

กติกาพวกนี้ทำให้ memory เป็นระบบ ไม่ใช่กอง note

## ตัวอย่างโครงสร้าง Obsidian ที่เหมาะ

ไม่จำเป็นต้องซับซ้อน

เริ่มแบบนี้พอ:

```text
00 - Maps/
  Project Memory Map.md
  Tool Policy Map.md

10 - Decisions/
  UI Verification Ownership.md
  Public Release Safety.md

20 - Workflows/
  Visual QA Workflow.md
  External Review Workflow.md

30 - Gotchas/
  Reddit MCP 403 Handling.md
  Whole File Rewrite Failure.md

40 - Preferences/
  User Git Approval Preference.md

90 - Tensions/
  Open Questions.md
```

หลักคือ note ควรเล็กพอที่จะ link ได้ แต่ไม่เล็กจนแตกเป็นเศษ

ถ้า note หนึ่งเริ่มมีหลาย claim ที่ไม่เกี่ยวกัน ให้แยก

ถ้า note หลายอันพูดเรื่องเดียวกัน ให้ merge หรือทำ MOC ชี้ไปหา

## วิธีเอาไปใช้กับ agent harness อื่น

ระบบนี้ไม่จำเป็นต้องใช้ OpenCode เท่านั้น

ขั้นต่ำที่ agent harness ต้องทำได้:

```text
1. ก่อนงานสำคัญ ขอ Brain Brief
2. หลังงาน verified แล้ว เขียน Memory Patch หรือ Learning Packet
3. ส่งให้ Memory Curator ตรวจและบันทึก
4. ถ้า Curator คืน TENSION/BLOCKED ต้องไม่ ignore
5. ใช้ eval เช็ก output เป็นระยะ
```

ถ้าไม่มี subagent ก็ใช้ agent เดียวทำได้ แต่ต้องแยก mode ให้ชัด:

```text
work mode:
ทำงานและตัดสินบทเรียน

curator mode:
จัด memory โดยห้ามแต่ง claim เพิ่ม
```

## ข้อจำกัดที่ต้องพูดตรง ๆ

ระบบนี้ยังมีข้อจำกัด:

- ถ้า memory ใหญ่มาก อาจต้องใช้ index/vector/graph เพิ่ม
- ถ้า lead agent เขียน Memory Patch แย่ Curator ก็ช่วยได้จำกัด
- ถ้าไม่มี eval จะไม่รู้ว่า memory ดีขึ้นจริงไหม
- ถ้า lifecycle ไม่ดี stale memory จะกลับมาเป็นปัญหา
- ถ้าใช้กับทีม ต้องมี rule เรื่อง privacy และ review
- ถ้าต้องการ real-time enterprise retrieval ระบบนี้ยังไม่พอ

นี่ไม่ใช่ silver bullet

มันเป็นฐานที่เรียบง่าย ตรวจสอบได้ และต่อยอดได้

## คำที่ควรใช้เวลาอธิบาย project นี้

ใช้คำพวกนี้ได้:

```text
agentic memory retrieval
file-based memory harness
provenance-preserving memory
compiled Markdown wiki
learning loop for coding agents
local-first second brain for agents
memory governance layer
```

หลีกเลี่ยงการ claim ว่า:

```text
better than all RAG
replacement for vector DB
proven live-model superiority
fully autonomous memory
```

เพราะยังต้องมี benchmark เพิ่มสำหรับ claim ระดับนั้น

## ต่างจาก RAG ปกติยังไง

RAG ปกติเน้น:

```text
documents -> chunks -> embeddings -> vector search -> retrieved context -> answer
```

เหมาะกับ:

- chatbot ถามตอบจากเอกสารจำนวนมาก
- enterprise search
- PDF/document QA
- customer support knowledge base

Graphmory เน้น:

```text
verified work -> structured lesson -> curated Markdown memory -> bounded recall -> better future agent decision
```

เหมาะกับ:

- coding agent
- project memory
- workflow preference
- root cause/gotcha
- design decision
- tool/model policy
- local Obsidian/Markdown second brain

สรุป:

```text
RAG ช่วยค้นข้อมูล
Graphmory ช่วยจำบทเรียนที่มีผลกับการทำงานครั้งหน้า
```

อนาคตสามารถต่อ vector search, BM25, graph, reranker ได้ แต่ไม่ควรให้สิ่งเหล่านั้นเป็น canonical truth

## CAG / caching เอามาใช้ยังไง

CAG และ prompt caching มีไอเดียหลักคือ context ที่ใช้ซ้ำบ่อยไม่ควรถูกสร้างใหม่ทุกครั้ง

ใน harness นี้ เราเอาแนวคิดมาใช้แบบเบา ๆ ผ่าน Hot Context Pack

```text
Canonical Markdown = memory ตัวจริง
Hot Context Pack = context สั้นที่ใช้บ่อย
Derived Index = แผนที่ช่วยค้น
Raw Evidence = หลักฐานต้นทาง
```

Hot Context Pack ช่วยประหยัด token แต่ต้อง invalidate ได้

ห้ามใช้ cache เก่าเป็น truth ถ้า lifecycle บอกว่าต้อง revalidate

## งานวิจัยที่ support เรื่อง performance / efficiency

ต้องพูดให้ตรงก่อน: harness นี้ยังไม่ใช่ production Agentic RAG เต็มระบบ และยังไม่ควร claim ว่าเร็วหรือแม่นกว่า RAG ทุกแบบ

แต่ paper หลายสายสนับสนุน design choice ที่เราใช้:

| งานวิจัย / แนวคิด | สิ่งที่สนับสนุน | แปลเป็นระบบของเรา |
|---|---|---|
| A-RAG | agentic retrieval ที่มี tool หลายระดับช่วยงาน multi-hop และรายงานว่าใช้ retrieved tokens comparable หรือต่ำกว่าใน benchmark | อย่า dump note ทั้ง vault ให้ agent; ใช้ bounded recall, section retrieval, scope, exact path |
| CRAG | retrieval ต้องมี evaluator เพราะ retrieved docs อาจไม่พอหรือผิด ต้อง corrective action | retrieval eval และ adversarial eval ต้องบอกให้ได้ว่า context ที่เจอเชื่อได้ไหม |
| Self-RAG | model ควร retrieve, generate, critique ไม่ใช่ retrieve แล้วตอบเลย | Memory Curator/Lead agent ต้องมี critique gate เช่น APPLIED/TENSION/BLOCKED |
| Agentic RAG survey | agentic RAG มี planning, reflection, tool use, iterative retrieval | harness ใช้ agent-controlled recall + Brain Brief ไม่ใช่ static one-shot retrieval |
| CAG | knowledge ที่จำกัดและจัดการได้อาจ cache/preload ได้ ลด retrieval latency/error | Hot Context Pack ใช้กับ memory ที่ stable และต้องมี stale control |
| RAGCache | long knowledge injection ทำให้ latency/throughput แย่ลง การ reuse knowledge state ช่วยได้ | ลด raw context ยาว ๆ ใช้ compact canonical memory + note path |
| Prompt Cache | repeated prompt/context segment reuse ช่วยลด latency | memory/prompt ที่ stable ควรถูกจัดเป็น structure ไม่ regenerate ใหม่ทุก turn |
| MemoryBank / Mem0 / Graphiti | long-term memory ต้องมี extraction, consolidation, lifecycle, provenance, temporal/relationship awareness | Markdown memory ต้องมี provenance, lifecycle, stale/superseded marker, conflict handling |

สรุปแบบไม่ hype:

```text
RAG เหมาะกับการค้นเอกสารจำนวนมาก
Agentic memory harness เหมาะกับการจำบทเรียนและ decision ที่เปลี่ยนพฤติกรรม agent
Cache/Hot Context เหมาะกับข้อมูลที่ stable และใช้ซ้ำ
Eval เป็นตัวบอกว่า memory ดีขึ้นจริงหรือแค่ดูดี
```

ดังนั้น performance ของเราไม่ได้มาจากการมีโมเดลใหญ่กว่า แต่มาจาก:

- context ที่ส่งให้ agent เล็กลง
- raw/stale note ไม่แย่ง canonical memory
- lead agent ไม่ต้องเล่าเรื่องเดิมซ้ำทุก session
- curator ไม่ต้องเดาความหมายเอง
- eval บอกว่าชั้น retrieval/curation เริ่มพลาดตรงไหน

## ทำไมต้องมี eval

ถ้าไม่มี eval ระบบ memory จะกลายเป็นแค่ไอเดียสวย ๆ

Harness นี้มี eval หลัก ๆ:

- retrieval eval: memory ที่ควรถูกเรียก ถูกเรียกจริงไหม
- curator eval: Curator ตัดสิน APPLIED/TENSION/BLOCKED ถูกไหม
- patch-quality eval: patch มี evidence, scope, lifecycle หรือเปล่า
- learning-loop eval: Learning Packet เพิ่มคุณภาพคุ้ม token ไหม
- future-task eval: memory ที่บันทึกทำให้ decision ครั้งหน้าดีขึ้นไหม

สิ่งสำคัญคือไม่ claim เกินหลักฐาน

ผล eval ตอนนี้เป็น deterministic/proxy eval ยังไม่ใช่ live-model proof เต็มรูปแบบ

ดังนั้นภาษาที่ถูกต้องคือ:

```text
evidence-informed
measured with fixtures
not yet proven superior on live-model benchmark
```

## วิธีคิดของ architecture นี้

จำหลักนี้ไว้:

```text
1. อย่าจำทุกอย่าง
   จำเฉพาะสิ่งที่เปลี่ยนการทำงานครั้งหน้า

2. อย่าให้คนที่ไม่เห็นงานเดาบทเรียน
   ให้ lead agent เขียนความหมายเอง

3. อย่าให้ memory manager แต่งเรื่อง
   ให้มันจัดระเบียบ ตรวจ conflict และคุม provenance

4. อย่าเชื่อ memory ตลอดไป
   ทุก memory ควรมี lifecycle และ stale trigger

5. อย่าให้ graph/search/cache เป็น truth
   ให้มันเป็น derived view

6. อย่า claim ว่าดีกว่าโดยไม่มี eval
   วัดด้วย scenario, fixture, token proxy, future-task utility
```

## Architecture แบบ Technical

ถ้ามองเป็นระบบ engineering จะมี component หลัก:

```text
Lead Agent
  -> owns task semantics
  -> produces Memory Patch / Learning Packet

Memory Curator
  -> owns retrieval, merge, link, conflict, lint
  -> never invents missing meaning

Canonical Markdown Store
  -> human-readable operational memory
  -> source for Brain Brief and Hot Context Pack

Raw Evidence Store
  -> files, commands, screenshots, reports, URLs
  -> not rewritten by memory synthesis

Derived Index Layer
  -> search index, graph, BM25, embeddings, HTML report
  -> rebuildable, non-canonical

Eval Harness
  -> checks retrieval, patch quality, curator behavior, future-task utility
```

ระบบนี้ตั้งใจให้ canonical truth อยู่ที่ Markdown + provenance ไม่ใช่อยู่ที่ vector DB หรือ generated graph

เหตุผลเชิง engineering:

- debug ได้ด้วย git diff
- review ได้ด้วยมนุษย์
- migrate ข้าม tool/provider ได้
- derived index พังแล้วยัง rebuild ได้
- memory corruption มองเห็นง่ายกว่า binary/index store

## Data Contract

Memory Patch และ Learning Packet คือ contract ระหว่าง lead agent กับ curator

Contract สำคัญกว่า prompt เพราะ prompt เปลี่ยนง่าย แต่ contract ตรวจด้วย validator ได้

### Memory Patch Contract

ใช้เมื่อมีบทเรียนที่ควรจำ แต่ไม่ได้ต้องการ loop trace เต็ม

```json
{
  "claim": "string",
  "why_it_matters": "string",
  "scope": {
    "applies": ["string"],
    "excludes": ["string"]
  },
  "provenance": [
    {
      "kind": "file|command|url|artifact|user",
      "value": "string"
    }
  ],
  "confidence": "high|medium|low",
  "suggested_type": "decision|workflow|preference|gotcha|source-map",
  "lifecycle": {
    "status": "active|superseded|tension|deprecated",
    "revalidate_when": ["string"]
  }
}
```

### Learning Packet Contract

ใช้เมื่อ memory นั้นควรเปลี่ยน behavior ของ agent

```json
{
  "role": "learning-packet",
  "lesson": "string",
  "trigger": "string",
  "future_behavior_change": "string",
  "selectors": {
    "tags": ["string"],
    "file_globs": ["string"],
    "tool_names": ["string"],
    "error_regex": ["string"]
  },
  "scope": {
    "applies": ["string"],
    "excludes": ["string"]
  },
  "evidence": [],
  "verification": {
    "status": "verified|partially-verified|blocked",
    "result": "string"
  },
  "loop_trace": {
    "recall": "string",
    "action": "string",
    "verification": "string",
    "learning": "string"
  },
  "memory_action": "apply|update|deprecate|tension|reject",
  "confidence": "high|medium|low",
  "lifecycle": {}
}
```

Selectors คือ bridge ระหว่าง memory กับ retrieval

ตัวอย่าง:

```text
ถ้า task มี tool_name = visual_qa
หรือ file_glob = src/**/*.tsx
หรือ tag = ui
ระบบมี hint ว่าควรดึง memory เรื่อง visual verification กลับมา
```

นี่ไม่ใช่ embedding แต่เป็น structured retrieval hint ที่ถูกกว่าและ explainable กว่า

## State Machine ของ Memory Write

Memory write ไม่ใช่ append file เฉย ๆ แต่เป็น state transition

```text
NEW_PATCH
  -> validate schema
  -> check significance
  -> retrieve nearby memory
  -> compare duplicate/conflict/stale
  -> decide outcome
```

Outcome:

```text
APPLIED
  -> create/update canonical note
  -> preserve provenance
  -> update links/MOC if needed

TENSION
  -> do not overwrite
  -> record conflicting note paths
  -> require lead decision or future revalidation

BLOCKED
  -> do not write durable memory
  -> return missing fields/evidence/scope
```

Invariant:

```text
No durable memory write without provenance
No silent overwrite of contradiction
No derived artifact promoted to canonical truth
No routine diary saved as behavioral memory
```

## Read Path: Recall Mechanics

Read path คือการดึง memory ก่อนเริ่มงาน

```text
task intent
  -> ask narrow memory question
  -> curator selects candidate notes
  -> curator filters by scope/lifecycle/relevance
  -> curator returns Brain Brief
  -> lead agent uses brief in plan/handoff
```

Brain Brief ต้อง bounded:

```text
1-7 memory items
0-3 direct note paths
stale warnings
tensions
constraints that affect this task
```

เหตุผลที่ต้อง bounded:

- ลด token
- ลด distraction
- ลด stale context
- ลดโอกาสที่ agent จะ overfit กับ note ที่ไม่เกี่ยว

## Retrieval Ladder

ระบบนี้ไม่เริ่มจาก vector DB เพราะยังไม่รู้ว่าปัญหาจริงคือ retrieval แบบไหน

ใช้ ladder:

```text
1. Explicit path / project map
2. Filename and tag search
3. Lexical search
4. BM25 / section BM25
5. Embedding search
6. Hybrid sparse+dense
7. Reranker
8. Graph-assisted multi-hop retrieval
```

กติกา:

```text
เพิ่มชั้นใหม่เมื่อ eval บอกว่าชั้นเดิม fail
ไม่เพิ่ม tool เพราะมันดูเท่
ไม่เพิ่ม dependency ถ้ายังไม่มี measured failure
```

ตัวอย่าง:

- ถ้า exact tool names หาย ใช้ BM25/full-text
- ถ้า paraphrase หาย ใช้ embedding
- ถ้า rank แย่ ใช้ reranker
- ถ้า relation ข้าม note ซับซ้อน ใช้ graph
- ถ้า context ใหญ่เกิน ใช้ Hot Context Pack หรือ section retrieval

## Write Path: Learning Mechanics

Learning ไม่ได้เกิดทุก task

Learning เกิดเมื่อมีอย่างน้อยหนึ่งข้อ:

```text
1. เจอ root cause ใหม่
2. user preference เปลี่ยน
3. tool/model policy เปลี่ยน
4. agent ทำผิดซ้ำและมี verified fix
5. workflow ใหม่ลด cost/error ได้จริง
6. old memory ถูก invalidate
7. contradiction สำคัญถูกค้นพบ
```

ถ้าไม่มีข้อเหล่านี้ ไม่ต้องเขียน memory

Pseudo flow:

```text
if task_verified:
  lesson = identify_behavior_changing_lesson()
  if lesson is None:
    skip memory
  else:
    packet = build_learning_packet(lesson, evidence, verification)
    result = curator.apply(packet)
    if result == TENSION:
      surface conflict
    if result == BLOCKED:
      do not retry by inventing details
```

## Theory: ทำไมแยก Semantic Author กับ Curator

นี่คือ design pattern สำคัญ

```text
Semantic Author = agent ที่รู้ meaning
Curator = agent ที่รู้ memory topology
```

ถ้ารวมสองบทบาท:

- agent หลักอาจเขียน vault มั่ว
- curator อาจเดา meaning จาก context ไม่ครบ

ถ้าแยก:

- meaning มาจากคนที่เห็นงานจริง
- structure มาจากคนที่ดูแล memory graph
- conflict ถูก surface
- provenance ไม่หาย

แนวคิดนี้คล้าย separation of concerns ใน software engineering

```text
business logic != persistence layer
task semantics != memory storage mechanics
```

Lead agent ไม่ควรทำตัวเป็น database migration script

Curator ไม่ควรทำตัวเป็น product manager ที่เดา requirement เอง

## Theory: Memory เป็น Governance ไม่ใช่ Storage

หลายระบบมอง memory เป็น storage:

```text
มีอะไรเกิดขึ้น -> save
```

Harness นี้มอง memory เป็น governance:

```text
มีอะไรเกิดขึ้น -> verify -> decide significance -> scope -> store with lifecycle
```

ความจำที่ดีต้องตอบได้:

- ใครเป็นคน claim
- evidence คืออะไร
- ใช้กับอะไร
- ไม่ใช้กับอะไร
- เก่าเมื่อไหร่
- ขัดกับอะไร
- ทำให้ครั้งหน้าต้องเปลี่ยนอะไร

ถ้าตอบไม่ได้ มันยังไม่ใช่ durable memory

## Failure Modes ที่ต้องกัน

### False Positive Recall

ดึง memory ที่ไม่เกี่ยวมา ทำให้ agent วางแผนผิด

วิธีกัน:

- scope.applies/excludes
- bounded Brain Brief
- selectors
- lifecycle

### False Negative Recall

มี memory สำคัญแต่ไม่ถูกดึงมา

วิธีกัน:

- project map
- tags/selectors
- BM25 baseline
- future-task eval

### Memory Drift

memory ถูก rewrite หลายรอบจนความหมายเพี้ยน

วิธีกัน:

- preserve provenance
- small atomic notes
- curator cannot invent
- TENSION instead of overwrite

### Stale Authority

memory เก่าถูกใช้เหมือนยังจริง

วิธีกัน:

- lifecycle.revalidate_when
- valid_until
- stale warning in Brain Brief

### Token Bloat

memory เยอะจน context แพงและสับสน

วิธีกัน:

- significance gate
- Brain Brief limit
- Hot Context Pack only for stable high-value memory
- eval estimated tokens

### Tool Lock-in

memory ผูกกับ tool เดียวจนย้ายระบบไม่ได้

วิธีกัน:

- Markdown canonical
- JSON contract
- adapters แยกจาก core
- derived index non-canonical

## Engineering Invariants

Invariant คือกฎที่ต้องจริงเสมอ

```text
1. Canonical memory must be human-readable Markdown.
2. Durable claims must cite provenance.
3. Curator must not invent missing task meaning.
4. Derived views must be rebuildable.
5. Conflicts must be surfaced, not overwritten.
6. Routine summaries must be rejected.
7. Hot context must point back to canonical notes.
8. Evaluation must separate proxy from live-model proof.
```

ถ้า invariant แตก ระบบจะเริ่มกลายเป็น memory dump

## Evaluation Engineering

Eval ของ memory ไม่ควรวัดแค่ “ค้นเจอไหม”

ต้องวัดหลายมิติ:

### Retrieval Metrics

- Hit@k: มี note ที่ถูกอยู่ใน top k ไหม
- Recall@k: ดึง expected notes ได้ครบแค่ไหน
- MRR: note ที่ถูกขึ้นมาเร็วแค่ไหน
- nDCG: ranking ดีแค่ไหนเมื่อมีหลายระดับ relevance
- context size: ดึงกลับมาเยอะเกินไหม

### Curator Behavior Metrics

- APPLIED/TENSION/BLOCKED ถูกไหม
- reject diary ได้ไหม
- preserve provenance ไหม
- detect conflict ไหม
- ไม่ promote derived artifact เป็น canonical ไหม

### Patch Quality Metrics

- claim ชัดไหม
- why_it_matters มีจริงไหม
- scope ครบไหม
- evidence มีไหม
- lifecycle มีไหม
- มีคำกว้าง/มั่ว/diary ไหม

### Future-task Utility

คำถามสำคัญที่สุด:

```text
memory นี้ทำให้ task หน้าเลือกทางถูกขึ้นไหม
```

ถ้า memory score ดีแต่ไม่เปลี่ยน future decision แปลว่ายังไม่ดีพอ

## ทำไมต้องมี Proxy Eval ก่อน Live-model Eval

Live-model eval แพงกว่า คุมยากกว่า และ reproduce ยากกว่า

Proxy eval ช่วยเช็กก่อนว่า:

- contract validate ได้
- scenario ครอบคลุม failure สำคัญ
- scoring logic ทำงาน
- output shape ชัด
- token ceiling ไม่หลุด

หลังจาก proxy แข็งแล้วค่อยใช้ live model

ลำดับที่ดี:

```text
contract tests
  -> deterministic fixtures
  -> proxy baselines
  -> live-model samples
  -> blinded human review
```

## Scaling Strategy

ถ้า memory ยังเล็ก:

```text
Markdown + filename/tag search + Brain Brief
```

ถ้า memory เริ่มกลาง:

```text
add project maps
add BM25/section retrieval
add generated eval reports
```

ถ้า memory ใหญ่:

```text
add embeddings
add hybrid retrieval
add graph index
add reranker
```

ถ้าใช้ในทีม:

```text
add review workflow
add CI validation
add privacy policy
add memory ownership rules
```

อย่าเริ่มจากขั้นใหญ่สุดถ้ายังไม่มี failure ที่พิสูจน์ว่าต้องใช้

## Security / Privacy Model

Memory มีความเสี่ยงกว่า log ธรรมดา เพราะมันถูกใช้ซ้ำในอนาคต

ต้องกัน:

- secret หลุดเข้า note
- raw transcript ถูก commit
- private path/user data หลุด public repo
- provider/API key ถูกจำเป็น preference
- generated report มีข้อมูลส่วนตัว

แนวทาง:

```text
ห้ามจำ secret
ห้ามจำ raw transcript ทั้งก้อน
จำเฉพาะ claim ที่ sanitize แล้ว
ก่อน public release ต้อง scan private detail
evidence path ใช้เท่าที่จำเป็น
```

## Observability

ระบบ memory ควรตอบคำถาม debug ได้:

```text
ทำไม agent ถึงเชื่อสิ่งนี้
memory นี้มาจาก evidence ไหน
note ไหนเป็น canonical
index ไหนเป็น derived
ใคร/อะไรทำให้ memory นี้ active
เมื่อไหร่ต้อง revalidate
ถ้า decision ผิด ต้องแก้ note ไหน
```

ถ้าตอบไม่ได้ แปลว่า memory opaque เกินไป

## Minimal Implementation Plan

ถ้าจะ implement เองจากศูนย์ ใช้ลำดับนี้:

```text
1. Define JSON schemas for Memory Patch and Brain Brief
2. Write validator
3. Create example valid/invalid patches
4. Build curator skill/instruction
5. Add APPLIED/TENSION/BLOCKED output contract
6. Add small fixture vault
7. Add retrieval eval
8. Add curator behavior eval
9. Add Learning Packet for behavior-changing lessons
10. Add future-task eval
11. Add optional Derived Index / Hot Context Pack
```

อย่าเริ่มจาก MCP, vector DB, graph UI ก่อน contract

contract คือกระดูกสันหลัง

## เหมาะกับใคร

เหมาะกับ:

- คนใช้ coding agent หลาย session
- คนมี Obsidian หรือ Markdown vault
- project ที่มี decision/gotcha/preference สะสม
- agent workflow ที่ต้องเรียนรู้จากงานจริง
- local-first memory ที่ไม่อยากเริ่มจาก vector DB

ไม่เหมาะกับ:

- chatbot สำหรับลูกค้าหลายพันคน
- enterprise document search ขนาดใหญ่
- ระบบที่ต้อง semantic search เอกสารมหาศาล
- use case ที่ต้อง multi-tenant infra, access control, hosted vector DB ตั้งแต่แรก

## สรุปสั้น

Graphmory คือ discipline layer สำหรับ agent memory

มันไม่ได้พยายามทำให้ model ฉลาดขึ้นด้วยการยัดข้อมูลมากขึ้น

มันทำให้ agent:

- recall เท่าที่จำเป็น
- verify ก่อนจำ
- จำเฉพาะบทเรียนที่มีผลกับอนาคต
- แยก evidence, memory, index, cache ออกจากกัน
- จัดการ contradiction แทนการ overwrite
- วัดคุณภาพ memory ด้วย eval

คำอธิบายสั้นที่สุด:

```text
Graphmory ทำให้ AI agent จำเป็นระบบ
ไม่ใช่จำเยอะขึ้น
แต่จำถูกขึ้น มีหลักฐานขึ้น และใช้เปลี่ยนการทำงานครั้งหน้าได้จริง
```
