import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createSourceHandoff, readSourceHandoff } from "../src/source-handoff.mjs"

test("exact path handoff stays metadata-only and guards every original before disclosure", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-handoff-"))
  const vault = path.join(root, "vault")
  fs.mkdirSync(path.join(vault, "90 Evidence"), { recursive: true })
  try {
    const first = "# Approval Record\n## E1\nOld rule.\n## E2\nNew rule.\n"
    const second = "# Runbook\nFollow [[90 Evidence/Approval Record]].\n"
    fs.writeFileSync(path.join(vault, "90 Evidence", "Approval Record.md"), first)
    fs.writeFileSync(path.join(vault, "Runbook.md"), second)
    fs.writeFileSync(path.join(root, "outside.md"), "Private")
    fs.symlinkSync(path.join(root, "outside.md"), path.join(vault, "escape.md"))

    const paths = ["90 Evidence/Approval Record.md", "Runbook.md"]
    const handoff = createSourceHandoff(vault, paths)
    assert.deepEqual(handoff.sources.map(({ path: item }) => item), paths)
    assert.equal(JSON.stringify(handoff).includes("Old rule"), false)
    assert.deepEqual(readSourceHandoff(vault, handoff).sources.map(({ markdown }) => markdown), [first, second])

    const manifest = path.join(root, "handoff.json")
    const command = (...args) => spawnSync(process.execPath, ["scripts/brain-sync.mjs", ...args], { encoding: "utf8" })
    const generated = command("source-handoff", "--vault", vault, "--paths", JSON.stringify(paths))
    assert.equal(generated.status, 0, generated.stderr)
    assert.deepEqual(JSON.parse(generated.stdout), handoff)
    fs.writeFileSync(manifest, generated.stdout)
    const read = command("read-notes", "--vault", vault, "--manifest", manifest)
    assert.equal(read.status, 0, read.stderr)
    assert.deepEqual(JSON.parse(read.stdout), readSourceHandoff(vault, handoff))
    assert.notEqual(command("read-notes", "--vault", vault, "--paths", JSON.stringify(paths), "--manifest", manifest).status, 0)

    fs.writeFileSync(path.join(vault, "Runbook.md"), "# Changed\n")
    assert.throws(() => readSourceHandoff(vault, handoff), /SOURCE_CHANGED/)
    const changed = command("read-notes", "--vault", vault, "--manifest", manifest)
    assert.notEqual(changed.status, 0)
    assert.equal(changed.stdout.includes(first), false)

    assert.throws(() => readSourceHandoff(root, handoff), /vault differs/)
    assert.throws(() => createSourceHandoff(vault, ["escape.md"]), /vault|path|source/i)
    assert.throws(() => createSourceHandoff(vault, ["90 Evidence/Approval Record E2.md"]), /ENOENT/)
    assert.throws(() => readSourceHandoff(vault, { ...handoff, sources: [handoff.sources[0], handoff.sources[0]] }), /Duplicate/)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})
