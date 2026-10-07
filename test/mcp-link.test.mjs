import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { createMemoryEngine } from "../src/mcp-engine.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"
import { loadVaultDocuments } from "../src/memory-recall.mjs"
import { buildNoteGraph } from "../src/graph-navigation.mjs"

const config = { ...DEFAULT_RUNTIME_CONFIG, retrievalMode: "lexical" }
const digest = value => createHash("sha256").update(value).digest("hex")
function fixture(t, notes) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-link-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const vault = path.join(root, "vault")
  for (const [file, text] of Object.entries(notes)) {
    fs.mkdirSync(path.dirname(path.join(vault, file)), { recursive: true })
    fs.writeFileSync(path.join(vault, file), text)
  }
  const engine = createMemoryEngine({ vault, stateRoot: path.join(root, "state"), config })
  const read = file => fs.readFileSync(path.join(vault, file), "utf8")
  return { vault, engine, read, hashOf: file => digest(read(file)) }
}
// One-note calls through the batch API; returns the note's entry merged with the batch status.
async function link(f, note) {
  const result = await f.engine.link({ notes: [note] })
  return result.notes ? { status: result.status, ...result.notes[0] } : result
}
const base = {
  "Projects/Cedar/Index.md": "# Cedar index\n",
  "Entities/Queue.md": "# Queue\n",
  "Evidence/Load test.md": "# Load test\n",
}

test("link adds relation properties as Obsidian wikilinks, keeps the note and is idempotent", async t => {
  const decision = "---\ntags: [cedar]\nrelated: Entities/Queue.md\n---\n# Cedar decision\n\nOwner text stays.\n"
  const f = fixture(t, { ...base, "Projects/Cedar/Decision.md": decision, "Plain.md": "# Plain\n\nNo frontmatter.\n" })
  const linked = await link(f, { path: "Projects/Cedar/Decision.md", hash: f.hashOf("Projects/Cedar/Decision.md"),
    add: [{ target: "Projects/Cedar/Index.md", relation: "part_of" }, { target: "Evidence/Load test.md", relation: "evidence_for" }, { target: "Entities/Queue.md", relation: "related" }] })
  assert.equal(linked.status, "LINKED", JSON.stringify(linked))
  assert.equal(linked.changes.length, 2, "the existing related link is not duplicated")
  const text = f.read("Projects/Cedar/Decision.md")
  assert.equal(linked.hash, digest(text)); assert.equal(linked.previousHash, digest(decision))
  assert.match(text, /^---\ntags: \[cedar\]\nrelated: Entities\/Queue\.md\npart_of:\n {2}- "\[\[Projects\/Cedar\/Index\]\]"\nevidence_for:\n {2}- "\[\[Evidence\/Load test\]\]"\n---\n# Cedar decision\n\nOwner text stays\.\n$/)
  const graph = buildNoteGraph(loadVaultDocuments(f.vault))
  assert.deepEqual([...graph.outgoing.get("Projects/Cedar/Decision.md")].sort(), ["Entities/Queue.md", "Evidence/Load test.md", "Projects/Cedar/Index.md"])
  const again = await link(f, { path: "Projects/Cedar/Decision.md", hash: linked.hash, add: [{ target: "Projects/Cedar/Index.md", relation: "part_of" }] })
  assert.equal(again.status, "UNCHANGED")

  const plain = await link(f, { path: "Plain.md", hash: f.hashOf("Plain.md"), add: [{ target: "Entities/Queue.md", relation: "depends_on" }] })
  assert.equal(plain.status, "LINKED")
  assert.equal(f.read("Plain.md"), '---\ndepends_on:\n  - "[[Entities/Queue]]"\n---\n# Plain\n\nNo frontmatter.\n')

  const removed = await link(f, { path: "Projects/Cedar/Decision.md", hash: f.hashOf("Projects/Cedar/Decision.md"), remove: [{ target: "Entities/Queue.md", relation: "related" }] })
  assert.deepEqual(removed.changes, [{ action: "removed", relation: "related", target: "Entities/Queue.md" }])
  assert.doesNotMatch(f.read("Projects/Cedar/Decision.md"), /related:/)
})

test("link repairs broken body and property links to an existing note, outside code", async t => {
  const note = [
    "---", "depends_on:", '  - "[[Old Queue]]"', "---", "# Runbook", "",
    "See [[Old Queue|the queue]] and [[Old Queue#Limits]], plus [the queue](Old%20Queue.md).",
    "Inline `[[Old Queue]]` stays.", "```", "[[Old Queue]]", "```", "Keep [[Entities/Queue]] as it is.", "",
  ].join("\n")
  const f = fixture(t, { ...base, "Projects/Cedar/Runbook.md": note })
  const repaired = await link(f, { path: "Projects/Cedar/Runbook.md", hash: f.hashOf("Projects/Cedar/Runbook.md"), repair: [{ from: "Old Queue", to: "Entities/Queue.md" }] })
  assert.equal(repaired.status, "LINKED", JSON.stringify(repaired))
  assert.deepEqual(repaired.changes, [{ action: "repaired", from: "Old Queue", to: "Entities/Queue.md", links: 4 }])
  const text = f.read("Projects/Cedar/Runbook.md")
  assert.match(text, /- "\[\[Entities\/Queue\]\]"/)
  assert.match(text, /See \[\[Entities\/Queue\|the queue\]\] and \[\[Entities\/Queue#Limits\]\], plus \[the queue\]\(\.\.\/\.\.\/Entities\/Queue\.md\)\./)
  assert.match(text, /Inline `\[\[Old Queue\]\]` stays\.\n```\n\[\[Old Queue\]\]\n```/)
  assert.equal(buildNoteGraph(loadVaultDocuments(f.vault)).issues.length, 0)

  const hash = f.hashOf("Projects/Cedar/Runbook.md")
  assert.equal((await link(f, { path: "Projects/Cedar/Runbook.md", hash, repair: [{ from: "Entities/Queue", to: "Projects/Cedar/Index.md" }] })).code, "LINK_NOT_BROKEN")
  assert.equal((await link(f, { path: "Projects/Cedar/Runbook.md", hash, add: [{ target: "Missing.md", relation: "related" }] })).code, "LINK_TARGET_NOT_FOUND")
  assert.equal((await link(f, { path: "Projects/Cedar/Runbook.md", hash, repair: [{ from: "Nowhere", to: "Entities/Queue.md" }] })).code, "LINK_NOT_FOUND")
  assert.equal((await link(f, { path: "Projects/Cedar/Runbook.md", hash: "0".repeat(64), add: [{ target: "Entities/Queue.md", relation: "related" }] })).code, "TARGET_CHANGED")
  assert.equal((await link(f, { path: "../outside.md", hash, add: [{ target: "Entities/Queue.md", relation: "related" }] })).status, "BLOCKED")
  assert.equal(f.hashOf("Projects/Cedar/Runbook.md"), hash, "refused edits write nothing")
})

test("status points the Curator at broken links", async t => {
  const f = fixture(t, { ...base, "Broken.md": "# Broken\n\nSee [[Gone]].\n" })
  const report = await f.engine.status()
  assert.ok(report.next.some(line => /broken or ambiguous link/.test(line)), JSON.stringify(report.next))
})

test("link edits many notes in one call and applies the batch whole or not at all", async t => {
  const f = fixture(t, { ...base, "A.md": "# A\n", "B.md": "# B\n\nSee [[Gone]].\n" })
  const batch = await f.engine.link({ notes: [
    { path: "A.md", hash: f.hashOf("A.md"), add: [{ target: "Projects/Cedar/Index.md", relation: "part_of" }] },
    { path: "B.md", hash: f.hashOf("B.md"), repair: [{ from: "Gone", to: "Entities/Queue.md" }], add: [{ target: "A.md", relation: "related" }] },
  ] })
  assert.equal(batch.status, "LINKED", JSON.stringify(batch))
  assert.deepEqual(batch.notes.map(note => [note.path, note.changes.length]), [["A.md", 1], ["B.md", 2]])
  assert.equal(batch.notes[1].hash, f.hashOf("B.md"))
  assert.match(f.read("B.md"), /See \[\[Entities\/Queue\]\]\./)

  const before = [f.read("A.md"), f.read("B.md")]
  const stale = await f.engine.link({ notes: [
    { path: "A.md", hash: f.hashOf("A.md"), add: [{ target: "Entities/Queue.md", relation: "depends_on" }] },
    { path: "B.md", hash: "0".repeat(64), add: [{ target: "Entities/Queue.md", relation: "depends_on" }] },
  ] })
  assert.equal(stale.code, "TARGET_CHANGED"); assert.equal(stale.path, "B.md")
  assert.deepEqual([f.read("A.md"), f.read("B.md")], before, "nothing in a refused batch is written")
  const twice = await f.engine.link({ notes: [{ path: "A.md", hash: f.hashOf("A.md"), add: [{ target: "B.md", relation: "related" }] }, { path: "A.md", hash: f.hashOf("A.md"), add: [{ target: "B.md", relation: "related" }] }] })
  assert.equal(twice.code, "INVALID_ARGUMENT")
})
