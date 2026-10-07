import fs from "node:fs"
import path from "node:path"
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { managedRecall, relevantExcerpt } from "./decision-recall.mjs"
import { loadRuntimeConfig } from "./runtime-config.mjs"
import { loadVaultDocuments } from "./memory-recall.mjs"
import { readSourceNotes } from "./source-read.mjs"
import { withAgentReadAuthority, beginAgentRead } from "./read-authority.mjs"
import { prepareCurationCheckpoint, finishCurationCheckpoint, verifyCurationWriteBinding, inspectCurationCheckpoint, restoreCurationCheckpoint } from "./curation-checkpoint.mjs"
import { renderPatchRecord, placePatchRecord } from "./patch-record.mjs"
import { scanTextForSecrets, safeMigrationPath, assertRealPathInsideVault } from "./brain-sync.mjs"
import { writeFileAtomic } from "./atomic-write.mjs"
import { enqueueReview, approveReview, rejectReview, listReviews, showReview } from "./review-queue.mjs"
import { memoryStatus, RESTORABLE } from "./memory-status.mjs"
import { readSyncConfig, localSyncState, pullMemory, pushMemory, pendingChanges, scanVaultForSecrets } from "./vault-sync.mjs"
import { findOverlappingNotes } from "./conflict-detection.mjs"

const hash = value => createHash("sha256").update(value).digest("hex")
const fail = (code, message) => Object.assign(new Error(message), { publicCode: code })
export function publicError(error) {
  const code = error.publicCode || /^([A-Z][A-Z0-9_]+):/.exec(error.message || "")?.[1] || "OPERATION_FAILED"
  return { code, message: {
    CURATION_PENDING: "Finish or review the pending curation before reading memory.",
    STALE_SOURCE: "Source bytes changed; recall and verify the original again.",
    NEEDS_CURATION: "Supply a complete Memory Patch and reviewed placement in remember.curation.",
    LOW_CONFIDENCE: "Low-confidence memory waits for the owner's decision. Tell the user it is queued; do not retry or raise the confidence.",
    RESTORE_HASH_MISMATCH: "A note changed while the owner was deciding; nothing was restored. Call status again.",
    STATE_LOCK_OWNER_ALIVE: "Another Graphmory write is still running. Wait, then call status again.",
    SYNC_NOT_CONFIGURED: "This vault has no Git sync yet. The owner sets it up once with `graphmory bootstrap`.",
    SECRET_FOUND: "Secret-like values are in the vault, so nothing was pushed. Tell the owner which files to clean.",
    REMOTE_CHANGED: "Remote memory moved. Call sync with action: \"pull\" first; nothing was pushed.",
    CHANGED_DURING_REVIEW: "Memory changed after the owner approved; nothing was pushed. Call sync again so they see the new changes.",
    SYNC_BUSY: "Another sync is running. Wait, then try again.",
    COMMAND_FAILED: "A Git command failed. Tell the owner; `graphmory push` in a terminal shows the details.",
  }[code] || "The operation could not be completed; inspect the configured server state." }
}

// Summaries dropped from recall because a source changed. Listed so the agent can tell the user;
// limited to summaries that mention the query so unrelated stale notes do not add noise.
const RECHECK_LIMIT = 5
function summariesToRecheck(documents, query) {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [])]
  return documents
    .filter(d => d.summaryFreshness?.changedSources.length)
    .filter(d => { const text = `${d.id}\n${d.markdown}`.toLowerCase(); return terms.some(term => text.includes(term)) })
    .slice(0, RECHECK_LIMIT)
    .map(d => ({ path: d.id, changedSources: d.summaryFreshness.changedSources }))
}

// Hard paging budget per query. The server only enforces it; the host Curator still judges relevance
// and normally stops long before it (see docs/guides/mcp-recall.md for the stop rule).
export const MAX_RECALL_PAGES = 8
export const MAX_RECALL_CANDIDATES = 80
// Owner questions per status call, so one call never turns into a long run of prompts.
const REVIEW_BATCH = 5
// Changed paths listed in the push question; the rest are counted.
const PUSH_LIST_LIMIT = 15

// A single engine is shared by all HTTP connections. No host decision/provider calls.
export function createMemoryEngine({ vault, config = loadRuntimeConfig(), stateRoot, recallOptions = {} }) {
  vault = fs.realpathSync(path.resolve(vault))
  if (!fs.statSync(vault).isDirectory()) throw fail("INVALID_VAULT", "Vault must be a directory")
  if (config.workflow !== "curator") throw fail("UNSUPPORTED_WORKFLOW", "MCP requires curator mode")
  const cursorKey = randomBytes(32)
  const indexes = new Map()
  // Recheck bytes on each request; retain parsed documents and indexes across calls.
  function documents(scope = "") {
    const cached = indexes.get(scope)
    const fresh = loadVaultDocuments(vault, { scope, priorDocuments: cached?.documents })
    const fingerprint = hash(JSON.stringify(fresh.map(d => [d.id, d.markdown, d.metadata])))
    if (fingerprint === cached?.fingerprint) return cached
    const index = { documents: fresh, fingerprint }
    if (indexes.size >= 16) indexes.delete(indexes.keys().next().value)
    indexes.set(scope, index)
    return index
  }
  function seal(value) {
    const payload = Buffer.from(JSON.stringify(value)).toString("base64url")
    return `${payload}.${hash(Buffer.concat([cursorKey, Buffer.from(payload)]))}`
  }
  function open(cursor) {
    try {
      const [payload, signature, extra] = cursor.split(".")
      const expected = hash(Buffer.concat([cursorKey, Buffer.from(payload)]))
      if (extra || signature?.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw Error()
      return JSON.parse(Buffer.from(payload, "base64url").toString())
    } catch { throw fail("INVALID_CURSOR", "Recall cursor is invalid") }
  }
  async function guarded(read) {
    const result = await withAgentReadAuthority({ vault, stateRoot, read })
    if (!result.ok) throw fail(result.code, "Read authority unavailable")
    return result.value
  }
  // Asks the owner through the host's question UI. Approve writes now; reject drops the item;
  // anything else (later, dismissed, no elicitation support) leaves it queued for review.
  async function ownerDecides(askOwner, request, reviewId) {
    const queued = { status: "BLOCKED", code: "LOW_CONFIDENCE", step: "owner_review", reviewId, ...publicError(fail("LOW_CONFIDENCE", "")) }
    if (!askOwner) return { answer: { action: "unsupported" }, result: queued }
    const answer = await askOwner({
      message: `Graphmory: approve this low-confidence memory?\n\nClaim: ${request.claim}\nNote: ${request.curation.target}\nEvidence: ${request.evidence.length} item(s)`,
      choices: [
        { value: "approve", title: "Approve and save it" },
        { value: "reject", title: "Reject it" },
        { value: "later", title: "Decide later (keep it in the review queue)" },
      ],
    })
    const note = answer.note ? { ownerNote: answer.note } : {}
    if (answer.action === "accept" && answer.decision === "approve") {
      const approved = await approveReview({ vault, stateRoot, reviewId, engine })
      return { answer, result: { ...approved, ...note } }
    }
    if (answer.action === "accept" && answer.decision === "reject") {
      rejectReview({ vault, stateRoot }, reviewId)
      return { answer, result: { status: "BLOCKED", code: "OWNER_REJECTED", step: "owner_rejected", reviewId, message: "The owner rejected this memory. Nothing was written; do not retry.", ...note } }
    }
    return { answer, result: { ...queued, ...note } }
  }
  const unsupportedPush = { status: "unsupported", message: "This host cannot show owner questions, so nothing was pushed. The owner can push with `graphmory push` in a terminal." }
  const unsupported = { status: "unsupported", message: "This host cannot show owner questions. Tell the owner what is waiting; they can decide with `graphmory review list` or `graphmory curation-checkpoint status` in a terminal." }
  // Walks the review queue one question at a time and stops as soon as the owner dismisses a question.
  async function decideReviews(askOwner) {
    const items = listReviews({ vault, stateRoot }).slice(0, REVIEW_BATCH)
    if (!items.length) return { status: "nothing-to-decide" }
    const decisions = []
    for (const { reviewId } of items) {
      const { answer, result } = await ownerDecides(askOwner, showReview({ vault, stateRoot }, reviewId).request, reviewId)
      if (answer.action === "unsupported") return unsupported
      const outcome = reviewOutcome(result)
      decisions.push({ reviewId, outcome, ...(result.receipt ? { receipt: result.receipt } : {}),
        ...(outcome === "stale" || outcome === "blocked" ? { code: result.code, message: result.message } : {}),
        ...(result.ownerNote ? { ownerNote: result.ownerNote } : {}) })
      if (answer.action !== "accept") break
    }
    return { status: "decided", decisions }
  }
  // Restores the notes an interrupted write touched, only after the owner chose it in the host's UI.
  async function decideRecovery(askOwner) {
    const checkpoint = inspectCurationCheckpoint({ vault, stateRoot })
    if (!checkpoint.blocked) return { status: "nothing-to-decide" }
    if (!checkpoint.operation || !RESTORABLE.has(checkpoint.status) || checkpoint.unsafeTargets) {
      return { status: "needs-terminal", state: checkpoint.status, message: "This state cannot be restored from MCP. Ask the owner to run `graphmory curation-checkpoint status` in a terminal." }
    }
    if (!askOwner) return unsupported
    const drift = checkpoint.sourceDrift?.length ? `\nSources changed since the write began: ${checkpoint.sourceDrift.map(item => item.path).join(", ")}` : ""
    const lock = checkpoint.locked ? `\nA lock from process ${checkpoint.lockOwner?.pid ?? "unknown"} remains; Graphmory clears it only if that process has ended.` : ""
    const answer = await askOwner({
      message: `Graphmory: an interrupted memory write left ${checkpoint.targets.length} note(s) unfinished:\n${checkpoint.targets.map(target => `- ${target}`).join("\n")}\n\nRestore them to how they were before the write? Source notes are never changed.${drift}${lock}`,
      choices: [
        { value: "restore", title: "Restore the notes and discard the interrupted write" },
        { value: "leave", title: "Leave it for now (recall and remember stay blocked)" },
      ],
      note: false,
    })
    if (answer.action === "unsupported") return unsupported
    if (answer.action !== "accept" || answer.decision !== "restore") return { status: "kept", operation: checkpoint.operation }
    try {
      const restored = restoreCurationCheckpoint({ vault, stateRoot, operation: checkpoint.operation, expectedHashes: checkpoint.expectedHashes, approve: true,
        ...(checkpoint.locked ? { reviewLockHash: checkpoint.lockOwnerSha256 ?? "" } : {}) })
      indexes.clear()
      return { status: "restored", operation: checkpoint.operation, restored: restored.restored, sourceDrift: restored.sourceDrift.map(item => item.path) }
    } catch (error) { return { status: "BLOCKED", operation: checkpoint.operation, ...publicError(error) } }
  }
  const engine = {
    async recall({ query, scope = "", cursor }) {
      return guarded(async () => {
        const index = documents(scope)
        const page = cursor ? open(cursor) : { offset: 0, page: 1 }
        const pageNumber = page.page ?? 1
        if (cursor && (page.query !== query || page.scope !== scope || page.fingerprint !== index.fingerprint)) throw fail("STALE_CURSOR", "Recall snapshot changed")
        const report = await managedRecall(vault, query, config, { ...recallOptions, stateRoot, scope, offset: page.offset, suppliedDocuments: index.documents })
        if (report.status === "BLOCKED") throw fail(report.code, "Recall blocked")
        const byId = new Map(index.documents.map(d => [d.id, d]))
        const candidates = report.results.map(item => {
          const document = byId.get(item.path)
          if (!document) throw fail("STALE_SOURCE", "Candidate changed")
          const source = readSourceNotes(vault, [item.path]).sources[0]
          if (source.markdown !== document.markdown) throw fail("STALE_SOURCE", "Candidate changed")
          return { path: item.path, heading: item.title, excerpt: relevantExcerpt(document, query).replace(/\s+/g, " ").slice(0, 180),
            hash: source.sha256, lanes: item.lanes ?? report.candidateLanes ?? ["keyword"] }
        })
        if (documents(scope).fingerprint !== index.fingerprint) throw fail("STALE_SOURCE", "Vault changed during recall")
        const recheck = cursor ? [] : summariesToRecheck(index.documents, query)
        const budgetReached = Boolean(report.hasMore) && (pageNumber >= MAX_RECALL_PAGES || report.nextOffset >= MAX_RECALL_CANDIDATES)
        return { candidates, page: pageNumber, scanLimitReached: Boolean(report.scanLimitReached),
          ...(recheck.length ? { recheck } : {}),
          ...(report.status === "abstain" ? { status: "abstain", code: "ABSTAIN_FLOOR" } : {}),
          ...(budgetReached ? { budgetReached: true } : {}),
          ...(report.hasMore && !budgetReached ? { nextCursor: seal({ query, scope, fingerprint: index.fingerprint, offset: report.nextOffset, page: pageNumber + 1 }) } : {}) }
      })
    },
    async read({ path: relative, section, hash: expected }) {
      return guarded(() => {
        const source = readSourceNotes(vault, [relative]).sources[0]
        if (expected && expected !== source.sha256) throw fail("STALE_SOURCE", "Source changed")
        let markdown = source.markdown
        if (section) {
          const lines = markdown.split(/(?<=\n)/)
          let start = -1, end = lines.length, depth, fenced = false
          for (let i = 0; i < lines.length; i++) {
            if (/^\s*(```|~~~)/.test(lines[i])) { fenced = !fenced; continue }
            const heading = !fenced && /^(#{1,6})\s+(.+?)\s*\r?\n?$/.exec(lines[i])
            if (!heading) continue
            if (start < 0 && heading[2] === section.replace(/^#+\s*/, "")) { start = i; depth = heading[1].length }
            else if (start >= 0 && heading[1].length <= depth) { end = i; break }
          }
          if (start < 0) throw fail("SECTION_NOT_FOUND", "Section not found")
          markdown = lines.slice(start, end).join("")
        }
        return { path: source.path, hash: source.sha256, ...(section ? { section } : {}), authority: "source-data", markdown }
      })
    },
    // Tool input never reaches `options`: the server adds only its own askOwner callback, and
    // ownerApprovedReview is set only by approveReview after the owner decided.
    async remember(input, options = {}) {
      let operation
      try {
        const { claim, scope, evidence, curation } = input
        if (!curation) return { status: "BLOCKED", ...publicError(fail("NEEDS_CURATION", "")), step: "needs_curation" }
        const { patch, target, targetHashes, supportVerified, conflictsReviewed, authorized, conflictPath, stage = "apply" } = curation
        if (conflictPath) {
          const source = await guarded(() => readSourceNotes(vault, [conflictPath]).sources[0])
          return { status: "TENSION", code: "CONFLICT", conflictingNote: { path: source.path, hash: source.sha256 } }
        }
        if (!patch || !target || !targetHashes) return { status: "BLOCKED", ...publicError(fail("NEEDS_CURATION", "")), step: "needs_curation" }
        if (!supportVerified || !conflictsReviewed || !authorized) throw fail("REVIEW_REQUIRED", "Host review and authorization required")
        if (patch?.claim !== claim || JSON.stringify(patch?.scope) !== JSON.stringify(scope)) throw fail("PATCH_BINDING_MISMATCH", "Claim and scope must match patch")
        renderPatchRecord(patch) // Rejects a patch outside the record contract before any vault check.
        if (scanTextForSecrets(JSON.stringify(input)).length) throw fail("SECRET", "Secret-like content refused")
        if (safeMigrationPath(target, "target") !== target || !target.endsWith(".md")) throw fail("INVALID_TARGET", "Exact Markdown target required")
        const predecessors = patch.lifecycle.supersedes ?? []
        const targets = [target, ...predecessors]
        if (new Set(targets).size !== targets.length) throw fail("INVALID_TARGET", "Duplicate target")
        const lowConfidence = patch.confidence === "low" && !options.ownerApprovedReview
        if (lowConfidence && curation.operation) throw fail("LOW_CONFIDENCE", "Low-confidence memory needs owner review outside MCP")
        const sources = evidence.filter(e => e.path).map(e => e.path)
        if (new Set(sources).size !== sources.length) throw fail("INVALID_EVIDENCE", "Duplicate source")
        if (curation.operation) {
          operation = curation.operation
          verifyCurationWriteBinding({ vault, stateRoot, operation, patch, targets, sources, expectedHashes: targetHashes })
        } else {
          const authority = beginAgentRead({ vault, stateRoot })
          if (!authority.ok) throw fail(authority.code, "Pending curation")
        }
        for (const e of evidence) {
          if (e.path) {
            const source = readSourceNotes(vault, [e.path]).sources[0]
            if (source.sha256 !== e.hash) throw fail("STALE_SOURCE", "Evidence changed")
            if (!patch.provenance.some(p => p.kind === "file" && p.value.split("#")[0] === e.path)) throw fail("UNRESOLVED_PROVENANCE", "Evidence must be bound to patch")
          } else if (!patch.provenance.some(p => p.kind === "user-statement" && p.value === e.quote)) throw fail("UNRESOLVED_PROVENANCE", "Quote attribution missing")
        }
        if (patch.provenance.some(p => p.kind === "file" ? !sources.includes(p.value.split("#")[0]) : p.kind !== "user-statement" || !evidence.some(e => e.quote === p.value))) throw fail("UNRESOLVED_PROVENANCE", "All provenance must be verified")
        const absolute = path.resolve(vault, target)
        assertRealPathInsideVault(fs, vault, absolute, "target")
        if (!curation.operation) {
          if (!targetHashes || Object.keys(targetHashes).length !== targets.length) throw fail("INVALID_EXPECTED_HASHES", "Every target needs a reviewed hash")
          for (const relative of targets) {
            const file = path.resolve(vault, relative)
            assertRealPathInsideVault(fs, vault, file, "target")
            const actual = fs.existsSync(file) ? readSourceNotes(vault, [relative]).sources[0].sha256 : null
            if (!Object.hasOwn(targetHashes, relative) || actual !== targetHashes[relative]) throw fail("TARGET_CHANGED", "Target changed since review")
          }
          // Placement into an existing note keeps the owner's content; check it can be placed before preparing.
          placePatchRecord(fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : null, patch)
          // The host attests it reviewed conflicts, but the engine still checks that it looked at every
          // overlapping active note, by current hash. The host decides; the engine refuses to skip the question.
          const overlapping = findOverlappingNotes({ documents: documents().documents, patch, exclude: [...targets, ...sources] })
            .map(({ path: overlap }) => ({ path: overlap, hash: readSourceNotes(vault, [overlap]).sources[0].sha256 }))
          const unreviewed = overlapping.filter(note => curation.reviewedConflicts?.[note.path] !== note.hash)
          if (unreviewed.length) return { status: "TENSION", code: "CONFLICT", conflictingNotes: unreviewed,
            message: "Read these notes. If the change replaces one, list it in lifecycle.supersedes. Then repeat remember with curation.reviewedConflicts mapping each path to its hash." }
          if (lowConfidence) {
            const { reviewId } = enqueueReview({ vault, stateRoot, request: input })
            return (await ownerDecides(options.askOwner, input, reviewId)).result
          }
          const prepared = prepareCurationCheckpoint({ vault, stateRoot, patch, targets, sources })
          operation = prepared.operation
          if (prepared.replayed) return { status: "APPLIED", receipt: compactReceipt(prepared.receipt), replayed: true }
        }
        if (stage === "prepare") return { status: "BLOCKED", code: "NEEDS_CURATION", step: "needs_curation", checkpoint: operation,
          message: "Complete this reviewed placement using remember with curation.operation and current target hashes." }
        verifyCurationWriteBinding({ vault, stateRoot, operation, patch, targets, sources, expectedHashes: targetHashes })
        // The binding check above confirmed the target still has its reviewed bytes, so placement is deterministic.
        const current = fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : null
        const placed = placePatchRecord(current, patch)
        fs.mkdirSync(path.dirname(absolute), { recursive: true })
        // Binding check includes the full inventory immediately before the write.
        assertRealPathInsideVault(fs, vault, absolute, "target")
        if (placed !== current) writeFileAtomic(absolute, placed)
        const finished = finishCurationCheckpoint({ vault, stateRoot, operation, patch, notePath: target })
        indexes.clear()
        return { status: "APPLIED", receipt: { ...compactReceipt(finished.receipt), ...(options.ownerApprovedReview ? { approvedBy: "owner", reviewId: options.ownerApprovedReview } : {}) } }
      } catch (error) { return { status: "BLOCKED", ...publicError(error), ...(operation ? { checkpoint: operation } : {}) } }
    },
    // Pull only fast-forwards. Push commits and publishes only after the owner approved the exact
    // changes in the host's question UI; the approval is bound to their bytes.
    async sync({ action, message }, options = {}) {
      try {
        const config = readSyncConfig(vault)
        if (!config || config.unreadable) throw fail("SYNC_NOT_CONFIGURED", "No sync config")
        if (inspectCurationCheckpoint({ vault, stateRoot }).blocked) throw fail("CURATION_PENDING", "Pending curation")
        const branch = typeof config.branch === "string" ? config.branch : "main"
        if (action === "pull") {
          const pulled = pullMemory(vault, { branch })
          indexes.clear()
          return { status: pulled.status, safeToContinue: pulled.safeToContinue, detail: pulled.detail }
        }
        const commitMessage = message ?? `memory: update brain snapshot ${new Date().toISOString().slice(0, 10)}`
        if (scanTextForSecrets(commitMessage).length) throw fail("SECRET", "Secret-like content refused")
        const { changes, snapshot } = pendingChanges(vault)
        const unpushed = localSyncState(vault).commitsAhead ?? 0
        if (!changes.length && !unpushed) return { status: "no-changes" }
        const secrets = scanVaultForSecrets(vault)
        if (secrets.length) return { status: "BLOCKED", ...publicError(fail("SECRET_FOUND", "")), files: [...new Set(secrets.map(item => item.file))] }
        if (!options.askOwner) return unsupportedPush
        const listed = changes.slice(0, PUSH_LIST_LIMIT).map(item => `- ${item.path}`)
        if (changes.length > PUSH_LIST_LIMIT) listed.push(`- and ${changes.length - PUSH_LIST_LIMIT} more`)
        const answer = await options.askOwner({
          message: `Graphmory: commit and push memory to ${config.repo ?? "the configured repository"} (${branch})?\n\n${changes.length} changed file(s)${listed.length ? `:\n${listed.join("\n")}` : ""}${unpushed ? `\n${unpushed} local commit(s) not pushed yet` : ""}\n\nCommit message: ${commitMessage}`,
          choices: [{ value: "push", title: "Commit and push" }, { value: "later", title: "Not now" }],
          note: false,
        })
        if (answer.action === "unsupported") return unsupportedPush
        if (answer.action !== "accept" || answer.decision !== "push") return { status: "kept", message: "The owner chose not to push. Nothing was committed." }
        const pushed = pushMemory(vault, { branch }, commitMessage, { expectedSnapshot: snapshot })
        return { ...pushed, approvedBy: "owner" }
      } catch (error) { return { status: "BLOCKED", ...publicError(error) } }
    },
    // Read-only report. With ask, the server puts the owner's decisions to them and reports the outcome.
    async status({ ask } = {}, options = {}) {
      const owner = ask === "reviews" ? await decideReviews(options.askOwner)
        : ask === "recovery" ? await decideRecovery(options.askOwner) : undefined
      return { ...memoryStatus({ vault, stateRoot }), ...(owner ? { owner } : {}) }
    },
  }
  return engine
}
function reviewOutcome(result) {
  if (result.status === "APPLIED") return "approved"
  if (result.status === "STALE") return "stale"
  if (result.code === "OWNER_REJECTED") return "rejected"
  if (result.code === "LOW_CONFIDENCE") return "kept"
  return "blocked"
}
function compactReceipt(receipt) {
  if (!receipt) return undefined
  return { operation: receipt.operation, patchDigest: receipt.patchDigest, notePath: receipt.notePath, targetHashes: receipt.targetHashes, sourceHashes: receipt.sourceHashes }
}
