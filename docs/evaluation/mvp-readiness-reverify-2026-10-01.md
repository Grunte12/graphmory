# ตรวจความพร้อมก่อน push — 1 ตุลาคม 2026

## ผลสรุป

**ยังไม่ควรเผยแพร่ rc.5 ในฐานะ MVP ที่ใช้งานได้ครบ workflow** การตรวจโค้ดและแพ็กเกจผ่าน แต่การอัปเดต memory ด้วย Curator จริงของ candidate เดียวกันยังล้มเหลว และยังไม่มี fresh-session recall หลัง receipt ที่สำเร็จ

รอบนี้เป็นการ verify ไม่แก้ runtime ไม่ทำ native retry ไม่ commit/push และไม่แก้ Obsidian vault จริง ผลทดสอบเดิมและ pending operation ถูกเก็บไว้

## สิ่งที่ตรวจใหม่

| รายการ | ผลและขอบเขต |
|---|---|
| `npm run check` | exit 0, tests 421/421 ผ่าน, 0 fail/skipped/cancelled; ประมาณ 11.5 วินาทีสำหรับ test suite |
| `git diff --check` | ผ่าน ไม่มี whitespace errors |
| `doctor --json` | `ok:true`; เป็นการตรวจ environment/CLI ไม่ใช่ผล native workflow |
| Candidate identity | rc.5 iteration-03 SHA-256 `11725097611ba5e65ecf2ee6ea39fbf5562061b0053c0e811946e3afe90ff04a`; runtime ใน checkout ตรงกับ archive 119/119 ไฟล์ |
| Synthetic metadata reproduction | full verifier ปฏิเสธ predecessor ที่ยัง active และใช้ replacement แบบชื่อย่อ ด้วยสอง error เดียวกับ native-05 |
| Package dry-run | rc.5, 119 ไฟล์; bins/local imports ครบ, semantic dependency ยัง optional; path/credential scan ไม่พบรายการน่าสงสัยในขอบเขตที่ตรวจ |
| Sync status ของ synthetic vault | `SYNC_CONFIG_NOT_FOUND` เพราะ fixture นี้ไม่ได้ตั้งค่า Git brain sync; ไม่ได้ใช้เป็นหลักฐานผ่านหรือไม่ผ่าน shared sync |
| Failed fixture integrity | ไฟล์ใน native-05 vault ยังตรงกับ failed capture ทั้งหมด หลัง diagnostic แบบอ่านอย่างเดียว |

ไม่มีการรันโมเดลซ้ำ: runtime ทั้ง 119 ไฟล์ไม่เปลี่ยนจาก candidate ที่มี native failure จึงยังไม่เกิดหลักฐานใหม่ว่าปัญหาถูกแก้

## Blocker ที่ต้องแก้

### 1. Curator ต้องเขียน lifecycle metadata เอง

native-05 สร้าง/แก้ครบ targets แต่ predecessor ยังมี `status: active` และ `superseded_by: [[Recovery Window Policy]]` full verifier ต้องการ `superseded` กับ canonical replacement path จึงไม่ให้ receipt งานยัง pending และ R11 ไม่ได้รัน

render-patch สร้างข้อมูล successor แต่ไม่ได้สร้าง predecessor transition ให้ การแก้ควรให้ workflow บันทึกเดิมจัดการเฉพาะ metadata ที่อนุมัติแล้ว จาก validated patch และ declared targets พร้อมรักษา preimages, source hashes, pending guard และ full verification

กฎตรวจ predecessor ตรงกับเอกสารและ focused test ข้อผิดพลาดนี้เป็นการเขียนข้อมูลของ Curator ไม่ใช่ false rejection ของ verifier

### 2. Native evaluator ยังอ่าน trace บางรูปแบบไม่ครบ

ตัว eval ไม่รองรับ dynamic child ID และบางคำสั่งที่ใช้ตัวแปรครบ ทำให้ผล trace gate คลาดเคลื่อน ต้องเพิ่ม regression จาก raw native-05 และตรึง evaluator รุ่นแก้ไขใหม่ เก็บ frozen score เดิมไว้ การแก้ตัว eval ไม่เปลี่ยนข้อผิดพลาดจริงในข้อ 1

### 3. เอกสารที่แนบในแพ็กเกจอ้าง candidate เก่า

`package.json` ระบุ version rc.5 และแนบ `docs/guides/trial-mvp.md` กับ `docs/evaluation/mvp-native-acceptance-2026-10-01.md` คู่มือบรรทัด 13 ชี้ไป acceptance ของ rc.4 ซึ่งระบุพร้อมทดลองใน configuration ที่ทดสอบไว้ แต่แพ็กเกจไม่ได้แนบ [รายงาน rc.5 ล่าสุด](mvp-native-retest-result-2026-10-01.md) ที่ระบุ R10 FAIL และ R11 NOT RUN

ควรคงรายงานประวัติไว้ แล้วให้คู่มือ/แพ็กเกจแสดงสถานะของ current candidate และข้อจำกัดของ host/model ที่ตรวจจริงอย่างชัดเจน

## เกณฑ์ก่อนบอกว่าพร้อมทดลองครบ workflow

1. แก้ lifecycle metadata ในเครื่องมือและปรับขั้นตอน Curator ให้ใช้ทางเดียว ลด validation ที่ซ้ำกับ finish โดยเก็บ diagnostic แยกไว้
2. ซ่อม evaluator แล้วตรึง candidate, fixture และ gold ใหม่
3. ใช้ Luna ทำ native update บน fresh synthetic vault ต้องได้ matching receipt พร้อม source/target bindings และประวัติแทนที่ถูกต้อง
4. เปิด session ใหม่อ่านกลับ ต้องใช้ข้อมูลปัจจุบัน ตอบประวัติย้อนหลังได้ และไม่เติมข้อเท็จจริงที่ไม่มีหลักฐาน
5. pending refusal ยังต้องบล็อกการอ่านและคง vault/state เดิม; ตรวจแพ็กเกจและเอกสาร current candidate ก่อน commit/push

ยังไม่ต้องเพิ่ม provider, semantic model หรือ benchmark ใหม่ก่อนปิด workflow นี้ ผลผ่านบน Codex/Luna ต้องรายงานตาม configuration ที่ทดสอบ ไม่ขยายเป็นการรับรองทุก host/model

## หลักฐาน

- [Native-05 retest](mvp-native-retest-result-2026-10-01.md)
- [Independent raw review](mvp-native-05-independent-review-2026-10-01.md)
- Private evidence root: `outputs/graphmory-mvp-repair-20261001/`
- New artifacts: `readiness-reverify-check.log`, `readiness-reverify-identity.json`, `readiness-reverify-core.json`, `readiness-reverify-package.json`, `readiness-reverify-doctor.json`, `readiness-reverify-status.log`, `readiness-reverify-fixture-integrity.json`

Package dry-run ครั้งแรกติด permission ของ user npm cache จึงใช้ cache ชั่วคราวใน `/private/tmp` โดยไม่เปลี่ยน global config หรือ ownership ตรวจสำเร็จแล้วลบเฉพาะ cache ชั่วคราวนั้น รายงาน private เก็บ command, initial error, retry และ cleanup ไว้

ผลนี้เป็นการตรวจความพร้อมของ candidate ปัจจุบัน ไม่ใช่ benchmark เปรียบเทียบเครื่องมืออื่น
