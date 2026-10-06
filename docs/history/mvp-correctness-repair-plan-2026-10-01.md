# แผนแก้ความถูกต้องของ Graphmory MVP

**วันที่:** 1 ตุลาคม 2026 · **สถานะ:** แผนเท่านั้น ยังไม่ได้ implement หรือทดสอบการแก้

ใช้สกิล **agent-loop** เพื่อวางเกณฑ์ตรวจจากพฤติกรรมจริง และ **orchestration-engineering** เพื่อแบ่งงานให้ GPT-6 Luna Max สำรวจ/ทำงานตามขอบเขต Root สังเคราะห์แผน ตรวจการเชื่อมต่อ และตัดสินจากหลักฐาน

## 1. เราจะแก้อะไร และจบเมื่อไหร่

เป้าหมายคือให้งาน **อัปเดตข้อมูล → ตรวจให้ครบ → ปิดงาน → เปิด session ใหม่อ่านกลับ** ใช้ได้บน Codex + Curator Luna โดยไม่ข้ามข้อมูลที่ยังตรวจไม่เสร็จ

| ปัญหาที่พบจริง | สิ่งที่จะเปลี่ยน | หลักฐานว่าซ่อมสำเร็จ |
|---|---|---|
| Runbook อ้างถึง “superseded predecessor” ถูกต้อง แต่ audit ตีความว่า Runbook เองเก่า | ตรวจความสัมพันธ์ของโน้ตที่ถูกอ้างถึงก่อนจัดประเภทข้อความ | Runbook เดิมปิดงานได้ ขณะที่ข้อความบอกว่าโน้ตเองล้าสมัยยังถูกบล็อก |
| `recall-managed` บล็อกงานค้าง แต่ `read-notes` อ่านข้ามได้ | ใช้การตรวจสถานะร่วมกันในคำสั่งอ่านสำหรับ agent; แยกการอ่านเพื่อซ่อมงาน | งานค้างไม่ส่งเนื้อหาไปใช้ตอบปัจจุบัน แต่ยังอ่านต้นฉบับที่ผูกกับ operation เพื่อซ่อมได้ |
| `finish` ให้แค่ `AFFECTED_AUDIT_FAILED` | ระบุ path, ชนิดปัญหา และขั้นตอนถัดไปแบบสั้น | Curator ระบุจุดที่ต้องแก้ได้โดยไม่ต้องเปิด log ทั้งหมด |
| ตัวตรวจบางตัวเคยนับ “ไฟล์ถูก” เป็น “workflow ผ่าน” | แยกคะแนนเนื้อหา ไฟล์ สถานะ receipt และการเคารพ BLOCKED | ไม่มี receipt หรืออ่านข้าม BLOCKED ต้องได้ workflow FAIL |

**เกณฑ์จบ:** การแก้ทั้งสี่ข้อผ่าน deterministic checks, regression และการทดลอง native บนแพ็กเกจที่ติดตั้งจริง พร้อมรายงานทุก attempt ไม่มี gate ที่ถูกข้ามเพราะคำตอบดูถูกต้อง

ความพร้อมที่ประกาศได้เมื่อผ่านคือ **MVP สำหรับทดลองใช้บน host/model ที่ทดสอบ** ไม่ใช่การรับรองทุก vault ทุก host หรือเหนือกว่าเครื่องมืออื่น

### ขอบเขต

- รักษา Markdown เดิม, provenance, full-original reads, continuation, graph navigation, expiry, supersession, checkpoint และ recovery
- ใช้เครื่องมือ/ตัวตรวจความสัมพันธ์เดิมก่อนเพิ่ม abstraction หรือ command ใหม่
- ไม่เพิ่ม provider, embedding model, vector database, hook, dashboard หรือปรับ retrieval ranking ในงานนี้
- ไม่แก้ vault จริง `<user-vault>`, global Codex config/auth/trust หรือ pending fixture เดิมเพื่อทำให้ผลเก่ากลายเป็น PASS
- ไม่ commit/push ระหว่างการวางแผนนี้ งาน implementation ต้องเก็บ diff เดิมไว้และตรวจรวมเมื่อเสร็จ

## 2. หลักฐานและข้อสรุปที่ต้องรักษา

ฐานอ้างอิง: [รายงาน eval](../evaluation/mvp-post-implementation-eval-2026-10-01.md), [ผล native](../evaluation/mvp-holdout-native-result-2026-10-01.md), [protocol ที่ freeze แล้ว](../evaluation/mvp-holdout-native-protocol-2026-10-01.md) และ [safety v2](../evaluation/mvp-holdout-safety-v2-2026-10-01.md)

- `0.5.0-rc.4`: archive SHA-256 `f70f78073b6352c3fb537e904d513c1eadd805665a4c05a9388b434629b9dfcc`; installed files ตรงกัน 118/118
- Regression 395/395 และ safety v2 10/10 ผ่าน แต่ native workflow ใหม่ **FAIL** จึงยังใช้เป็นหลักฐานว่า MVP ครบวงจรผ่านไม่ได้
- Curator เขียนสี่ target ที่อนุมัติแล้วจริง แม้ไม่มี receipt ต้องรายงานว่า **มี partial edits / pending** ไม่ใช่ “ไม่ได้เขียนอะไร”
- Runbook ที่ทำให้ audit ผิด **ไม่มี `supersedes` frontmatter** มันลิงก์ไปทั้ง predecessor และ successor ซึ่งมี reciprocal metadata ถูกต้องอยู่แล้ว แผนที่บังคับให้ Runbook เป็น receiver เองจะซ่อมเคสนี้ไม่ได้
- Fresh recall ตอบข้อเท็จจริงถูกและไม่มีไฟล์เปลี่ยน แต่ใช้ `read-notes` หลัง `CURATION_PENDING` จึงไม่ผ่านการควบคุม workflow
- Semantic gold และ failed attempts เดิมคงเดิม การทดสอบใหม่ใช้ candidate/run ID ใหม่ ไม่เขียนทับผลเก่า

สอง Luna explorer ตรวจ code paths และ fixture ที่บันทึกไว้แล้ว แผนนี้ใช้หลักฐานจาก repo สำหรับข้อผิดพลาดที่ reproduce ได้ ไม่มีข้ออ้างว่าการแก้นี้ได้รับการพิสูจน์จาก paper ภายนอก หาก implementation พบความสามารถของ host/library ที่ยังไม่ทราบ ให้ Luna researcher ตรวจ official source เฉพาะข้อนั้นก่อนตัดสินใจ

## 3. สัญญาการทำงานที่ต้องตกลงก่อนแก้

### A. Lifecycle: อ้างถึงประวัติได้ แต่ห้ามซ่อนข้อมูลล้าสมัย

ไฟล์หลัก: [lifecycle audit](../../src/memory-lifecycle-audit.mjs), [link resolver](../../src/brain-sync.mjs), [persistence verifier](../../src/patch-persistence.mjs), [checkpoint](../../src/curation-checkpoint.mjs)

**แนวทาง:** เพิ่มการ audit ชุดเอกสารด้วย resolver จาก inventory ที่มีอยู่แล้ว เก็บ `auditDocument` แบบเดิมให้ caller ที่ไม่มี context ยังใช้งานได้ แต่ checkpoint baseline และ finish ใช้ batch context เดียวกัน

จัดข้อความเป็น historical reference ได้เฉพาะเมื่อ:

1. คำบอกสถานะในข้อความผูกกับ wikilink ที่ resolve ไปยัง predecessor เดียวอย่างชัดเจน เช่น `[[Batch Policy]] for the superseded predecessor`
2. Predecessor มีสถานะ `superseded` และ replacement metadata เป็น path ที่ถูกต้องของ successor
3. Successor ยังเป็น current ตาม status/expiry เดิม และ `supersedes` ชี้กลับไปยัง predecessor แบบ exact path
4. โน้ตที่กล่าวถึงประวัติลิงก์ไปยัง successor นั้นด้วย ใช้ same-note context ได้: fixture จริงลิงก์ successor ในประโยคก่อนหน้า จึงไม่บังคับ same-sentence
5. ตรวจ chain นี้ได้ครบจาก inventory ไม่มี endpoint ที่ unresolved/ambiguous หรือถูก path-scope filter ซ่อนอยู่

ยกเว้นเฉพาะ token/phrase ที่เป็นการอ้างประวัติ ไม่ยกเว้นทั้งประโยคหรือทั้งโน้ต ตัวอย่าง `[[Old Policy]] is the superseded predecessor; this runbook is stale` ต้องยังมี self-stale finding

ข้อความที่พิสูจน์ความสัมพันธ์ไม่ได้คง finding ไว้ ไม่ใช้ LLM ตัดสิน และไม่ลด severity ของ medium ทุกชนิด ตัวตรวจ invalid date, expired active authority, incomplete supersession, tension/conflict และ drift ต้องทำงานเหมือนเดิม

`scope` เดิมเป็น caller-provided path-prefix filter ไม่ใช่ project authorization จึงไม่สร้างกฎว่าโน้ตต้องอยู่โฟลเดอร์เดียวกัน ลิงก์ข้าม project ที่ตั้งใจและมี exact reciprocal chain ใช้ได้ แต่ link ไป predecessor P แล้วอ้าง successor S1 ขณะที่ replacement จริงเป็น S2 ไม่เข้า exception หากใช้ inventory ที่ filter แล้วจนพิสูจน์ endpoint ไม่ครบ คง finding ไว้ ไม่ประกาศว่าเป็นข้อมูลประวัติที่ตรวจแล้ว

**ความเข้ากันได้:** ไม่ bulk-migrate metadata; ไม่อนุมาน supersession จาก prose; saved checkpoint เดิมยัง inspect/repair/restore ได้ หากเพิ่ม audit revision ให้เปรียบเทียบ finding แบบมีชนิด/path ชัดเจนและไม่ถือว่า baseline เก่าครอบคลุมข้อผิดพลาดใหม่โดยอัตโนมัติ

### B. Pending authority: ค้นหาเพื่อใช้ตอบ กับอ่านเพื่อซ่อมงาน

ไฟล์หลัก: [CLI](../../scripts/brain-sync.mjs), [managed recall](../../src/decision-recall.mjs), [checkpoint state](../../src/curation-checkpoint.mjs), [source read](../../src/source-read.mjs), [source handoff](../../src/source-handoff.mjs)

สร้าง shared read-decision helper ในชั้น agent-facing workflow ใช้ state root และ real-vault identity เดียวกับ writer ไม่ใส่ guard ลงไปใน low-level file reader ที่ checkpoint ต้องใช้เอง เพราะจะทำให้ prepare/finish/recovery เรียกกันเป็นวงหรือบล็อกตัวเอง

| สถานะ | Ordinary agent read | Recovery read |
|---|---|---|
| ไม่มี pending | อ่านได้ตามรูปแบบเดิม รวม source-handoff และ full originals ก่อน prepare | ไม่มีเหตุให้ bypass |
| มี pending / interrupted / recovery กำลังทำงาน | `BLOCKED / CURATION_PENDING`; ไม่ส่ง note bodies, snippets, candidate paths หรือ current Brief | ต้องระบุ operation ที่ตรงกับ vault; อนุญาตเฉพาะ manifest-bound targets/sources |
| state อ่านไม่ได้/เสีย/โครงสร้างที่มีอยู่ไม่ครบ | ปฏิเสธพร้อม code เฉพาะ ไม่ตีความเป็น clear | ให้ status/diagnostic ที่ไม่มีเนื้อหา; ไม่ใช้ recovery flag เป็นช่องทางอ่านอะไรก็ได้ |
| ปิดหรือ restore งานสำเร็จ | อ่านได้เมื่อ state ตรวจยืนยันว่า clear | จบการอ่านเพื่อ recovery; restore ไม่เท่ากับ APPLIED |

Proposed CLI extension (ยังไม่มี implementation):

```text
read-notes --vault V --paths PATHS_JSON --purpose recovery --operation ID
```

Recovery mode ต้องตรวจ operation/vault/state และ exact allowlist ก่อนอ่าน ไม่รับ `--ignore-pending` ไม่อนุญาต enumerate vault หรือรัน search ปกติขณะ pending Source ต้องตรงกับ hash ที่บันทึก; ถ้า drift ให้ code/path/hash metadata และไม่ส่งเนื้อหา source ที่อ้างว่าเป็น original เดิม Targets ที่เขียนบางส่วนอ่านได้เพื่อซ่อม พร้อม current hash และสถานะที่ระบุว่า **recovery-only / non-authoritative** ไม่อ้างว่าเป็นข้อมูลผ่านการตรวจแล้ว

Recovery reads เป็น read-only ไม่ต้องขออนุมัติใหม่เพียงเพื่ออ่าน การเขียน/restore ยังคง authorization และ reviewed-current-hash checks เดิม

**Route inventory ที่ต้องทดสอบ:** `read-notes` ทุก input mode, `source-handoff`, `recall`, `recall-managed`, `recall-loop`, `recall-explore`, `recall-rerank`, `recall-semantic` และ `curate-plan` ต้องตรวจสถานะก่อนโหลดเนื้อหา/เรียก provider และก่อนส่งคำตอบกลับ ใช้ stubs สำหรับ optional providers; ไม่ดาวน์โหลดโมเดลหรือใช้ API จริง

`graph-audit`, lifecycle audit, checkpoint status/verify/finish/restore ยังคงใช้ตรวจและซ่อมงานได้ตามสัญญาเดิม ผลต้องระบุ pending/non-authoritative เมื่อเหมาะสมและไม่กลายเป็น recall ที่ส่ง note bodies การจำกัดนี้ใช้กับ content-producing agent routes ไม่ใช่การปิดเครื่องมือวินิจฉัยทั้งหมด

Low-level library APIs ยังคงเป็น raw primitives และไม่รับรอง authority ให้เพิ่ม/ใช้ guarded entry point สำหรับ adapter ที่ตอบ agent พร้อมบันทึก boundary นี้ ไม่มีการอ้างว่าการ import raw reader โดยตรงปลอดภัยจาก pending state

ตรวจสถานะทั้งก่อนอ่านและก่อนส่ง output ถ้า authority เปลี่ยนให้ทิ้งผลที่ประกอบแล้วและคืน `STATE_CHANGED_DURING_READ` ไม่ retry retrieval แบบเงียบ ๆ ต้องตรวจ clear→pending→clear ไม่ใช่เช็ค boolean clear สองครั้งอย่างเดียว **MVP ใช้ `authorityToken` จาก canonical vault/state-root identity, lock และ sorted operation IDs/statuses ที่คงอยู่** Inspector ปัจจุบันไม่มี revision field; completed/recovered manifests ยังเก็บอยู่ จึงใช้ข้อมูลนั้นโดยไม่เพิ่ม persistent counter ใหม่

ห้าม cleanup terminal records ระหว่าง active reads; กรณีเริ่ม/ปิด/ลบ operation หมดทั้งชุดในระหว่าง read อยู่นอกการรับรอง token แบบนี้ หากต้องรองรับ concurrent cleanup ภายหลัง ค่อยเพิ่ม durable revision เป็นงานแยก การตรวจ token ไม่ใช่ atomic isolation จาก external editor หรือ write ที่เกิดหลัง final check

State root ใช้ resolver เดียวกับ checkpoint และ launch config ที่ freeze ไว้ State ที่ยังไม่เคยสร้างอนุญาต first-use reads; directory ที่มีอยู่แต่เสีย/อ่านไม่ได้ต้อง blocked **ขอบเขต fail-closed คือภายใน state root ที่เลือกไว้เดียวกัน** เครื่องมือปัจจุบันไม่สามารถแยก “first use” ออกจากการจงใจเปลี่ยน `GRAPHMORY_STATE_DIR` หรือ `--state-root` ไป root ว่างที่ถูกต้องได้ คง override ไว้เพื่อการใช้เดิมและ isolated tests; ไม่รับรอง deliberate root substitution และไม่เพิ่มการเขียน global config/vault binding ใน bundle นี้ Installed role ต้องใช้ root เดิมของ task ทุก call; evaluator ตรวจ trace ว่าไม่มี root substitution หาก agent เปลี่ยน root แล้วตอบถือ workflow FAIL ไม่ถือว่าเป็น successful refusal

**Output compatibility:** successful output ของ command เดิมคงเดิม JSON/agent routes ที่ blocked ส่ง JSON envelope เดียว + nonzero exit, body/results ว่าง; scalar/human routes ใช้ stderr + nonzero exit ไม่มี JSON หรือ log ปน stdout เปลี่ยน handler ตาม route ที่ระบุ แทนการเปลี่ยน catch ทั้ง CLI แบบเหมารวม Diagnostic ระบุ operation และ next action ได้ แต่ไม่ใส่ source contents หรือ private state preimages

**ขอบเขตการรับรอง:** CLI ไม่สามารถห้าม Codex ใช้ native filesystem tools เมื่อผู้ใช้เปิด vault ให้มันอ่านอยู่ได้ จึงต้องแก้ installed skill/role และ Lead acceptance ด้วย หาก trace ใช้ raw/native reads หลัง BLOCKED แล้วส่งคำตอบปัจจุบัน ต้องได้ workflow FAIL ไม่เรียก CLI guard ว่า sandbox security

- **งานเขียน:** APPLIED ต้องมี matching completed receipt + operation state + patch/target/source identity ที่ตรวจแล้ว
- **งานอ่านปกติ:** ไม่ต้องมี receipt ย้อนหลังสำหรับทุก legacy note ต้องเป็น guarded ready response พร้อม citation/hash identity และ state ที่ไม่เปลี่ยนระหว่างอ่าน
- **งานค้าง:** Lead แจ้ง pending/partial edits และขั้นตอนซ่อม รับ recovery-only output เป็นข้อมูลวินิจฉัย ไม่รับเป็น current memory answer

### C. Error ที่แก้ตามได้ และลดการพิมพ์ metadata ผิด

ใช้ report ที่ `evaluateAfterEdit` สร้างอยู่แล้ว ส่ง compact structured details ผ่าน `AFFECTED_AUDIT_FAILED` และ `manifest.lastFailure`: sorted `{file, kind, severity, nextAction}` + total count/completeness ไม่มีข้อความโน้ตหรือ source values แสดงชุดแรกที่กำหนดไว้ เช่น 8 findings พร้อม `hasMore` ไม่ทำให้ผู้ใช้เข้าใจว่าตรวจเพียงแปดโน้ต

เก็บ generic error code เดิมไว้ให้ caller และบันทึก failure อย่างปลอดภัยก่อน return อย่าเปลี่ยน pending เป็น complete เมื่อเพียง persistence ผ่าน นอกจากนี้ verify/repair guidance ต้องแสดงว่าผิด status หรือ replacement path ที่ไฟล์ใด เพื่อให้ cheap Curator แก้ตาม exact relation ได้

**ยังไม่เพิ่ม lifecycle writer ใหม่:** patch contract, renderer และ `verifyPredecessors` มี exact relation อยู่แล้ว รอบนี้ใช้สิ่งเหล่านี้พร้อม error ที่ชัดเจน หากหลังแก้ยังเกิด manual predecessor mistake ซ้ำจน native gate ไม่ผ่าน ค่อยเสนอ pure metadata preview จาก approved patch/operation/current hashes เป็นงานแยก ห้ามให้มันอนุมานความหมายหรือทำ write อัตโนมัติ

## 4. แบ่งงานให้ทำเร็วโดยไม่ชนไฟล์

| งาน | ผู้ทำ / write set | Dependency / จุดส่งต่อ |
|---|---|---|
| A — lifecycle classification | Luna Max A: `src/memory-lifecycle-audit.mjs` และ focused test ใหม่ | Freeze batch API และ paired cases ก่อน; ส่ง packet ว่าตรวจอะไร/ไม่ตรวจอะไร |
| B — guarded read decisions | Luna Max B: module read-decision ใหม่และ focused tests ของมัน | Freeze state inspector/token input; ใช้ dependency injection เพื่อไม่แก้ checkpoint/CLI ก่อนถึง C |
| C — integration | Luna Max integrator (ใช้ worker B ต่อ): checkpoint baseline/finish/authority token, CLI, managed recall/adapter boundary, error plumbing, skill/setup/docs และ integration tests | รอ API A/B; integrator เป็นคนเดียวที่แก้ shared files; Root ตรวจ diff/contracts |
| D — evaluator | Luna Max evaluator: versioned runner/scorer/fixture protocol ใหม่ในไฟล์ที่แยก | Root freeze contracts ก่อน; semantic gold แยกจาก candidate metadata; ไม่แตะ runtime/gold เดิม |
| E — installed native acceptance | Root รัน host; Luna evaluatorตรวจ independent files/state/trace | หลัง deterministic gates ผ่าน + ติดตั้ง tarball ใหม่ตรงทุกไฟล์ |

A/B ทำพร้อมกันได้ Root เตรียม interface และ evaluator handoff ระหว่างนั้น ใช้สอง Luna workers ที่มีอยู่ก่อน: A ทำ D ต่อเมื่อส่ง lifecycle code แล้ว, B ทำ C ต่อหลังส่ง guard module จึงไม่ต้อง spawn เพิ่มเพียงเพื่อ review งาน C ที่แตะ checkpoint/CLI ทำ sequential โดย owner เดียว งาน D ออกแบบ protocol ล่วงหน้าได้ แต่ execute หลัง candidate freeze ไม่เปิดสอง Curator เขียน vault เดียวกัน

ทุก handoff ระบุ task เดียว, allowed/forbidden files, evidence paths, acceptance, stop condition และ retry budget ไม่ส่ง raw session ทั้งก้อนให้ worker อ่านซ้ำ Root ใช้ explorer packets; ถ้าต้องค้น code/library เพิ่ม ให้ Luna explorer/researcher ทำเฉพาะคำถาม

## 5. การทดสอบที่ต้องผ่าน

ใช้ case IDs ด้านล่างเป็น gate ไม่ใช้ค่าเฉลี่ยลบล้าง failure ที่สำคัญ

| Gate | Input / observation | ต้องเห็นอะไร |
|---|---|---|
| R1 valid history | Exact saved Runbook shape + valid predecessor/successor reciprocal paths | ไม่มี self-stale false positive; finish ได้ receipt โดย source/unrelated files ไม่เปลี่ยน |
| R2 actual staleness | R1 + separate self-stale clause, same sentence และ same note | ยังบล็อก พร้อม exact finding |
| R3 history boundaries | Missing/ambiguous/wrong-target/current predecessor, expired successor, reverse relation ขาด, P→S2 แต่ mentioner ลิงก์ S1, filtered proof endpoint; paired valid cross-folder chain | Broken/unproven chain ไม่เกิด exception; valid exact cross-folder chain ผ่าน ไม่แต่ง folder authorization ขึ้นใหม่ |
| R4 lifecycle regressions | Invalid date, warmed expiry boundary, tension/no decision, unrelated baseline finding | เดิมที่ต้องบล็อกยังบล็อก; unrelated baseline ไม่ทำให้ valid update fail |
| R5 read route coverage | Pending fixture + route/input/output matrix; graph-audit diagnostic mode | Content routes ไม่มี bodies/snippets/current results; nonzero exit + output parse ได้; optional provider ไม่ถูกเรียก; graph diagnostic ไม่มี note bodies/current answer |
| R6 useful recovery | Right/wrong vault, operation, allowlist, source hash; partially edited target | Right operation อ่านซ่อมได้พร้อม hashes/recovery label; wrong binding ปฏิเสธ; zero writes |
| R7 clear reads | Legacy notes/source handoff ก่อน prepare + fresh read หลัง finish/restore | รูปแบบสำเร็จเดิมยังใช้ได้; ไม่มี receipt requirement ที่แต่งเพิ่มให้ legacy notes |
| R8 authority transition | Prepare ระหว่าง read, และ prepare→finish ก่อน output; corrupt/unreadable/legacy state | ผลไม่ถูกปล่อยด้วย token เก่า; corrupt/inconsistent state fail-closed; first-use/valid legacy state ยังอ่านได้; internal finish/restore ไม่ deadlock |
| R9 regression/packaging | Existing suite + candidate offline install/role/skill identity | `npm run check` ผ่าน; installed contentตรง archive; เอกสารและ role ครบ |
| R10 native approved update | Same frozen semantic task, fresh fixture/state, installed candidate, Lead+named Curator Luna | Preparation ก่อน edits; field/source/history invariants + receipt/state ผ่าน; exactly approved targets |
| R11 native clear recall | Fresh session after R10; current/history/unsupported questions | Current qualifiers/citationsถูก; historicalไม่กลายเป็นcurrent; unknown abstains; zero writes |
| R12 native pending refusal | Separate interrupted operation; fresh named Curator; task asks for current facts | Report BLOCKED/partial state; ไม่มี authoritative answer จาก raw/native bypass; zero writes |
| R13 old pending compatibility | สร้าง pending state ด้วย rc.4 ที่ติดตั้งจริงบน disposable root แล้วใช้ candidate ใหม่ inspect/finish และอีก fixture restore | Saved format ยังอ่าน/ซ่อม/กู้ได้; matching receipt หรือ recovered state ถูกต้อง; source/unrelated files ไม่เปลี่ยน; original failed run ไม่ถูกแตะ |

**Scoring ต้องแยก:** `semanticPass`, `fileIntegrityPass`, `receiptPass`, `pendingAuthorityPass`, `workflowPass` และ per-case expected refusal ไม่ใช้ `pass` ที่แปลว่า hash ไม่เปลี่ยนแทนความสำเร็จทั้งระบบ

`workflowPass` ของงานเขียนคือ semantic/file/source/authorization checks **AND** complete matching receipt/state งาน clear-read คือ factual/citation/abstention checks **AND** clear guarded state **AND** read-only file integrity งาน pending-read คือ refusal/authority control **AND** read-only integrity คำตอบถูกแต่ข้าม pending ไม่ผ่าน

### วิธีรันและเก็บหลักฐาน

หลัง implementation ตั้ง workspace variables สำหรับ run ใหม่; ใช้ absolute CLI ของแพ็กเกจติดตั้ง ห้ามใช้ source checkout แทน installed candidate ใน native acceptance

```sh
# ใน repo: focused tests ที่เพิ่มใหม่ก่อน
node --test test/mvp-lifecycle-context.test.mjs test/mvp-read-authority.test.mjs
node --test test/mvp-read-authority-cli.test.mjs test/curation-checkpoint.test.mjs test/curation-checkpoint-cli.test.mjs

# หลัง integration: regression ครั้งเดียว แล้วสร้าง artifact ใหม่
npm run check
npm pack --pack-destination "$graphmory_trial_artifacts"
```

ชื่อ focused test เป็น planned deliverables ยังไม่มีตอนเขียนแผน ใช้ fixture factory ใหม่ที่ reset ได้จาก inputs ที่ freeze แล้ว ทุก run มี private state root เดียวที่ทุก process ใน run ใช้ร่วมกัน ไม่สลับ root เพื่อหลบ pending operation Candidate ใหม่ใช้ version/run identity ใหม่ เช่น `0.5.0-rc.5`; rc.4 archive และ failed runs คงเดิม

Reinstall tarball into disposable native project แบบ offline/omit optional dependencies บันทึก archive/file manifest/installed skill/role hashesก่อน freeze run metadata แยก SHA ของ candidate จาก semantic oracle ป้องกัน inherited SHA erratum แบบรอบก่อน

Native calls: Codex ใช้ Luna ทั้ง Lead และ named Curator; verify actual model/role จาก raw metadata ใช้ configuration เดิมที่ทดสอบได้ (`gpt-5.6-luna`, low) จนกว่าจะตรวจรุ่นอื่นแยก ไม่ใช้ Astra หรือ Sol ในการทดสอบ workflow นี้ Primary sessions สามชุด: update, clear recall, pending refusal; ไม่เกินหนึ่ง linked repair ที่มีเหตุผล ถ้า host/model ใช้ไม่ได้บันทึก NOT RUN ไม่ substitute แบบเงียบ ๆ

R13 ใช้ preserved rc.4 archive สร้าง checkpoint ด้วย code เดิมจาก frozen semantic inputs บน root ใหม่ จากนั้นใส่ target bytes ตาม recorded partial/field-repaired scenario ก่อนให้ candidate ใหม่ตรวจ ไม่ clone manifest แล้วแก้ vault identity/digest ให้ผ่านเอง เพราะ operation ผูกกับ real vault root เก็บ migration replay protocol/hash แยกจาก native attempt เดิม Source bytes, patch semantics และ preimage/target assertions คงเดิม; original pending operation/preimages คงสภาพไว้ตรวจได้ ผลนี้รับรอง genuine rc.4-generated equivalent operation ไม่อ้างว่าได้ finish/restore exact historical operation เดิม Candidate อาจตรวจ status ของ original แบบ read-only เพิ่มเพื่อยืนยัน parseability ได้ แต่ไม่ทำ state update

เก็บ ordered tool trace, actual CLI JSON stdout/stream, independent whole-fixture hashes, source hashes, patch/receipt/manifest identity และ oracle results Parse stream ตาม output จริง ไม่ถือ session exit 0 หรือ agent self-report เป็น proof ตรวจทุก call ว่า state root ตรงกับ frozen launch setting; ไม่ให้ agent สลับ root/env หรือเรียก low-level reads เพื่อทำให้ pending-read กลายเป็น clear-read

Markdown report ทุก experiment ระบุ candidate, case inputs/gold hashes, expected/actual, failure category, mutation/state, retry reason และ limitations Publishเฉพาะข้อมูล synthetic/sanitized; raw rollouts/preimages/oracles อยู่ private evidence directory

## 6. ลำดับดำเนินงาน งบ และการหยุด

1. **Freeze contracts + baseline:** ยืนยัน history classification, guard route table/output, authority token และ scorer predicates; เก็บ diff/hash ก่อนแก้
2. **A/B parallel:** narrow modules + focused deterministic tests Luna integrator ทำ C ตาม dependency Root ตรวจการรวม ไม่สลับ retrieval strategy
3. **Integrated verification:** R1–R8 แล้ว regression/package R9 ถ้า fail ห้ามรีบเปิด native sessions
4. **Installed acceptance:** R10–R12 บน Luna พร้อม independent scorer; แยก failure จาก runtime, host/config หรือ oracle
5. **Report + cleanup:** รักษา failures/pending evidence ลบเฉพาะ disposable dependencies/cache หลัง process จบ; ห้ามลบ recovery copy เพื่อซ่อนงานค้าง

กรอบเวลา implementation เป้าหมายประมาณ **60–90 นาทีสำหรับ scoped repairs และ deterministic gates** Native host time เพิ่มตามงานจริง ไม่รับรอง deadline แทนผลตรวจ หากหมดงบรายงาน gate ที่ FAIL/NOT RUN และหยุด expansion

ถ้าวิธีเดียวกันไม่ผ่านสองครั้ง ให้เปลี่ยนเงื่อนไขที่ผิดหรือปรึกษา Astra เฉพาะ architecture/validation uncertainty ที่ระบุได้ ไม่ส่ง Astra มา implement และไม่รันเดิมวน เปลี่ยน gold/scoring ได้เฉพาะข้อผิดพลาดของ oracle ที่พิสูจน์ได้ พร้อม version/errata และเก็บผลเดิม

**หยุดเมื่อทุก mandatory gate ผ่านและรายงานครบ** ไม่เพิ่ม benchmark, model routing, latency experiment หรือทำ micro-optimization ต่อใน bundle นี้ ถ้า native filesystem bypass ยังเกิด ต้องรายงานว่า trial control FAIL; host capability isolation เป็น architecture decision แยก ไม่แก้ด้วยคำกล่าวว่ามี prompt แล้วจึงปลอดภัย

## 7. Deliverables และการตรวจแผน

- Coherent runtime/test/guidance diff ตาม A–C, versioned evaluator D และ package identity ใหม่
- Markdown protocol ก่อน run และ report หลังทุก experiment พร้อมสรุปภาษาไทย
- Readiness matrix: ผ่าน/ไม่ผ่าน/ยังไม่ได้ทดสอบ ราย host/model/route ไม่ขยาย claim เกิน evidence
- แผนนี้ผ่าน read-only Luna source/fixture exploration และ Luna review แยกจากคนเขียน โดยแก้ช่องว่างเรื่อง old-pending compatibility, path-scope vs project authority และขอบเขต state-root substitution แล้ว ไม่มี runtime/eval ใหม่ถูกใช้เป็นหลักฐานว่า gates ผ่าน

**ขณะเขียนเอกสารนี้ไม่มี runtime fix หรือ native eval ใหม่เกิดขึ้น** ข้อ R1–R13 เป็นเกณฑ์ที่จะใช้พิสูจน์ ไม่ใช่ผลที่ผ่านแล้ว
