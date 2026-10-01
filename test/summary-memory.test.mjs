import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"
import { applySummaryFreshness, captureSummaryDependencies, inspectSummaryFreshness } from "../src/summary-memory.mjs"

function source(id, body, status = "active") {
  const markdown = `---\nstatus: ${status}\n---\n# ${id}\n\n${body}\n`
  return { id, markdown, metadata: { status } }
}

function summary(id, sourceEntries, { body = "Reviewed summary text.", status = "active" } = {}) {
  const markdown = `---\nmemory_kind: summary\nstatus: ${status}\nsummary_sources:\n${sourceEntries.map((entry) => `  - ${entry}`).join("\n")}\n---\n# ${id}\n\n${body}\n`
  return { id, markdown, metadata: { memory_kind: "summary", status, summary_sources: [...sourceEntries] } }
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

test("captureSummaryDependencies records sorted, exact UTF-8 content hashes", () => {
  const documents = [
    source("Reference/Policy with spaces.md", "Keep the evidence linked."),
    source("Reference/Alpha.md", "Résumé supports the claim."),
  ]

  assert.deepEqual(captureSummaryDependencies(documents, [
    "Reference/Policy with spaces.md",
    "Reference/Alpha.md",
    "Reference/Policy with spaces.md",
  ]), [
    `${sha256(documents[1].markdown)} Reference/Alpha.md`,
    `${sha256(documents[0].markdown)} Reference/Policy with spaces.md`,
  ])
})

test("freshness accepts an unchanged active source and detects changed content", () => {
  const original = source("Reference/Policy.md", "Use the reviewed rollout window.")
  const entries = captureSummaryDependencies([original], [original.id])
  const brief = summary("Summaries/Rollout.md", entries)

  assert.deepEqual(inspectSummaryFreshness([original, brief], brief.id), {
    path: brief.id,
    status: "fresh",
    reasons: [],
  })

  const edited = source(original.id, "Use the reviewed rollout window and owner.")
  const stale = inspectSummaryFreshness([edited, brief], brief.id)
  assert.equal(stale.status, "stale")
  assert.deepEqual(stale.reasons.map((reason) => reason.code), ["source-changed"])
  assert.equal(stale.reasons[0].path, original.id)
})

test("freshness detects removed and superseded sources, including unchanged bytes", () => {
  const original = source("Reference/Policy.md", "Retain the reviewed control.")
  const brief = summary("Summaries/Control.md", captureSummaryDependencies([original], [original.id]))

  const removed = inspectSummaryFreshness([brief], brief.id)
  assert.equal(removed.status, "stale")
  assert.equal(removed.reasons[0].code, "source-missing")

  const superseded = { ...original, metadata: { status: "superseded" } }
  const staleLifecycle = inspectSummaryFreshness([superseded, brief], brief.id)
  assert.equal(staleLifecycle.status, "stale")
  assert.ok(staleLifecycle.reasons.some((reason) => reason.code === "source-inactive" && reason.sourceStatus === "superseded"))
})

test("freshness follows transitive summary dependencies", () => {
  const evidence = source("Evidence/Release.md", "The release requires two approvals.")
  const evidenceEntry = captureSummaryDependencies([evidence], [evidence.id])
  const inner = summary("Summaries/Release.md", evidenceEntry)
  const outer = summary("Summaries/Release-brief.md", captureSummaryDependencies([inner], [inner.id]))

  const fresh = inspectSummaryFreshness([evidence, inner, outer], outer.id)
  assert.equal(fresh.status, "fresh")

  const editedEvidence = source(evidence.id, "The release requires three approvals.")
  const stale = inspectSummaryFreshness([editedEvidence, inner, outer], outer.id)
  assert.equal(stale.status, "stale")
  const transitive = stale.reasons.find((reason) => reason.code === "summary-dependency-stale")
  assert.equal(transitive.path, inner.id)
  assert.ok(transitive.causes.includes("source-changed"))
})

test("summary dependency cycles are stale", () => {
  const cycleEntry = "0".repeat(64)
  const first = summary("Summaries/First.md", [`${cycleEntry} Summaries/Second.md`])
  const second = summary("Summaries/Second.md", [`${cycleEntry} Summaries/First.md`])

  const report = inspectSummaryFreshness([first, second], first.id)
  assert.equal(report.status, "stale")
  assert.ok(report.reasons.some((reason) => reason.code === "summary-dependency-stale" && reason.causes.includes("summary-cycle")))
  assert.equal(inspectSummaryFreshness([first, second], second.id).status, "stale")
})

test("unsafe dependency paths are rejected and case changes affect the hash", () => {
  assert.throws(() => captureSummaryDependencies([], ["../outside.md"]), /inside the vault|canonical/u)
  assert.throws(() => captureSummaryDependencies([], ["/outside.md"]), /inside the vault/u)

  const original = source("Reference/Policy.md", "Keep Case-sensitive evidence.")
  const brief = summary("Summaries/Policy.md", captureSummaryDependencies([original], [original.id]))
  const cased = source(original.id, "Keep case-sensitive evidence.")
  const report = inspectSummaryFreshness([cased, brief], brief.id)
  assert.equal(report.status, "stale")
  assert.equal(report.reasons[0].code, "source-changed")

  const unsafeMetadata = summary("Summaries/Unsafe.md", [`${"0".repeat(64)} ../outside.md`])
  const unsafeReport = inspectSummaryFreshness([unsafeMetadata], unsafeMetadata.id)
  assert.equal(unsafeReport.status, "stale")
  assert.ok(unsafeReport.reasons.some((reason) => reason.code === "source-path-unsafe"))
})

test("applySummaryFreshness marks only stale summary copies and returns reports", () => {
  const currentSource = source("Reference/Current.md", "Still accurate.")
  const oldSource = source("Reference/Old.md", "Old text.")
  const currentSummary = summary("Summaries/Current.md", captureSummaryDependencies([currentSource], [currentSource.id]))
  const oldSummary = summary("Summaries/Old.md", captureSummaryDependencies([oldSource], [oldSource.id]))
  const input = [currentSource, oldSource, currentSummary, oldSummary]
  const updatedSource = source(oldSource.id, "Updated text.")

  const applied = applySummaryFreshness([currentSource, updatedSource, currentSummary, oldSummary])
  const byPath = new Map(applied.documents.map((document) => [document.id, document]))

  assert.equal(byPath.get(currentSummary.id).metadata.status, "active")
  assert.equal(byPath.get(oldSummary.id).metadata.status, "stale")
  assert.equal(applied.freshCount, 1)
  assert.equal(applied.staleCount, 1)
  assert.deepEqual(applied.summaries.map((report) => report.path), [currentSummary.id, oldSummary.id])
  assert.equal(input[3].metadata.status, "active", "source documents are not mutated")
})
