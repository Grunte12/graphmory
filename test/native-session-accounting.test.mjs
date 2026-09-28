import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import test from "node:test"

test("session A/B summary rejects pending, duplicate and unordered slots before scoring", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-session-accounting-"))
  try {
    const prepared = path.join(scratch, "prepared"), runs = path.join(scratch, "runs")
    fs.mkdirSync(prepared); fs.mkdirSync(runs)
    const manifest = JSON.stringify({ plannedTrials: 4 })
    fs.writeFileSync(path.join(prepared, "manifest.json"), manifest)
    for (const [name, attempts, error] of [
      ["pending", [{ index: 0 }], "Pending trials cannot be scored"],
      ["duplicate", [{ index: 0 }, { index: 1 }, { index: 1 }, { index: 3 }], "Duplicate attempt"],
      ["unordered", [{ index: 0 }, { index: 2 }, { index: 1 }, { index: 3 }], "Unknown or unordered attempt"],
    ]) {
      fs.writeFileSync(path.join(runs, "ledger.json"), JSON.stringify({ manifestSha256: createHash("sha256").update(manifest).digest("hex"), attempts, stopped: null }))
      const output = path.join(scratch, name)
      const child = spawnSync("python3", ["scripts/summarize-native-session-ab.py", "--prepared", prepared, "--runs", runs, "--scorer-source", "unused", "--out", output], { encoding: "utf8" })
      assert.notEqual(child.status, 0)
      assert.ok(child.stderr.includes(error), child.stderr)
      assert.equal(fs.existsSync(output), false)
    }
  } finally { fs.rmSync(scratch, { recursive: true, force: true }) }
})
