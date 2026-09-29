import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { managedRecall } from "../src/decision-recall.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"
import { spawnSync } from "node:child_process"

test("truncated previews require inspection while omitted previews describe presentation", async () => {
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
    assert.equal(owner.sourceReadRequired, undefined)
    assert.equal(owner.previewOmitted, true)
    const cli = spawnSync(process.execPath, ["scripts/brain-sync.mjs", "recall-managed", "--vault", vault,
      "--query", "Compare all Orion owners and deadlines", "--auto", "--matched-previews", "--agent"], { encoding: "utf8" })
    assert.equal(cli.status, 0, cli.stderr)
    const compactOwner = JSON.parse(cli.stdout).results.find((item) => item.path === "owner.md")
    assert.equal(compactOwner.previewOmitted, true)
    assert.equal(compactOwner.sourceReadRequired, undefined)
    const baseline = await managedRecall(vault, "Orion", DEFAULT_RUNTIME_CONFIG)
    assert.ok(baseline.results.every((item) => !Object.hasOwn(item, "sourceReadRequired")))
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})

test("preview states preserve complete ranking through byte-budget pagination", async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-preview-pages-"))
  try {
    for (let i = 0; i < 80; i++) fs.writeFileSync(path.join(vault, `note-${i}.md`), `# Orion recovery ${i}\nOrion recovery requirement ${i}. ${"Context. ".repeat(70)}Required backup ${i}.`)
    const collect = async (options) => {
      const paths = []
      let offset = 0, pages = 0
      while (true) {
        const page = await managedRecall(vault, "List all Orion recovery requirements", DEFAULT_RUNTIME_CONFIG, { ...options, offset })
        pages++
        paths.push(...page.results.map((item) => item.path))
        if (!page.hasMore) break
        assert.ok(page.nextOffset > offset)
        assert.ok(pages < 81)
        offset = page.nextOffset
      }
      return { paths, pages }
    }
    const baseline = await collect({})
    const treatment = await collect({ adaptiveBundle: true, matchedPreviews: true })
    const coverage = await collect({ adaptiveBundle: true, coveragePreviews: true })
    assert.deepEqual(treatment.paths, baseline.paths)
    assert.deepEqual(coverage.paths, baseline.paths)
    assert.equal(new Set(treatment.paths).size, 80)
    assert.ok(treatment.pages > 1)
  } finally { fs.rmSync(vault, { recursive: true, force: true }) }
})
