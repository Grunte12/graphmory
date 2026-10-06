import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assertRealPathInsideVault, createNoteLinkResolver, safeMigrationPath } from "./brain-sync.mjs"
import { writeFileAtomic, writeJsonAtomic } from "./atomic-write.mjs"
import { validateMemoryPatch } from "./contracts.mjs"
import { auditDocuments } from "./memory-lifecycle-audit.mjs"
import { parseMarkdown } from "./retrieval.mjs"
import { buildNoteGraph } from "./graph-navigation.mjs"
import { createSourceHandoff } from "./source-handoff.mjs"
import { readSourceNotes } from "./source-read.mjs"
import { patchDigest, renderPatchRecord } from "./patch-record.mjs"
import { verifyCanonicalPatchRecord, verifyPatchPersistence } from "./patch-persistence.mjs"
import { planPredecessorTransition } from "./lifecycle-transition.mjs"

const PROTOCOL = "graphmory-curation-checkpoint-v1"
const MAX_MARKDOWN_FILES = 5000
const STATE_MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const HEX_SHA256 = /^[a-f0-9]{64}$/u
const EXCLUDED_DIRECTORY_NAMES = new Set([".git", "node_modules"])

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child)
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

function defaultStateRoot() {
  if (process.env.GRAPHMORY_STATE_DIR) return path.resolve(process.env.GRAPHMORY_STATE_DIR)
  if (process.platform === "win32") return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Graphmory", "state")
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "Graphmory", "state")
  return path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state"), "graphmory")
}

function mkdirPrivate(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  try { fs.chmodSync(directory, 0o700) } catch { /* ACLs or platform permissions may not expose chmod. */ }
}

function writePrivateJson(file, value) {
  writeJsonAtomic(file, value)
  try { fs.chmodSync(file, 0o600) } catch { /* Best effort on platforms without POSIX modes. */ }
}

function writePrivateBytes(file, bytes) {
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`
  try {
    fs.writeFileSync(temporary, bytes, { flag: "wx", mode: 0o600 })
    try { fs.chmodSync(temporary, 0o600) } catch { /* Best effort on platforms without POSIX modes. */ }
    fs.renameSync(temporary, file)
    try { fs.chmodSync(file, 0o600) } catch { /* Best effort on platforms without POSIX modes. */ }
  } catch (error) {
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) } catch { /* Preserve the original error. */ }
    throw error
  }
}

function resolveVault(vault) {
  if (typeof vault !== "string" || !vault.trim()) throw new Error("VAULT_REQUIRED: vault path is required")
  const root = fs.realpathSync(path.resolve(vault))
  if (!fs.statSync(root).isDirectory()) throw new Error("INVALID_VAULT: vault path is not a directory")
  return root
}

function resolveState(vaultRoot, requestedRoot, { create = true } = {}) {
  const raw = requestedRoot === undefined ? defaultStateRoot() : requestedRoot
  if (typeof raw !== "string" || !raw.trim()) throw new Error("STATE_ROOT_REQUIRED: state root is required")
  const requested = path.resolve(raw)
  let nearest = requested
  while (!fs.existsSync(nearest)) {
    const parent = path.dirname(nearest)
    if (parent === nearest) break
    nearest = parent
  }
  const nearestReal = fs.realpathSync(nearest)
  const prospective = path.resolve(nearestReal, path.relative(nearest, requested))
  if (isWithin(vaultRoot, prospective)) throw new Error("UNSAFE_STATE_ROOT: curation state must be outside the vault")
  if (isWithin(STATE_MODULE_ROOT, prospective)) throw new Error("UNSAFE_STATE_ROOT: curation state must be outside the source checkout")
  if (create) mkdirPrivate(requested)
  if (!fs.existsSync(requested)) {
    return { vaultRoot, stateRoot: requested, vaultDir: path.join(requested, "vaults", sha256(vaultRoot)), operationsDir: path.join(requested, "vaults", sha256(vaultRoot), "operations"), exists: false }
  }
  const stateRoot = fs.realpathSync(requested)
  if (isWithin(vaultRoot, stateRoot)) throw new Error("UNSAFE_STATE_ROOT: curation state must be outside the vault")
  if (isWithin(STATE_MODULE_ROOT, stateRoot)) throw new Error("UNSAFE_STATE_ROOT: curation state must be outside the source checkout")
  const vaultDir = path.join(stateRoot, "vaults", sha256(vaultRoot))
  let vaultDirStat
  try { vaultDirStat = fs.lstatSync(vaultDir) }
  catch (error) {
    if (error.code !== "ENOENT") throw new Error("CHECKPOINT_STATE_UNREADABLE: cannot inspect vault state")
  }
  if (vaultDirStat && (vaultDirStat.isSymbolicLink() || !vaultDirStat.isDirectory())) {
    throw new Error("CHECKPOINT_STATE_UNREADABLE: vault state is not a regular directory")
  }
  return { vaultRoot, stateRoot, vaultDir, operationsDir: path.join(vaultDir, "operations"), exists: Boolean(vaultDirStat) }
}

/**
 * Private per-vault location for sibling state (such as the review queue). It sits beside, not inside,
 * the checkpoint directory so that checkpoint inspection never sees it. Outside the vault and the checkout.
 */
export function privateVaultStateLocation({ vault, stateRoot, create = true } = {}) {
  const vaultRoot = resolveVault(vault)
  const context = resolveState(vaultRoot, stateRoot, { create })
  return { stateRoot: context.stateRoot, vaultKey: sha256(vaultRoot) }
}

function relativeMarkdownPath(value, label) {
  const normalized = safeMigrationPath(value, label)
  if (normalized !== value || normalized.includes("\\") || !normalized.endsWith(".md")) {
    throw new Error(`INVALID_${label.toUpperCase().replaceAll(" ", "_")}: expected an exact relative .md path`)
  }
  if (normalized.split("/").some((part) => EXCLUDED_DIRECTORY_NAMES.has(part))) {
    throw new Error(`INVALID_${label.toUpperCase().replaceAll(" ", "_")}: path is outside checkpoint inventory coverage`)
  }
  return normalized
}

function validatePathArray(values, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) throw new Error(`INVALID_${label}: expected a ${allowEmpty ? "JSON array" : "non-empty JSON array"}`)
  const paths = values.map((value) => relativeMarkdownPath(value, `${label} path`))
  if (new Set(paths).size !== paths.length) throw new Error(`INVALID_${label}: duplicate paths are not allowed`)
  return paths
}

function assertNoSymlinkPath(vaultRoot, relative, { mayBeMissing = false } = {}) {
  const pieces = relative.split("/")
  let current = vaultRoot
  for (let index = 0; index < pieces.length; index++) {
    current = path.join(current, pieces[index])
    let stat
    try { stat = fs.lstatSync(current) } catch (error) {
      if (error.code === "ENOENT" && mayBeMissing) break
      throw new Error(`UNSAFE_VAULT_PATH: ${relative} cannot be inspected safely`)
    }
    if (stat.isSymbolicLink()) throw new Error(`UNSAFE_VAULT_PATH: ${relative} contains a symbolic link`)
    if (index < pieces.length - 1 && !stat.isDirectory()) throw new Error(`UNSAFE_VAULT_PATH: parent of ${relative} is not a directory`)
  }
  assertRealPathInsideVault(fs, vaultRoot, path.resolve(vaultRoot, relative), relative)
}

function physicalIdentity(vaultRoot, relative, mayBeMissing) {
  assertNoSymlinkPath(vaultRoot, relative, { mayBeMissing })
  const candidate = path.resolve(vaultRoot, relative)
  try {
    const stat = fs.statSync(candidate)
    if (stat.isFile()) return `inode:${stat.dev}:${stat.ino}`
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
  let existing = candidate
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing)
    if (parent === existing) break
    existing = parent
  }
  const realParent = fs.realpathSync(existing)
  const suffix = path.relative(existing, candidate)
  const identity = path.resolve(realParent, suffix)
  return process.platform === "win32" ? identity.toLowerCase() : identity
}

function assertRegularMarkdown(vaultRoot, relative, { mayBeMissing = false } = {}) {
  assertNoSymlinkPath(vaultRoot, relative, { mayBeMissing })
  const absolute = path.resolve(vaultRoot, relative)
  try {
    const stat = fs.lstatSync(absolute)
    if (!stat.isFile()) throw new Error(`UNSAFE_VAULT_PATH: ${relative} is not a regular file`)
    return stat
  } catch (error) {
    if (error.code === "ENOENT" && mayBeMissing) return null
    throw error
  }
}

function inventoryVault(vaultRoot) {
  const markdown = new Map()
  const metadata = new Map()
  const stack = [""]
  while (stack.length) {
    const relativeDirectory = stack.pop()
    const absoluteDirectory = relativeDirectory ? path.join(vaultRoot, relativeDirectory) : vaultRoot
    let entries
    try { entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)) }
    catch { throw new Error(`INCOMPLETE_INVENTORY: cannot read directory ${relativeDirectory || "."}`) }
    for (const entry of entries) {
      if (EXCLUDED_DIRECTORY_NAMES.has(entry.name)) continue
      const relative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name
      const absolute = path.join(vaultRoot, relative)
      let stat
      try { stat = fs.lstatSync(absolute) }
      catch { throw new Error(`INCOMPLETE_INVENTORY: cannot inspect ${relative}`) }
      if (stat.isSymbolicLink()) throw new Error(`INCOMPLETE_INVENTORY: symbolic link prevents coverage at ${relative}`)
      if (stat.isDirectory()) {
        stack.push(relative)
        continue
      }
      if (!stat.isFile()) {
        if (relative.toLowerCase().endsWith(".md") || (relative.startsWith(".obsidian/") && relative.toLowerCase().endsWith(".json"))) {
          throw new Error(`INCOMPLETE_INVENTORY: non-regular covered file ${relative}`)
        }
        continue
      }
      const isMarkdown = path.extname(entry.name).toLowerCase() === ".md"
      const isObsidianJson = relative.startsWith(".obsidian/") && path.extname(entry.name).toLowerCase() === ".json"
      if (!isMarkdown && !isObsidianJson) continue
      if (isMarkdown && markdown.size >= MAX_MARKDOWN_FILES) throw new Error("INCOMPLETE_INVENTORY: vault exceeds the 5,000 Markdown file cap")
      assertRealPathInsideVault(fs, vaultRoot, absolute, relative)
      let bytes
      try { bytes = fs.readFileSync(absolute) }
      catch { throw new Error(`INCOMPLETE_INVENTORY: cannot read covered file ${relative}`) }
      const entryInfo = { sha256: sha256(bytes), bytes: bytes.length, mode: stat.mode & 0o777 }
      if (isMarkdown) markdown.set(relative, { ...entryInfo, markdown: bytes.toString("utf8") })
      else metadata.set(relative, entryInfo)
    }
  }
  return { markdown, metadata }
}

function inventoryHashes(inventory) {
  const result = {}
  for (const [relative, item] of [...inventory.markdown, ...inventory.metadata].sort(([a], [b]) => a.localeCompare(b))) {
    result[relative] = item.sha256
  }
  return result
}

function graphTargetEdges(graph, targets) {
  const targetSet = new Set(targets)
  const edges = []
  for (const [key, details] of graph.edgeDetails) {
    const [source, target] = JSON.parse(key)
    if (!targetSet.has(source) && !targetSet.has(target)) continue
    edges.push({ source, target, relations: [...new Set(details.map((edge) => edge.relation))].sort() })
  }
  return edges.sort((a, b) => `${a.source}\0${a.target}`.localeCompare(`${b.source}\0${b.target}`))
}

function captureBaseline(inventory, now = new Date(), targets = []) {
  const documents = [...inventory.markdown].map(([id, item]) => parseMarkdown(id, item.markdown))
  const graph = buildNoteGraph(documents)
  if (graph.limitReached) throw new Error("INCOMPLETE_GRAPH: graph audit reached a traversal limit")
  const lifecycle = auditDocuments(documents, now, { inventoryComplete: true })
    .map(({ severity, kind, file }) => ({ severity, kind, file }))
  return {
    documents,
    summary: {
      graph: { issueCounts: graph.issueCounts, issues: graph.issues, edges: graph.edges },
      lifecycle,
      capturedAt: now.toISOString(),
      targetEdges: graphTargetEdges(graph, targets),
    },
  }
}

function operationId() {
  return crypto.randomUUID()
}

function listOperationRecords(context) {
  let operationsStat
  try { operationsStat = fs.lstatSync(context.operationsDir) }
  catch (error) {
    if (error.code === "ENOENT" && !context.exists) return []
    if (error.code === "ENOENT") throw new Error("CHECKPOINT_STATE_UNREADABLE: operation directory is missing")
    throw new Error("CHECKPOINT_STATE_UNREADABLE: cannot inspect operation directory")
  }
  if (operationsStat.isSymbolicLink() || !operationsStat.isDirectory()) {
    throw new Error("CHECKPOINT_STATE_UNREADABLE: operation directory is not a regular directory")
  }
  let entries
  try { entries = fs.readdirSync(context.operationsDir).sort() }
  catch { throw new Error("CHECKPOINT_STATE_UNREADABLE: cannot list operation state") }
  return entries.map((id) => {
    const directory = path.join(context.operationsDir, id)
    const manifestPath = path.join(directory, "manifest.json")
    try {
      const stat = fs.lstatSync(directory)
      if (stat.isSymbolicLink() || !stat.isDirectory()) return { id, status: "interrupted-registration", corrupt: true }
      let manifestStat
      try { manifestStat = fs.lstatSync(manifestPath) }
      catch (error) {
        if (error.code === "ENOENT") return { id, status: "interrupted-registration", corrupt: true }
        throw error
      }
      if (manifestStat.isSymbolicLink() || !manifestStat.isFile()) return { id, status: "interrupted-registration", corrupt: true }
      const manifestBytes = fs.readFileSync(manifestPath)
      const manifest = JSON.parse(manifestBytes.toString("utf8"))
      if (manifest.protocol !== PROTOCOL || manifest.operationId !== id || manifest.vaultRoot !== context.vaultRoot || !Array.isArray(manifest.targets)
        || !Array.isArray(manifest.sources) || !["pending", "recovery-in-progress", "complete", "recovered", "interrupted-registration"].includes(manifest.status)
        || manifest.targets.some((item) => !item || typeof item.path !== "string")) {
        return { id, status: "interrupted-registration", corrupt: true, manifestSha256: sha256(manifestBytes) }
      }
      return { id, manifest, manifestSha256: sha256(manifestBytes) }
    } catch {
      let manifestSha256 = null
      try { manifestSha256 = sha256(fs.readFileSync(manifestPath)) } catch { /* missing/unreadable state stays fail-closed */ }
      return { id, status: "interrupted-registration", corrupt: true, manifestSha256 }
    }
  })
}

function authorityToken(context, lock, records) {
  const state = {
    vaultRoot: context.vaultRoot,
    stateRoot: context.stateRoot,
    vaultStateExists: context.exists,
    lock: { locked: lock.locked, ownerSha256: lock.lockOwnerSha256,
      status: lock.lockOwner?.status ?? null },
    operations: records.map((record) => ({
      id: record.id,
      status: record.manifest?.status ?? record.status ?? "interrupted-registration",
      manifestSha256: record.manifestSha256 ?? null,
      corrupt: Boolean(record.corrupt),
    })).sort((left, right) => left.id.localeCompare(right.id)),
  }
  return sha256(Buffer.from(JSON.stringify(state)))
}

function isUnresolved(record) {
  if (!record.manifest) return true
  return !["complete", "recovered"].includes(record.manifest.status)
}

function operationSummary(record) {
  if (!record.manifest) return { operation: record.id, status: "interrupted-registration", corrupt: true }
  const { manifest } = record
  return {
    operation: manifest.operationId,
    status: manifest.status,
    patchDigest: manifest.patchDigest,
    targets: manifest.targets.map((item) => item.path),
    sources: manifest.sources.map((item) => item.path),
    preparedAt: manifest.preparedAt,
    ...(manifest.completedAt ? { completedAt: manifest.completedAt } : {}),
    ...(manifest.recoveredAt ? { recoveredAt: manifest.recoveredAt } : {}),
    ...(manifest.lastFailure ? { lastFailure: manifest.lastFailure } : {}),
  }
}

function currentTargetHashes(vaultRoot, targetPaths) {
  const hashes = {}
  const unsafeTargets = []
  for (const relative of targetPaths) {
    try {
      const stat = assertRegularMarkdown(vaultRoot, relative, { mayBeMissing: true })
      hashes[relative] = stat ? sha256(fs.readFileSync(path.resolve(vaultRoot, relative))) : null
    } catch {
      unsafeTargets.push(relative)
    }
  }
  return { hashes, unsafeTargets }
}

function lockDetails(context) {
  const lockPath = path.join(context.vaultDir, "state-update.lock")
  let lockStat
  try { lockStat = fs.lstatSync(lockPath) }
  catch (error) {
    if (error.code === "ENOENT") return { lockPath, locked: false, lockOwner: null, lockOwnerSha256: null }
    return { lockPath, locked: true, lockOwner: { status: "lock-unreadable" }, lockOwnerSha256: null }
  }
  if (lockStat.isSymbolicLink() || !lockStat.isDirectory()) {
    return { lockPath, locked: true, lockOwner: { status: "lock-unsafe" }, lockOwnerSha256: null }
  }
  const ownerPath = path.join(lockPath, "owner.json")
  let lockOwner = null
  let lockOwnerSha256 = null
  try {
    const stat = fs.lstatSync(ownerPath)
    if (!stat.isSymbolicLink() && stat.isFile()) {
      const bytes = fs.readFileSync(ownerPath)
      lockOwnerSha256 = sha256(bytes)
      try { lockOwner = JSON.parse(bytes.toString("utf8")) }
      catch { lockOwner = { status: "owner-record-invalid" } }
    } else lockOwner = { status: "owner-record-unavailable" }
  } catch { lockOwner = { status: "owner-record-unavailable" } }
  return { lockPath, locked: true, lockOwner, lockOwnerSha256 }
}

function archiveReviewedDeadLock(context, reviewLockHash) {
  const lockPath = path.join(context.vaultDir, "state-update.lock")
  if (!fs.existsSync(lockPath)) {
    if (reviewLockHash !== undefined) throw new Error("STATE_LOCK_CHANGED: no state lock remains; inspect status again")
    return
  }
  if (typeof reviewLockHash !== "string" || !HEX_SHA256.test(reviewLockHash)) {
    const details = lockDetails(context)
    throw new Error(`CHECKPOINT_STATE_BUSY: review the dead-owner lock before restore (lock ${details.lockPath}, owner hash ${details.lockOwnerSha256 ?? "unavailable"})`)
  }
  let directoryStat
  try { directoryStat = fs.lstatSync(lockPath) } catch { throw new Error("STATE_LOCK_CHANGED: state lock could not be inspected") }
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) throw new Error("STATE_LOCK_UNSAFE: state lock is not a regular directory")
  const ownerPath = path.join(lockPath, "owner.json")
  let ownerBytes
  let owner
  try {
    const ownerStat = fs.lstatSync(ownerPath)
    if (ownerStat.isSymbolicLink() || !ownerStat.isFile()) throw new Error("unsafe owner record")
    ownerBytes = fs.readFileSync(ownerPath)
    owner = JSON.parse(ownerBytes.toString("utf8"))
  } catch { throw new Error("STATE_LOCK_OWNER_UNKNOWN: owner record is missing, unsafe, or unreadable") }
  if (sha256(ownerBytes) !== reviewLockHash) throw new Error("STATE_LOCK_REVIEW_MISMATCH: owner record changed since status; review status again")
  if (owner.hostname !== os.hostname()) throw new Error("STATE_LOCK_OWNER_UNKNOWN: lock was created on another host; automatic liveness checks are unsafe")
  if (!Number.isSafeInteger(owner.pid) || owner.pid < 1) throw new Error("STATE_LOCK_OWNER_UNKNOWN: owner PID is invalid")
  try { process.kill(owner.pid, 0) }
  catch (error) {
    if (error.code !== "ESRCH") throw new Error(`STATE_LOCK_OWNER_UNKNOWN: cannot prove owner process is absent (${error.code ?? error.message})`)
    owner = null
  }
  if (owner) throw new Error("STATE_LOCK_OWNER_ALIVE: the recorded owner process is still present")
  // Preserve the reviewed lock and its owner record for later inspection.
  const reviewedPath = `${lockPath}.reviewed-dead-owner-${Date.now()}-${crypto.randomUUID()}`
  try { fs.renameSync(lockPath, reviewedPath) }
  catch (error) { throw new Error(`STATE_LOCK_ARCHIVE_FAILED: could not preserve reviewed lock (${error.message})`) }
  return reviewedPath
}

function acquireStateLock(context) {
  mkdirPrivate(context.vaultDir)
  mkdirPrivate(context.operationsDir)
  const lockPath = path.join(context.vaultDir, "state-update.lock")
  try { fs.mkdirSync(lockPath, { mode: 0o700 }) }
  catch (error) {
    if (error.code === "EEXIST") throw new Error("CHECKPOINT_STATE_BUSY: another state update or an interrupted state lock needs review")
    throw error
  }
  try {
    writePrivateJson(path.join(lockPath, "owner.json"), { pid: process.pid, hostname: os.hostname(), startedAt: new Date().toISOString() })
  } catch (error) {
    throw new Error(`CHECKPOINT_STATE_BUSY: state lock was created but its owner record could not be written: ${error.message}`)
  }
  return () => {
    try { fs.unlinkSync(path.join(lockPath, "owner.json")) } catch { /* Leave unexpected state for explicit review. */ }
    try { fs.rmdirSync(lockPath) } catch { /* Never remove a lock with unrecognized contents. */ }
  }
}

function readManifest(context, operation) {
  if (typeof operation !== "string" || !/^[0-9a-f-]{36}$/u.test(operation)) throw new Error("INVALID_OPERATION: operation ID is invalid")
  const directory = path.join(context.operationsDir, operation)
  let manifest
  try { manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8")) }
  catch { throw new Error("CHECKPOINT_STATE_UNREADABLE: operation manifest is missing or invalid") }
  if (manifest.protocol !== PROTOCOL || manifest.operationId !== operation || manifest.vaultRoot !== context.vaultRoot) {
    throw new Error("CHECKPOINT_STATE_MISMATCH: operation is not bound to this vault")
  }
  if (!Array.isArray(manifest.targets) || !Array.isArray(manifest.sources)
    || !["pending", "recovery-in-progress", "complete", "recovered", "interrupted-registration"].includes(manifest.status)) {
    throw new Error("CHECKPOINT_STATE_UNREADABLE: operation manifest fields are invalid")
  }
  const targetPaths = validatePathArray(manifest.targets.map((item) => item?.path), "targets", {
    allowEmpty: manifest.status === "interrupted-registration",
  })
  const sourcePaths = validatePathArray(manifest.sources.map((item) => item?.path), "sources", { allowEmpty: true })
  if (new Set([...targetPaths, ...sourcePaths]).size !== targetPaths.length + sourcePaths.length) {
    throw new Error("CHECKPOINT_STATE_UNREADABLE: source and target paths overlap")
  }
  for (const item of manifest.targets) {
    if (typeof item.existed !== "boolean" || (item.existed && (!HEX_SHA256.test(item.sha256 ?? "")
      || !/^[a-f0-9]{64}\.bin$/u.test(item.preimageFile ?? "")
      || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || !Number.isInteger(item.mode) || item.mode < 0 || item.mode > 0o777))
      || (!item.existed && (item.sha256 !== null || item.preimageFile !== null || item.mode !== null || item.bytes !== 0))) {
      throw new Error("CHECKPOINT_STATE_UNREADABLE: target preimage metadata is invalid")
    }
  }
  for (const item of manifest.sources) {
    if (!HEX_SHA256.test(item.sha256 ?? "") || !Number.isSafeInteger(item.bytes) || item.bytes < 0) {
      throw new Error("CHECKPOINT_STATE_UNREADABLE: source identity metadata is invalid")
    }
  }
  return { directory, manifest }
}

function saveManifest(directory, manifest) {
  writePrivateJson(path.join(directory, "manifest.json"), manifest)
}

function sourceDrift(vaultRoot, sources) {
  const drift = []
  for (const source of sources) {
    try {
      const actual = readSourceNotes(vaultRoot, [source.path]).sources[0]
      if (actual.sha256 !== source.sha256) drift.push({ path: source.path, status: "changed", currentSha256: actual.sha256 })
    } catch {
      drift.push({ path: source.path, status: "missing-or-unsafe" })
    }
  }
  return drift
}

function inventoryDrift(before, current, targets, sources) {
  const allowed = new Set(targets)
  const oldKeys = new Set(Object.keys(before))
  const currentKeys = new Set(Object.keys(current))
  const changed = []
  const added = []
  const removed = []
  const all = new Set([...oldKeys, ...currentKeys])
  for (const key of all) {
    if (allowed.has(key)) continue
    if (!oldKeys.has(key)) added.push(key)
    else if (!currentKeys.has(key)) removed.push(key)
    else if (before[key] !== current[key]) changed.push(key)
  }
  const sourceSet = new Set(sources)
  return {
    changed: changed.sort(), added: added.sort(), removed: removed.sort(),
    sourceDrift: [...changed, ...added, ...removed].filter((item) => sourceSet.has(item)).sort(),
  }
}

function findingKey(item) {
  return JSON.stringify([item.file, item.kind, item.severity])
}

function graphIssueKey(item) {
  return JSON.stringify([item.source, item.target, item.kind, item.reason, item.relation])
}

function evaluateAfterEdit(baseline, inventory, targets, now) {
  const captured = captureBaseline(inventory, now, targets)
  const docs = captured.documents
  const graph = buildNoteGraph(docs)
  if (graph.limitReached) throw new Error("INCOMPLETE_GRAPH: graph audit reached a traversal limit")
  const targetSet = new Set(targets)
  const baselineGraphIssues = new Set((baseline?.graph?.issues ?? []).map(graphIssueKey))
  const newGraphIssues = graph.issues.filter((item) => !baselineGraphIssues.has(graphIssueKey(item)))
  const targetAliases = new Set()
  for (const document of docs) {
    if (!targetSet.has(document.id)) continue
    const basename = path.posix.basename(document.id, path.posix.extname(document.id))
    for (const alias of [document.id.replace(/\.md$/iu, ""), basename, document.title]) {
      targetAliases.add(alias.trim().toLocaleLowerCase("en"))
    }
  }
  const affectedGraphIssues = graph.issues.filter((item) => targetSet.has(item.source)
    || targetAliases.has(String(item.target).replace(/^\[\[|\]\]$/gu, "").split(/[|#]/u)[0].trim().toLocaleLowerCase("en")))
  const targetSourceGraphIssues = []
  for (const target of targets) {
    if (target.includes(",")) throw new Error("INCOMPLETE_GRAPH: comma in a target path cannot be isolated by the graph audit API")
    const scopedGraph = buildNoteGraph(docs, { scope: target })
    if (scopedGraph.limitReached) throw new Error(`INCOMPLETE_GRAPH: graph audit reached a limit for ${target}`)
    if (Object.values(scopedGraph.issueCounts).some((count) => count > 0)) {
      targetSourceGraphIssues.push({ file: target, issueCounts: scopedGraph.issueCounts, issues: scopedGraph.issues })
    }
  }
  const unrelatedBaselineGraphIssues = (baseline?.graph?.issues ?? []).filter((item) => !targetSet.has(item.source)
    && !targetAliases.has(String(item.target).replace(/^\[\[|\]\]$/gu, "").split(/[|#]/u)[0].trim().toLocaleLowerCase("en")))
  const baselineLifecycle = new Set((baseline?.lifecycle ?? []).map(findingKey))
  const currentLifecycle = captured.summary.lifecycle
  const newLifecycle = currentLifecycle.filter((item) => !baselineLifecycle.has(findingKey(item)))
  const affectedLifecycle = currentLifecycle.filter((item) => targetSet.has(item.file)
    && ["high", "medium", "critical"].includes(item.severity))
  const currentIssueCounts = graph.issueCounts ?? {}
  const baselineIssueCounts = baseline?.graph?.issueCounts ?? {}
  const increasedIssueCounts = Object.fromEntries(Object.keys({ ...currentIssueCounts, ...baselineIssueCounts })
    .filter((kind) => (currentIssueCounts[kind] ?? 0) > (baselineIssueCounts[kind] ?? 0))
    .map((kind) => [kind, { before: baselineIssueCounts[kind] ?? 0, after: currentIssueCounts[kind] ?? 0 }]))
  return {
    report: {
      graph: { issueCounts: graph.issueCounts, issues: graph.issues, edges: graph.edges },
      lifecycle: currentLifecycle,
      targetEdges: captured.summary.targetEdges,
      baselineTargetEdges: baseline?.targetEdges ?? [],
      newGraphIssues,
      increasedIssueCounts,
      affectedGraphIssues,
      targetSourceGraphIssues,
      newLifecycleFindings: newLifecycle,
      affectedLifecycleFindings: affectedLifecycle,
      unrelatedBaselineGraphIssues,
      unrelatedBaselineLifecycleFindings: (baseline?.lifecycle ?? []).filter((item) => !targetSet.has(item.file)),
    },
    valid: newGraphIssues.length === 0 && Object.keys(increasedIssueCounts).length === 0 && affectedGraphIssues.length === 0
      && targetSourceGraphIssues.length === 0
      && newLifecycle.length === 0 && affectedLifecycle.length === 0,
  }
}

function compactAffectedAudit(report, { limit = 8 } = {}) {
  const findings = []
  const add = (file, kind, severity = "medium") => {
    findings.push({ file: String(file ?? "(vault)"), kind: String(kind ?? "audit-finding"), severity: String(severity ?? "medium"),
      nextAction: "review this path and repair or resolve its affected relationship before finish" })
  }
  for (const item of report.affectedGraphIssues ?? []) add(item.source ?? item.file ?? item.target, item.kind ?? item.relation ?? "graph-issue", item.severity)
  for (const group of report.targetSourceGraphIssues ?? []) {
    const nested = group.issues ?? []
    if (!nested.length) add(group.file, "target-source-graph-issue")
    else for (const item of nested) add(item.source ?? group.file, item.kind ?? item.relation ?? "graph-issue", item.severity)
  }
  for (const item of report.affectedLifecycleFindings ?? []) add(item.file, item.kind, item.severity)
  for (const item of report.newGraphIssues ?? []) add(item.source ?? item.file ?? item.target, item.kind ?? item.relation ?? "new-graph-issue", item.severity)
  for (const item of report.newLifecycleFindings ?? []) add(item.file, item.kind, item.severity)
  for (const [kind] of Object.entries(report.increasedIssueCounts ?? {})) add("(vault)", `increased-${kind}`)
  const unique = new Map(findings.map((item) => [JSON.stringify([item.file, item.kind, item.severity]), item]))
  const ordered = [...unique.values()].sort((left, right) => left.file.localeCompare(right.file) || left.kind.localeCompare(right.kind)
    || left.severity.localeCompare(right.severity))
  return { totalCount: ordered.length, complete: ordered.length <= limit, findings: ordered.slice(0, limit),
    ...(ordered.length > limit ? { remainingCount: ordered.length - limit } : {}) }
}

function assertTargetBinding(manifest, targetPaths, sourcePaths, patchHash) {
  if (manifest.patchDigest !== patchHash) throw new Error("PATCH_BINDING_MISMATCH: patch differs from prepared operation")
  const targets = manifest.targets.map((item) => item.path)
  const sources = manifest.sources.map((item) => item.path)
  if (JSON.stringify(targets) !== JSON.stringify(targetPaths) || JSON.stringify(sources) !== JSON.stringify(sourcePaths)) {
    throw new Error("PATCH_BINDING_MISMATCH: target or source binding differs")
  }
}

function findReplay(records, digest) {
  return records.filter((record) => record.manifest?.patchDigest === digest && record.manifest.status === "complete")
}

function verifyReplay(vaultRoot, record, patch, digest, requestedTargets, requestedSources, now) {
  const manifest = record.manifest
  const originalTargets = manifest.targets.map((item) => item.path)
  const originalSources = manifest.sources.map((item) => item.path)
  if (JSON.stringify(originalTargets) !== JSON.stringify(requestedTargets)) {
    throw new Error(`PATCH_ALREADY_APPLIED: patch digest is bound to ${originalTargets.join(", ") || "its original destination"}`)
  }
  if (JSON.stringify(originalSources) !== JSON.stringify(requestedSources)) {
    throw new Error("PATCH_ALREADY_APPLIED: patch digest is bound to its original source paths")
  }
  if (manifest.patchDigest !== digest) throw new Error("PATCH_BINDING_MISMATCH: replay patch digest differs")
  const notePath = manifest.receipt?.notePath
  if (!notePath || !originalTargets.includes(notePath)) throw new Error("CHECKPOINT_STATE_UNREADABLE: completed operation has no verified note path")
  const verification = verifyPatchPersistence({ vault: vaultRoot, patch, notePath, full: true, ...(now ? { now } : {}) })
  const changedSources = sourceDrift(vaultRoot, manifest.sources)
  const { hashes: currentHashes, unsafeTargets } = currentTargetHashes(vaultRoot, originalTargets)
  const savedHashes = manifest.receipt?.targetHashes ?? {}
  const changedTargets = originalTargets.filter((target) => !HEX_SHA256.test(currentHashes[target] ?? "")
    || currentHashes[target] !== savedHashes[target])
  let auditValid = false
  try {
    const inventory = inventoryVault(vaultRoot)
    const report = evaluateAfterEdit(manifest.baseline, inventory, originalTargets, now ? new Date(now) : new Date())
    const targetedGraphIssues = report.report.affectedGraphIssues
    const targetSourceGraphIssues = report.report.targetSourceGraphIssues
    const targetedLifecycleIssues = report.report.affectedLifecycleFindings
    auditValid = targetedGraphIssues.length === 0 && targetSourceGraphIssues.length === 0 && targetedLifecycleIssues.length === 0
  } catch { auditValid = false }
  if (!verification.valid || changedSources.length || !auditValid || unsafeTargets.length || changedTargets.length) {
    throw new Error(`REPLAY_REVERIFY_FAILED: current target bytes/fields, links, lifecycle, or original sources changed or no longer pass verification${changedTargets.length ? ` (${changedTargets.join(", ")})` : ""}`)
  }
  return { operation: manifest.operationId, status: "complete", replayed: true, receipt: manifest.receipt,
    verification, currentTargetHashes: currentHashes, sourceDrift: [], targets: originalTargets, sources: originalSources }
}

export function inspectCurationCheckpoint({ vault, stateRoot } = {}) {
  const vaultRoot = resolveVault(vault)
  const context = resolveState(vaultRoot, stateRoot, { create: false })
  const lock = lockDetails(context)
  const records = listOperationRecords(context)
  const token = authorityToken(context, lock, records)
  if (!context.exists) return {
    blocked: false, operation: null, status: "none", nextAction: "prepare a reviewed patch before native edits",
    vaultRoot, operations: [], expectedHashes: {}, stateRoot: context.stateRoot,
    lockPath: lock.lockPath, lockOwnerSha256: lock.lockOwnerSha256, authorityToken: token,
  }
  const unresolved = records.filter(isUnresolved)
  const { locked, lockOwner, lockOwnerSha256, lockPath } = lock
  if (unresolved.length > 1) return {
    blocked: true, operation: null, status: "conflicting-pending-state", nextAction: "review all listed operation records before another write",
    vaultRoot, operations: records.map(operationSummary), expectedHashes: {}, stateRoot: context.stateRoot, locked, lockOwner, lockOwnerSha256, lockPath, authorityToken: token,
  }
  if (unresolved.length === 1) {
    const active = unresolved[0]
    if (!active.manifest) return {
      blocked: true, operation: active.id, status: "interrupted-registration", nextAction: "inspect the private operation directory and recover or archive it explicitly",
      vaultRoot, operations: records.map(operationSummary), expectedHashes: {}, stateRoot: context.stateRoot, locked, lockOwner, lockOwnerSha256, lockPath, authorityToken: token,
    }
    const manifest = active.manifest
    const targetPaths = manifest.targets.map((item) => item.path)
    const { hashes, unsafeTargets } = currentTargetHashes(vaultRoot, targetPaths)
    if (unsafeTargets.length) return {
      blocked: true, operation: manifest.operationId, status: "unsafe-target-state",
      nextAction: "inspect the named target paths; restore requires safe regular files inside the vault",
      vaultRoot, operations: records.map(operationSummary), expectedHashes: {}, unsafeTargets,
      sources: manifest.sources.map((item) => item.path), targets: targetPaths,
      sourceDrift: sourceDrift(vaultRoot, manifest.sources), stateRoot: context.stateRoot, locked, lockOwner, lockOwnerSha256, lockPath, authorityToken: token,
    }
    return {
      blocked: true, operation: manifest.operationId, status: manifest.status,
      nextAction: locked ? "review the lock owner hash; if the same-host owner PID is absent, pass its hash to approved restore"
        : manifest.status === "recovery-in-progress" ? "review current target hashes and resume approved restore"
        : manifest.status === "interrupted-registration" ? "review current hashes and approve target-only restore; finish requires a complete preparation"
          : "finish verification or review current hashes and restore",
      vaultRoot, operations: records.map(operationSummary), expectedHashes: hashes,
      sources: manifest.sources.map((item) => item.path), targets: targetPaths,
      sourceDrift: sourceDrift(vaultRoot, manifest.sources), stateRoot: context.stateRoot, locked, lockOwner, lockOwnerSha256, lockPath, authorityToken: token,
    }
  }
  const latest = records.filter((record) => record.manifest).sort((left, right) => {
    const leftTime = Date.parse(left.manifest.recoveredAt ?? left.manifest.completedAt ?? left.manifest.preparedAt ?? "") || 0
    const rightTime = Date.parse(right.manifest.recoveredAt ?? right.manifest.completedAt ?? right.manifest.preparedAt ?? "") || 0
    return rightTime - leftTime
  })[0]
  return {
    blocked: locked, operation: null, status: locked ? "interrupted-state-lock" : latest?.manifest?.status ?? "none",
    nextAction: locked ? "inspect the persistent state lock before another update" : "read normally or prepare a new reviewed patch",
    vaultRoot, operations: records.map(operationSummary), expectedHashes: {}, stateRoot: context.stateRoot, locked, lockOwner, lockOwnerSha256, lockPath, authorityToken: token,
  }
}

export function readCurationRecoveryContext({ vault, stateRoot, operation, paths } = {}) {
  const vaultRoot = resolveVault(vault)
  const context = resolveState(vaultRoot, stateRoot, { create: false })
  const before = inspectCurationCheckpoint({ vault: vaultRoot, stateRoot: context.stateRoot })
  if (!before.blocked || before.operation !== operation || !["pending", "recovery-in-progress"].includes(before.status)) {
    throw new Error("RECOVERY_OPERATION_MISMATCH: select the current unresolved operation for this vault")
  }
  if (before.locked) throw new Error("CHECKPOINT_STATE_BUSY: wait for the active state operation before reading recovery content")
  const { manifest } = readManifest(context, operation)
  if (!manifest.preimagesReady || manifest.vaultRoot !== vaultRoot) {
    throw new Error("CHECKPOINT_STATE_UNREADABLE: operation does not contain a complete recovery binding")
  }
  const requested = validatePathArray(paths, "recovery paths")
  const targets = new Map(manifest.targets.map((item) => [item.path, item]))
  const sources = new Map(manifest.sources.map((item) => [item.path, item]))
  if (requested.some((relative) => !targets.has(relative) && !sources.has(relative))) {
    throw new Error("RECOVERY_PATH_NOT_BOUND: request only paths listed by this operation")
  }
  const reads = requested.map((relative) => {
    if (targets.has(relative)) {
      const binding = targets.get(relative)
      try {
        const stat = assertRegularMarkdown(vaultRoot, relative, { mayBeMissing: true })
        const bytes = stat ? fs.readFileSync(path.resolve(vaultRoot, relative)) : null
        return { path: relative, kind: "target", status: stat ? "current-partial-or-complete-bytes" : "missing",
          expectedSha256: binding.sha256, currentSha256: bytes ? sha256(bytes) : null,
          bytes: bytes?.length ?? 0, ...(bytes ? { markdown: bytes.toString("utf8") } : {}),
          authority: "recovery-only", authoritative: false }
      } catch {
        return { path: relative, kind: "target", status: "unsafe-or-unavailable", expectedSha256: binding.sha256,
          currentSha256: null, bytes: null, authority: "recovery-only", authoritative: false }
      }
    }
    const binding = sources.get(relative)
    try {
      const source = readSourceNotes(vaultRoot, [relative]).sources[0]
      if (source.sha256 !== binding.sha256) return { path: relative, kind: "source", status: "changed",
        expectedSha256: binding.sha256, currentSha256: source.sha256, bytes: source.bytes,
        authority: "recovery-only", authoritative: false }
      return { path: relative, kind: "source", status: "verified-original", expectedSha256: binding.sha256,
        currentSha256: source.sha256, bytes: source.bytes, markdown: source.markdown,
        authority: "recovery-only", authoritative: false }
    } catch {
      return { path: relative, kind: "source", status: "missing-or-unsafe", expectedSha256: binding.sha256,
        currentSha256: null, bytes: null, authority: "recovery-only", authoritative: false }
    }
  })

  for (const item of reads) {
    try {
      const stat = assertRegularMarkdown(vaultRoot, item.path, { mayBeMissing: true })
      const currentSha256 = stat ? sha256(fs.readFileSync(path.resolve(vaultRoot, item.path))) : null
      if (currentSha256 !== item.currentSha256) throw new Error("RECOVERY_BYTES_CHANGED_DURING_READ: a bound file changed during recovery read")
    } catch (error) {
      if (/RECOVERY_BYTES_CHANGED_DURING_READ/u.test(String(error.message))) throw error
      throw new Error("RECOVERY_BYTES_CHANGED_DURING_READ: a bound file became unavailable during recovery read")
    }
  }
  const after = inspectCurationCheckpoint({ vault: vaultRoot, stateRoot: context.stateRoot })
  if (!after.blocked || after.operation !== operation || after.status !== before.status
    || after.authorityToken !== before.authorityToken || after.locked) {
    throw new Error("STATE_CHANGED_DURING_READ: recovery operation changed while content was read")
  }
  return { status: "RECOVERY_READ", operation, authority: "recovery-only", authoritative: false,
    authorityToken: after.authorityToken, reads }
}

export function verifyCurationRecoveryContext({ vault, stateRoot, operation, authorityToken } = {}) {
  const checkpoint = inspectCurationCheckpoint({ vault, stateRoot })
  if (!checkpoint.blocked || checkpoint.operation !== operation || checkpoint.locked
    || !["pending", "recovery-in-progress"].includes(checkpoint.status)
    || checkpoint.authorityToken !== authorityToken) {
    throw new Error("STATE_CHANGED_DURING_READ: recovery operation changed before output")
  }
  return { operation, status: checkpoint.status, authorityToken: checkpoint.authorityToken }
}

export function prepareCurationCheckpoint({ vault, patch, targets, sources, stateRoot, now } = {}) {
  const vaultRoot = resolveVault(vault)
  const targetPaths = validatePathArray(targets, "targets")
  const sourcePaths = validatePathArray(sources, "sources", { allowEmpty: true })
  const schema = validateMemoryPatch(patch)
  if (!schema.valid) throw new Error(`INVALID_PATCH: ${schema.errors.join("; ")}`)
  renderPatchRecord(patch)
  const predecessors = validatePathArray(patch.lifecycle.supersedes ?? [], "predecessors", { allowEmpty: true })
  for (const predecessor of predecessors) {
    if (!targetPaths.includes(predecessor)) throw new Error(`PREDECESSOR_NOT_DECLARED: ${predecessor}`)
    assertRegularMarkdown(vaultRoot, predecessor)
  }
  const digest = patchDigest(patch)
  const context = resolveState(vaultRoot, stateRoot)
  const release = acquireStateLock(context)
  let createdDirectory = null
  try {
    const records = listOperationRecords(context)
    const unresolved = records.filter(isUnresolved)
    if (unresolved.length) throw new Error(`CURATION_PENDING: ${unresolved.map((item) => item.id).join(", ")}`)
    const replays = findReplay(records, digest)
    if (replays.length) return verifyReplay(vaultRoot, replays.at(-1), patch, digest, targetPaths, sourcePaths, now)

    const existingIdentities = new Map()
    for (const source of sourcePaths) {
      const stat = assertRegularMarkdown(vaultRoot, source)
      const identity = physicalIdentity(vaultRoot, source, false)
      existingIdentities.set(identity, { path: source, type: "source" })
      if (!stat) throw new Error(`INVALID_SOURCE: ${source} is missing`)
    }
    for (const target of targetPaths) {
      const stat = assertRegularMarkdown(vaultRoot, target, { mayBeMissing: true })
      const identity = physicalIdentity(vaultRoot, target, true)
      if (existingIdentities.has(identity)) throw new Error(`SOURCE_TARGET_OVERLAP: ${target} overlaps source ${existingIdentities.get(identity).path}`)
      existingIdentities.set(identity, { path: target, type: "target" })
      if (stat && stat.isDirectory()) throw new Error(`INVALID_TARGET: ${target} is not a regular Markdown file`)
    }
    const inventory = inventoryVault(vaultRoot)
    const baseline = captureBaseline(inventory, now ? new Date(now) : new Date(), targetPaths)
    const sourceHandoff = sourcePaths.length ? createSourceHandoff(vaultRoot, sourcePaths) : null
    for (const source of sourceHandoff?.sources ?? []) {
      if (inventory.markdown.get(source.path)?.sha256 !== source.sha256) throw new Error(`SOURCE_CHANGED: source changed while checkpoint was being prepared (${source.path})`)
    }
    const targetRecords = []
    const preimageBytes = new Map()
    for (const relative of targetPaths) {
      const item = inventory.markdown.get(relative)
      const currentStat = assertRegularMarkdown(vaultRoot, relative, { mayBeMissing: true })
      if (!!item !== !!currentStat) throw new Error(`TARGET_CHANGED_DURING_PREPARE: target presence changed while checkpoint was being prepared (${relative})`)
      const bytes = item ? fs.readFileSync(path.resolve(vaultRoot, relative)) : null
      if (item && sha256(bytes) !== item.sha256) throw new Error(`TARGET_CHANGED_DURING_PREPARE: target bytes changed while checkpoint was being prepared (${relative})`)
      const preimageFile = item ? `${sha256(Buffer.from(relative))}.bin` : null
      if (item) preimageBytes.set(relative, bytes)
      targetRecords.push({ path: relative, existed: !!item, preimageFile,
        sha256: item?.sha256 ?? null, bytes: item?.bytes ?? 0, mode: item?.mode ?? null })
    }
    const operation = operationId()
    const operationDirectory = path.join(context.operationsDir, operation)
    mkdirPrivate(operationDirectory)
    createdDirectory = operationDirectory
    mkdirPrivate(path.join(operationDirectory, "preimages"))
    const manifest = {
      protocol: PROTOCOL,
      operationId: operation,
      status: "interrupted-registration",
      vaultRoot,
      patchDigest: digest,
      targets: targetRecords,
      sources: (sourceHandoff?.sources ?? []).map((item) => ({ path: item.path, sha256: item.sha256, bytes: item.bytes })),
      sourceHandoff,
      inventory: { markdownCount: inventory.markdown.size, hashes: inventoryHashes(inventory) },
      baseline: baseline.summary,
      preimagesReady: false,
      preparedAt: new Date(now ?? Date.now()).toISOString(),
      lastFailure: null,
    }
    writePrivateJson(path.join(operationDirectory, "manifest.json"), manifest)
    for (const item of targetRecords) {
      if (item.existed) writePrivateBytes(path.join(operationDirectory, "preimages", item.preimageFile), preimageBytes.get(item.path))
    }
    manifest.status = "pending"
    manifest.preimagesReady = true
    manifest.preimagesReadyAt = new Date().toISOString()
    saveManifest(operationDirectory, manifest)
    return { operation, status: "pending", replayed: false, patchDigest: digest,
      targets: targetPaths, sources: sourcePaths, sourceHandoff, preparedAt: manifest.preparedAt,
      expectedHashes: Object.fromEntries(targetPaths.map((target) => [target, inventory.markdown.get(target)?.sha256 ?? null])) }
  } catch (error) {
    if (createdDirectory) {
      // An incomplete registration is intentionally preserved for status/recovery.
      try {
        const manifestPath = path.join(createdDirectory, "manifest.json")
        if (!fs.existsSync(manifestPath)) writePrivateJson(manifestPath, {
          protocol: PROTOCOL, operationId: path.basename(createdDirectory), status: "interrupted-registration",
          vaultRoot, targets: [], sources: [], preimagesReady: false,
          lastFailure: { code: "PREPARE_INTERRUPTED", message: "registration did not finish" },
        })
        else {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
          manifest.status = "interrupted-registration"
          manifest.preimagesReady = false
          manifest.lastFailure = { code: "PREPARE_INTERRUPTED", at: new Date().toISOString(), message: "private preimages were not fully registered" }
          saveManifest(createdDirectory, manifest)
        }
      } catch { /* Directory presence itself is enough for status to fail closed. */ }
    }
    throw error
  } finally {
    release()
  }
}

export function finishCurationCheckpoint({ vault, operation, patch, notePath, stateRoot, now } = {}) {
  const vaultRoot = resolveVault(vault)
  const context = resolveState(vaultRoot, stateRoot, { create: false })
  if (!context.exists) throw new Error("CHECKPOINT_NOT_FOUND: no operation state exists for this vault")
  const release = acquireStateLock(context)
  let directory
  let manifest
  try {
    ({ directory, manifest } = readManifest(context, operation))
    if (manifest.status === "complete") return verifyReplay(vaultRoot, { manifest }, patch, patchDigest(patch), manifest.targets.map((item) => item.path), manifest.sources.map((item) => item.path), now)
    if (manifest.status !== "pending") throw new Error(`CHECKPOINT_NOT_FINISHABLE: operation state is ${manifest.status}`)
    if (manifest.preimagesReady !== true) throw new Error("CHECKPOINT_NOT_FINISHABLE: private preimages were not fully registered")
    const targetPaths = validatePathArray(manifest.targets.map((item) => item.path), "targets")
    const sourcePaths = manifest.sources.map((item) => item.path)
    assertTargetBinding(manifest, targetPaths, sourcePaths, patchDigest(patch))
    const safeNotePath = relativeMarkdownPath(notePath, "note path")
    if (!targetPaths.includes(safeNotePath)) throw new Error("NOTE_NOT_DECLARED: canonical note must be a declared target")
    let inventory = inventoryVault(vaultRoot)
    let hashes = inventoryHashes(inventory)
    const drift = inventoryDrift(manifest.inventory.hashes, hashes, targetPaths, sourcePaths)
    if (drift.changed.length || drift.added.length || drift.removed.length) {
      const failure = { code: "UNDECLARED_DRIFT", message: "covered files changed outside declared targets", paths: [...drift.changed, ...drift.added, ...drift.removed] }
      if (drift.sourceDrift.length) {
        failure.code = "SOURCE_CHANGED"
        failure.message = "immutable source files changed after preparation"
      }
      manifest.lastFailure = { ...failure, at: new Date().toISOString() }
      saveManifest(directory, manifest)
      throw new Error(`${failure.code}: ${failure.message} (${failure.paths.join(", ")})`)
    }
    if (sourceDrift(vaultRoot, manifest.sources).length) {
      manifest.lastFailure = { code: "SOURCE_CHANGED", at: new Date().toISOString(), paths: sourceDrift(vaultRoot, manifest.sources).map((item) => item.path) }
      saveManifest(directory, manifest)
      throw new Error(`SOURCE_CHANGED: immutable source files changed after preparation (${manifest.lastFailure.paths.join(", ")})`)
    }
    for (const target of targetPaths) {
      const stat = assertRegularMarkdown(vaultRoot, target)
      if (!stat) throw new Error(`TARGET_MISSING: declared target is missing after native edit (${target})`)
    }
    const predecessors = validatePathArray(patch.lifecycle.supersedes ?? [], "predecessors", { allowEmpty: true })
    const resolveNoteLink = predecessors.length ? createNoteLinkResolver([...inventory.markdown].map(([id, item]) => {
      const document = parseMarkdown(id, item.markdown)
      return { path: id, title: document.title, text: item.markdown }
    })) : null
    const transitions = predecessors.map(predecessor => {
      if (predecessor === safeNotePath) throw new Error("LIFECYCLE_SELF_REFERENCE: successor cannot supersede itself")
      if (!targetPaths.includes(predecessor) || !manifest.targets.find(item => item.path === predecessor)?.existed) {
        throw new Error(`PREDECESSOR_NOT_DECLARED: ${predecessor} must be an existing declared target`)
      }
      assertRegularMarkdown(vaultRoot, predecessor)
      const original = fs.readFileSync(path.resolve(vaultRoot, predecessor), "utf8")
      return { path: predecessor, original, markdown: planPredecessorTransition(original, safeNotePath, {
        resolveReplacement: link => resolveNoteLink(link, predecessor),
      }) }
    })
    if (transitions.length) {
      const preflight = verifyCanonicalPatchRecord({ vault: vaultRoot, patch, notePath: safeNotePath, ...(now ? { now } : {}) })
      if (!preflight.valid) throw new Error(`PERSISTENCE_FAILED: successor preflight failed (${preflight.errors.join("; ")})`)
      // All plans and the successor have been validated before the first write.
      const beforeWrites = inventoryHashes(inventoryVault(vaultRoot))
      const during = inventoryDrift(hashes, beforeWrites, [], [])
      if (during.changed.length || during.added.length || during.removed.length) throw new Error("COVERED_DRIFT_DURING_FINISH: files changed before lifecycle writes")
      for (const transition of transitions) {
        assertRegularMarkdown(vaultRoot, transition.path)
        const absolute = path.resolve(vaultRoot, transition.path)
        if (fs.readFileSync(absolute, "utf8") !== transition.original) throw new Error("COVERED_DRIFT_DURING_FINISH: predecessor changed before lifecycle write")
        const mode = fs.statSync(absolute).mode & 0o777
        if (transition.original !== transition.markdown) { writeFileAtomic(absolute, transition.markdown); fs.chmodSync(absolute, mode) }
      }
      inventory = inventoryVault(vaultRoot)
      const afterWrites = inventoryHashes(inventory)
      const changed = inventoryDrift(hashes, afterWrites, transitions.map(item => item.path), [])
      if (changed.changed.length || changed.added.length || changed.removed.length) throw new Error("COVERED_DRIFT_DURING_FINISH: files changed during lifecycle writes")
      for (const transition of transitions) {
        if (afterWrites[transition.path] !== sha256(Buffer.from(transition.markdown))) throw new Error("COVERED_DRIFT_DURING_FINISH: lifecycle output changed")
      }
      hashes = afterWrites
    }
    const verification = verifyPatchPersistence({ vault: vaultRoot, patch, notePath: safeNotePath, full: true, ...(now ? { now } : {}) })
    if (!verification.valid) {
      manifest.lastFailure = { code: "PERSISTENCE_FAILED", at: new Date().toISOString(), errors: verification.errors ?? [] }
      saveManifest(directory, manifest)
      throw new Error(`PERSISTENCE_FAILED: full patch persistence verification failed (${(verification.errors ?? []).join("; ")})`)
    }
    const report = evaluateAfterEdit(manifest.baseline, inventory, targetPaths, now ? new Date(now) : new Date())
    if (!report.valid) {
      const affectedAudit = compactAffectedAudit(report.report)
      manifest.lastFailure = { code: "AFFECTED_AUDIT_FAILED", at: new Date().toISOString(), affectedAudit }
      saveManifest(directory, manifest)
      const preview = affectedAudit.findings.map((item) => `${item.file} [${item.kind}/${item.severity}]`).join(", ")
      const remainder = affectedAudit.remainingCount ? `; ${affectedAudit.remainingCount} additional finding(s)` : ""
      const error = new Error(`AFFECTED_AUDIT_FAILED: ${affectedAudit.totalCount} finding(s) need review${preview ? `: ${preview}` : ""}${remainder}; repair named paths or resolve affected relationships before finish`)
      error.affectedAudit = affectedAudit
      throw error
    }
    const finalInventory = inventoryVault(vaultRoot)
    const finalHashes = inventoryHashes(finalInventory)
    const finalDrift = inventoryDrift(hashes, finalHashes, [], [])
    if (finalDrift.changed.length || finalDrift.added.length || finalDrift.removed.length) {
      const paths = [...finalDrift.changed, ...finalDrift.added, ...finalDrift.removed]
      manifest.lastFailure = { code: "COVERED_DRIFT_DURING_FINISH", at: new Date().toISOString(), paths }
      saveManifest(directory, manifest)
      throw new Error(`COVERED_DRIFT_DURING_FINISH: covered files changed during verification (${paths.join(", ")})`)
    }
    const targetHashes = Object.fromEntries(targetPaths.map((target) => [target, finalHashes[target]]))
    const receipt = {
      operation,
      status: "complete",
      patchDigest: manifest.patchDigest,
      notePath: safeNotePath,
      targets: targetPaths,
      sources: sourcePaths,
      targetHashes,
      sourceHashes: Object.fromEntries(manifest.sources.map((item) => [item.path, item.sha256])),
      verification,
      audit: {
        newGraphIssues: report.report.newGraphIssues,
        increasedGraphIssueCounts: report.report.increasedIssueCounts,
        affectedGraphIssues: report.report.affectedGraphIssues,
        targetSourceGraphIssues: report.report.targetSourceGraphIssues,
        newLifecycleFindings: report.report.newLifecycleFindings,
        affectedLifecycleFindings: report.report.affectedLifecycleFindings,
        targetEdges: report.report.targetEdges,
        baselineTargetEdges: report.report.baselineTargetEdges,
        unrelatedBaselineGraphIssueCounts: manifest.baseline.graph.issueCounts,
        unrelatedBaselineGraphIssues: report.report.unrelatedBaselineGraphIssues,
        unrelatedBaselineLifecycleFindings: report.report.unrelatedBaselineLifecycleFindings,
      },
    }
    manifest.status = "complete"
    manifest.completedAt = new Date(now ?? Date.now()).toISOString()
    manifest.receipt = receipt
    manifest.lastFailure = null
    saveManifest(directory, manifest)
    return { operation, status: "complete", replayed: false, receipt }
  } catch (error) {
    if (directory && manifest && manifest.status === "pending" && !manifest.lastFailure) {
      manifest.lastFailure = { code: "FINISH_FAILED", at: new Date().toISOString(), message: String(error.message).slice(0, 240) }
      try { saveManifest(directory, manifest) } catch { /* The original failure is more useful. */ }
    }
    throw error
  } finally {
    release()
  }
}

function assertExpectedHashMap(expectedHashes, targets) {
  if (!expectedHashes || typeof expectedHashes !== "object" || Array.isArray(expectedHashes)) {
    throw new Error("INVALID_EXPECTED_HASHES: expected a JSON object keyed by every target path")
  }
  const keys = Object.keys(expectedHashes).sort()
  const expectedKeys = [...targets].sort()
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) throw new Error("INVALID_EXPECTED_HASHES: provide a current value for every target and no other path")
  for (const target of targets) {
    const hash = expectedHashes[target]
    if (hash !== null && (typeof hash !== "string" || !HEX_SHA256.test(hash))) {
      throw new Error(`INVALID_EXPECTED_HASHES: ${target} must have a SHA-256 digest or null for absence`)
    }
  }
}

function currentHashForRestore(vaultRoot, target) {
  const stat = assertRegularMarkdown(vaultRoot, target, { mayBeMissing: true })
  if (!stat) return null
  return sha256(fs.readFileSync(path.resolve(vaultRoot, target)))
}

function computeSourceDriftForReport(vaultRoot, sources) {
  return sourceDrift(vaultRoot, sources).map(({ path: sourcePath, status, currentSha256 }) => ({
    path: sourcePath, status, ...(currentSha256 ? { currentSha256 } : {}),
  }))
}

export function restoreCurationCheckpoint({ vault, operation, expectedHashes, approve, reviewLockHash, stateRoot } = {}) {
  if (approve !== true) throw new Error("RESTORE_APPROVAL_REQUIRED: reviewed target restoration requires approve: true")
  const vaultRoot = resolveVault(vault)
  const context = resolveState(vaultRoot, stateRoot, { create: false })
  if (!context.exists) throw new Error("CHECKPOINT_NOT_FOUND: no operation state exists for this vault")
  const reviewedLockArchive = archiveReviewedDeadLock(context, reviewLockHash)
  const release = acquireStateLock(context)
  try {
    const { directory, manifest } = readManifest(context, operation)
    if (!["pending", "recovery-in-progress", "interrupted-registration"].includes(manifest.status)) throw new Error(`CHECKPOINT_NOT_RESTORABLE: operation state is ${manifest.status}`)
    const targets = manifest.targets.map((item) => item.path)
    assertExpectedHashMap(expectedHashes, targets)
    const alreadyRecovering = manifest.status === "recovery-in-progress"
    const incompleteRegistration = manifest.status === "interrupted-registration" || manifest.preimagesReady !== true
    const progress = manifest.recovery?.progress ?? {}
    const current = {}
    const preimages = new Map()
    for (const item of manifest.targets) {
      let actual
      try { actual = currentHashForRestore(vaultRoot, item.path) }
      catch { throw new Error(`RESTORE_PREFLIGHT_FAILED: target is unsafe or unreadable (${item.path})`) }
      const expected = expectedHashes[item.path]
      if (actual !== expected) throw new Error(`RESTORE_HASH_MISMATCH: current bytes differ from reviewed hash (${item.path})`)
      if (actual === null && !item.existed && alreadyRecovering && progress[item.path] !== "applying" && progress[item.path] !== "restored") {
        throw new Error(`RESTORE_PREFLIGHT_FAILED: absence was not part of the interrupted restore (${item.path})`)
      }
      current[item.path] = actual
      if (item.existed) {
        const preimagePath = path.join(directory, "preimages", item.preimageFile)
        let stat = null
        try { stat = fs.lstatSync(preimagePath) } catch { /* An interrupted registration may not have saved every preimage yet. */ }
        if (!stat || stat.isSymbolicLink() || !stat.isFile()) {
          if (actual !== item.sha256) throw new Error(`PREIMAGE_MISSING: changed target has no usable private preimage (${item.path})`)
        } else {
          let bytes
          try { bytes = fs.readFileSync(preimagePath) } catch { throw new Error(`PREIMAGE_MISSING: private preimage is unavailable for ${item.path}`) }
          if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256) {
            if (actual !== item.sha256) throw new Error(`PREIMAGE_CORRUPT: changed target has no valid private preimage (${item.path})`)
          } else preimages.set(item.path, bytes)
        }
      }
    }
    const drift = computeSourceDriftForReport(vaultRoot, manifest.sources)
    if (!alreadyRecovering) {
      manifest.status = "recovery-in-progress"
      manifest.recovery = { startedAt: new Date().toISOString(), progress: {}, reviewedHashes: { ...expectedHashes } }
      manifest.lastFailure = null
      saveManifest(directory, manifest)
    } else {
      manifest.recovery.reviewedHashes = { ...expectedHashes }
      saveManifest(directory, manifest)
    }
    for (const item of manifest.targets) {
      const relative = item.path
      const alreadyOriginal = item.existed ? current[relative] === item.sha256 : current[relative] === null
      if (alreadyOriginal) {
        let beforeSkip
        try { beforeSkip = currentHashForRestore(vaultRoot, relative) }
        catch { throw new Error(`RESTORE_DRIFT: target became unsafe before restore verification (${relative})`) }
        if (beforeSkip !== expectedHashes[relative] || beforeSkip !== (item.existed ? item.sha256 : null)) {
          throw new Error(`RESTORE_DRIFT: target changed after preflight (${relative})`)
        }
        manifest.recovery.progress[relative] = "restored"
        saveManifest(directory, manifest)
        continue
      }
      manifest.recovery.progress[relative] = "applying"
      saveManifest(directory, manifest)
      let before
      try { before = currentHashForRestore(vaultRoot, relative) }
      catch { throw new Error(`RESTORE_DRIFT: target became unsafe before restoration (${relative})`) }
      if (before !== expectedHashes[relative]) throw new Error(`RESTORE_DRIFT: target changed after preflight (${relative})`)
      const absolute = path.resolve(vaultRoot, relative)
      if (item.existed) {
        const bytes = preimages.get(relative)
        if (!bytes) throw new Error(`PREIMAGE_MISSING: private preimage is unavailable for changed target ${relative}`)
        writeFileAtomic(absolute, bytes)
        try { fs.chmodSync(absolute, item.mode) } catch { /* Preserve original mode where available. */ }
      } else {
        fs.unlinkSync(absolute)
      }
      const after = currentHashForRestore(vaultRoot, relative)
      if ((item.existed && after !== item.sha256) || (!item.existed && after !== null)) {
        throw new Error(`RESTORE_VERIFY_FAILED: target did not return to its preimage state (${relative})`)
      }
      manifest.recovery.progress[relative] = "restored"
      saveManifest(directory, manifest)
    }
    const { hashes: currentHashes, unsafeTargets } = currentTargetHashes(vaultRoot, targets)
    if (unsafeTargets.length) throw new Error(`RESTORE_VERIFY_FAILED: restored targets cannot be hashed safely (${unsafeTargets.join(", ")})`)
    const mismatchedTargets = targets.filter((target) => currentHashes[target] !== (manifest.targets.find((item) => item.path === target)?.existed
      ? manifest.targets.find((item) => item.path === target).sha256 : null))
    if (mismatchedTargets.length) throw new Error(`RESTORE_VERIFY_FAILED: targets do not all match their exact preimage state (${mismatchedTargets.join(", ")})`)
    manifest.status = "recovered"
    manifest.recoveredAt = new Date().toISOString()
    manifest.recovery.sourceDrift = drift
    manifest.recovery.currentHashes = currentHashes
    manifest.recovery.targetOnly = true
    manifest.lastFailure = null
    saveManifest(directory, manifest)
    return { operation, status: "recovered", restored: targets, currentHashes,
      sourceDrift: drift, changedPaths: targets, sourcesUntouched: true, resumed: alreadyRecovering || incompleteRegistration,
      ...(reviewedLockArchive ? { reviewedLockArchive } : {}) }
  } catch (error) {
    try {
      const { directory, manifest } = readManifest(context, operation)
      if (manifest.status === "recovery-in-progress") {
        manifest.lastFailure = { code: "RESTORE_INTERRUPTED", at: new Date().toISOString(), message: String(error.message).slice(0, 240) }
        saveManifest(directory, manifest)
      }
    } catch { /* Preserve the recovery error and leave the state visible. */ }
    throw error
  } finally {
    release()
  }
}

// MCP may resume only the exact prepared transaction, before any placement write.
export function verifyCurationWriteBinding({ vault, stateRoot, operation, patch, targets, sources, expectedHashes } = {}) {
  const vaultRoot = resolveVault(vault)
  const context = resolveState(vaultRoot, stateRoot, { create: false })
  const state = inspectCurationCheckpoint({ vault, stateRoot })
  if (state.locked || state.operation !== operation || state.status !== "pending") throw new Error("CURATION_PENDING: operation is not writable")
  const { manifest } = readManifest(context, operation)
  if (!manifest.preimagesReady) throw new Error("CHECKPOINT_NOT_FINISHABLE: preparation incomplete")
  assertTargetBinding(manifest, validatePathArray(targets, "targets"), validatePathArray(sources, "sources", { allowEmpty: true }), patchDigest(patch))
  assertExpectedHashMap(expectedHashes, targets)
  const inventory = inventoryVault(vaultRoot)
  const drift = inventoryDrift(manifest.inventory.hashes, inventoryHashes(inventory), targets, sources)
  if (drift.changed.length || drift.added.length || drift.removed.length || sourceDrift(vaultRoot, manifest.sources).length) throw new Error("SOURCE_CHANGED: prepared inventory changed")
  for (const target of targets) if (currentHashForRestore(vaultRoot, target) !== expectedHashes[target]) throw new Error("TARGET_CHANGED: reviewed target hash changed")
  return { operation, patchDigest: manifest.patchDigest }
}
