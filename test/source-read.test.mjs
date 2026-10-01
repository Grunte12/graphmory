import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { readSourceNotes } from "../src/source-read.mjs"
import { spawnSync } from "node:child_process"

test("batch source reads preserve full originals and enforce vault boundaries", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-source-read-"))
  const vault = path.join(dir, "vault")
  fs.mkdirSync(vault)
  try {
    const markdown = `# Thai ไทย\r\n${"Context. ".repeat(500)}\r\nDo NOT deploy Friday.\r\n`
    fs.writeFileSync(path.join(vault, "one.md"), markdown)
    fs.writeFileSync(path.join(vault, "two.md"), "# Other\nNo relation recorded.")
    fs.writeFileSync(path.join(dir, "outside.md"), "Private")
    fs.symlinkSync(path.join(dir, "outside.md"), path.join(vault, "escape.md"))
    const output = readSourceNotes(vault, ["one.md", "two.md", "one.md"])
    assert.deepEqual(output.sources.map((item) => item.path), ["one.md", "two.md"])
    assert.equal(output.sources[0].markdown, markdown)
    assert.equal(output.sources[0].sha256, createHash("sha256").update(markdown).digest("hex"))
    assert.equal(output.sources[0].bytes, Buffer.byteLength(markdown))
    for (const invalid of [["../outside.md"], ["escape.md"], ["/etc/passwd"], ["one.txt"], [], [42]]) {
      assert.throws(() => readSourceNotes(vault, invalid))
    }
    const result = spawnSync(process.execPath, ["scripts/brain-sync.mjs", "read-notes", "--vault", vault,
      "--paths", '["one.md","two.md"]'], { encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), output)
    const pretty = spawnSync(process.execPath, ["scripts/brain-sync.mjs", "read-notes", "--vault", vault,
      "--paths", '["one.md","two.md"]', "--pretty"], { encoding: "utf8" })
    assert.equal(pretty.status, 0, pretty.stderr)
    assert.ok(pretty.stdout.split("\n").length > result.stdout.split("\n").length)
    assert.deepEqual(JSON.parse(pretty.stdout), output, "formatting must preserve full originals and their hashes")
    assert.equal(fs.readFileSync(path.join(vault, "one.md"), "utf8"), markdown)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
