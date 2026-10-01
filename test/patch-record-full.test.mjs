import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { patchDigest, renderPatchRecord } from "../src/patch-record.mjs"
import { verifyPatchPersistence } from "../src/patch-persistence.mjs"
import { auditDocument } from "../src/memory-lifecycle-audit.mjs"
import { governedRank, isRetrievable, parseMarkdown } from "../src/retrieval.mjs"

function tempVault() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-full-record-"))
  const vault = path.join(root, "vault")
  fs.mkdirSync(vault)
  return { root, vault }
}

function patch({ validUntil, supersedes, status = "active" } = {}) {
  return {
    claim: "Production approvals require an independent approver.",
    why_it_matters: "Independent approval prevents release owners from approving themselves.",
    scope: { applies: ["production releases"], excludes: ["development deployments"] },
    provenance: [{ kind: "file", value: "90 Evidence/Approval.md#E2" }],
    confidence: "high",
    suggested_type: "decision",
    lifecycle: {
      status,
      revalidate_when: ["policy owner changes", "approval process changes"],
      ...(validUntil === undefined ? {} : { valid_until: validUntil }),
      ...(supersedes === undefined ? {} : { supersedes }),
    },
  }
}

function writeRendered(vault, notePatch = patch(), notePath = "Policy.md") {
  const markdown = renderPatchRecord(notePatch)
  fs.writeFileSync(path.join(vault, notePath), markdown + "\nProject context and history may follow the owned record.\n")
  return markdown
}

test("patch digest sorts object keys while preserving array order and exact field text", () => {
  const value = patch()
  const reordered = {
    lifecycle: { revalidate_when: [...value.lifecycle.revalidate_when], status: "active" },
    suggested_type: "decision",
    confidence: "high",
    provenance: [{ value: "90 Evidence/Approval.md#E2", kind: "file" }],
    scope: { excludes: ["development deployments"], applies: ["production releases"] },
    why_it_matters: value.why_it_matters,
    claim: value.claim,
  }
  assert.equal(patchDigest(value), patchDigest(reordered))
  assert.notEqual(patchDigest(value), patchDigest(patch({ supersedes: [] })))
  const absentOptional = renderPatchRecord(value)
  const emptyOptional = renderPatchRecord(patch({ supersedes: [] }))
  assert.match(absentOptional, /lifecycle\.valid_until\.present: false/u)
  assert.match(absentOptional, /lifecycle\.supersedes\.present: false/u)
  assert.match(emptyOptional, /lifecycle\.supersedes\.present: true/u)
  assert.match(emptyOptional, /lifecycle\.supersedes\.count: 0/u)
  reordered.lifecycle.revalidate_when.reverse()
  assert.notEqual(patchDigest(value), patchDigest(reordered))
  reordered.lifecycle.revalidate_when.reverse()
  reordered.claim = "Production approvals require 2 independent approvers."
  assert.notEqual(patchDigest(value), patchDigest(reordered))

  const unsafeHeadingPatch = patch()
  unsafeHeadingPatch.claim = "Production [approvals] **need review**\n<svg>"
  const rendered = renderPatchRecord(unsafeHeadingPatch)
  assert.equal((rendered.match(/^# /gmu) ?? []).length, 1)
  assert.equal(rendered.split("\n").find((line) => line.startsWith("# ")), "# Production \\[approvals\\] \\*\\*need review\\*\\* \\<svg\\>")
  assert.ok(rendered.includes('claim: "Production \\u005bapprovals\\u005d \\u002a\\u002aneed review\\u002a\\u002a\\n\\u003csvg\\u003e"'))
  assert.doesNotMatch(rendered, /\n<svg>/u)
  const { root, vault } = tempVault()
  try {
    fs.writeFileSync(path.join(vault, "Policy.md"), rendered)
    const result = verifyPatchPersistence({ vault, patch: unsafeHeadingPatch, notePath: "Policy.md", full: true })
    assert.equal(result.valid, true, result.errors.join("; "))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("full verification checks the versioned record, digest, and frontmatter projection", () => {
  const { root, vault } = tempVault()
  try {
    const current = patch()
    const markdown = writeRendered(vault, current)
    const verified = verifyPatchPersistence({ vault, patch: current, notePath: "Policy.md", full: true, now: new Date("2026-09-30T12:00:00Z") })
    assert.deepEqual(verified, {
      valid: true,
      metadataOnly: false,
      persistenceOnly: true,
      semanticSupportVerified: false,
      checkedFields: [
        "record.format", "patch_digest", "claim", "why_it_matters", "scope.applies", "scope.excludes",
        "provenance", "confidence", "suggested_type", "lifecycle.status", "lifecycle.valid_until",
        "lifecycle.revalidate_when", "lifecycle.supersedes", "frontmatter.type", "frontmatter.confidence",
        "frontmatter.status", "frontmatter.patch_digest", "frontmatter.graphmory_record_format",
        "frontmatter.revalidate_when", "frontmatter.valid_until", "frontmatter.supersedes",
      ],
      errors: [],
    })
    assert.match(markdown, /^---\ntype: decision\nconfidence: high\nstatus: active\n/u)
    assert.match(markdown, /<!-- graphmory-patch-record:v1:start -->[\s\S]*<!-- graphmory-patch-record:v1:end -->/u)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("full record comparison permits whitespace-only field changes and rejects altered claims", () => {
  const { root, vault } = tempVault()
  try {
    const current = patch()
    const original = writeRendered(vault, current)
    const whitespaceOnly = original.replace(
      'claim: "Production approvals require an independent approver."',
      'claim: "  Production   approvals require an independent approver.  "',
    )
    fs.writeFileSync(path.join(vault, "Policy.md"), whitespaceOnly)
    assert.equal(verifyPatchPersistence({ vault, patch: current, notePath: "Policy.md", full: true }).valid, true)

    fs.writeFileSync(path.join(vault, "Policy.md"), whitespaceOnly.replace(
      'claim: "  Production   approvals require an independent approver.  "',
      'claim: "  Production   approvals require no independent approver.  "',
    ))
    const result = verifyPatchPersistence({ vault, patch: current, notePath: "Policy.md", full: true })
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((error) => error.startsWith("claim ")))
    assert.doesNotMatch(JSON.stringify(result), /Production approvals|independent approver/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("full verification binds the recorded digest and provenance attribution", () => {
  const { root, vault } = tempVault()
  try {
    const current = patch()
    const rendered = writeRendered(vault, current)
    const digestChanged = rendered.replace(/patch_digest: "sha256:[^"]+"/u, 'patch_digest: "sha256:' + "0".repeat(64) + '"')
    fs.writeFileSync(path.join(vault, "Policy.md"), digestChanged)
    let result = verifyPatchPersistence({ vault, patch: current, notePath: "Policy.md", full: true })
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((error) => error.startsWith("patch_digest ")))
    assert.doesNotMatch(JSON.stringify(result), /sha256:/u)

    const attributionChanged = rendered.replace('provenance[0].kind: "file"', 'provenance[0].kind: "url"')
    fs.writeFileSync(path.join(vault, "Policy.md"), attributionChanged)
    result = verifyPatchPersistence({ vault, patch: current, notePath: "Policy.md", full: true })
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((error) => error.startsWith("provenance[0].kind ")))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("full verification rejects missing, quoted, fenced, duplicated, and duplicate-field records", () => {
  const { root, vault } = tempVault()
  try {
    const current = patch()
    const rendered = renderPatchRecord(current)
    const quoted = rendered.split("\n").map((line) => "> " + line).join("\n")
    fs.writeFileSync(path.join(vault, "Policy.md"), "# Policy\n\n" + quoted)
    let result = verifyPatchPersistence({ vault, patch: current, notePath: "Policy.md", full: true })
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((error) => /missing or ambiguous/u.test(error)))

    fs.writeFileSync(path.join(vault, "Policy.md"), "# Policy\n\n```markdown\n" + rendered + "```\n")
    result = verifyPatchPersistence({ vault, patch: current, notePath: "Policy.md", full: true })
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((error) => /missing or ambiguous/u.test(error)))

    fs.writeFileSync(path.join(vault, "Policy.md"), rendered + "\n" + rendered)
    result = verifyPatchPersistence({ vault, patch: current, notePath: "Policy.md", full: true })
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((error) => /multiple|ambiguous/u.test(error)))

    const duplicateField = rendered.replace("claim: ", "claim: \"extra\"\nclaim: ")
    fs.writeFileSync(path.join(vault, "Policy.md"), duplicateField)
    result = verifyPatchPersistence({ vault, patch: current, notePath: "Policy.md", full: true })
    assert.equal(result.valid, false)
    assert.ok(result.errors.includes("owned patch record contains duplicate fields"))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("full verification requires exact bidirectional predecessor links and rejects unsafe paths", () => {
  const { root, vault } = tempVault()
  try {
    const current = patch({ supersedes: ["Old.md"] })
    writeRendered(vault, current, "Current.md")
    fs.writeFileSync(path.join(vault, "Old.md"), "---\nstatus: superseded\nsuperseded_by: Current.md\n---\n# Old\nEarlier policy.\n")
    let result = verifyPatchPersistence({ vault, patch: current, notePath: "Current.md", full: true })
    assert.equal(result.valid, true, result.errors.join("; "))

    fs.writeFileSync(path.join(vault, "Old.md"), "---\nstatus: superseded\nsuperseded_by: Other.md\n---\n# Old\nEarlier policy.\n")
    result = verifyPatchPersistence({ vault, patch: current, notePath: "Current.md", full: true })
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((error) => /replacement link must point/u.test(error)))

    const unsafe = patch({ supersedes: ["../outside.md"] })
    writeRendered(vault, unsafe, "Unsafe.md")
    result = verifyPatchPersistence({ vault, patch: unsafe, notePath: "Unsafe.md", full: true })
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((error) => /predecessor path is missing, ambiguous, or unsafe/u.test(error)))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("full verification rejects contradictory or duplicated lifecycle frontmatter", () => {
  const { root, vault } = tempVault()
  try {
    const current = patch()
    const rendered = writeRendered(vault, current)
    fs.writeFileSync(path.join(vault, "Policy.md"), rendered.replace("status: active", "status: superseded"))
    let result = verifyPatchPersistence({ vault, patch: current, notePath: "Policy.md", full: true })
    assert.equal(result.valid, false)
    assert.ok(result.errors.includes("frontmatter.status differs from the patch"))

    fs.writeFileSync(path.join(vault, "Policy.md"), rendered.replace("status: active", "status: active\nstatus: superseded"))
    result = verifyPatchPersistence({ vault, patch: current, notePath: "Policy.md", full: true })
    assert.equal(result.valid, false)
    assert.ok(result.errors.includes("frontmatter.status is duplicated"))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("date-only expiry is inclusive through UTC day, timestamps need a zone, and warmed recall expires", () => {
  const document = parseMarkdown("today.md", "---\nstatus: active\nvalid_until: 2026-09-30\n---\n# Approval policy\nProduction approvals.")
  assert.equal(isRetrievable(document, { now: new Date("2026-09-30T23:59:59.999Z") }), true)
  assert.equal(isRetrievable(document, { now: new Date("2026-10-01T00:00:00.000Z") }), false)
  const warmed = [document]
  assert.equal(governedRank(warmed, "production approvals", "bm25", { now: new Date("2026-09-30T23:00:00Z") }).results.length, 1)
  assert.equal(governedRank(warmed, "production approvals", "bm25", { now: new Date("2026-10-01T00:00:00Z") }).results.length, 0)

  const malformed = parseMarkdown("bad.md", "---\nstatus: active\nvalid_until: 2026-02-30\n---\n# Bad\nInvalid expiry.")
  assert.equal(isRetrievable(malformed, { now: new Date("2026-02-01T00:00:00Z") }), false)
  assert.equal(auditDocument(malformed, new Date("2026-02-01T00:00:00Z")).some((item) => item.kind === "invalid-valid-until"), true)

  const timestamp = parseMarkdown("timestamp.md", "---\nstatus: active\nvalid_until: 2026-09-30T23:59:59Z\n---\n# Timed\nTimed expiry.")
  assert.equal(isRetrievable(timestamp, { now: new Date("2026-09-30T23:59:58.999Z") }), true)
  assert.equal(isRetrievable(timestamp, { now: new Date("2026-09-30T23:59:59.000Z") }), false)
  const offsetTimestamp = parseMarkdown("offset.md", "---\nstatus: active\nvalid_until: 2026-10-01T00:00:00+07:00\n---\n# Offset\nTimed expiry.")
  assert.equal(isRetrievable(offsetTimestamp, { now: new Date("2026-09-30T16:59:59.999Z") }), true)
  assert.equal(isRetrievable(offsetTimestamp, { now: new Date("2026-09-30T17:00:00.000Z") }), false)
  const subMillisecond = parseMarkdown("subms.md", "---\nstatus: active\nvalid_until: 2026-09-30T23:59:59.123456Z\n---\n# Submillisecond\nTimed expiry.")
  assert.equal(isRetrievable(subMillisecond, { now: new Date("2026-09-30T23:59:59.123Z") }), true)
  assert.equal(isRetrievable(subMillisecond, { now: new Date("2026-09-30T23:59:59.124Z") }), false)
  const timezoneMissing = parseMarkdown("zone.md", "---\nstatus: active\nvalid_until: 2026-09-30T23:59:59\n---\n# Zone\nInvalid expiry.")
  assert.equal(isRetrievable(timezoneMissing), false)

  const history = parseMarkdown("history.md", "---\nstatus: superseded\nvalid_until: 2020-01-01\n---\n# History\nOld policy.")
  assert.equal(isRetrievable(history), false)
  assert.equal(isRetrievable(history, { includeNoncanonical: true }), false)
  assert.equal(isRetrievable(history, { includeSuperseded: true }), true)
})

test("governed eligibility reuses corpus identity only inside its expiry window", () => {
  const document = parseMarkdown("today.md", "---\nstatus: active\nvalid_until: 2026-09-30\n---\n# Approval policy\nProduction approvals.")
  const documents = [document]
  const seen = []
  const capture = (now, options = {}) => {
    governedRank(documents, "approval policy", "bm25", {
      now: new Date(now),
      followLinks: false,
      rankImpl(eligible) { seen.push(eligible); return [] },
      ...options,
    })
    return seen.at(-1)
  }

  const beforeExpiry = capture("2026-09-30T12:00:00Z")
  assert.strictEqual(capture("2026-09-30T13:00:00Z"), beforeExpiry)
  const atExpiry = capture("2026-10-01T00:00:00Z")
  assert.notStrictEqual(atExpiry, beforeExpiry)
  assert.equal(atExpiry.length, 0)
  const afterClockRollback = capture("2026-09-30T14:00:00Z")
  assert.notStrictEqual(afterClockRollback, atExpiry)
  assert.equal(afterClockRollback.length, 1)
})

test("governed eligibility cache detects status, markdown, and valid_until alias mutation", () => {
  const document = parseMarkdown("mutable.md", "# Mutable memory\nA current decision.")
  const documents = [document]
  const seen = []
  const capture = (options = {}) => {
    governedRank(documents, "current decision", "bm25", {
      now: new Date("2026-09-30T12:00:00Z"),
      followLinks: false,
      rankImpl(eligible) { seen.push(eligible); return [] },
      ...options,
    })
    return seen.at(-1)
  }

  const current = capture()
  assert.strictEqual(capture(), current)
  document.metadata.status = "stale"
  const stale = capture()
  assert.notStrictEqual(stale, current)
  assert.equal(stale.length, 0)
  document.metadata.status = "active"
  document.markdown = "---\nstatus: active\nvalid_until: 2026-09-29\n---\n# Mutable memory\nA current decision."
  const expiredMarkdown = capture()
  assert.notStrictEqual(expiredMarkdown, stale)
  assert.equal(expiredMarkdown.length, 0)

  const metadataOnly = [{ id: "metadata-only", metadata: { status: "active" }, markdown: "# Metadata-only memory", text: "A current decision." }]
  const aliasSeen = []
  const captureAlias = () => {
    governedRank(metadataOnly, "current decision", "bm25", {
      now: new Date("2026-09-30T12:00:00Z"),
      followLinks: false,
      rankImpl(eligible) { aliasSeen.push(eligible); return [] },
    })
    return aliasSeen.at(-1)
  }
  const unexpired = captureAlias()
  metadataOnly[0].metadata["valid-until"] = "2026-09-29"
  const expiredAlias = captureAlias()
  assert.notStrictEqual(expiredAlias, unexpired)
  assert.equal(expiredAlias.length, 0)
})

test("full writes accept date-only expiry through that day and reject it at the next UTC midnight", () => {
  const { root, vault } = tempVault()
  try {
    const current = patch({ validUntil: "2026-09-30" })
    writeRendered(vault, current)
    assert.equal(verifyPatchPersistence({ vault, patch: current, notePath: "Policy.md", full: true, now: new Date("2026-09-30T23:59:59.999Z") }).valid, true)
    const expired = verifyPatchPersistence({ vault, patch: current, notePath: "Policy.md", full: true, now: new Date("2026-10-01T00:00:00.000Z") })
    assert.equal(expired.valid, false)
    assert.ok(expired.errors.includes("lifecycle.valid_until has expired for active authority"))

    const ambiguous = patch({ validUntil: "2026-09-30T23:59:59" })
    writeRendered(vault, ambiguous)
    const invalid = verifyPatchPersistence({ vault, patch: ambiguous, notePath: "Policy.md", full: true, now: new Date("2026-09-30T12:00:00Z") })
    assert.equal(invalid.valid, false)
    assert.ok(invalid.errors.some((error) => /invalid or lacks an explicit timezone/u.test(error)))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
