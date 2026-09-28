import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import test from "node:test"

test("native reader summary rejects pending, duplicate and unknown attempts before scoring", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-native-accounting-"))
  try {
    const prepared = path.join(scratch, "prepared"), runs = path.join(scratch, "runs")
    fs.mkdirSync(prepared); fs.mkdirSync(runs)
    const manifest = JSON.stringify({ cases: [{ id: "one", armOrder: ["basic", "graphmory"] }] })
    fs.writeFileSync(path.join(prepared, "manifest.json"), manifest)
    for (const [name, attempts, error] of [
      ["pending", [{ id: "one", arm: "basic" }], "Pending batch cannot be scored"],
      ["duplicate", [{ id: "one", arm: "basic" }, { id: "one", arm: "basic" }], "Duplicate attempts"],
      ["unknown", [{ id: "one", arm: "basic" }, { id: "other", arm: "graphmory" }], "Unknown or reordered attempt"],
    ]) {
      fs.writeFileSync(path.join(runs, "ledger.json"), JSON.stringify({ manifestSha256: createHash("sha256").update(manifest).digest("hex"), attempts, stopped: null }))
      const output = path.join(scratch, name)
      const result = spawnSync("python3", ["scripts/summarize-locomo-native-reader.py", "--prepared", prepared, "--runs", runs, "--scorer-source", "unused", "--out", output], { encoding: "utf8" })
      assert.notEqual(result.status, 0)
      assert.ok(result.stderr.includes(error), result.stderr)
      assert.equal(fs.existsSync(output), false)
    }
  } finally { fs.rmSync(scratch, { recursive: true, force: true }) }
})
