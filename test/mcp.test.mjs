import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { createMemoryEngine } from "../src/mcp-engine.mjs"
import { createMcpServer, startHttpServer } from "../src/mcp-server.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"
import { managedRecall } from "../src/decision-recall.mjs"
import { prepareCurationCheckpoint, inspectCurationCheckpoint } from "../src/curation-checkpoint.mjs"
import { renderPatchRecord } from "../src/patch-record.mjs"
const config = { ...DEFAULT_RUNTIME_CONFIG, retrievalMode: "lexical" }
const digest = value => createHash("sha256").update(value).digest("hex")
function fixture(t, count = 16) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-mcp-"))
  const vault = path.join(root, "vault"), stateRoot = path.join(root, "state")
  fs.mkdirSync(vault)
  for (let i = 0; i < count; i++) fs.writeFileSync(path.join(vault, `N${i}.md`), `# Release policy ${i}\n\n## Approval\nProduction release policy needs an independent approver.\n\n## Other\nUnrelated details.\n`)
  fs.writeFileSync(path.join(root, "config.json"), JSON.stringify(config))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return { root, vault, stateRoot, config, engine: createMemoryEngine({ vault, stateRoot, config }) }
}
function input(target = "Decision.md", supersedes = []) {
  const claim = "Hotfix deployments need a named incident commander on call."
  const scope = { applies: ["hotfix deployments"], excludes: ["scheduled deployments"] }
  const quote = "Owner approved a named incident commander for hotfix deployments."
  const patch = { claim, why_it_matters: "A named commander keeps hotfix response accountable.", scope, provenance: [{ kind: "user-statement", value: quote }],
    confidence: "high", suggested_type: "decision", lifecycle: { status: "active", revalidate_when: ["release process changes"], supersedes } }
  return { claim, scope, evidence: [{ quote }], curation: { patch, target, targetHashes: { [target]: null }, supportVerified: true, conflictsReviewed: true, authorized: true } }
}
async function connect(t, mode, f) {
  const client = new Client({ name: "synthetic-tests", version: "1" })
  let transport, logs = ""
  if (mode === "memory") {
    const pair = InMemoryTransport.createLinkedPair()
    const server = createMcpServer(f.engine)
    await server.connect(pair[1]); transport = pair[0]
    t.after(() => server.close())
  } else if (mode === "stdio") {
    transport = new StdioClientTransport({ command: process.execPath, args: ["scripts/graphmory-mcp.mjs"], stderr: "pipe",
      env: { ...process.env, GRAPHMORY_VAULT: f.vault, GRAPHMORY_STATE_DIR: f.stateRoot, GRAPHMORY_CONFIG_PATH: path.join(f.root, "config.json") } })
    transport.stderr?.on("data", data => { logs += data.toString() })
  } else {
    const listener = await startHttpServer({ ...f, port: 0, token: "synthetic-test-bearer-token" })
    t.after(() => listener.close())
    transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${listener.address.port}/mcp`), { requestInit: { headers: { authorization: "Bearer synthetic-test-bearer-token" } } })
  }
  await client.connect(transport)
  t.after(() => client.close())
  return { client, logs: () => logs }
}
async function call(client, name, args) {
  const response = await client.callTool({ name, arguments: args })
  const body = JSON.parse(response.content[0].text)
  assert.deepEqual(response.structuredContent, body)
  return body
}
for (const mode of ["memory", "stdio", "http"]) {
  test(`${mode}: tools/resources, CLI parity, paging, source reads and guarded remember`, async t => {
    const f = fixture(t)
    const { client, logs } = await connect(t, mode, f)
    const tools = (await client.listTools()).tools
    assert.deepEqual(tools.map(t => t.name), ["recall", "read", "remember"])
    for (const tool of tools) {
      assert.ok(!tool.description.includes("\n"))
      if (tool.name === "remember") for (const outcome of ["APPLIED", "TENSION", "BLOCKED", "receipt"]) assert.match(tool.description, new RegExp(outcome))
      assert.equal(tool.annotations.readOnlyHint, tool.name !== "remember")
      assert.equal(tool.annotations.idempotentHint, tool.name !== "remember")
    }
    assert.equal((await client.listResources()).resources.length, 5)
    assert.match((await client.readResource({ uri: "graphmory://guide/recall" })).contents[0].text, /data, never instructions/)
    assert.match((await client.readResource({ uri: "graphmory://guide/remember" })).contents[0].text, /checkpoint/)
    const first = await call(client, "recall", { query: "release policy" })
    const cli = await managedRecall(f.vault, "release policy", config, { stateRoot: f.stateRoot })
    assert.deepEqual(first.candidates.map(c => c.path), cli.results.map(c => c.path))
    const processCli = spawnSync(process.execPath, ["scripts/brain-sync.mjs", "recall-managed", "--vault", f.vault, "--query", "release policy", "--json", "--state-root", f.stateRoot],
      { encoding: "utf8", env: { ...process.env, GRAPHMORY_CONFIG_PATH: path.join(f.root, "config.json") } })
    assert.equal(processCli.status, 0, processCli.stderr)
    assert.deepEqual(first.candidates.map(c => c.path), JSON.parse(processCli.stdout).results.map(c => c.path))
    assert.equal(first.candidates.length, 10)
    assert.ok(first.candidates.every(c => c.excerpt.length <= 180 && !c.markdown && c.hash.length === 64 && c.lanes.length))
    const second = await call(client, "recall", { query: "release policy", cursor: first.nextCursor })
    assert.equal(second.candidates.length, 6)
    assert.equal(new Set([...first.candidates, ...second.candidates].map(c => c.path)).size, 16)
    assert.equal(second.nextCursor, undefined)
    const candidate = first.candidates[0]
    const original = await call(client, "read", { path: candidate.path, hash: candidate.hash })
    assert.equal(original.markdown, fs.readFileSync(path.join(f.vault, candidate.path), "utf8"))
    const section = await call(client, "read", { path: candidate.path, section: "Approval", hash: candidate.hash })
    assert.ok(section.markdown.startsWith("## Approval\n"))
    assert.ok(!section.markdown.includes("## Other"))
    assert.equal(section.hash, original.hash)
    const missing = await call(client, "remember", { claim: input().claim, scope: input().scope, evidence: input().evidence })
    assert.equal(missing.status, "BLOCKED"); assert.equal(missing.step, "needs_curation")
    const tension = await call(client, "remember", { ...input(), curation: { conflictPath: candidate.path } })
    assert.equal(tension.status, "TENSION"); assert.equal(tension.conflictingNote.path, candidate.path)
    const prepared = await call(client, "remember", { ...input(), curation: { ...input().curation, stage: "prepare" } })
    assert.equal(prepared.status, "BLOCKED"); assert.ok(prepared.checkpoint)
    assert.equal((await call(client, "recall", { query: "release" })).code, "CURATION_PENDING")
    assert.equal((await call(client, "read", { path: candidate.path })).code, "CURATION_PENDING")
    const wrong = input("Wrong.md"); wrong.curation.operation = prepared.checkpoint
    assert.equal((await call(client, "remember", wrong)).status, "BLOCKED")
    assert.equal(fs.existsSync(path.join(f.vault, "Wrong.md")), false)
    const resumed = input(); resumed.curation.operation = prepared.checkpoint
    const applied = await call(client, "remember", resumed)
    assert.equal(applied.status, "APPLIED", JSON.stringify(applied)); assert.equal(applied.receipt.operation, prepared.checkpoint)
    assert.equal(inspectCurationCheckpoint(f).blocked, false)
    const saved = await call(client, "read", { path: "Decision.md", hash: applied.receipt.targetHashes["Decision.md"] })
    assert.equal(saved.markdown, renderPatchRecord(input().curation.patch))
    assert.equal(logs().includes("synthetic-test-bearer-token"), false)
  })
}

test("read rejects stale hashes, traversal, symlinks and forged tool arguments without path leaks", async t => {
  const f = fixture(t, 1), { client } = await connect(t, "memory", f)
  const candidate = (await call(client, "recall", { query: "release" })).candidates[0]
  fs.appendFileSync(path.join(f.vault, candidate.path), "Changed.\n")
  const stale = await call(client, "read", { path: candidate.path, hash: candidate.hash })
  assert.equal(stale.code, "STALE_SOURCE"); assert.equal(stale.markdown, undefined)
  fs.writeFileSync(path.join(f.root, "private.md"), "outside data")
  fs.symlinkSync(path.join(f.root, "private.md"), path.join(f.vault, "Link.md"))
  for (const relative of ["../private.md", "Link.md", "/etc/passwd"]) {
    const read = await call(client, "read", { path: relative })
    assert.ok(read.code); assert.equal(read.markdown, undefined)
    assert.equal(JSON.stringify(read).includes(f.root), false)
  }
  assert.equal((await call(client, "recall", { query: "release", vault: "/etc" })).code, "INVALID_ARGUMENT")
  assert.equal((await call(client, "read", { path: "N0.md", section: "Missing" })).code, "SECTION_NOT_FOUND")
})

test("cursor rejects tampering, wrong query/scope, source edit and process restart", async t => {
  const f = fixture(t), first = await f.engine.recall({ query: "release" })
  await assert.rejects(f.engine.recall({ query: "release", cursor: first.nextCursor + "x" }), e => e.publicCode === "INVALID_CURSOR")
  await assert.rejects(f.engine.recall({ query: "approval", cursor: first.nextCursor }), e => e.publicCode === "STALE_CURSOR")
  await assert.rejects(f.engine.recall({ query: "release", scope: "N0", cursor: first.nextCursor }), e => e.publicCode === "STALE_CURSOR")
  await assert.rejects(createMemoryEngine(f).recall({ query: "release", cursor: first.nextCursor }), e => e.publicCode === "INVALID_CURSOR")
  fs.appendFileSync(path.join(f.vault, "N0.md"), "Changed.\n")
  await assert.rejects(f.engine.recall({ query: "release", cursor: first.nextCursor }), e => e.publicCode === "STALE_CURSOR")
})

test("remember one-call apply, exact replay and supersession preserve source and predecessor bytes", async t => {
  const f = fixture(t, 1)
  const old = "---\nstatus: active\n---\n# Old release policy\nProduction releases permit the release owner to approve.\n"
  fs.writeFileSync(path.join(f.vault, "Old.md"), old)
  const request = input("New.md", ["Old.md"])
  request.curation.targetHashes["Old.md"] = digest(old)
  request.evidence = [{ path: "N0.md", hash: digest(fs.readFileSync(path.join(f.vault, "N0.md"))) }]
  request.curation.patch.provenance = [{ kind: "file", value: "N0.md#Approval" }]
  const before = fs.readFileSync(path.join(f.vault, "N0.md"))
  const applied = await f.engine.remember(request)
  assert.equal(applied.status, "APPLIED", JSON.stringify(applied))
  const updatedOld = fs.readFileSync(path.join(f.vault, "Old.md"), "utf8")
  assert.match(updatedOld, /status: superseded/); assert.match(updatedOld, /superseded_by:/)
  assert.match(updatedOld, /Production releases permit the release owner to approve/)
  assert.deepEqual(fs.readFileSync(path.join(f.vault, "N0.md")), before)
  const page = await f.engine.recall({ query: "release policy" })
  assert.equal(page.candidates.some(c => c.path === "Old.md"), false)
  request.curation.targetHashes = applied.receipt.targetHashes
  const replay = await f.engine.remember(request)
  assert.equal(replay.status, "APPLIED", JSON.stringify(replay)); assert.equal(replay.replayed, true)
  assert.equal(fs.readFileSync(path.join(f.vault, "Old.md"), "utf8"), updatedOld)
})

test("remember refuses unsupported review, stale sources, undeclared provenance, an ambiguous existing record and low confidence", async t => {
  const f = fixture(t, 1)
  const unsupported = input(); unsupported.curation.supportVerified = false
  assert.equal((await f.engine.remember(unsupported)).code, "REVIEW_REQUIRED")
  const stale = input(); stale.evidence = [{ path: "N0.md", hash: "0".repeat(64) }]
  assert.equal((await f.engine.remember(stale)).code, "STALE_SOURCE")
  const unbound = input(); unbound.curation.patch.provenance[0].value = "Unknown quote"
  assert.equal((await f.engine.remember(unbound)).code, "UNRESOLVED_PROVENANCE")
  const ambiguous = "# Two records\n<!-- graphmory-patch-record:v1:start -->\n<!-- graphmory-patch-record:v1:end -->\n<!-- graphmory-patch-record:v1:start -->\n<!-- graphmory-patch-record:v1:end -->\n"
  fs.writeFileSync(path.join(f.vault, "Ambiguous.md"), ambiguous)
  const occupied = input("Ambiguous.md"); occupied.curation.targetHashes["Ambiguous.md"] = digest(ambiguous)
  assert.equal((await f.engine.remember(occupied)).code, "NEEDS_CURATION")
  const uncertain = input(); uncertain.curation.patch.confidence = "low"
  assert.equal((await f.engine.remember(uncertain)).code, "LOW_CONFIDENCE")
  assert.equal(inspectCurationCheckpoint(f).blocked, false)
})

test("remember places the record into an existing note, keeps the owner's content and updates it again later", async t => {
  const f = fixture(t, 1)
  const note = "---\ntags: [release]\ntype: scratch\nstatus: draft\n---\n# Hotfix runbook\n\nOwner notes stay here.\n\n## Steps\n1. Page the commander.\n"
  fs.writeFileSync(path.join(f.vault, "Runbook.md"), note)
  const request = input("Runbook.md"); request.curation.targetHashes["Runbook.md"] = digest(note)
  const applied = await f.engine.remember(request)
  assert.equal(applied.status, "APPLIED", JSON.stringify(applied))
  const merged = fs.readFileSync(path.join(f.vault, "Runbook.md"), "utf8")
  assert.match(merged, /^---\ntype: decision\n/)
  assert.match(merged, /tags: \[release\]/)
  assert.doesNotMatch(merged, /type: scratch|status: draft/)
  assert.match(merged, /# Hotfix runbook\n\n<!-- graphmory-patch-record:v1:start -->/)
  assert.match(merged, /Owner notes stay here\.\n\n## Steps\n1\. Page the commander\.\n$/)
  assert.equal(applied.receipt.targetHashes["Runbook.md"], digest(merged))

  const revised = input("Runbook.md"); revised.curation.targetHashes["Runbook.md"] = digest(merged)
  revised.claim = revised.curation.patch.claim = "Hotfix deployments need a named incident commander and a scribe on call."
  const again = await f.engine.remember(revised)
  assert.equal(again.status, "APPLIED", JSON.stringify(again))
  const updated = fs.readFileSync(path.join(f.vault, "Runbook.md"), "utf8")
  assert.equal(updated.match(/graphmory-patch-record:v1:start/g).length, 1)
  assert.match(updated, /and a scribe on call/)
  assert.match(updated, /Owner notes stay here\./)

  const stale = input("Runbook.md"); stale.curation.targetHashes["Runbook.md"] = digest(note)
  assert.equal((await f.engine.remember(stale)).code, "TARGET_CHANGED")
})

test("source drift after prepare remains pending and prevents resume", async t => {
  const f = fixture(t, 1), request = input()
  request.evidence = [{ path: "N0.md", hash: digest(fs.readFileSync(path.join(f.vault, "N0.md"))) }]
  request.curation.patch.provenance = [{ kind: "file", value: "N0.md" }]
  const prepared = await f.engine.remember({ ...request, curation: { ...request.curation, stage: "prepare" } })
  fs.appendFileSync(path.join(f.vault, "N0.md"), "Source changed.\n")
  request.curation.operation = prepared.checkpoint
  const failed = await f.engine.remember(request)
  assert.equal(failed.status, "BLOCKED"); assert.equal(failed.code, "SOURCE_CHANGED")
  assert.equal(inspectCurationCheckpoint(f).blocked, true)
  assert.equal(fs.existsSync(path.join(f.vault, "Decision.md")), false)
})

test("HTTP requires an explicit remote bind and token; all routes reject missing/wrong auth and browser origins", async t => {
  const f = fixture(t, 1)
  await assert.rejects(startHttpServer({ ...f, host: "0.0.0.0", port: 0 }), /REMOTE_BIND_REFUSED/)
  await assert.rejects(startHttpServer({ ...f, host: "0.0.0.0", allowRemote: true, port: 0 }), /TOKEN_REQUIRED/)
  await assert.rejects(startHttpServer({ ...f, port: 0 }), /TOKEN_REQUIRED/)
  const token = "synthetic-test-bearer-token"
  const listener = await startHttpServer({ ...f, port: 0, token })
  t.after(() => listener.close())
  const url = `http://127.0.0.1:${listener.address.port}/mcp`
  for (const value of [undefined, "Bearer incorrect-token"]) {
    const response = await fetch(url, { method: "POST", headers: value ? { authorization: value } : {}, body: "{}" })
    assert.equal(response.status, 401)
    const body = await response.text(); assert.equal(body.includes(token), false); assert.equal(body.includes(f.root), false)
  }
  const auth = { authorization: `Bearer ${token}` }
  assert.equal((await fetch(url, { method: "POST", headers: { ...auth, origin: "https://example.test" }, body: "{}" })).status, 403)
  assert.equal((await fetch(url, { method: "POST", headers: auth, body: "invalid" })).status, 400)
  assert.equal((await fetch(url, { method: "POST", headers: auth, body: "x".repeat(66000) })).status, 413)
  assert.equal((await fetch(url, { headers: auth })).status, 405)
  const refused = spawnSync(process.execPath, ["scripts/graphmory-mcp.mjs", "--http", "--bind", "0.0.0.0", "--allow-remote", "--token", token], { encoding: "utf8" })
  assert.equal(refused.status, 1); assert.equal((refused.stdout + refused.stderr).includes(token), false)
})

test("warm hybrid recall retains parsed documents and semantic lane hooks; pending during await blocks disclosure", async t => {
  const f = fixture(t, 1)
  let first, calls = 0
  const engine = createMemoryEngine({ ...f, config: DEFAULT_RUNTIME_CONFIG, recallOptions: { semanticLaneImpl: async (_v, _q, options) => {
    calls++
    if (!first) first = options.documents
    else assert.equal(options.documents, first)
    return { method: "semantic-vector", model: "synthetic-bge", results: options.documents.map(d => ({ ...d, score: 0.9 })) }
  } } })
  await engine.recall({ query: "release" }); await engine.recall({ query: "release" })
  assert.equal(calls, 2)
  const blocking = createMemoryEngine({ ...f, config: DEFAULT_RUNTIME_CONFIG, recallOptions: { semanticLaneImpl: async (_v, _q, options) => {
    prepareCurationCheckpoint({ ...f, patch: input().curation.patch, targets: ["Decision.md"], sources: [] })
    return { method: "semantic-vector", model: "synthetic-bge", results: options.documents }
  } } })
  await assert.rejects(blocking.recall({ query: "release" }), e => ["STATE_CHANGED_DURING_READ", "CURATION_PENDING"].includes(e.publicCode))
})

for (const tokenSource of ["env", "file"]) {
  test(`HTTP CLI accepts token from ${tokenSource} and startup logs omit it`, async t => {
    const f = fixture(t, 1), token = "synthetic-cli-bearer-token"
    const args = ["scripts/graphmory-mcp.mjs", "--http", "--port", "0"]
    const env = { ...process.env, GRAPHMORY_VAULT: f.vault, GRAPHMORY_STATE_DIR: f.stateRoot, GRAPHMORY_CONFIG_PATH: path.join(f.root, "config.json") }
    if (tokenSource === "env") { env.SYNTHETIC_MCP_TOKEN = token; args.push("--token-env", "SYNTHETIC_MCP_TOKEN") }
    else { const file = path.join(f.root, "bearer-token"); fs.writeFileSync(file, token, { mode: 0o600 }); args.push("--token-file", file) }
    const child = spawn(process.execPath, args, { env, stdio: ["ignore", "pipe", "pipe"] })
    const closed = new Promise(resolve => child.once("exit", resolve))
    t.after(async () => { child.kill("SIGTERM"); await closed })
    let stdout = "", stderr = ""
    child.stdout.on("data", data => { stdout += data.toString() })
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error("HTTP startup did not finish")), 10000)
      child.once("error", error => { clearTimeout(timeout); reject(error) })
      child.once("exit", () => { clearTimeout(timeout); reject(Error("HTTP startup failed")) })
      child.stderr.on("data", data => {
        stderr += data.toString()
        if (stderr.includes("\n")) {
          clearTimeout(timeout)
          try { resolve(JSON.parse(stderr.split("\n")[0]).port) } catch { reject(Error("Invalid startup status")) }
        }
      })
    })
    assert.ok(port)
    const client = new Client({ name: "synthetic-cli", version: "1" })
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }))
    t.after(() => client.close())
    assert.equal((await call(client, "recall", { query: "release" })).candidates.length, 1)
    assert.equal((stdout + stderr).includes(token), false)
    assert.equal(stdout, "")
  })
}

test("exact spaced path identifiers survive tool validation", async t => {
  const f = fixture(t, 0), { client } = await connect(t, "memory", f)
  const relative = " Leading Space.md"
  fs.writeFileSync(path.join(f.vault, relative), "# Space\nExact original.\n")
  const original = await call(client, "read", { path: relative })
  assert.equal(original.path, relative); assert.equal(original.markdown, "# Space\nExact original.\n")
})

test("recall numbers its pages, cuts at the page budget and still rejects a tampered cursor", async t => {
  const f = fixture(t, 100)
  const pages = []
  let cursor
  do {
    const page = await f.engine.recall({ query: "release policy", ...(cursor ? { cursor } : {}) })
    pages.push(page)
    cursor = page.nextCursor
  } while (cursor)
  assert.deepEqual(pages.map(p => p.page), [1, 2, 3, 4, 5, 6, 7, 8])
  assert.equal(pages.reduce((sum, p) => sum + p.candidates.length, 0), 80)
  assert.equal(pages.at(-1).budgetReached, true)
  assert.equal(pages.at(-1).nextCursor, undefined)
  assert.ok(pages.slice(0, -1).every(p => p.budgetReached === undefined && p.nextCursor))
  await assert.rejects(f.engine.recall({ query: "release policy", cursor: pages[0].nextCursor + "x" }), e => e.publicCode === "INVALID_CURSOR")
})

test("a result set inside the budget has no budgetReached flag", async t => {
  const f = fixture(t, 16)
  const second = await f.engine.recall({ query: "release policy", cursor: (await f.engine.recall({ query: "release policy" })).nextCursor })
  assert.equal(second.page, 2)
  assert.equal(second.budgetReached, undefined)
  assert.equal(second.nextCursor, undefined)
})
