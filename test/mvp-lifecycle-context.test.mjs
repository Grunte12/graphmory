import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { auditDocument, auditDocuments, auditMemoryLifecycle } from "../src/memory-lifecycle-audit.mjs"
import { parseMarkdown } from "../src/retrieval.mjs"

const NOW = new Date("2026-10-01T00:00:00.000Z")
const RUNBOOK = "01 Projects/HelioForge/Migration Runbook.md"
const PREDECESSOR = "01 Projects/HelioForge/Batch Policy.md"
const SUCCESSOR = "01 Projects/HelioForge/Recovery Window Policy.md"

function document(id, markdown) {
  return parseMarkdown(id, markdown)
}

function helioforgeHistory({
  runbookBody = "Major-migration recovery runs under [[Recovery Window Policy]]. See [[Batch Policy]] for the superseded predecessor.",
  predecessorStatus = "superseded",
  replacementPath = SUCCESSOR,
  successorStatus = "active",
  successorSupersedes = PREDECESSOR,
  successorValidUntil = "",
} = {}) {
  const successorDate = successorValidUntil ? `valid_until: ${successorValidUntil}\n` : ""
  return [
    document(RUNBOOK, `---\nstatus: active\ncanonical_memory: true\n---\n# HelioForge migration runbook\n\n${runbookBody}\n`),
    document(PREDECESSOR, `---\nstatus: ${predecessorStatus}\nsuperseded_by: "${replacementPath}"\n---\n# HelioForge migration batch policy\n\nThe earlier recovery cadence.\n`),
    document(SUCCESSOR, `---\nstatus: ${successorStatus}\n${successorDate}supersedes:\n  - "${successorSupersedes}"\n---\n# HelioForge recovery window policy\n\nThe current recovery cadence.\n`),
  ]
}

function hasFinding(findings, file, kind) {
  return findings.some((item) => item.file === file && item.kind === kind)
}

function auditComplete(documents) {
  return auditDocuments(documents, NOW, { inventoryComplete: true })
}

test("batch audit exempts only the saved Runbook historical predecessor phrase", () => {
  const documents = helioforgeHistory()
  const findings = auditComplete(documents)

  assert.equal(hasFinding(findings, RUNBOOK, "active-note-has-stale-language"), false)
  assert.equal(hasFinding(auditDocument(documents[0], NOW), RUNBOOK, "active-note-has-stale-language"), true,
    "standalone auditDocument keeps its context-free behavior")
  assert.equal(hasFinding(auditDocuments(documents, NOW), RUNBOOK, "active-note-has-stale-language"), true,
    "batch auditing fails closed unless a caller confirms its relationship inventory is complete")
})

test("batch audit recognizes the saved Runbook wording for a proven superseded prior rule", () => {
  const documents = helioforgeHistory({
    runbookBody: "Major-migration recovery runs under [[Recovery Window Policy]]. Keep the queue and monitoring notes with each recovery window. See [[HelioForge Change Record]] for the approved owner decision, [[Batch Policy]] for the superseded prior rule, and [[HelioForge Recovery Window 2025]] for expired history.",
  })

  assert.equal(hasFinding(auditComplete(documents), RUNBOOK, "active-note-has-stale-language"), false)

  const withSelfStaleClaim = helioforgeHistory({
    runbookBody: "Major-migration recovery runs under [[Recovery Window Policy]]. [[Batch Policy]] is the superseded prior rule; this runbook itself is stale.",
  })
  assert.equal(hasFinding(auditComplete(withSelfStaleClaim), RUNBOOK, "active-note-has-stale-language"), true,
    "the additional stale assertion remains visible even in the same sentence")
})

test("stale terms in frontmatter and non-prose are ignored while a body claim remains visible", () => {
  const notePath = "01 Projects/HelioForge/Example.md"
  const nonProseOnly = document(notePath, [
    "---", "status: active", "comment: obsolete", "---", "# Example", "",
    "```text", "superseded", "```", "", "<!-- deprecated -->", "",
  ].join("\n"))
  assert.equal(hasFinding(auditDocument(nonProseOnly, NOW), notePath, "active-note-has-stale-language"), false)

  const bodyClaim = document(notePath, [
    "---", "status: active", "comment: obsolete", "---", "# Example", "",
    "```text", "superseded", "```", "", "<!-- deprecated -->", "", "This policy is stale.", "",
  ].join("\n"))
  assert.equal(hasFinding(auditDocument(bodyClaim, NOW), notePath, "active-note-has-stale-language"), true)
})

test("exact reciprocal history links work across folders without folder-based scope assumptions", () => {
  const mentionerPath = "01 Projects/Alpha/Runbook.md"
  const predecessorPath = "03 Reference/Beta/Batch Policy.md"
  const successorPath = "04 Decisions/Gamma/Recovery Policy.md"
  const documents = [
    document(mentionerPath, `---\nstatus: active\n---\n# Runbook\n\nSee [[${successorPath}]]. Refer to [[${predecessorPath}]] for the superseded predecessor.\n`),
    document(predecessorPath, `---\nstatus: superseded\nsuperseded_by: "${successorPath}"\n---\n# Batch Policy\n\nEarlier rule.\n`),
    document(successorPath, `---\nstatus: active\nsupersedes:\n  - "${predecessorPath}"\n---\n# Recovery Policy\n\nCurrent rule.\n`),
  ]

  assert.equal(hasFinding(auditComplete(documents), mentionerPath, "active-note-has-stale-language"), false)
})

test("a separate self-stale claim in the same sentence remains a finding", () => {
  const documents = helioforgeHistory({
    runbookBody: "See [[Batch Policy]] for the superseded predecessor; this runbook is stale.",
  })

  assert.equal(hasFinding(auditComplete(documents), RUNBOOK, "active-note-has-stale-language"), true)
})

test("unproven, ambiguous, incomplete, unknown, or expired history keeps the stale finding", () => {
  const cases = [
    ["predecessor missing", [helioforgeHistory()[0], helioforgeHistory()[2]]],
    ["successor missing from filtered inventory", helioforgeHistory().slice(0, 2)],
    ["filtered inventory explicitly marked incomplete", helioforgeHistory()],
    ["unknown predecessor", helioforgeHistory({ predecessorStatus: "unknown" })],
    ["wrong predecessor replacement", helioforgeHistory({ replacementPath: "01 Projects/HelioForge/Other Policy.md" })],
    ["successor does not reciprocate", helioforgeHistory({ successorSupersedes: "01 Projects/HelioForge/Other Policy.md" })],
    ["successor is not current", helioforgeHistory({ successorStatus: "unknown" })],
    ["successor expired", helioforgeHistory({ successorValidUntil: "2026-09-30" })],
    ["mentioner does not link successor", helioforgeHistory({ runbookBody: "See [[Batch Policy]] for the superseded predecessor." })],
    ["phrase is not bound to predecessor link", helioforgeHistory({ runbookBody: "The superseded policy is historical; see [[Recovery Window Policy]]." })],
    ["held-out wording with a broken reciprocal chain", helioforgeHistory({
      runbookBody: "See [[Recovery Window Policy]]. Refer to [[Batch Policy]] for the superseded prior rule.",
      successorSupersedes: "01 Projects/HelioForge/Other Policy.md",
    })],
    ["standalone stale mention remains visible", helioforgeHistory({
      runbookBody: "See [[Recovery Window Policy]]. This runbook is stale.",
    })],
  ]

  const ambiguous = [
    document(RUNBOOK, `---\nstatus: active\n---\n# Migration Runbook\n\nSee [[Recovery Window Policy]]. See [[Batch Policy]] for the superseded predecessor.\n`),
    document("02 Projects/HelioForge Archive/Batch Policy.md", `---\nstatus: superseded\nsuperseded_by: "01 Projects/HelioForge/Recovery Window Policy.md"\n---\n# Archived Batch Policy\n\nEarlier rule.\n`),
    document("03 Projects/Other/Batch Policy.md", `---\nstatus: superseded\nsuperseded_by: "01 Projects/HelioForge/Recovery Window Policy.md"\n---\n# Other Batch Policy\n\nOther project predecessor.\n`),
    document(SUCCESSOR, `---\nstatus: active\nsupersedes:\n  - "02 Projects/HelioForge Archive/Batch Policy.md"\n---\n# HelioForge recovery window policy\n\nCurrent rule.\n`),
  ]
  cases.push(["ambiguous basename", ambiguous])

  for (const [name, documents] of cases) {
    const options = { inventoryComplete: name !== "filtered inventory explicitly marked incomplete" }
    assert.equal(hasFinding(auditDocuments(documents, NOW, options), RUNBOOK, "active-note-has-stale-language"), true, name)
  }
})

test("history exemption does not remove invalid-date, conflict, or successor-expiry blockers", () => {
  const documents = helioforgeHistory()
  documents[0] = document(RUNBOOK, `---\nstatus: active\nvalid_until: not-a-date\n---\n# Migration Runbook\n\nMajor-migration recovery runs under [[Recovery Window Policy]]. See [[Batch Policy]] for the superseded predecessor.\n`)
  documents.push(document("03 Projects/Conflict.md", `---\nstatus: tension\n---\n# Conflict\n\nThe two accounts remain inconsistent.\n`))

  const findings = auditComplete(documents)
  assert.equal(hasFinding(findings, RUNBOOK, "active-note-has-stale-language"), false)
  assert.equal(hasFinding(findings, RUNBOOK, "invalid-valid-until"), true)
  assert.equal(hasFinding(findings, "03 Projects/Conflict.md", "tension-without-decision-path"), true)

  const expired = auditComplete(helioforgeHistory({ successorValidUntil: "2026-09-30" }))
  assert.equal(hasFinding(expired, RUNBOOK, "active-note-has-stale-language"), true)
  assert.equal(hasFinding(expired, SUCCESSOR, "expired-valid-until"), true)
})

test("tension decision paths require affirmative details, not bare or negated keywords", () => {
  const pathCases = [
    ["bare keyword mention", "The owner, evidence, and decision remain unknown."],
    ["negated decision", "No decision yet."],
    ["empty and unresolved fields", "Decision:\nOwner: unassigned\nNext step: none"],
  ]
  for (const [name, body] of pathCases) {
    const note = document("03 Projects/Conflict.md", `---\nstatus: tension\n---\n# Conflict\n\n${body}\n`)
    assert.equal(hasFinding(auditDocument(note, NOW), note.id, "tension-without-decision-path"), true, name)
  }

  const affirmativeCases = [
    "Decision: defer selection until the independent source review on 2026-10-15.",
    "Owner: Maya Chen\nNext step: compare both signed source records at the 2026-10-15 review.",
    "The platform owner will reconcile both records after the scheduled review on 2026-10-15.",
  ]
  for (const body of affirmativeCases) {
    const note = document("03 Projects/Conflict.md", `---\nstatus: tension\n---\n# Conflict\n\nThe accounts remain inconsistent.\n\n${body}\n`)
    assert.equal(hasFinding(auditDocument(note, NOW), note.id, "tension-without-decision-path"), false, body)
  }
})

test("conflict detection ignores code and comments but retains body and metadata markers", () => {
  const notePath = "03 Projects/Conflict.md"
  const examplesOnly = document(notePath, [
    "---", "status: active", "---", "# Example", "",
    "```markdown", "TENSION", "Decision: the owner will review both records after the audit.", "```",
    "<!-- TENSION -->", "",
  ].join("\n"))
  assert.equal(hasFinding(auditDocument(examplesOnly, NOW), notePath, "tension-without-decision-path"), false)

  const bodyMarker = document(notePath, [
    "---", "status: active", "---", "# Conflict", "", "TENSION", "The accounts remain inconsistent.", "",
  ].join("\n"))
  assert.equal(hasFinding(auditDocument(bodyMarker, NOW), notePath, "tension-without-decision-path"), true)

  const metadataMarker = document(notePath, [
    "---", "status: tension", "---", "# Conflict", "",
    "```markdown", "Decision: the owner will review both records after the audit.", "```", "",
  ].join("\n"))
  assert.equal(hasFinding(auditDocument(metadataMarker, NOW), notePath, "tension-without-decision-path"), true)
})

test("default lifecycle audit uses hidden raw notes for ambiguity without auditing them", () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-lifecycle-context-"))
  const files = {
    "Projects/Runbook.md": `---\nstatus: active\n---\n# Runbook\n\nSee [[Replacement]]. See [[Batch Policy]] for the superseded predecessor.\n`,
    "Reference/Batch Policy.md": `---\nstatus: superseded\nsuperseded_by: "Projects/Replacement.md"\n---\n# Batch Policy\n\nEarlier rule.\n`,
    "Projects/Replacement.md": `---\nstatus: active\nsupersedes:\n  - "Reference/Batch Policy.md"\n---\n# Replacement\n\nCurrent rule.\n`,
    "00 Inbox/Batch Policy.md": `# Batch Policy\n\nUntriaged capture with the same title.\n`,
  }
  try {
    for (const [relative, markdown] of Object.entries(files)) {
      const absolute = path.join(vault, relative)
      fs.mkdirSync(path.dirname(absolute), { recursive: true })
      fs.writeFileSync(absolute, markdown)
    }

    const report = auditMemoryLifecycle(vault, { now: NOW, maxFiles: 100 })
    assert.equal(report.scanned, 3, "raw inbox notes remain outside the audited document set")
    assert.equal(report.findings.some((item) => item.file === "00 Inbox/Batch Policy.md"), false)
    assert.equal(hasFinding(report.findings, "Projects/Runbook.md", "active-note-has-stale-language"), true,
      "the raw duplicate makes the unqualified basename link ambiguous in the relationship inventory")

    const capped = auditMemoryLifecycle(vault, { now: NOW, maxFiles: 3 })
    assert.equal(capped.scanLimitReached, true, "the visible-note scan cap keeps its existing meaning")
    assert.equal(hasFinding(capped.findings, "Projects/Runbook.md", "active-note-has-stale-language"), true,
      "a capped relationship inventory cannot prove a history exemption")
  } finally {
    fs.rmSync(vault, { recursive: true, force: true })
  }
})
