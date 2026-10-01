# Graphmory: ผลการซ่อมและทดสอบ MVP — 1 ตุลาคม 2026

## สรุปสถานะ

**แก้โค้ดและคู่มือแล้ว แต่ยังไม่ประกาศว่า MVP พร้อมใช้งานครบ workflow**

ชุดตรวจโค้ดผ่าน 414/414, แพ็กเกจติดตั้งตรงกับ archive 119/119, การปฏิเสธอ่านเมื่อมีงานค้างผ่านใน Codex จริง และ checkpoint ที่สร้างด้วย rc.4 ใช้ rc.5 ปิดงาน/กู้คืนได้จริง

ส่วนที่ยังต้องยืนยันคือ **Curator อัปเดตครบเมื่อมีโน้ตใหม่ แล้วอ่านข้อมูลกลับใน session ใหม่** การทดสอบ update สองครั้งยัง FAIL และเก็บไว้ทั้งสองครั้ง คู่มือแก้สาเหตุล่าสุดแล้ว แต่ยังไม่ได้ทดสอบ native update หลังการแก้นั้น ตามขอบเขตที่จำกัดการลองซ้ำ

## แก้อะไรและทำไม

| ส่วน | สิ่งที่แก้ |
|---|---|
| Lifecycle | การอ้างโน้ตเก่าที่มีลิงก์ predecessor/successor ถูกต้องไม่ถูกตีความว่าโน้ตปัจจุบันเองเก่า รองรับ prior/previous/earlier rule, policy, record และ version โดยยังตรวจความสัมพันธ์สองทาง |
| Conflict | `No decision yet.` ไม่ถูกนับว่าเป็น decision path แล้ว ต้องมีขั้นตอนหรือผู้รับผิดชอบที่ระบุจริง |
| Retrieval / read authority | คำสั่งอ่านสำหรับ agent ตรวจ pending state ก่อนอ่าน ก่อน provider/cache work และก่อนส่ง output ตรวจการเปลี่ยนสถานะระหว่างอ่านด้วย |
| Recovery | อ่านเพื่อซ่อมได้เฉพาะ operation และ path ใน manifest ตรวจ source hash และแยกข้อมูล partial/recovery ออกจากข้อมูลที่ยืนยันแล้ว |
| Finish diagnostics | เมื่อปิดงานไม่ได้ ระบุ path, kind และ next action แบบสั้น พร้อมเก็บงานค้างไว้ ไม่มี note body ใน error |
| Curator setup / skill | ใช้ state root เดียว เคารพ BLOCKED และตรวจ receipt; แยก existing original จาก target ใหม่ที่อนุมัติชัดเจน ต้อง prepare ก่อนสร้างไฟล์ใหม่ |

งานสำรวจ แก้โค้ด และตรวจเฉพาะส่วนใช้ Luna Max แยกกัน Root รวมงาน ตรวจ archive และรัน native acceptance ไม่มีการเปลี่ยน retrieval strategy, เพิ่ม provider หรือ benchmark คู่แข่งในรอบนี้

## ผลตามเกณฑ์ R1–R13

| เกณฑ์ | ผล | หลักฐาน |
|---|---|---|
| R1–R4 lifecycle/history/conflict | PASS แบบ deterministic | Exact chain, self-stale, chain ขาด/กำกวม/หมดอายุ, negated decision และข้อความที่พบใน native failure |
| R5–R8 read guard/recovery/clear reads/state transition | PASS แบบ deterministic | Focused integration 104/104 และ regression suite |
| R9 regression/package/install | PASS | `npm run check` 414/414, zero skipped; final archive/checkout/installed 119 ไฟล์ตรงกัน; project skill/role สร้างจากตัวติดตั้งจริง |
| R10 native approved update | ยังไม่ยืนยันกับ final guide candidate | Native สองครั้งก่อนหน้า FAIL; รอบหนึ่งเขียน partial แล้ว finish ไม่ผ่าน อีกครั้งหยุดก่อน prepare/เขียน |
| R11 fresh current/history/unsupported recall | NOT RUN | ยังไม่มี native update ที่ได้ matching APPLIED receipt จึงไม่ใช้ข้อมูลที่เตรียมเองแทนเพื่อให้ผ่าน |
| R12 fresh pending refusal | PASS ในขอบเขตที่สังเกตได้ | Actual Lead + Curator, pending envelope, ไม่มี policy answer หรือ raw vault bypass, vault 12/12 hash เท่า seed; automated gates ผ่านทั้งหมด |
| R13 rc.4 → final rc.5 compatibility | PASS | แยกสอง lane: finish ได้ matching receipt/full persistence; reviewed restore คืน baseline 12 ไฟล์ครบ สถานะ recovered และไม่มี receipt |

R12 มีข้อจำกัดหลักฐาน: ก่อน launch ไม่ได้บันทึก hash ของ state tree ทุกไฟล์ จึงไม่อ้างว่าได้เปรียบเทียบ state bytes ทั้งต้นไม้ก่อน/หลัง ตรวจได้ว่า operation/preimages/current hashes ตรงกับ seed, state files มี mtime ก่อน launch และ trace ไม่มีคำสั่งเขียน state

## Native experiments ที่เกิดขึ้นจริง

ทุก session ใช้ Codex CLI, Lead และ named `graphmory_curator` เป็น `gpt-5.6-luna`, effort `low` มี raw dispatch `fork_context:false`, ไม่มี child model override และตรวจ actual child/wait metadata

| Run | Candidate | ผล |
|---|---|---|
| `repair-native-01` | `978c…cdd` | ไม่เริ่ม model: graph preflight อ่าน edge objects ผิด และ role ที่ harness สร้างเองขัดกับ installer เก็บ failure แล้วแก้ harness |
| `repair-native-02` | `978c…cdd` | R10 FAIL: persistence ถูก แต่ audit ปฏิเสธ Runbook ที่อ้าง `superseded prior rule` ทั้งที่ chain ถูกต้อง มี partial edits และ pending operation, ไม่มี receipt แก้ grammar พร้อม negative tests |
| `repair-native-03` | `aa2b…a80` | R10 FAIL: Curator ถือว่า approved new target ที่ยังไม่มีไฟล์เป็น blocker หยุดก่อน prepare/เขียน ตรวจอิสระแล้ว vault 12/12 ไม่เปลี่ยน ไม่มี operation/receipt แก้ guidance แล้ว |
| `repair-native-04` | `1172…04a` | รันเฉพาะ R12: BLOCKED/CURATION_PENDING ตามคาด ไม่มี policy details และไม่มี vault changes ทั้ง parent/child จบ task_complete |

Final candidate คือ `artifacts/iteration-03/graphmory-0.5.0-rc.5.tgz`, SHA-256:

`11725097611ba5e65ecf2ee6ea39fbf5562061b0053c0e811946e3afe90ff04a`

Version เท่ากันทั้งสาม iteration แต่ archive hashes ต่างกัน จึงเก็บแยกและใช้ hash ระบุ candidate ไม่แทนที่ archive เก่า

## ข้อผิดพลาดของ eval ที่บันทึกไว้

- Lifecycle focused รอบแรก 15/16 นำไปสู่การแก้ genuine negated-decision defect; ไม่ลบ FAIL
- R13 harness รอบแรกคาด field `blocked:false` ที่ rc.4 ไม่คืนมา รอบสองเรียก rc.4 binary แทน rc.5 แก้เป็นคนละ install และตรวจ version/archive-member parity ก่อน CLI ทุกครั้ง รอบที่ใช้ candidate ถูกต้องผ่าน
- Native scorer แก้การอ่าน graph edge และ actual host dispatch schema โดยบันทึก old/new scorer hashes และคง semantic gold/candidate/input เดิม
- Native02 ยังมี scorer limitations: source anchor `.md#D2`, การ lowercase state path และ offset 0 ที่ CLI ใช้เป็น default native03 capture ยัง throw เมื่อ required new target ไม่มี ทั้งหมดอยู่ใน remaining eval work; ไม่ใช้ข้อผิดพลาดเหล่านี้ลบ genuine workflow FAIL
- Independent pending review รุ่นแรกเทียบ status กับ manifest ผิดชนิด และตีความ `sed` ที่อ่าน skill เป็น raw vault read ผิด เก็บไฟล์เดิมและบันทึก correction แยกไว้ ผล R12 automated PASS คงเดิม

## ขั้นต่อไปก่อนประกาศ MVP พร้อม

1. ซ่อม scorer ด้วย recorded traces: source fragments, case-preserved state paths, implicit offset 0 และ missing target ต้องคืน FAIL พร้อมเหตุผลแทน crash เพิ่ม state-tree hash snapshot ก่อน launch
2. Freeze evaluator/candidate/input/gold ก่อนเปิด model และเก็บ exact evaluator bytes
3. ทดสอบ native update ใหม่ด้วยคู่มือ new target ที่แก้แล้ว ตรวจ source/target/history/receipt/state แยกกัน
4. หลัง update ได้ receipt จึงรัน fresh recall สำหรับ current, historical และ unsupported facts ถ้าข้อใดไม่ผ่านต้องรายงานตามจริง

## ขอบเขตและการเก็บหลักฐาน

นี่เป็น synthetic correctness/workflow acceptance ของ Codex/Luna ไม่ใช่ LoCoMo/LongMemEval score, general accuracy หรือหลักฐานว่าเหนือกว่าเครื่องมืออื่น CLI guard อาศัยการทำตามกติกาของ agent; ไม่ใช่ filesystem isolation ของ host และไม่รับรอง atomicity ต่อ external edits หลังการตรวจครั้งสุดท้าย

ไม่ได้แก้ vault จริง `<user-vault>` หรือ global config/trust ไม่ commit/push เก็บ original failed fixture/operation, private gold, raw rollouts, manifests และ preimages ไว้ ไม่ล้าง pending state เพื่อทำให้ผลผ่าน

Private evidence: `../graphmory-mvp-repair-20261001/` รวม `baseline.json`, `repository-check-03.log`, `candidate-03.json`, native evidence และ `r13-compatibility-2026-10-01-r13-final-guide-20261001/result.json` งานเดิมที่ค้างใน working tree ถูกเก็บไว้ มี round inventory แยกจาก Git diff เดิม

รายงานที่เกี่ยวข้อง: [lifecycle](mvp-lifecycle-context-repair-2026-10-01.md), [read authority](mvp-read-authority-repair-2026-10-01.md), [native protocol/failures](mvp-correctness-native-protocol-2026-10-01.md), [checkpoint compatibility](mvp-checkpoint-compatibility-repair-2026-10-01.md), [acceptance protocol](mvp-correctness-repair-protocol-2026-10-01.md)

Cleanup เสร็จแล้ว: ลบเฉพาะ dependency/cache และ Python bytecode ใน private test root เก็บ archives, gold, raw traces, fixture vaults, manifests และ preimages ครบ ไม่แตะ dependency ของ checkout หลัก บันทึกไว้ใน `cleanup.json`

## Follow-up: native-05 หลังผู้ใช้อนุมัติทดสอบต่อ

แก้ development evaluator พร้อม regression 7/7 และ `npm run check` ผ่าน 421/421 จากนั้นทดสอบ final candidate เดิมด้วย Lead/Curator Luna จริงบน fresh fixture ผล R10 ยัง FAIL: Curator ไม่เปลี่ยน predecessor เป็น superseded และใช้ replacement link แบบชื่อย่อ; full verifier บล็อกถูกต้อง งานคง pending ไม่มี receipt จึงไม่รัน R11

R12 ปฏิเสธข้อมูลและคง vault/state tree เดิมไว้ครบ แต่ frozen automated trace gate ยังอ่าน dynamic wait ไม่ครบ จึงคงคะแนน FAIL เดิมไว้ พร้อม independent raw review แยกผลการทำงานกับข้อจำกัดของตัว eval ไม่มี manual repair เพื่อเปลี่ยน failed attempt ให้เป็น success

[รายงาน follow-up และขั้นแก้ที่แนะนำ](mvp-native-retest-result-2026-10-01.md) · [independent review](mvp-native-05-independent-review-2026-10-01.md)
