# ผลทดสอบ MVP รอบ native-05 — 1 ตุลาคม 2026

## สรุป

**ยังไม่ผ่านการอัปเดต memory แบบ end-to-end จึงยังไม่ยืนยันว่า MVP พร้อมใช้งานเต็ม workflow**

ทดสอบด้วย Codex CLI จริงบน vault สังเคราะห์ที่แยกจาก Obsidian ของผู้ใช้ ใช้ `gpt-5.6-luna` / reasoning `low` ทั้ง Lead และ named `graphmory_curator` ใน session ใหม่ ไม่มีประวัติสนทนาส่งให้ Curator ผลจากการตรวจไฟล์และ raw log ถูกเก็บไว้ครบ

| สิ่งที่ทดสอบ | ผล | ความหมาย |
|---|---|---|
| `npm run check` | ผ่าน — 421/421 tests, ไม่มี skipped | รวม regression ใหม่ของตัว eval 7 กรณี |
| ติดตั้งแพ็กเกจและสร้าง Curator ในโปรเจกต์แยก | ผ่าน | ไฟล์แพ็กเกจตรงกัน 119/119; setup สร้าง role และ skill สำเร็จ |
| R10: Curator อัปเดตโน้ตจากหลักฐาน | **ไม่ผ่านจริง** | แก้/สร้างครบ 4 targets แต่ metadata ของนโยบายเก่ายังผิด 2 ค่า; verifier บล็อก ไม่มี receipt |
| R11: อ่านกลับใน session ใหม่หลังอัปเดต | ไม่ได้รัน | R10 ยัง pending จึงไม่มีข้อมูลอัปเดตที่ยืนยันสำเร็จให้ทดสอบ |
| R12: ปฏิเสธข้อมูลเมื่อ checkpoint ค้าง | พฤติกรรมผ่าน; คะแนน trace ของตัว eval ยังไม่ผ่าน | มี `CURATION_PENDING`, ไม่ตอบนโยบาย, ไม่อ่านข้าม guard; vault และ state tree ไม่เปลี่ยน |

ผลรวมของ **ตัว eval ที่ตรึงไว้** ยังคงเป็น 0/3 primary tasks ผ่าน: R10 และ R12 ถูกให้ FAIL, R11 NOT RUN คะแนนเดิมไม่ถูกแก้ย้อนหลัง การตรวจ raw log เพิ่มเติมอธิบายข้อจำกัดของ trace parser แยกไว้ใน [independent review](mvp-native-05-independent-review-2026-10-01.md)

## จุดที่ล้มเหลวจริง: metadata ของนโยบายเดิม

Curator สร้าง `Recovery Window Policy.md` สำเร็จ อัปเดต MOC/Runbook และเก็บ patch record ของนโยบายใหม่ครบ แต่ `Batch Policy.md` ยังคงมี:

```yaml
status: active
superseded_by: [[Recovery Window Policy]]
```

contract ต้องการ:

```yaml
status: superseded
superseded_by: "01 Projects/HelioForge/Recovery Window Policy.md"
```

คำสั่ง `verify-patch-persistence --full` ที่ Curator รันจริงคืน `valid:false` พร้อมสองข้อผิดพลาดนี้ Curator จึงหยุดตาม protocol ก่อน `finish` และเก็บ operation `89ec5120-2e37-4601-b12b-b239a0d834e9` เป็น pending

- `receipt: null` และ `lastFailure: null` สอดคล้องกับการไม่เรียก finish; verifier เป็นคำสั่งอ่านเพื่อตรวจสอบ
- source SHA ยังตรงกับข้อมูลที่ตรึงไว้; `sourceIdentityPass:false` เกิดจาก receipt ที่ไม่มี source binding
- สี่ targets เปลี่ยนตามที่อนุญาต มีโน้ตใหม่หนึ่งไฟล์ ไม่มี source หรือไฟล์อื่นถูกแก้
- คง failed vault, manifest และ preimages เดิมไว้ ไม่มีการแก้ด้วยมือแล้วนับเป็น native success

## ผลของโหมดงานค้าง

บน vault/state แยกอีกชุดหนึ่ง Curator เรียก `recall-managed` แล้วตอบปฏิเสธแบบ `CURATION_PENDING` โดยไม่ตอบข้อมูลนโยบาย

- frozen scorer ให้ผ่านทุก behavioral gate: pending state, blocked envelope, no answer, no bypass, vault read-only, state tree read-only และ state-root binding
- Markdown/config vault ทั้ง 12 ไฟล์เหมือนก่อนรัน
- state tree ทั้ง 10 entries (ไฟล์และ directory) เหมือนก่อนรัน รวมชนิด ขนาด byte hash และ permission bits
- Root ตรวจ inventory แยกอีกครั้งได้ผลเดียวกัน; inventory ฉบับแรกใช้ชื่อ directory ไม่มี `/` ท้าย จึงเกิด false difference ได้เก็บทั้ง artifact แรกและคำอธิบายแก้ไขไว้

การเทียบนี้ไม่ครอบคลุม ownership, ACL, extended attributes หรือ timestamps และไม่ได้สร้าง host filesystem isolation

## ข้อจำกัดของตัววัดผลที่พบจากรอบจริง

1. ตัวเก็บ raw trace รุ่นแรกอ่าน prompt แบบ JavaScript template literal ไม่ได้ จึงซ่อมตัว collector แล้วเก็บ trace จาก session เดิม ไม่ได้รันโมเดลซ้ำ มี failure record และ hash รุ่นแก้ไข; ไม่มี hash ของ collector ก่อนแก้ จึงบันทึกข้อจำกัดนี้ตรง ๆ
2. frozen evaluator ยังอ่าน wait แบบ `[r.agent_id]` และ `[load("child_id")]` ไม่ครบ จึงให้ delegation/trace gate FAIL ทั้งที่ collector ตรวจการ spawn, returned child ID, matching completed wait และ actual model metadata ได้
3. R10 workflow parser ยังไม่รองรับ shell command ที่ใช้ตัวแปร CLI และบางรูปแบบของ offset ค่าเริ่มต้น จึงรายงาน missing routes เพิ่มเติม ต้องตรวจด้วย raw log ประกอบ

ข้อจำกัดเหล่านี้ไม่เปลี่ยนสาเหตุที่ R10 ล้มเหลว: native full verifier และไฟล์จริงยืนยัน predecessor metadata ผิดตรงกัน ไม่มีการลดเกณฑ์ receipt หรือแก้ frozen score เพื่อให้ผ่าน

## สิ่งที่แก้ในรอบทดสอบนี้

แก้เฉพาะ development evaluator: ลิงก์ `.md#หัวข้อ`, case ของ state path, offset เริ่มต้น 0, missing-target FAIL artifact และ snapshot/state-tree comparison รวม missing state root เพิ่มคำอนุมัติสร้าง exact target ใน prompt ใหม่ ไม่มีการเปลี่ยน fixture facts, patch, target set หรือ semantic gold

[รายละเอียดและ regression tests](mvp-evaluator-repair-followup-2026-10-01.md)

## ขั้นถัดไปที่แนะนำ

1. **ให้เครื่องมือช่วยเขียน lifecycle metadata อย่างแน่นอน**: ใช้ path จาก validated patch ตั้ง predecessor เป็น superseded และผูก replacement ด้วย canonical path ตรวจ checkpoint target/hash ก่อนเขียน และรักษาเนื้อหาประวัติเดิม Curator ยังรับผิดชอบการสังเคราะห์เนื้อหา
2. ขยาย trace parser ด้วย raw regression ของ native-05 เพื่อรองรับค่าที่คืนจาก spawn, store/load และ shell ตัวแปร ตรวจจาก calls/results จริง แล้วตรึง evaluator รุ่นใหม่
3. ทดสอบ fresh fixture อีกครั้ง เมื่อได้ matching receipt แล้วจึงเปิด fresh recall session ห้ามใช้การซ่อม failed fixture ด้วยมือแทนผล native end-to-end

รอบนี้จบที่การทดสอบและระบุ blocker ไม่มีการเพิ่มฟีเจอร์ runtime หรือทำ optimization ด้าน latency/cost ต่อ

## ตัวตนเวอร์ชันและหลักฐาน

| Artifact | SHA-256 |
|---|---|
| rc.5 candidate, iteration-03 | `11725097611ba5e65ecf2ee6ea39fbf5562061b0053c0e811946e3afe90ff04a` |
| frozen evaluator | `f2f8eb1634e04a141536a589ecdfc585ea3a3e4d8ce85900bbd15f6f32c05371` |
| revised private collector | `4bd44b1ef9b9cafa90a9f3f229b52a5de166d2ff2668c543720197f8bf4dc482` |

หลักฐาน local อยู่ที่ `outputs/graphmory-mvp-repair-20261001/native/private/repair-native-05/evidence/`: `update-capture.json`, `update-score.json`, `pending-score.json`, `final-score.json`, `native-traces.json`, raw Lead/Curator JSONL สี่ไฟล์, `collector-failures.json`, independent inventory/correction, `post-score-integrity.json` และ `cleanup.json` ข้อมูล oracle/freeze/preimages เก็บอยู่ใน private run เดียวกัน

เวลาจาก launcher: update ประมาณ 186 วินาที; pending refusal ประมาณ 38 วินาที เป็น wall time ของ workflow ทั้ง Lead/Curator ในหนึ่งครั้ง ไม่มีข้อสรุปเปรียบเทียบความเร็วทั่วไป

ล้างเฉพาะ native-05 `node_modules` และ npm cache ชั่วคราวหลัง scoring เก็บ candidate tarball, fixture, state, preimages และหลักฐานทั้งหมดไว้ ไม่แก้ real vault หรือ global config ไม่ commit/push

ผลนี้ครอบคลุมหนึ่ง synthetic scenario บน Codex/Luna เป็นหลักฐาน correctness ของรอบนี้ ยังไม่ใช่ผล benchmark ว่าเหนือกว่าเครื่องมืออื่น หรือการรับรอง unattended use
