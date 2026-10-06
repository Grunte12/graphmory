import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./atomic-write.mjs"
import { privateVaultStateLocation } from "./curation-checkpoint.mjs"

// Low-confidence memory waits here for the owner. The queue lives in the private state root,
// outside the vault, so a queued request is never recalled and never counts as memory.
const REVIEW_ID = /^rv_[a-f0-9]{16}$/u
const MAX_PENDING = 50

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex")
const failure = (code, message) => Object.assign(new Error(`${code}: ${message}`), { publicCode: code })

function reviewsDirectory(options, create) {
  const { stateRoot, vaultKey } = privateVaultStateLocation({ ...options, create })
  const directory = path.join(stateRoot, "reviews", vaultKey)
  if (create) fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  return directory
}

function reviewFile(options, reviewId, create = false) {
  if (typeof reviewId !== "string" || !REVIEW_ID.test(reviewId)) throw failure("INVALID_REVIEW_ID", "Expected a review id such as rv_0123456789abcdef")
  return path.join(reviewsDirectory(options, create), `${reviewId}.json`)
}

function readItem(file) {
  let item
  try { item = JSON.parse(fs.readFileSync(file, "utf8")) } catch (error) {
    if (error.code === "ENOENT") throw failure("REVIEW_NOT_FOUND", "No such review")
    throw failure("REVIEW_UNREADABLE", "Review record is unreadable")
  }
  return item
}

function summarize(item) {
  return { reviewId: item.reviewId, status: item.status, createdAt: item.createdAt, claim: item.request.claim,
    target: item.request.curation.target, confidence: item.request.curation.patch.confidence }
}

/** Queue a fully checked request. The same request always maps to the same review id. */
export function enqueueReview({ vault, stateRoot, request, now = new Date() }) {
  const reviewId = `rv_${sha256(JSON.stringify(request)).slice(0, 16)}`
  const file = reviewFile({ vault, stateRoot }, reviewId, true)
  if (fs.existsSync(file) && readItem(file).status === "pending") return { reviewId, queued: false }
  const pending = fs.readdirSync(path.dirname(file)).filter((name) => name.endsWith(".json") && readItem(path.join(path.dirname(file), name)).status === "pending")
  if (pending.length >= MAX_PENDING) throw failure("REVIEW_QUEUE_FULL", "Too many memories wait for review; clear some first")
  writeJsonAtomic(file, { version: 1, reviewId, status: "pending", createdAt: now.toISOString(), request })
  try { fs.chmodSync(file, 0o600) } catch { /* Best effort on platforms without POSIX modes. */ }
  return { reviewId, queued: true }
}

export function listReviews(options) {
  const directory = reviewsDirectory(options, false)
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory).filter((name) => /^rv_[a-f0-9]{16}\.json$/u.test(name))
    .map((name) => readItem(path.join(directory, name))).filter((item) => item.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.reviewId.localeCompare(b.reviewId)).map(summarize)
}

export function showReview(options, reviewId) {
  const item = readItem(reviewFile(options, reviewId))
  return { ...summarize(item), request: item.request }
}

/** Rejecting removes the queued request; the vault is never touched. */
export function rejectReview(options, reviewId) {
  const file = reviewFile(options, reviewId)
  readItem(file)
  fs.unlinkSync(file)
  return { reviewId, status: "rejected" }
}

/**
 * Owner approval. The engine re-checks every source and target hash and runs the normal
 * checkpoint flow, so drift reports STALE and writes nothing; the item then stays pending.
 */
export async function approveReview({ vault, stateRoot, reviewId, engine, now = new Date() }) {
  const options = { vault, stateRoot }
  const file = reviewFile(options, reviewId)
  const item = readItem(file)
  if (item.status !== "pending") throw failure("REVIEW_NOT_PENDING", "This review was already decided")
  const result = await engine.remember(item.request, { ownerApprovedReview: reviewId })
  if (result.status === "BLOCKED" && ["STALE_SOURCE", "TARGET_CHANGED"].includes(result.code)) {
    return { status: "STALE", code: result.code, reviewId, message: "A source or target changed since the request was queued. Nothing was written; ask the agent to review and remember again, then reject this item." }
  }
  if (result.status !== "APPLIED") return { ...result, reviewId }
  writeJsonAtomic(file, { ...item, status: "approved", approvedBy: "owner", approvedAt: now.toISOString(), receipt: result.receipt })
  try { fs.chmodSync(file, 0o600) } catch { /* Best effort on platforms without POSIX modes. */ }
  return result
}
