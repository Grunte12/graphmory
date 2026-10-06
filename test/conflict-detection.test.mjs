import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { createMemoryEngine } from "../src/mcp-engine.mjs"
import { findOverlappingNotes } from "../src/conflict-detection.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"

const config = { ...DEFAULT_RUNTIME_CONFIG, retrievalMode: "lexical" }
const digest = (value) => createHash("sha256").update(value).digest("hex")
const OLD_PRICE = "---\ntype: decision\nstatus: active\n---\n# Pro plan pricing\n\nThe Pro plan costs 19 dollars per month for each seat.\n"

function fixture(t, notes = { "Pricing.md": OLD_PRICE }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-conflict-"))
  const vault = path.join(root, "vault")
  fs.mkdirSync(vault)
  for (const [name, text] of Object.entries(notes)) fs.writeFileSync(path.join(vault, name), text)
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return { vault, engine: createMemoryEngine({ vault, stateRoot: path.join(root, "state"), config }) }
}

function request({ claim = "The Pro plan costs 29 dollars per month for each seat.", target = "Pro Plan Price.md", supersedes = [], targetHashes, reviewedConflicts, type = "decision" } = {}) {
  const scope = { applies: ["pro plan pricing"], excludes: ["enterprise contracts"] }
  const quote = "Owner set the new Pro price."
  const patch = { claim, why_it_matters: "Quotes and invoices must use the current Pro price.", scope, provenance: [{ kind: "user-statement", value: quote }],
    confidence: "high", suggested_type: type, lifecycle: { status: "active", revalidate_when: ["pricing changes"], supersedes } }
  return { claim, scope, evidence: [{ quote }], curation: { patch, target, targetHashes: targetHashes ?? { [target]: null }, supportVerified: true, conflictsReviewed: true, authorized: true,
    ...(reviewedConflicts ? { reviewedConflicts } : {}) } }
}

test("a new price overlapping an active price returns TENSION with the note and its hash, and writes nothing", async (t) => {
  const f = fixture(t)
  const result = await f.engine.remember(request())
  assert.equal(result.status, "TENSION")
  assert.equal(result.code, "CONFLICT")
  assert.deepEqual(result.conflictingNotes, [{ path: "Pricing.md", hash: digest(OLD_PRICE) }])
  assert.equal(fs.existsSync(path.join(f.vault, "Pro Plan Price.md")), false)
})

test("naming every overlapping note by its current hash lets the write through", async (t) => {
  const f = fixture(t)
  const applied = await f.engine.remember(request({ reviewedConflicts: { "Pricing.md": digest(OLD_PRICE) } }))
  assert.equal(applied.status, "APPLIED", JSON.stringify(applied))
  assert.ok(fs.existsSync(path.join(f.vault, "Pro Plan Price.md")))
})

test("a note that changes after review asks again", async (t) => {
  const f = fixture(t)
  fs.writeFileSync(path.join(f.vault, "Pricing.md"), `${OLD_PRICE}\nUpdated after the host looked.\n`)
  const result = await f.engine.remember(request({ reviewedConflicts: { "Pricing.md": digest(OLD_PRICE) } }))
  assert.equal(result.status, "TENSION")
  assert.equal(result.conflictingNotes[0].hash, digest(`${OLD_PRICE}\nUpdated after the host looked.\n`))
})

test("an unrelated active note does not raise TENSION", async (t) => {
  const f = fixture(t, { "Pricing.md": OLD_PRICE, "Offsite.md": "---\ntype: decision\nstatus: active\n---\n# Team offsite\n\nThe offsite is in March at the lake house.\n" })
  const applied = await f.engine.remember(request({ reviewedConflicts: { "Pricing.md": digest(OLD_PRICE) } }))
  assert.equal(applied.status, "APPLIED", JSON.stringify(applied))
})

test("the notes a change supersedes, stale notes and other declared types are not reported", async (t) => {
  const f = fixture(t, {
    "Pricing.md": OLD_PRICE,
    "Stale price.md": "---\ntype: decision\nstatus: stale\n---\n# Pro plan pricing\n\nThe Pro plan costs 15 dollars per month for each seat.\n",
    "Price workflow.md": "---\ntype: workflow\nstatus: active\n---\n# Pro plan pricing\n\nThe Pro plan costs 29 dollars per month for each seat after quoting.\n",
  })
  const applied = await f.engine.remember(request({ supersedes: ["Pricing.md"], targetHashes: { "Pro Plan Price.md": null, "Pricing.md": digest(OLD_PRICE) } }))
  assert.equal(applied.status, "APPLIED", JSON.stringify(applied))
})

test("overlap needs three shared terms and 60 percent of the claim", () => {
  const patch = { claim: "The Pro plan costs 29 dollars per month for each seat.", scope: { applies: ["pro plan pricing"], excludes: [] }, suggested_type: "decision", lifecycle: { supersedes: [] } }
  const doc = (id, markdown) => ({ id, title: markdown.match(/^#\s+(.+)$/m)[1], metadata: {}, markdown })
  assert.equal(findOverlappingNotes({ documents: [doc("a.md", "# Pro plan\n\nCosts a lot.\n")], patch }).length, 0)
  assert.equal(findOverlappingNotes({ documents: [doc("b.md", "# Pro plan pricing\n\nThe Pro plan costs 19 dollars per month for each seat.\n")], patch }).length, 1)
  assert.deepEqual(findOverlappingNotes({ documents: [doc("b.md", "# Pro plan pricing\n\nThe Pro plan costs 19 dollars per month for each seat.\n")], patch, exclude: ["b.md"] }), [])
})

test("probe: first-line claims of the bundled eval vault do not overlap other notes", async () => {
  const { loadVaultDocuments } = await import("../src/memory-recall.mjs")
  const vault = new URL("../eval/real-vault/vault", import.meta.url).pathname
  if (!fs.existsSync(vault)) return
  const documents = loadVaultDocuments(vault)
  let flagged = 0
  for (const document of documents) {
    const claim = document.markdown.replace(/^---[\s\S]*?\n---\n?/u, "").split("\n").map((line) => line.trim()).find((line) => line.length > 30 && !line.startsWith("#"))
    if (!claim) continue
    const patch = { claim, scope: { applies: [document.title], excludes: [] }, suggested_type: "decision", lifecycle: { supersedes: [] } }
    if (findOverlappingNotes({ documents, patch, exclude: [document.id] }).length) flagged += 1
  }
  assert.equal(flagged, 0)
})
