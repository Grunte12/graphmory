import assert from "node:assert/strict"
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { verifyPatchPersistence } from "../src/patch-persistence.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(repoRoot, "scripts", "brain-sync.mjs")

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-patch-persistence-"))
}

function patch({ validUntil = undefined, triggers = ["policy owner changes", "approval process changes"] } = {}) {
  return {
    claim: "Production approvals require an independent approver.",
    why_it_matters: "Independent approval prevents release owners from approving themselves.",
    scope: { applies: ["production releases"], excludes: ["development deployments"] },
    provenance: [{ kind: "file", value: "90 Evidence/Approval.md#E2" }],
    confidence: "high",
    suggested_type: "decision",
    lifecycle: {
      status: "active",
      revalidate_when: triggers,
      ...(validUntil === undefined ? {} : { valid_until: validUntil }),
      supersedes: [],
    },
  }
}

function note({ status = "active", triggers = [], validUntil = undefined, body = "# Policy\n\nCanonical policy note.\n" } = {}) {
  const triggerYaml = triggers.length
    ? `revalidate_when:\n${triggers.map((trigger) => `  - ${JSON.stringify(trigger)}`).join("\n")}\n`
    : ""
  const validUntilYaml = validUntil === undefined ? "" : `valid_until: ${validUntil}\n`
  return `---\nstatus: ${status}\n${triggerYaml}${validUntilYaml}---\n${body}`
}

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: repoRoot, encoding: "utf8" })
}

function hash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function resultJson(result) {
  const body = JSON.parse(result.stdout)
  assert.deepEqual(Object.keys(body).sort(), ["checkedFields", "errors", "metadataOnly", "valid"])
  assert.equal(body.metadataOnly, true)
  return body
}

test("accepts reordered and extra multiline event triggers while checking supplied expiry separately", () => {
  const root = tempRoot()
  try {
    const vault = path.join(root, "vault")
    fs.mkdirSync(vault)
    fs.writeFileSync(path.join(vault, "Policy.md"), note({
      triggers: ["approval process changes", "unrelated extra review trigger", "policy owner changes"],
      validUntil: "2027-03-01",
    }))
    const result = verifyPatchPersistence({
      vault,
      patch: patch({ validUntil: "2027-03-01" }),
      notePath: "Policy.md",
    })
    assert.deepEqual(result, {
      valid: true,
      metadataOnly: true,
      checkedFields: ["lifecycle.status", "lifecycle.revalidate_when[0]", "lifecycle.revalidate_when[1]", "lifecycle.valid_until"],
      errors: [],
    })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("rejects a partially lost event list even when valid_until is present and exact", () => {
  const root = tempRoot()
  try {
    const vault = path.join(root, "vault")
    fs.mkdirSync(vault)
    fs.writeFileSync(path.join(vault, "Policy.md"), note({
      triggers: ["policy owner changes"],
      validUntil: "2027-03-01",
    }))
    const result = verifyPatchPersistence({
      vault,
      patch: patch({ validUntil: "2027-03-01" }),
      notePath: "Policy.md",
    })
    assert.equal(result.valid, false)
    assert.deepEqual(result.errors, ["lifecycle.revalidate_when[1] is missing from the note YAML list"])
    assert.equal(result.checkedFields.includes("lifecycle.valid_until"), true)
    assert.doesNotMatch(JSON.stringify(result), /policy owner changes|approval process changes/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("a date cannot stand in for missing event triggers, and existing expiry audit stays date-based", () => {
  const root = tempRoot()
  try {
    const vault = path.join(root, "vault")
    fs.mkdirSync(vault)
    const noteFile = path.join(vault, "Policy.md")
    fs.writeFileSync(noteFile, note({ validUntil: "2026-01-01" }))

    const checked = verifyPatchPersistence({
      vault,
      patch: patch({ validUntil: "2026-01-01" }),
      notePath: "Policy.md",
    })
    assert.equal(checked.valid, false)
    assert.match(checked.errors.join("\n"), /revalidate_when/)

    fs.writeFileSync(noteFile, note({
      triggers: ["policy owner changes", "approval process changes"],
      validUntil: "2026-01-01",
    }))
    const audit = runCli(["lifecycle-audit", "--vault", vault, "--now", "2026-07-01", "--json"])
    assert.equal(audit.status, 1)
    const auditBody = JSON.parse(audit.stdout)
    assert.equal(auditBody.findings.some((item) => item.kind === "expired-valid-until"), true)
    assert.equal(auditBody.findings.some((item) => item.kind === "revalidation-due"), false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("malformed input, missing note, path escape, and symlink escape fail safely without vault writes or content leakage", () => {
  const root = tempRoot()
  try {
    const vault = path.join(root, "vault")
    fs.mkdirSync(vault)
    const vaultNote = path.join(vault, "Policy.md")
    const original = "# Private policy sentinel\nDo not expose or modify this note.\n"
    fs.writeFileSync(vaultNote, original)
    const outside = path.join(root, "outside.md")
    fs.writeFileSync(outside, "# Outside sentinel\nThis file must not be read as a vault note.\n")
    fs.symlinkSync(outside, path.join(vault, "Escape.md"))
    const beforeVaultHash = hash(vaultNote)
    const validPatch = path.join(root, "patch.json")
    fs.writeFileSync(validPatch, JSON.stringify(patch()))
    const secretMalformedPatch = path.join(root, "malformed.json")
    fs.writeFileSync(secretMalformedPatch, '{"claim":"PATCH_SECRET_SENTINEL"')

    const malformed = runCli(["verify-patch-persistence", "--vault", vault, "--input", secretMalformedPatch, "--note", "Policy.md", "--agent"])
    assert.equal(malformed.status, 1)
    assert.deepEqual(resultJson(malformed), {
      valid: false,
      metadataOnly: true,
      checkedFields: [],
      errors: ["patch input cannot be read as valid JSON"],
    })
    assert.doesNotMatch(malformed.stdout, /PATCH_SECRET_SENTINEL/)

    const missing = runCli(["verify-patch-persistence", "--vault", vault, "--input", validPatch, "--note", "Missing.md", "--json"])
    assert.equal(missing.status, 1)
    assert.match(resultJson(missing).errors.join("\n"), /cannot be read safely/)

    const escaped = runCli(["verify-patch-persistence", "--vault", vault, "--input", validPatch, "--note", "../outside.md"])
    assert.equal(escaped.status, 1)
    assert.match(resultJson(escaped).errors.join("\n"), /cannot be read safely/)

    const symlink = runCli(["verify-patch-persistence", "--vault", vault, "--input", validPatch, "--note", "Escape.md"])
    assert.equal(symlink.status, 1)
    assert.match(resultJson(symlink).errors.join("\n"), /cannot be read safely/)
    assert.doesNotMatch(symlink.stdout, /Outside sentinel/)

    assert.equal(hash(vaultNote), beforeVaultHash)
    assert.equal(fs.readFileSync(vaultNote, "utf8"), original)
    assert.equal(fs.readFileSync(outside, "utf8"), "# Outside sentinel\nThis file must not be read as a vault note.\n")
    assert.deepEqual(fs.readdirSync(vault).sort(), ["Escape.md", "Policy.md"])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("rejects non-string valid_until input through the patch contract", () => {
  const root = tempRoot()
  try {
    const vault = path.join(root, "vault")
    fs.mkdirSync(vault)
    fs.writeFileSync(path.join(vault, "Policy.md"), note({ triggers: patch().lifecycle.revalidate_when }))
    const invalidPatch = patch({ triggers: patch().lifecycle.revalidate_when })
    invalidPatch.lifecycle.valid_until = 20270301
    const result = verifyPatchPersistence({ vault, patch: invalidPatch, notePath: "Policy.md" })
    assert.equal(result.valid, false)
    assert.deepEqual(result.checkedFields, [])
    assert.match(result.errors.join("\n"), /valid_until must be a string/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
