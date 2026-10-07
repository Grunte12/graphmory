import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { createMemoryEngine } from "../src/mcp-engine.mjs"
import { createMcpServer } from "../src/mcp-server.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"

const config = { ...DEFAULT_RUNTIME_CONFIG, retrievalMode: "lexical" }
function git(cwd, args) {
  const result = spawnSync("git", ["-c", "user.name=Sync Test", "-c", "user.email=sync@example.invalid", ...args], { cwd, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout.trim()
}
// Two clones of one bare remote: `other` stands in for another machine.
function sharedBrain(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-mcp-sync-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const remote = path.join(root, "brain.git"), vault = path.join(root, "vault"), other = path.join(root, "other")
  git(root, ["init", "-q", "--bare", "-b", "main", remote])
  fs.mkdirSync(path.join(vault, ".memory-patch-harness"), { recursive: true })
  fs.writeFileSync(path.join(vault, ".memory-patch-harness", "brain-sync.json"), JSON.stringify({ version: 1, repo: "example/brain", branch: "main" }))
  fs.writeFileSync(path.join(vault, "Shared.md"), "# Shared\n\nInitial.\n")
  git(vault, ["init", "-q", "-b", "main"]); git(vault, ["add", "-A"]); git(vault, ["commit", "-qm", "base"])
  git(vault, ["remote", "add", "origin", remote]); git(vault, ["push", "-q", "-u", "origin", "main"])
  git(root, ["clone", "-q", remote, other])
  return { root, remote, vault, other, stateRoot: path.join(root, "state"), engine: createMemoryEngine({ vault, stateRoot: path.join(root, "state"), config }) }
}
async function connect(t, engine, answer) {
  const client = new Client({ name: "sync-tests", version: "1" }, answer ? { capabilities: { elicitation: {} } } : {})
  const asked = []
  if (answer) client.setRequestHandler(ElicitRequestSchema, async request => { asked.push(request.params); return typeof answer === "function" ? answer() : answer })
  const pair = InMemoryTransport.createLinkedPair(), server = createMcpServer(engine)
  await server.connect(pair[1]); await client.connect(pair[0])
  t.after(async () => { await client.close(); await server.close() })
  return {
    asked,
    call: async args => JSON.parse((await client.callTool({ name: "sync", arguments: args })).content[0].text),
  }
}
const remoteHead = f => git(f.root, ["--git-dir", f.remote, "rev-parse", "main"])

test("sync pull fast-forwards and reports a dirty tree instead of merging", async t => {
  const f = sharedBrain(t), { call } = await connect(t, f.engine, null)
  fs.writeFileSync(path.join(f.other, "Remote.md"), "# Remote\n")
  git(f.other, ["add", "-A"]); git(f.other, ["commit", "-qm", "remote"]); git(f.other, ["push", "-q"])
  const pulled = await call({ action: "pull" })
  assert.equal(pulled.status, "updated", JSON.stringify(pulled))
  assert.ok(fs.existsSync(path.join(f.vault, "Remote.md")))
  fs.writeFileSync(path.join(f.vault, "Draft.md"), "# Draft\n")
  assert.equal((await call({ action: "pull" })).status, "skipped-dirty")
})

test("sync push asks the owner with the changed files and pushes only after approval", async t => {
  const f = sharedBrain(t)
  fs.writeFileSync(path.join(f.vault, "Decision.md"), "# Decision\n")
  const before = remoteHead(f)
  const noQuestions = await connect(t, f.engine, null)
  assert.equal((await noQuestions.call({ action: "push" })).status, "unsupported")
  const later = await connect(t, f.engine, { action: "accept", content: { decision: "later" } })
  assert.equal((await later.call({ action: "push" })).status, "kept")
  assert.equal(remoteHead(f), before)
  assert.match(later.asked[0].message, /example\/brain \(main\)/)
  assert.match(later.asked[0].message, /- Decision\.md/)

  const approving = await connect(t, f.engine, { action: "accept", content: { decision: "push" } })
  const pushed = await approving.call({ action: "push", message: "memory: add decision" })
  assert.equal(pushed.status, "pushed", JSON.stringify(pushed))
  assert.equal(pushed.approvedBy, "owner")
  assert.equal(remoteHead(f), pushed.commit)
  assert.equal(git(f.vault, ["log", "-1", "--format=%s"]), "memory: add decision")
  assert.equal((await approving.call({ action: "push" })).status, "no-changes")
})

test("sync push refuses changes made after approval, secrets and a moved remote", async t => {
  const f = sharedBrain(t)
  fs.writeFileSync(path.join(f.vault, "Decision.md"), "# Decision\n")
  const before = remoteHead(f)
  const racing = await connect(t, f.engine, () => {
    fs.writeFileSync(path.join(f.vault, "Decision.md"), "# Decision\n\nEdited while the owner read the question.\n")
    return { action: "accept", content: { decision: "push" } }
  })
  assert.equal((await racing.call({ action: "push" })).code, "CHANGED_DURING_REVIEW")
  assert.equal(remoteHead(f), before)
  assert.equal(git(f.vault, ["status", "--porcelain"]).includes("Decision.md"), true)

  fs.writeFileSync(path.join(f.vault, "Creds.md"), "api_key = exposed-value-1234567890\n")
  const secret = await connect(t, f.engine, { action: "accept", content: { decision: "push" } })
  const blocked = await secret.call({ action: "push" })
  assert.equal(blocked.code, "SECRET_FOUND"); assert.deepEqual(blocked.files, ["Creds.md"])
  assert.equal(secret.asked.length, 0)
  assert.equal(JSON.stringify(blocked).includes("exposed-value"), false)
  fs.rmSync(path.join(f.vault, "Creds.md"))

  fs.writeFileSync(path.join(f.other, "Remote.md"), "# Remote\n")
  git(f.other, ["add", "-A"]); git(f.other, ["commit", "-qm", "remote"]); git(f.other, ["push", "-q"])
  const moved = await connect(t, f.engine, { action: "accept", content: { decision: "push" } })
  assert.equal((await moved.call({ action: "push" })).code, "REMOTE_CHANGED")

  const fresh = sharedBrain(t)
  assert.equal((await (await connect(t, fresh.engine, null)).call({ action: "push", message: "two\nlines" })).code, "INVALID_ARGUMENT")
  fs.rmSync(path.join(fresh.vault, ".memory-patch-harness", "brain-sync.json"))
  assert.equal((await (await connect(t, fresh.engine, null)).call({ action: "pull" })).code, "SYNC_NOT_CONFIGURED")
})
