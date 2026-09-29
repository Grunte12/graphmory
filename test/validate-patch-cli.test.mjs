import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(repoRoot, "scripts", "brain-sync.mjs")
const examplePatch = JSON.parse(fs.readFileSync(path.join(repoRoot, "examples", "memory-patch.json"), "utf8"))

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-validate-patch-"))
}

function run(args) {
  return spawnSync(process.execPath, [cli, "validate-patch", ...args], { cwd: repoRoot, encoding: "utf8" })
}

function assertVaultUnchanged(vault, original) {
  assert.deepEqual(fs.readdirSync(vault), ["Canonical.md"])
  assert.equal(fs.readFileSync(path.join(vault, "Canonical.md"), "utf8"), original)
}

test("validate-patch accepts a valid patch and emits only compact schema status", () => {
  const root = tempRoot()
  try {
    const input = path.join(root, "patch.json")
    fs.writeFileSync(input, JSON.stringify(examplePatch))
    const result = run(["--input", input, "--agent"])
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), { valid: true, schemaOnly: true, errors: [] })
    assert.equal(result.stderr, "")
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("invalid provenance is rejected without exposing patch text or changing a vault", () => {
  const root = tempRoot()
  try {
    const vault = path.join(root, "vault")
    fs.mkdirSync(vault)
    const before = "# Canonical\nKeep this unchanged.\n"
    fs.writeFileSync(path.join(vault, "Canonical.md"), before)
    const input = path.join(root, "patch.json")
    fs.writeFileSync(input, JSON.stringify({ ...examplePatch, claim: "PRIVATE_PATCH_SENTINEL claim text", provenance: [] }))

    const result = run(["--input", input, "--agent", "--json"])
    assert.equal(result.status, 1)
    const body = JSON.parse(result.stdout)
    assert.equal(body.valid, false)
    assert.equal(body.schemaOnly, true)
    assert.match(body.errors.join("\n"), /provenance/)
    assert.doesNotMatch(result.stdout, /PRIVATE_PATCH_SENTINEL/)
    assert.equal(result.stderr, "")
    assertVaultUnchanged(vault, before)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("malformed JSON gets a generic error without echoing the input", () => {
  const root = tempRoot()
  try {
    const input = path.join(root, "patch.json")
    fs.writeFileSync(input, '{"secret":"PRIVATE_JSON_SENTINEL"')
    const result = run(["--input", input])
    assert.equal(result.status, 1)
    assert.deepEqual(JSON.parse(result.stdout), {
      valid: false,
      schemaOnly: true,
      errors: ["input file is not valid JSON"],
    })
    assert.doesNotMatch(result.stdout, /PRIVATE_JSON_SENTINEL/)
    assert.equal(result.stderr, "")
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("missing input and missing files return controlled JSON errors", () => {
  const root = tempRoot()
  try {
    const missingInput = run(["--agent"])
    assert.equal(missingInput.status, 2)
    assert.deepEqual(JSON.parse(missingInput.stdout), {
      valid: false,
      schemaOnly: true,
      errors: ["--input is required"],
    })

    const missingFile = run(["--input", path.join(root, "absent.json"), "--json"])
    assert.equal(missingFile.status, 1)
    assert.deepEqual(JSON.parse(missingFile.stdout), {
      valid: false,
      schemaOnly: true,
      errors: ["input file cannot be read"],
    })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
