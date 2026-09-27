import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { managedRecall } from "../src/decision-recall.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"

test("incomplete or filtered previews require source inspection", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-incomplete-"))
  try {
    fs.writeFileSync(path.join(vault, "long.md"), `# Orion recovery\nOrion recovery requirements. ${"Context. ".repeat(80)}Restore backup.`)
    const long = await managedRecall(vault, "List all Orion recovery requirements", DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true })
    assert.equal(long.results[0].evidencePreview[0].truncated, true)
    assert.equal(long.results[0].sourceReadRequired, true)
    fs.writeFileSync(path.join(vault, "owner.md"), "# Orion owners\nOrion owner is Mira.")
    const filtered = await managedRecall(vault, "Compare all Orion owners and deadlines", DEFAULT_RUNTIME_CONFIG, { adaptiveBundle: true, matchedPreviews: true })
    const owner = filtered.results.find((item) => item.path === "owner.md")
    assert.ok(owner)
    assert.equal(owner.evidencePreview, undefined)
    assert.equal(owner.sourceReadRequired, true)
    const baseline = await managedRecall(vault, "Orion", DEFAULT_RUNTIME_CONFIG)
    assert.ok(baseline.results.every((item) => !Object.hasOwn(item, "sourceReadRequired")))
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})
