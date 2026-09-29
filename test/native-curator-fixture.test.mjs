import assert from "node:assert/strict"
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { validateMemoryPatch } from "../src/contracts.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const generator = path.join(repoRoot, "scripts", "prepare-native-curator-smoke.mjs")

function runGenerator(output) {
  return spawnSync(process.execPath, [generator, "--out", output], { cwd: repoRoot, encoding: "utf8" })
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function listFiles(root, directory = root) {
  const result = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    assert.equal(entry.isSymbolicLink(), false, `unexpected symlink: ${absolute}`)
    if (entry.isDirectory()) result.push(...listFiles(root, absolute))
    else if (entry.isFile()) result.push(path.relative(root, absolute).split(path.sep).join("/"))
  }
  return result.sort()
}

test("native Curator fixture schemas, hashes, and fresh-output guard are reproducible", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-native-curator-fixture-test-"))
  try {
    const output = path.join(tempRoot, "fixture")
    const generated = runGenerator(output)
    assert.equal(generated.status, 0, generated.stderr)
    const result = JSON.parse(generated.stdout)
    assert.equal(result.created, true)

    const scenario = JSON.parse(fs.readFileSync(path.join(output, "scenario.json"), "utf8"))
    assert.deepEqual(scenario.cases.map((item) => item.id), [
      "01-approved-supersession",
      "02-missing-provenance",
      "03-unresolved-current-conflict",
    ])

    const patches = scenario.cases.map((item) => JSON.parse(fs.readFileSync(path.join(output, item.patch), "utf8")))
    assert.deepEqual(patches.map((patch) => validateMemoryPatch(patch).valid), [true, false, true])
    assert.equal(Object.hasOwn(patches[1], "provenance"), false)
    assert.equal(patches[2].suggested_type, "tension")

    for (const item of scenario.cases) {
      const vault = path.join(output, item.vault)
      const sourceManifest = JSON.parse(fs.readFileSync(path.join(output, item.sourceHashes), "utf8"))
      const baseline = JSON.parse(fs.readFileSync(path.join(output, item.vaultBaseline), "utf8"))
      const actualPaths = listFiles(vault)
      assert.deepEqual(baseline.files.map((file) => file.path), actualPaths)

      for (const file of sourceManifest.files) {
        const bytes = fs.readFileSync(path.join(vault, file.path))
        assert.equal(bytes.length, file.bytes, `${item.id} source byte count: ${file.path}`)
        assert.equal(sha256(bytes), file.sha256, `${item.id} source hash: ${file.path}`)
      }
      for (const file of baseline.files) {
        const bytes = fs.readFileSync(path.join(vault, file.path))
        assert.equal(bytes.length, file.bytes, `${item.id} baseline byte count: ${file.path}`)
        assert.equal(sha256(bytes), file.sha256, `${item.id} baseline hash: ${file.path}`)
      }
    }

    const sentinel = path.join(output, "keep-me.txt")
    fs.writeFileSync(sentinel, "existing fixture must not be overwritten\n")
    const scenarioBefore = fs.readFileSync(path.join(output, "scenario.json"), "utf8")
    const refused = runGenerator(output)
    assert.equal(refused.status, 1)
    assert.match(refused.stderr, /fresh directory; existing paths are never overwritten/)
    assert.equal(fs.readFileSync(sentinel, "utf8"), "existing fixture must not be overwritten\n")
    assert.equal(fs.readFileSync(path.join(output, "scenario.json"), "utf8"), scenarioBefore)
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})
