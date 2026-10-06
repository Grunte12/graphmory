import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { createMemoryEngine } from "../src/mcp-engine.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"
import { approveReview, listReviews, rejectReview, showReview } from "../src/review-queue.mjs"

const config = { ...DEFAULT_RUNTIME_CONFIG, retrievalMode: "lexical" }
const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "brain-sync.mjs")
const digest = (value) => createHash("sha256").update(value).digest("hex")

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-review-"))
  const vault = path.join(root, "vault"), stateRoot = path.join(root, "state")
  fs.mkdirSync(vault)
  fs.writeFileSync(path.join(vault, "Policy.md"), "# Release policy\n\nProduction release policy needs an independent approver.\n")
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const engine = createMemoryEngine({ vault, stateRoot, config })
  return { root, vault, stateRoot, engine, common: { vault, stateRoot } }
}

function lowRequest(f, { claim = "Pricing decisions need a second reviewer before launch.", target = "Pricing Decision.md", evidencePath } = {}) {
  const scope = { applies: ["pricing decisions"], excludes: ["internal experiments"] }
  const quote = "Owner thinks pricing may need a second reviewer."
  const provenance = [{ kind: "user-statement", value: quote }]
  let evidence = [{ quote }]
  if (evidencePath) {
    evidence = [...evidence, { path: evidencePath, hash: digest(fs.readFileSync(path.join(f.vault, evidencePath))) }]
    provenance.push({ kind: "file", value: evidencePath })
  }
  const patch = { claim, why_it_matters: "A second reviewer reduces pricing mistakes.", scope, provenance, confidence: "low",
    suggested_type: "decision", lifecycle: { status: "active", revalidate_when: ["pricing process changes"], supersedes: [] } }
  return { claim, scope, evidence, curation: { patch, target, targetHashes: { [target]: null }, supportVerified: true, conflictsReviewed: true, authorized: true } }
}

const vaultFiles = (f) => fs.readdirSync(f.vault).sort()

test("low-confidence memory is queued for review, not written and not recalled", async (t) => {
  const f = fixture(t)
  const before = vaultFiles(f)
  const result = await f.engine.remember(lowRequest(f))
  assert.equal(result.status, "BLOCKED")
  assert.equal(result.code, "LOW_CONFIDENCE")
  assert.equal(result.step, "owner_review")
  assert.match(result.reviewId, /^rv_[a-f0-9]{16}$/)
  assert.deepEqual(vaultFiles(f), before)
  assert.ok(fs.existsSync(path.join(f.stateRoot, "reviews")), "queue lives in the private state root")
  const recall = await f.engine.recall({ query: "pricing decisions second reviewer" })
  assert.ok(!recall.candidates.some((c) => /Pricing/.test(c.path)))
  const again = await f.engine.remember(lowRequest(f))
  assert.equal(again.reviewId, result.reviewId)
  const pending = listReviews(f.common)
  assert.equal(pending.length, 1)
  assert.equal(pending[0].claim, "Pricing decisions need a second reviewer before launch.")
  assert.equal(showReview(f.common, result.reviewId).request.curation.target, "Pricing Decision.md")
})

test("owner approval writes the note with a receipt marked approved by owner", async (t) => {
  const f = fixture(t)
  const queued = await f.engine.remember(lowRequest(f, { evidencePath: "Policy.md" }))
  const applied = await approveReview({ ...f.common, reviewId: queued.reviewId, engine: f.engine })
  assert.equal(applied.status, "APPLIED", JSON.stringify(applied))
  assert.equal(applied.receipt.approvedBy, "owner")
  assert.equal(applied.receipt.reviewId, queued.reviewId)
  assert.match(fs.readFileSync(path.join(f.vault, "Pricing Decision.md"), "utf8"), /second reviewer/)
  assert.deepEqual(listReviews(f.common), [])
  await assert.rejects(approveReview({ ...f.common, reviewId: queued.reviewId, engine: f.engine }), /REVIEW_NOT_PENDING/)
})

test("approval after source or target drift reports STALE and writes nothing", async (t) => {
  const f = fixture(t)
  const queued = await f.engine.remember(lowRequest(f, { evidencePath: "Policy.md" }))
  fs.appendFileSync(path.join(f.vault, "Policy.md"), "\nChanged after the request was queued.\n")
  const stale = await approveReview({ ...f.common, reviewId: queued.reviewId, engine: f.engine })
  assert.equal(stale.status, "STALE")
  assert.equal(stale.code, "STALE_SOURCE")
  assert.equal(fs.existsSync(path.join(f.vault, "Pricing Decision.md")), false)
  assert.equal(listReviews(f.common).length, 1)

  const g = fixture(t)
  const second = await g.engine.remember(lowRequest(g))
  fs.writeFileSync(path.join(g.vault, "Pricing Decision.md"), "# Someone else wrote this first\n")
  const drift = await approveReview({ ...g.common, reviewId: second.reviewId, engine: g.engine })
  assert.equal(drift.status, "STALE")
  assert.equal(drift.code, "TARGET_CHANGED")
  assert.equal(fs.readFileSync(path.join(g.vault, "Pricing Decision.md"), "utf8"), "# Someone else wrote this first\n")
})

test("rejecting removes the queued request and leaves the vault untouched", async (t) => {
  const f = fixture(t)
  const before = vaultFiles(f)
  const queued = await f.engine.remember(lowRequest(f))
  assert.deepEqual(rejectReview(f.common, queued.reviewId), { reviewId: queued.reviewId, status: "rejected" })
  assert.deepEqual(listReviews(f.common), [])
  assert.deepEqual(vaultFiles(f), before)
  assert.throws(() => showReview(f.common, queued.reviewId), /REVIEW_NOT_FOUND/)
})

test("a secret is refused and never queued", async (t) => {
  const f = fixture(t)
  const secret = lowRequest(f, { claim: "Deploy with token ghp_abcdefghijklmnopqrstuvwxyz0123456789 for pricing." })
  secret.curation.patch.claim = secret.claim
  const result = await f.engine.remember(secret)
  assert.equal(result.code, "SECRET")
  assert.deepEqual(listReviews(f.common), [])
})

test("review ids cannot escape the queue directory", async (t) => {
  const f = fixture(t)
  assert.throws(() => showReview(f.common, "../../etc/passwd"), /INVALID_REVIEW_ID/)
  assert.throws(() => rejectReview(f.common, "rv_../x"), /INVALID_REVIEW_ID/)
})

test("the engine ignores approval hints that arrive through MCP-style single-argument calls", async (t) => {
  const f = fixture(t)
  const request = lowRequest(f)
  request.curation.ownerApprovedReview = "rv_0000000000000000"
  const result = await f.engine.remember(request)
  assert.equal(result.code, "LOW_CONFIDENCE")
  assert.equal(fs.existsSync(path.join(f.vault, "Pricing Decision.md")), false)
})

test("CLI lists, shows and rejects, and refuses to approve without an interactive terminal", async (t) => {
  const f = fixture(t)
  const queued = await f.engine.remember(lowRequest(f))
  const run = (...args) => spawnSync(process.execPath, [cli, "review", ...args, "--vault", f.vault, "--state-root", f.stateRoot], { encoding: "utf8", input: "" })
  assert.match(run("list").stdout, new RegExp(queued.reviewId))
  assert.match(run("show", queued.reviewId).stdout, /Claim: Pricing decisions/)
  const approve = run("approve", queued.reviewId)
  assert.notEqual(approve.status, 0)
  assert.match(approve.stderr, /OWNER_APPROVAL_REQUIRED/)
  assert.equal(fs.existsSync(path.join(f.vault, "Pricing Decision.md")), false)
  assert.equal(run("reject", queued.reviewId).status, 0)
  assert.match(run("list").stdout, /No memory is waiting/)
})
