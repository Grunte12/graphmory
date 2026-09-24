# QA Report — Graphmory

## Verification update — 2026-09-23

The repository was rechecked on Node 24 and npm 12. The original release gate failed on npm 12 because `npm pack --json` returned an object instead of the array expected by the script. The gate now accepts both formats. This checkout adds a lockfile and configures CI to use `npm ci` and execute the release gate. The fresh-install test uses an isolated npm cache, so a developer's broken or unwritable global cache does not affect it. The install manifest now uses the shared atomic-write helper, and the install guide points to the actual installed CLI path.

Remaining work: lock recovery still needs a carefully reviewed policy for stale locks; push remains subject to remote changes between inspection and publication; semantic model startup has no cancellation/timeout; and retrieval latency needs a stable benchmark environment before tightening the gate. Module-level coverage and linting can be added incrementally. The existing CLI suite already tests many `scripts/brain-sync.mjs` commands, so the older blanket claim that no CLI logic is tested is inaccurate.

## What this project is / โปรเจกต์นี้คืออะไร

**EN:** A memory layer for coding agents. A "lead agent" writes a structured Memory Patch (JSON); a separate "curator" agent validates and stores it into a Markdown/Obsidian vault ("the brain"), without inventing facts. Ships as Node.js CLI tooling (`mph`), an installable Claude/agent skill, and an eval harness. v0.5.0-rc.3, zero required dependencies.

**TH:** เป็นระบบ "หน่วยความจำ" สำหรับ coding agent โดย agent หลัก (lead agent) จะเขียน "Memory Patch" (ไฟล์ JSON ที่มีโครงสร้างชัดเจน) แล้ว agent อีกตัว (curator) จะตรวจสอบและบันทึกลง vault แบบ Markdown/Obsidian (เรียกว่า "the brain") โดยห้ามแต่งข้อมูลเพิ่มเอง โปรเจกต์นี้ประกอบด้วย CLI tool (`mph`), skill ที่ติดตั้งให้ Claude/agent ใช้ได้ และชุด eval สำหรับทดสอบคุณภาพ ปัจจุบันเวอร์ชัน 0.5.0-rc.3 ไม่มี dependency ที่จำเป็นเลย

## Key Findings / ประเด็นสำคัญ

### 🔴 High

1. ~~**Path-traversal write bug** in `curationApply` (`scripts/brain-sync.mjs:1633`) — no vault-confinement check on the write target, unlike the (correct) pattern used elsewhere in the same file.~~ **Fixed** — `curationApply` now requires `--vault`, resolves `candidate.target` through the existing `safeMigrationPath`/`assertRealPathInsideVault` guards (rejects absolute paths and `../` escapes), and writes via `writeFileAtomic` instead of a bare `fs.writeFileSync`. Regression tests added: "curation-apply rejects a target that escapes the vault root" and "curation-apply rejects an absolute path target" (`test/brain-sync-cli.test.mjs`).
   *ช่องโหว่ path-traversal ใน `curationApply` — **แก้ไขแล้ว** ตอนนี้ต้องระบุ `--vault` และตรวจสอบ path ปลายทางด้วย `safeMigrationPath`/`assertRealPathInsideVault` เหมือน pattern ที่ถูกต้องในจุดอื่นของไฟล์ พร้อมเขียนไฟล์แบบ atomic*

2. ~~**Release gate isn't wired into CI**~~ **Fixed** — CI now executes `release:gate`; the gate checks `package-lock.json` against `package.json` instead of hardcoding an rc version, and accepts npm 12 pack JSON.
   *"release gate" ที่โฆษณาไว้ยังไม่ถูกเชื่อมเข้ากับ CI จริง และ regex เช็คเวอร์ชันถูก hardcode ไว้*

3. ~~**No dependency lockfile**~~ **Fixed in this checkout** — `package-lock.json` is added and CI uses `npm ci`.
   *ไม่มี lockfile เลย ทำให้ build ไม่ reproducible*

### 🟡 Medium

4. Sync/restructure locks have no staleness check — a killed process leaves an orphaned lock requiring manual cleanup.
   *lock ไฟล์ไม่มีการเช็คว่าหมดอายุหรือ process ตายไปแล้ว ถ้าโปรแกรมถูกฆ่ากลางคันจะต้องลบ lock เองด้วยมือ*
5. TOCTOU gap in multi-machine push (mitigated only by local lock).
6. Module-level coverage remains thin for `memory-lifecycle-audit.mjs` and `semantic-recall.mjs`. CLI tests already cover many `scripts/brain-sync.mjs` commands; `curation-recommendations.mjs` has direct tests in `test/retrieval-stress.test.mjs`.
   *ยังไม่มี unit test เฉพาะสำหรับหลายโมดูลสำคัญ รวมถึง CLI script ทั้งหมด*
7. A recent CI-flake fix widened a latency assertion instead of fixing root cause (commit `4cfc0fb`).
8. No lint/formatter (ESLint/Prettier) anywhere, nothing enforced in CI.
9. Semantic-recall model load has no timeout guard.

### 🟢 Low

10. Two silent-error spots swallow failures without logging (`scripts/brain-sync.mjs:416`, `src/brain-sync.mjs:1031`).
11. ~~`install.mjs` writes its manifest non-atomically.~~ **Fixed** with `writeJsonAtomic`.

### ✅ What's solid / สิ่งที่ทำได้ดีอยู่แล้ว

Core retrieval/contracts/brain-sync logic is well tested; no shell-injection risk anywhere; no hardcoded secrets, and the project actively scans for secret-like content before push; the atomic-write + rollback pattern is genuinely crash-safe (just not applied everywhere).

## Suggested Optimization Roadmap / แนวทางปรับปรุง (เรียงตามความสำคัญ)

1. ~~Fix `curationApply` to reuse the existing `safeMigrationPath`/vault-confinement check + atomic write.~~ **Done.**
2. Wire `release-gate.mjs` into CI, or stop advertising it as enforced.
3. Commit a lockfile; pin the one optional dependency.
4. Add PID/staleness detection + a `--force-unlock` escape hatch to the lock files.
5. Backfill unit tests for the untested modules and CLI dispatch logic.
6. Fix the CI latency-flake at its root instead of loosening the threshold.
7. Add ESLint/Biome + wire into CI (cheap given the code is already clean).
8. Add a timeout around the semantic-recall model load.
9. Log the two silent-catch spots instead of swallowing errors.

---
*The original report was retained as an issue history; the verification update above reflects the current checkout.*
