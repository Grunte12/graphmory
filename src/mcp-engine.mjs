import fs from "node:fs"
import path from "node:path"
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { managedRecall, relevantExcerpt } from "./decision-recall.mjs"
import { loadRuntimeConfig } from "./runtime-config.mjs"
import { loadVaultDocuments } from "./memory-recall.mjs"
import { readSourceNotes } from "./source-read.mjs"
import { withAgentReadAuthority, beginAgentRead } from "./read-authority.mjs"
import { prepareCurationCheckpoint, finishCurationCheckpoint, verifyCurationWriteBinding } from "./curation-checkpoint.mjs"
import { renderPatchRecord } from "./patch-record.mjs"
import { scanTextForSecrets, safeMigrationPath, assertRealPathInsideVault } from "./brain-sync.mjs"
import { writeFileAtomic } from "./atomic-write.mjs"

const hash = value => createHash("sha256").update(value).digest("hex")
const fail = (code, message) => Object.assign(new Error(message), { publicCode: code })
export function publicError(error) {
  const code = error.publicCode || /^([A-Z][A-Z0-9_]+):/.exec(error.message || "")?.[1] || "OPERATION_FAILED"
  return { code, message: {
    CURATION_PENDING: "Finish or review the pending curation before reading memory.",
    STALE_SOURCE: "Source bytes changed; recall and verify the original again.",
    NEEDS_CURATION: "Supply a complete Memory Patch and reviewed placement in remember.curation.",
  }[code] || "The operation could not be completed; inspect the configured server state." }
}

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
  return {
    async recall({ query, scope = "", cursor }) {
      return guarded(async () => {
        const index = documents(scope)
        const page = cursor ? open(cursor) : { offset: 0 }
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
        return { candidates, scanLimitReached: Boolean(report.scanLimitReached),
          ...(report.status === "abstain" ? { status: "abstain", code: "ABSTAIN_FLOOR" } : {}),
          ...(report.hasMore ? { nextCursor: seal({ query, scope, fingerprint: index.fingerprint, offset: report.nextOffset }) } : {}) }
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
    async remember(input) {
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
        const record = renderPatchRecord(patch)
        if (scanTextForSecrets(JSON.stringify(input)).length) throw fail("SECRET", "Secret-like content refused")
        if (safeMigrationPath(target, "target") !== target || !target.endsWith(".md")) throw fail("INVALID_TARGET", "Exact Markdown target required")
        const predecessors = patch.lifecycle.supersedes ?? []
        const targets = [target, ...predecessors]
        if (new Set(targets).size !== targets.length) throw fail("INVALID_TARGET", "Duplicate target")
        if (patch.confidence === "low") throw fail("LOW_CONFIDENCE", "Low-confidence memory needs owner review outside MCP")
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
          // Deterministic placement creates a new canonical note; existing notes are preserved.
          if (fs.existsSync(absolute) && fs.readFileSync(absolute, "utf8") !== record) throw fail("NEEDS_CURATION", "Existing target requires reviewed merge via CLI")
          const prepared = prepareCurationCheckpoint({ vault, stateRoot, patch, targets, sources })
          operation = prepared.operation
          if (prepared.replayed) return { status: "APPLIED", receipt: compactReceipt(prepared.receipt), replayed: true }
        }
        if (stage === "prepare") return { status: "BLOCKED", code: "NEEDS_CURATION", step: "needs_curation", checkpoint: operation,
          message: "Complete this reviewed placement using remember with curation.operation and current target hashes." }
        verifyCurationWriteBinding({ vault, stateRoot, operation, patch, targets, sources, expectedHashes: targetHashes })
        if (fs.existsSync(absolute) && fs.readFileSync(absolute, "utf8") !== record) throw fail("NEEDS_CURATION", "Existing content cannot be overwritten")
        fs.mkdirSync(path.dirname(absolute), { recursive: true })
        // Binding check includes the full inventory immediately before the write.
        assertRealPathInsideVault(fs, vault, absolute, "target")
        writeFileAtomic(absolute, record)
        const finished = finishCurationCheckpoint({ vault, stateRoot, operation, patch, notePath: target })
        indexes.clear()
        return { status: "APPLIED", receipt: compactReceipt(finished.receipt) }
      } catch (error) { return { status: "BLOCKED", ...publicError(error), ...(operation ? { checkpoint: operation } : {}) } }
    },
  }
}
function compactReceipt(receipt) {
  if (!receipt) return undefined
  return { operation: receipt.operation, patchDigest: receipt.patchDigest, notePath: receipt.notePath, targetHashes: receipt.targetHashes, sourceHashes: receipt.sourceHashes }
}
