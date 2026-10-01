#!/usr/bin/env node
import crypto from "node:crypto"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { spawn, spawnSync } from "node:child_process"
import { execFileSync } from "node:child_process"

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..")
const DEFAULT_ARCHIVE = path.resolve(REPO_ROOT, "../graphmory-mvp-trial-20261001/graphmory-0.5.0-rc.4.tgz")
const DEFAULT_OUTPUT = path.resolve(REPO_ROOT, "../graphmory-mvp-eval-20261001/private-safety")
const FROZEN_ARCHIVE_SHA256 = "f70f78073b6352c3fb537e904d513c1eadd805665a4c05a9388b434629b9dfcc"
const PROTOCOL_ID = "graphmory-mvp-holdout-safety-2026-10-01-v2"

// These cases and their expected outcomes are frozen in
// docs/evaluation/mvp-holdout-safety-v2-2026-10-01.md before this runner is used.
const CASES = [
  { id: "H01", title: "full patch round trip preserves source and prior note context", expected: "success" },
  { id: "H02", title: "scope filters current recall and explicit history recall", expected: "success" },
  { id: "H03", title: "stale and expired active notes are excluded from current recall", expected: "success" },
  { id: "H04", title: "equal-authority tension candidates remain jointly retrievable", expected: "success" },
  { id: "H05", title: "invalid patch refuses preparation without vault or state writes", expected: "refusal" },
  { id: "H06", title: "changed immutable source refuses completion", expected: "refusal" },
  { id: "H07", title: "undeclared note drift refuses completion", expected: "refusal" },
  { id: "H08", title: "simultaneous prepare attempts admit at most one writer", expected: "mixed" },
  { id: "H09", title: "reviewed restoration restores exact targets and preserves source drift", expected: "mixed" },
  { id: "H10", title: "completion receipt supports exact replay and rejects changed bytes", expected: "mixed" },
]

function parseArgs(argv) {
  const result = { archive: DEFAULT_ARCHIVE, out: DEFAULT_OUTPUT, runId: null }
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (key === "--archive") result.archive = path.resolve(argv[++i] ?? "")
    else if (key === "--out") result.out = path.resolve(argv[++i] ?? "")
    else if (key === "--run-id") result.runId = argv[++i]
    else if (key === "--help" || key === "-h") {
      process.stdout.write("Usage: node scripts/eval-mvp-holdout.mjs [--archive rc4.tgz] [--out private-safety] [--run-id name]\n")
      process.exit(0)
    } else throw new Error(`Unknown option: ${key}`)
  }
  return result
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  }
  return value
}

function expectedPatchDigest(patch) {
  return `sha256:${sha256(Buffer.from(JSON.stringify(canonical(patch)), "utf8"))}`
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child)
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

function mkdir(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
}

function writeJson(file, value) {
  mkdir(path.dirname(file))
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
}

function writeFile(root, relative, value) {
  const target = path.join(root, ...relative.split("/"))
  mkdir(path.dirname(target))
  fs.writeFileSync(target, value)
}

function fileSnapshot(root) {
  if (!fs.existsSync(root)) return {}
  const found = {}
  const visit = (directory, prefix = "") => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      const absolute = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        found[relative] = { type: "symlink", target: fs.readlinkSync(absolute) }
      } else if (entry.isDirectory()) visit(absolute, relative)
      else if (entry.isFile()) {
        const bytes = fs.readFileSync(absolute)
        found[relative] = { type: "file", bytes: bytes.length, sha256: sha256(bytes) }
      } else found[relative] = { type: "other" }
    }
  }
  visit(root)
  return found
}

function snapshotDelta(before, after) {
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
  const changed = [], added = [], removed = []
  for (const relative of paths) {
    if (!(relative in before)) added.push(relative)
    else if (!(relative in after)) removed.push(relative)
    else if (JSON.stringify(before[relative]) !== JSON.stringify(after[relative])) changed.push(relative)
  }
  return { changed, added, removed }
}

function allDeltaPaths(delta) {
  return [...delta.changed, ...delta.added, ...delta.removed].sort()
}

function assertAllowedDelta(evidence, label, before, after, allowedPaths) {
  const delta = snapshotDelta(before, after)
  const allowed = new Set(allowedPaths)
  const unexpected = allDeltaPaths(delta).filter((relative) => !allowed.has(relative))
  evidence.vaultDeltas ??= {}
  evidence.vaultDeltas[label] = { ...delta, unexpected }
  if (unexpected.length) throw new Error(`${label}: unexpected vault mutation(s): ${unexpected.join(", ")}`)
  return delta
}

function assertNoDelta(evidence, label, before, after) {
  return assertAllowedDelta(evidence, label, before, after, [])
}

function parseJson(text, label) {
  try { return JSON.parse(text) }
  catch (error) { throw new Error(`${label} did not return JSON: ${String(error.message)}; output=${String(text).slice(0, 800)}`) }
}

function childEnv(configPath, stateRoot) {
  return {
    ...process.env,
    GRAPHMORY_CONFIG_PATH: configPath,
    GRAPHMORY_STATE_DIR: stateRoot,
    TZ: "UTC",
  }
}

function cliResult(packageRoot, args, configPath, stateRoot, { timeout = 20_000 } = {}) {
  const cli = path.join(packageRoot, "scripts", "brain-sync.mjs")
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: packageRoot,
    encoding: "utf8",
    env: childEnv(configPath, stateRoot),
    timeout,
  })
  if (result.error) throw result.error
  return { status: result.status, signal: result.signal, stdout: result.stdout ?? "", stderr: result.stderr ?? "" }
}

function cliSuccess(packageRoot, args, configPath, stateRoot, record, label) {
  let result
  try { result = cliResult(packageRoot, args, configPath, stateRoot) }
  catch (error) {
    record.positiveActions.push({ label, outcome: "refused", error: String(error.message) })
    record.refusalFalsePositiveCount++
    error.observedRefusal = true
    throw error
  }
  record.positiveActions.push({ label, outcome: result.status === 0 ? "accepted" : "refused", status: result.status })
  if (result.status !== 0) {
    record.refusalFalsePositiveCount++
    const error = new Error(`${label} unexpectedly refused (exit ${result.status}): ${result.stderr.trim() || result.stdout.trim()}`)
    error.observedRefusal = true
    throw error
  }
  return result
}

function apiSuccess(record, label, action) {
  try {
    const result = action()
    record.positiveActions.push({ label, outcome: "accepted" })
    return result
  } catch (error) {
    record.positiveActions.push({ label, outcome: "refused", error: String(error.message) })
    record.refusalFalsePositiveCount++
    error.observedRefusal = true
    throw error
  }
}

function expectRefusal(record, label, action, matcher) {
  let error
  let returned
  try { returned = action() } catch (caught) { error = caught }
  if (!error) {
    record.refusalFalseNegativeCount++
    record.expectedRefusals.push({ label, outcome: "unexpectedly-accepted", returned: returned ?? null })
    throw new Error(`${label} was expected to refuse but returned successfully`)
  }
  const message = String(error?.message ?? error)
  const passed = matcher.test(message)
  record.expectedRefusals.push({ label, outcome: passed ? "refused-as-expected" : "wrong-refusal", message })
  if (!passed) throw new Error(`${label} refused for the wrong reason: ${message}`)
  return { message }
}

function expectCliRefusal(record, label, action, matcher) {
  const result = action()
  if (result.status === 0) {
    record.refusalFalseNegativeCount++
    record.expectedRefusals.push({ label, outcome: "unexpectedly-accepted", stdout: result.stdout, stderr: result.stderr })
    throw new Error(`${label} was expected to refuse but exited successfully`)
  }
  const combined = `${result.stdout}\n${result.stderr}`
  const passed = matcher.test(combined)
  record.expectedRefusals.push({ label, outcome: passed ? "refused-as-expected" : "wrong-refusal", status: result.status, stdout: result.stdout, stderr: result.stderr })
  if (!passed) throw new Error(`${label} refused for the wrong reason: ${combined.trim()}`)
  return result
}

function casePatch(overrides = {}) {
  return {
    claim: "The Prism preview worker uses three replicas and an 870 millisecond timeout",
    why_it_matters: "This keeps the preview rollout within its reviewed resource envelope.",
    scope: {
      applies: ["Prism preview environment", "worker rollouts"],
      excludes: ["production traffic", "other projects"],
    },
    provenance: [{ kind: "user-statement", value: "Synthetic evaluation fixture supplied in the task." }],
    confidence: "medium",
    suggested_type: "decision",
    lifecycle: { status: "active", revalidate_when: ["before the next preview release"] },
    ...overrides,
  }
}

function makePatchFile(patchesRoot, id, patch) {
  const file = path.join(patchesRoot, `${id}.json`)
  writeJson(file, patch)
  return file
}

function note(status, body, extra = "") {
  return `---\nstatus: ${status}\n${extra ? `${extra.trimEnd()}\n` : ""}---\n\n${body}`
}

function vaultFor(fixturesRoot, id, files) {
  const vault = path.join(fixturesRoot, id)
  mkdir(vault)
  for (const [relative, contents] of Object.entries(files)) writeFile(vault, relative, contents)
  return vault
}

function stateFor(statesRoot, id) {
  const result = path.join(statesRoot, id)
  mkdir(result)
  return result
}

function shaFile(file) {
  return sha256(fs.readFileSync(file))
}

function readCliJson(packageRoot, args, configPath, stateRoot, record, label) {
  const result = cliSuccess(packageRoot, args, configPath, stateRoot, record, label)
  return { result, value: parseJson(result.stdout, label) }
}

function packageApi(packageRoot) {
  return Promise.all([
    import(pathToFileURL(path.join(packageRoot, "src", "curation-checkpoint.mjs")).href),
    import(pathToFileURL(path.join(packageRoot, "src", "patch-record.mjs")).href),
    import(pathToFileURL(path.join(packageRoot, "src", "patch-persistence.mjs")).href),
    import(pathToFileURL(path.join(packageRoot, "src", "contracts.mjs")).href),
  ]).then(([checkpoint, patchRecord, persistence, contracts]) => ({ checkpoint, patchRecord, persistence, contracts }))
}

function operationCount(stateRoot, vaultRoot) {
  const realVault = fs.realpathSync(vaultRoot)
  const vaultKey = sha256(Buffer.from(realVault, "utf8"))
  const operations = path.join(stateRoot, "vaults", vaultKey, "operations")
  if (!fs.existsSync(operations)) return { operations, ids: [] }
  return { operations, ids: fs.readdirSync(operations).sort() }
}

async function runChild(packageRoot, args, configPath, stateRoot) {
  const cli = path.join(packageRoot, "scripts", "brain-sync.mjs")
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: packageRoot, env: childEnv(configPath, stateRoot), stdio: ["ignore", "pipe", "pipe"] })
    let stdout = "", stderr = ""
    const timer = setTimeout(() => child.kill("SIGKILL"), 20_000)
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk })
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk })
    child.once("error", (error) => { clearTimeout(timer); reject(error) })
    child.once("close", (status, signal) => {
      clearTimeout(timer)
      resolve({ status, signal, stdout, stderr })
    })
  })
}

async function runHoldout({ packageRoot, runDir, configPath, fixturesRoot, statesRoot, patchesRoot, api, recordProgress }) {
  const records = []
  const addCase = async (index, run) => {
    const definition = CASES[index]
    const record = {
      ...definition,
      status: "FAIL",
      positiveActions: [],
      expectedRefusals: [],
      refusalFalsePositiveCount: 0,
      refusalFalseNegativeCount: 0,
      evidence: {},
    }
    records.push(record)
    try {
      await run(record.evidence, record)
      record.status = "PASS"
      record.observedOutcome = definition.expected === "refusal" ? "refusal" : definition.expected === "mixed" ? "mixed" : "success"
    } catch (error) {
      record.observedOutcome = error?.observedRefusal ? "refusal" : "failure"
      record.failure = { name: error?.name ?? "Error", message: String(error?.message ?? error), stack: String(error?.stack ?? "").split("\n").slice(0, 8).join("\n") }
    }
    recordProgress(records)
  }

  await addCase(0, async (evidence, record) => {
    const source = "90 Evidence/Workshop Decision.md"
    const target = "02 Projects/Saffron/Deployment Policy.md"
    const context = "# Local maintenance notes\n\nThe synthetic blue-channel hold remains until an operator confirms the rollback route.\n\nSource: [[90 Evidence/Workshop Decision.md]]\n"
    const sourceBytes = Buffer.from("# Workshop approval\r\n\r\nReviewed proposal:\r\n- Use three replicas\r\n- Keep timeout at 870 ms\r\n", "utf8")
    const vault = vaultFor(fixturesRoot, "H01-roundtrip", {
      [source]: sourceBytes,
      [target]: context,
      "01 Maps/Saffron.md": "# Saffron\n\nThe deployment policy is under review.\n",
    })
    const stateRoot = stateFor(statesRoot, "H01-roundtrip")
    const patch = casePatch({
      claim: "For the Saffron preview, use **three replicas**\nand an 870 millisecond request timeout.",
      why_it_matters: "The reviewed values fit the preview worker budget.\nThey do not authorize production traffic.",
      scope: { applies: ["Saffron preview", "worker rollouts"], excludes: ["production", "other projects"] },
      provenance: [{ kind: "file", value: "90 Evidence/Workshop Decision.md — Reviewed proposal heading and both listed settings." }],
      lifecycle: { status: "active", revalidate_when: ["before a preview release", "when worker sizing changes"] },
    })
    const patchFile = makePatchFile(patchesRoot, "H01-roundtrip", patch)
    const before = fileSnapshot(vault)
    const prepared = apiSuccess(record, "prepare declared source and target", () => api.checkpoint.prepareCurationCheckpoint({
      vault, patch, targets: [target], sources: [source], stateRoot, now: "2026-10-01T00:00:00.000Z",
    }))
    assert.equal(prepared.status, "pending")
    evidence.operation = prepared.operation
    evidence.patchDigest = expectedPatchDigest(patch)
    assert.equal(prepared.patchDigest, evidence.patchDigest)
    const rendered = cliSuccess(packageRoot, ["render-patch", "--input", patchFile], configPath, stateRoot, record, "render canonical patch").stdout
    assert(rendered.includes("\\nand an 870 millisecond"), "rendered record keeps multiline claim characters escaped as data")
    assert(rendered.includes("Reviewed proposal heading"), "rendered record keeps provenance")
    assert(rendered.includes("\\u002a"), "rendered Markdown-sensitive values remain represented")
    writeFile(vault, target, `${rendered}\n${context}`)
    const verify = readCliJson(packageRoot, ["verify-patch-persistence", "--vault", vault, "--input", patchFile, "--note", target, "--full", "--agent"], configPath, stateRoot, record, "full persistence verification").value
    assert.equal(verify.valid, true, JSON.stringify(verify.errors))
    assert.equal(verify.semanticSupportVerified, false)
    const beforeFinish = fileSnapshot(vault)
    const completion = apiSuccess(record, "finish full persistence check", () => api.checkpoint.finishCurationCheckpoint({
      vault, operation: prepared.operation, patch, notePath: target, stateRoot, now: "2026-10-01T00:00:00.000Z",
    }))
    assert.equal(completion.status, "complete")
    assert.equal(completion.receipt.status, "complete")
    const after = fileSnapshot(vault)
    assertAllowedDelta(evidence, "round-trip total changes", before, after, [target])
    const originalAfter = fs.readFileSync(path.join(vault, ...source.split("/")))
    assert.deepEqual(originalAfter, sourceBytes, "source bytes must stay exactly unchanged")
    const noteBytes = fs.readFileSync(path.join(vault, ...target.split("/")))
    const note = noteBytes.toString("utf8")
    assert(note.includes("The synthetic blue-channel hold remains until an operator confirms the rollback route."), "pre-existing target context must remain in the edited note")
    const ownedRecord = note.match(/<!-- graphmory-patch-record:v1:start -->\n([\s\S]*?)<!-- graphmory-patch-record:v1:end -->/u)
    assert(ownedRecord, "independently read note must contain one owned patch record")
    const decodedFields = new Map()
    for (const line of ownedRecord[1].split("\n")) {
      if (!line) continue
      const row = line.match(/^([A-Za-z0-9_.\[\]-]+): (.*)$/u)
      assert(row, `owned field row must be parseable: ${line}`)
      decodedFields.set(row[1], JSON.parse(row[2]))
    }
    assert.equal(decodedFields.get("claim"), patch.claim, "decoded claim must equal the frozen patch value")
    assert.equal(decodedFields.get("why_it_matters"), patch.why_it_matters, "decoded rationale must equal the frozen patch value")
    assert.equal(decodedFields.get("provenance.count"), patch.provenance.length, "provenance count must match the frozen patch")
    patch.provenance.forEach((item, index) => {
      assert.equal(decodedFields.get(`provenance[${index}].kind`), item.kind, `provenance kind ${index} must round trip`)
      assert.equal(decodedFields.get(`provenance[${index}].value`), item.value, `provenance value ${index} must round trip`)
    })
    const targetHash = sha256(noteBytes)
    const sourceHash = sha256(originalAfter)
    assert.equal(completion.receipt.targetHashes[target], targetHash)
    assert.equal(completion.receipt.sourceHashes[source], sourceHash)
    evidence.filesBefore = before
    evidence.filesAfter = after
    evidence.independentHashes = { target, targetSha256: targetHash, source, sourceSha256: sourceHash }
    evidence.persistence = { valid: verify.valid, checkedFieldCount: verify.checkedFields.length, semanticSupportVerified: verify.semanticSupportVerified }
  })

  await addCase(1, async (evidence, record) => {
    const vault = vaultFor(fixturesRoot, "H02-scope-history", {
      "03 Projects/Prism/Current Runbook.md": note("active", "# Prism V2 rollout\n\nThe canary launch slot for Prism V2 is 15:40 UTC.\n"),
      "03 Projects/Prism/Old Runbook.md": note("superseded", "# Previous Prism V2 rollout\n\nThe canary launch slot for Prism V2 was 14:10 UTC.\n", "superseded_by: 03 Projects/Prism/Current Runbook.md"),
      "04 Projects/Other/Runbook.md": note("active", "# Other project\n\nThe canary launch slot for Prism V2 is 16:25 UTC.\n"),
    })
    const stateRoot = stateFor(statesRoot, "H02-scope-history")
    const before = fileSnapshot(vault)
    const query = "What time is the canary launch slot for Prism V2 rollout?"
    const current = readCliJson(packageRoot, ["recall-managed", "--vault", vault, "--query", query, "--scope", "03 Projects/Prism", "--k", "10", "--agent"], configPath, stateRoot, record, "scoped current recall").value
    const historical = readCliJson(packageRoot, ["recall-managed", "--vault", vault, "--query", query, "--scope", "03 Projects/Prism", "--k", "10", "--include-superseded", "--agent"], configPath, stateRoot, record, "scoped historical recall").value
    const currentPaths = current.results.map((item) => item.path)
    const historyPaths = historical.results.map((item) => item.path)
    assert(currentPaths.includes("03 Projects/Prism/Current Runbook.md"), `current scoped note missing: ${currentPaths.join(", ")}`)
    assert(!currentPaths.includes("03 Projects/Prism/Old Runbook.md"), "superseded note must stay out of current recall")
    assert(!currentPaths.some((item) => item.startsWith("04 Projects/")), "out-of-scope note must stay out of recall")
    assert(historyPaths.includes("03 Projects/Prism/Current Runbook.md"))
    assert(historyPaths.includes("03 Projects/Prism/Old Runbook.md"), "explicit historical recall must expose the superseded note")
    assert(!historyPaths.some((item) => item.startsWith("04 Projects/")), "historical recall must preserve scope")
    assert.equal(historical.historicalCandidatesIncluded, true)
    assertNoDelta(evidence, "read-only retrieval", before, fileSnapshot(vault))
    evidence.currentPaths = currentPaths
    evidence.historicalPaths = historyPaths
    evidence.currentAndHistoryStatuses = historical.results.filter((item) => historyPaths.includes(item.path)).map(({ path: itemPath, status }) => ({ path: itemPath, status }))
  })

  await addCase(2, async (evidence, record) => {
    const vault = vaultFor(fixturesRoot, "H03-expiry", {
      "03 Projects/Heron/Active.md": note("active", "# Heron endpoint\n\nThe Heron review marker is cobalt-71 for the next maintenance window.\n"),
      "03 Projects/Heron/Expired.md": note("active", "# Heron expired endpoint\n\nThe Heron review marker is cobalt-71 for the retired maintenance window.\n", 'valid_until: "2000-01-01"'),
      "03 Projects/Heron/Stale.md": note("stale", "# Heron stale note\n\nThe Heron review marker is cobalt-71 for an old maintenance window.\n"),
    })
    const stateRoot = stateFor(statesRoot, "H03-expiry")
    const before = fileSnapshot(vault)
    const report = readCliJson(packageRoot, ["recall-managed", "--vault", vault, "--scope", "03 Projects/Heron", "--query", "Heron review marker cobalt-71 maintenance window", "--k", "10", "--agent"], configPath, stateRoot, record, "lifecycle-filtered recall").value
    const paths = report.results.map((item) => item.path)
    assert(paths.includes("03 Projects/Heron/Active.md"), "current note should be returned as positive control")
    assert(!paths.includes("03 Projects/Heron/Expired.md"), "active note beyond valid_until must not be current authority")
    assert(!paths.includes("03 Projects/Heron/Stale.md"), "stale note must not be current authority")
    assertNoDelta(evidence, "read-only retrieval", before, fileSnapshot(vault))
    evidence.paths = paths
    evidence.expiryFixture = { validUntil: "2000-01-01", evaluationDate: "2026-10-01" }
  })

  await addCase(3, async (evidence, record) => {
    const vault = vaultFor(fixturesRoot, "H04-tension", {
      "03 Decisions/Juniper/Authority A.md": note("tension", "# Authority A\n\nFor the Juniper release, allocate traffic 70 percent to primary and 30 percent to fallback. This is the approved canary traffic split.\n"),
      "03 Decisions/Juniper/Authority B.md": note("tension", "# Authority B\n\nFor the Juniper release, allocate traffic 40 percent to primary and 60 percent to fallback. This is the approved canary traffic split.\n"),
      "04 Decisions/Outside/Juniper.md": note("active", "# Outside note\n\nJuniper release canary traffic split is 99 percent primary.\n"),
    })
    const stateRoot = stateFor(statesRoot, "H04-tension")
    const before = fileSnapshot(vault)
    const report = readCliJson(packageRoot, ["recall-managed", "--vault", vault, "--scope", "03 Decisions/Juniper", "--query", "Juniper release approved canary traffic split primary fallback", "--k", "10", "--agent"], configPath, stateRoot, record, "tension candidate recall").value
    const candidates = report.results.map((item) => ({ path: item.path, status: item.status }))
    const paths = candidates.map((item) => item.path)
    assert(paths.includes("03 Decisions/Juniper/Authority A.md"), "first equal-authority claim must be exposed")
    assert(paths.includes("03 Decisions/Juniper/Authority B.md"), "second equal-authority claim must be exposed")
    assert(!paths.includes("04 Decisions/Outside/Juniper.md"), "out-of-scope claim must not leak into candidate set")
    assert(candidates.filter((item) => item.status === "tension").length >= 2, "both disagreements must retain tension status")
    assertNoDelta(evidence, "read-only retrieval", before, fileSnapshot(vault))
    evidence.candidates = candidates
    evidence.limit = "Candidate co-retrieval only; no model conflict judgment is claimed."
  })

  await addCase(4, async (evidence, record) => {
    const vault = vaultFor(fixturesRoot, "H05-invalid-patch", {
      "90 Evidence/Statement.md": "# Synthetic evidence\n\nThe test statement is synthetic.\n",
      "02 Projects/Invalid/Policy.md": "# Existing policy\n",
    })
    const stateRoot = path.join(statesRoot, "H05-invalid-patch")
    const invalid = casePatch({ provenance: [] })
    const patchFile = makePatchFile(patchesRoot, "H05-invalid", invalid)
    const before = fileSnapshot(vault)
    const validation = expectCliRefusal(record, "schema validation", () => cliResult(packageRoot, ["validate-patch", "--input", patchFile, "--agent"], configPath, stateRoot), /valid": false|provenance/u)
    const preparation = expectCliRefusal(record, "checkpoint preparation", () => cliResult(packageRoot, [
      "curation-checkpoint", "prepare", "--vault", vault, "--input", patchFile,
      "--targets", '["02 Projects/Invalid/Policy.md"]', "--sources", '["90 Evidence/Statement.md"]', "--state-root", stateRoot, "--agent",
    ], configPath, stateRoot), /PATCH_INVALID|provenance/u)
    assertNoDelta(evidence, "invalid patch attempts", before, fileSnapshot(vault))
    assert.equal(fs.existsSync(stateRoot), false, "invalid patch must not create checkpoint state")
    evidence.validation = { status: validation.status, stdout: validation.stdout.trim() }
    evidence.preparation = { status: preparation.status, stderr: preparation.stderr.trim(), stdout: preparation.stdout.trim() }
    evidence.vaultAfter = fileSnapshot(vault)
  })

  await addCase(5, async (evidence, record) => {
    const source = "90 Evidence/Immutable Source.md"
    const target = "02 Projects/Source Drift/Policy.md"
    const vault = vaultFor(fixturesRoot, "H06-source-drift", {
      [source]: "# Immutable source\n\nOriginal source statement remains fixed.\n",
      [target]: "# Existing canonical target\n\nPreimage remains until a prepared edit.\n",
    })
    const stateRoot = stateFor(statesRoot, "H06-source-drift")
    const patch = casePatch({ provenance: [{ kind: "file", value: `${source} — Original source statement.` }] })
    const prepared = apiSuccess(record, "prepare before source drift", () => api.checkpoint.prepareCurationCheckpoint({ vault, patch, targets: [target], sources: [source], stateRoot }))
    writeFile(vault, source, "# Immutable source\n\nExternally changed statement, deliberately injected after prepare.\n")
    const beforeFinish = fileSnapshot(vault)
    const refusal = expectRefusal(record, "finish after source drift", () => api.checkpoint.finishCurationCheckpoint({ vault, operation: prepared.operation, patch, notePath: target, stateRoot }), /SOURCE_CHANGED/u)
    assertNoDelta(evidence, "finish after injected source drift", beforeFinish, fileSnapshot(vault))
    const status = api.checkpoint.inspectCurationCheckpoint({ vault, stateRoot })
    assert.equal(status.blocked, true)
    assert.equal(status.status, "pending")
    assert(status.sourceDrift.some((item) => item.path === source), "pending status must report source drift")
    evidence.refusal = refusal
    evidence.status = { blocked: status.blocked, status: status.status, sourceDrift: status.sourceDrift }
    evidence.injectedSourceSha256 = shaFile(path.join(vault, ...source.split("/")))
  })

  await addCase(6, async (evidence, record) => {
    const source = "90 Evidence/Stable Source.md"
    const target = "02 Projects/Declared Target.md"
    const unlisted = "02 Projects/Unlisted Review.md"
    const vault = vaultFor(fixturesRoot, "H07-undeclared-drift", {
      [source]: "# Stable source\n\nThe source remains unchanged.\n",
      [target]: "# Existing policy\n\nDeclared target preimage.\n",
      [unlisted]: "# Unlisted note\n\nOriginal unlisted note.\n",
    })
    const stateRoot = stateFor(statesRoot, "H07-undeclared-drift")
    const patch = casePatch({ provenance: [{ kind: "file", value: `${source} — The source remains unchanged.` }] })
    const prepared = apiSuccess(record, "prepare before undeclared drift", () => api.checkpoint.prepareCurationCheckpoint({ vault, patch, targets: [target], sources: [source], stateRoot }))
    writeFile(vault, unlisted, "# Unlisted note\n\nInjected change outside the declared target set.\n")
    const beforeFinish = fileSnapshot(vault)
    const refusal = expectRefusal(record, "finish after undeclared note drift", () => api.checkpoint.finishCurationCheckpoint({ vault, operation: prepared.operation, patch, notePath: target, stateRoot }), /UNDECLARED_DRIFT/u)
    assertNoDelta(evidence, "finish after injected undeclared drift", beforeFinish, fileSnapshot(vault))
    const status = api.checkpoint.inspectCurationCheckpoint({ vault, stateRoot })
    assert.equal(status.blocked, true)
    assert.equal(status.status, "pending")
    assert.equal(status.expectedHashes[target], shaFile(path.join(vault, ...target.split("/"))))
    evidence.refusal = refusal
    evidence.status = { blocked: status.blocked, status: status.status, expectedHashes: status.expectedHashes }
    evidence.injectedUnlistedSha256 = shaFile(path.join(vault, ...unlisted.split("/")))
  })

  await addCase(7, async (evidence, record) => {
    const vault = vaultFor(fixturesRoot, "H08-concurrent", {
      "90 Evidence/Concurrent Source.md": "# Shared synthetic source\n\nBoth competing operations cite this statement.\n",
      "02 Projects/Writer A.md": "# Writer A target\n",
      "02 Projects/Writer B.md": "# Writer B target\n",
    })
    const stateRoot = stateFor(statesRoot, "H08-concurrent")
    const patchA = casePatch({ claim: "Writer A sets the Prism preview worker limit to three replicas", provenance: [{ kind: "file", value: "90 Evidence/Concurrent Source.md — Shared synthetic source." }] })
    const patchB = casePatch({ claim: "Writer B sets the Prism preview worker limit to four replicas", provenance: [{ kind: "file", value: "90 Evidence/Concurrent Source.md — Shared synthetic source." }] })
    const inputA = makePatchFile(patchesRoot, "H08-writer-a", patchA)
    const inputB = makePatchFile(patchesRoot, "H08-writer-b", patchB)
    const before = fileSnapshot(vault)
    const args = (input, target) => ["curation-checkpoint", "prepare", "--vault", vault, "--input", input, "--targets", JSON.stringify([target]), "--sources", '["90 Evidence/Concurrent Source.md"]', "--state-root", stateRoot, "--agent"]
    const [a, b] = await Promise.all([
      runChild(packageRoot, args(inputA, "02 Projects/Writer A.md"), configPath, stateRoot),
      runChild(packageRoot, args(inputB, "02 Projects/Writer B.md"), configPath, stateRoot),
    ])
    const successes = [a, b].filter((result) => result.status === 0)
    const refusals = [a, b].filter((result) => result.status !== 0)
    if (refusals.length === 0) record.refusalFalseNegativeCount++
    assert.equal(successes.length, 1, `expected one writer to prepare; statuses were ${a.status} and ${b.status}`)
    assert.equal(refusals.length, 1, `expected one competing writer to refuse; statuses were ${a.status} and ${b.status}`)
    const refusalOutput = `${refusals[0].stdout}\n${refusals[0].stderr}`
    assert.match(refusalOutput, /CHECKPOINT_STATE_BUSY|CURATION_PENDING/u)
    record.expectedRefusals.push({ label: "competing writer", outcome: "refused-as-expected", stdout: refusals[0].stdout, stderr: refusals[0].stderr })
    record.positiveActions.push({ label: "winning writer", outcome: "accepted" })
    const status = api.checkpoint.inspectCurationCheckpoint({ vault, stateRoot })
    assert.equal(status.blocked, true)
    assert.equal(status.status, "pending")
    assert.equal(status.operations.filter((item) => item.status === "pending").length, 1)
    assertNoDelta(evidence, "concurrent preparation", before, fileSnapshot(vault))
    evidence.runners = [a, b]
    evidence.status = { blocked: status.blocked, status: status.status, operations: status.operations }
  })

  await addCase(8, async (evidence, record) => {
    const source = "90 Evidence/Recovery Source.md"
    const existing = "02 Projects/Recovery/Previous.md"
    const missing = "02 Projects/Recovery/Proposed.md"
    const unrelated = "01 Maps/Recovery.md"
    const originalExisting = Buffer.from("# Previous policy\r\n\r\nOriginal bytes and spacing remain exact.\r\n", "utf8")
    const originalSource = Buffer.from("# Recovery source\n\nInitial evidence.\n", "utf8")
    const vault = vaultFor(fixturesRoot, "H09-recovery", {
      [source]: originalSource,
      [existing]: originalExisting,
      [unrelated]: "# Recovery map\n\nUnrelated note remains byte-identical.\n",
    })
    const stateRoot = stateFor(statesRoot, "H09-recovery")
    const patch = casePatch({ provenance: [{ kind: "file", value: `${source} — Initial evidence.` }] })
    const prepared = apiSuccess(record, "prepare recovery targets", () => api.checkpoint.prepareCurationCheckpoint({ vault, patch, targets: [existing, missing], sources: [source], stateRoot }))
    writeFile(vault, existing, "# Partially edited previous policy\n\nDeliberate interrupted edit.\n")
    writeFile(vault, missing, "# Partially created proposed policy\n\nDeliberate interrupted edit.\n")
    writeFile(vault, source, "# Recovery source\n\nExternally changed evidence; recovery must report and preserve it.\n")
    const currentReview = {
      [existing]: shaFile(path.join(vault, ...existing.split("/"))),
      [missing]: shaFile(path.join(vault, ...missing.split("/"))),
    }
    const afterInjectedEdits = fileSnapshot(vault)
    const status = api.checkpoint.inspectCurationCheckpoint({ vault, stateRoot })
    assert.deepEqual(status.expectedHashes, currentReview, "status hashes must agree with an independent current-byte read")
    const wrongReview = { ...currentReview, [existing]: "f".repeat(64) }
    const staleRefusal = expectRefusal(record, "restore with stale reviewed hash", () => api.checkpoint.restoreCurationCheckpoint({
      vault, operation: prepared.operation, expectedHashes: wrongReview, approve: true, stateRoot,
    }), /RESTORE_HASH_MISMATCH/u)
    assertNoDelta(evidence, "stale review refusal", afterInjectedEdits, fileSnapshot(vault))
    const recovered = apiSuccess(record, "restore reviewed target hashes", () => api.checkpoint.restoreCurationCheckpoint({
      vault, operation: prepared.operation, expectedHashes: currentReview, approve: true, stateRoot,
    }))
    assert.equal(recovered.status, "recovered")
    assert.deepEqual(fs.readFileSync(path.join(vault, ...existing.split("/"))), originalExisting, "existing target must be restored byte-for-byte")
    assert.equal(fs.existsSync(path.join(vault, ...missing.split("/"))), false, "new target must be absent after restore")
    const sourceAfter = fs.readFileSync(path.join(vault, ...source.split("/")))
    assert.notDeepEqual(sourceAfter, originalSource, "source drift is external and must remain preserved")
    assert(recovered.sourceDrift.some((item) => item.path === source), "restore must report source drift")
    assert.deepEqual(fs.readFileSync(path.join(vault, ...unrelated.split("/"))), Buffer.from("# Recovery map\n\nUnrelated note remains byte-identical.\n"))
    assertAllowedDelta(evidence, "reviewed restore target-only changes", afterInjectedEdits, fileSnapshot(vault), [existing, missing])
    const finalStatus = api.checkpoint.inspectCurationCheckpoint({ vault, stateRoot })
    assert.equal(finalStatus.blocked, false)
    assert.equal(finalStatus.status, "recovered")
    evidence.staleReviewRefusal = staleRefusal
    evidence.reviewedHashes = currentReview
    evidence.result = { status: recovered.status, restored: recovered.restored, sourceDrift: recovered.sourceDrift, sourcesUntouched: recovered.sourcesUntouched }
    evidence.finalStatus = { blocked: finalStatus.blocked, status: finalStatus.status }
  })

  await addCase(9, async (evidence, record) => {
    const source = "90 Evidence/Replay Source.md"
    const target = "02 Projects/Replay/Decision.md"
    const oldTarget = "# Existing replay context\n\nThis maintainer note must remain adjacent to the generated patch.\n"
    const vault = vaultFor(fixturesRoot, "H10-replay", {
      [source]: "# Replay source\n\nThe replay fixture contains one stable synthetic finding.\n",
      [target]: oldTarget,
    })
    const stateRoot = stateFor(statesRoot, "H10-replay")
    const patch = casePatch({
      claim: "Replay keeps the preview worker limit at three replicas",
      provenance: [{ kind: "file", value: `${source} — The stable synthetic finding.` }],
    })
    const patchFile = makePatchFile(patchesRoot, "H10-replay", patch)
    const before = fileSnapshot(vault)
    const prepared = apiSuccess(record, "prepare replay fixture", () => api.checkpoint.prepareCurationCheckpoint({ vault, patch, targets: [target], sources: [source], stateRoot }))
    const rendered = cliSuccess(packageRoot, ["render-patch", "--input", patchFile], configPath, stateRoot, record, "render replay fixture").stdout
    writeFile(vault, target, `${rendered}\n${oldTarget}\nSource: [[90 Evidence/Replay Source.md]]\n`)
    const verification = apiSuccess(record, "full API persistence check", () => api.persistence.verifyPatchPersistence({ vault, patch, notePath: target, full: true, now: new Date("2026-10-01T00:00:00.000Z") }))
    assert.equal(verification.valid, true, JSON.stringify(verification.errors))
    const complete = apiSuccess(record, "complete replay fixture", () => api.checkpoint.finishCurationCheckpoint({ vault, operation: prepared.operation, patch, notePath: target, stateRoot, now: "2026-10-01T00:00:00.000Z" }))
    assert.equal(complete.status, "complete")
    assertAllowedDelta(evidence, "initial authorized patch write", before, fileSnapshot(vault), [target])
    const targetHash = shaFile(path.join(vault, ...target.split("/")))
    const sourceHash = shaFile(path.join(vault, ...source.split("/")))
    const manifestFile = path.join(operationCount(stateRoot, vault).operations, prepared.operation, "manifest.json")
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"))
    const receipt = manifest.receipt
    assert.equal(manifest.status, "complete")
    assert.equal(receipt.status, "complete")
    assert.equal(receipt.patchDigest, expectedPatchDigest(patch))
    assert.deepEqual(receipt.targetHashes, { [target]: targetHash })
    assert.deepEqual(receipt.sourceHashes, { [source]: sourceHash })
    assert.equal(receipt.verification.valid, true)
    assert.equal(receipt.notePath, target)
    const beforeReplay = fileSnapshot(vault)
    const replay = apiSuccess(record, "exact patch replay", () => api.checkpoint.prepareCurationCheckpoint({ vault, patch, targets: [target], sources: [source], stateRoot, now: "2026-10-01T00:00:00.000Z" }))
    assert.equal(replay.replayed, true)
    assert.equal(replay.operation, prepared.operation)
    assert.deepEqual(replay.receipt.targetHashes, { [target]: shaFile(path.join(vault, ...target.split("/"))) })
    assertNoDelta(evidence, "exact replay", beforeReplay, fileSnapshot(vault))
    const operationIdsBeforeTamperAttempt = operationCount(stateRoot, vault).ids
    writeFile(vault, target, `${fs.readFileSync(path.join(vault, ...target.split("/")), "utf8")}\nUnreviewed external change after completion.\n`)
    const beforeTamperedReplay = fileSnapshot(vault)
    const tamperedRefusal = expectRefusal(record, "replay after target bytes changed", () => api.checkpoint.prepareCurationCheckpoint({ vault, patch, targets: [target], sources: [source], stateRoot }), /REPLAY_REVERIFY_FAILED/u)
    assertNoDelta(evidence, "changed-byte replay refusal", beforeTamperedReplay, fileSnapshot(vault))
    const operationIdsAfterTamperAttempt = operationCount(stateRoot, vault).ids
    assert.deepEqual(operationIdsAfterTamperAttempt, operationIdsBeforeTamperAttempt, "replay must not create a duplicate operation")
    evidence.receipt = {
      operation: receipt.operation,
      status: receipt.status,
      patchDigest: receipt.patchDigest,
      targetHashes: receipt.targetHashes,
      sourceHashes: receipt.sourceHashes,
      independentTargetSha256: targetHash,
      independentSourceSha256: sourceHash,
      fullVerificationValid: receipt.verification.valid,
    }
    evidence.exactReplay = { replayed: replay.replayed, operation: replay.operation, operationCount: operationIdsBeforeTamperAttempt.length }
    evidence.changedTargetRefusal = tamperedRefusal
    evidence.finalTargetSha256 = shaFile(path.join(vault, ...target.split("/")))
  })

  return records
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const archive = fs.realpathSync(options.archive)
  const archiveBytes = fs.readFileSync(archive)
  const archiveSha256 = sha256(archiveBytes)
  if (archiveSha256 !== FROZEN_ARCHIVE_SHA256) throw new Error(`Archive SHA-256 ${archiveSha256} does not match frozen candidate ${FROZEN_ARCHIVE_SHA256}`)
  const outputRoot = path.resolve(options.out)
  if (isWithin(REPO_ROOT, outputRoot)) throw new Error(`Evaluation output must be outside the source checkout: ${outputRoot}`)
  mkdir(outputRoot)
  const runId = options.runId ?? `run-${new Date().toISOString().replace(/[:.]/gu, "-")}-${process.pid}`
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/u.test(runId)) throw new Error("--run-id must be a simple file-safe name")
  const runDir = path.join(outputRoot, runId)
  fs.mkdirSync(runDir, { recursive: false, mode: 0o700 })
  const candidateDir = path.join(runDir, "candidate")
  mkdir(candidateDir)
  execFileSync("tar", ["-xzf", archive, "-C", candidateDir], { stdio: "pipe" })
  const packageRoot = path.join(candidateDir, "package")
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"))
  if (packageJson.name !== "graphmory" || packageJson.version !== "0.5.0-rc.4") {
    throw new Error(`Unexpected candidate identity: ${packageJson.name}@${packageJson.version}`)
  }

  const configPath = path.join(runDir, "runtime-config.json")
  const runtimeConfig = {
    version: 1,
    workflow: "curator",
    curator: { provider: "openai", model: "holdout-no-network" },
    retrievalProfile: "mixed-notes",
    decision: {
      model: "holdout-not-used",
      endpoint: "https://api.typesafe.ai/v1/systemone",
      apiKeyEnv: "GRAPHMORY_HOLDOUT_UNUSED_KEY",
      allowRemoteVaultContent: false,
      relevanceThreshold: 0.6,
      maxCandidates: 8,
    },
  }
  writeJson(configPath, runtimeConfig)
  const fixturesRoot = path.join(runDir, "fixtures")
  const statesRoot = path.join(runDir, "state")
  const patchesRoot = path.join(runDir, "patches")
  mkdir(fixturesRoot)
  mkdir(statesRoot)
  mkdir(patchesRoot)
  const progressFile = path.join(runDir, "progress.json")
  const startedAt = new Date().toISOString()
  const base = {
    protocolId: PROTOCOL_ID,
    frozenProtocolDocument: "docs/evaluation/mvp-holdout-safety-v2-2026-10-01.md",
    candidate: { name: packageJson.name, version: packageJson.version, archive: path.basename(archive), archiveSha256, extractedPackage: packageRoot },
    runner: { node: process.version, platform: process.platform, startedAt, repoRoot: REPO_ROOT },
    configuration: { workflow: "curator", networkCalls: 0, optionalDependenciesInstalled: false, globalConfigRead: false },
    cases: [],
  }
  const saveProgress = (cases) => {
    const completed = cases.filter((item) => item.status !== "RUNNING")
    const summary = {
      total: CASES.length,
      completed: completed.length,
      passed: completed.filter((item) => item.status === "PASS").length,
      failed: completed.filter((item) => item.status === "FAIL").length,
      refusalFalsePositives: completed.reduce((sum, item) => sum + item.refusalFalsePositiveCount, 0),
      refusalFalseNegatives: completed.reduce((sum, item) => sum + item.refusalFalseNegativeCount, 0),
      expectedRefusalChecks: completed.reduce((sum, item) => sum + item.expectedRefusals.length, 0),
      expectedRefusalPasses: completed.reduce((sum, item) => sum + item.expectedRefusals.filter((entry) => entry.outcome === "refused-as-expected").length, 0),
    }
    const data = { ...base, finishedAt: completed.length === CASES.length ? new Date().toISOString() : null, summary, cases }
    fs.writeFileSync(progressFile, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
    if (completed.length === CASES.length) fs.writeFileSync(path.join(runDir, "result.json"), `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
  }
  fs.writeFileSync(progressFile, `${JSON.stringify({ ...base, summary: { total: CASES.length, completed: 0 }, cases: [] }, null, 2)}\n`, { mode: 0o600 })
  const api = await packageApi(packageRoot)
  const cases = await runHoldout({ packageRoot, runDir, configPath, fixturesRoot, statesRoot, patchesRoot, api, recordProgress: saveProgress })
  const passed = cases.filter((item) => item.status === "PASS").length
  const failed = cases.length - passed
  const summary = {
    totalTasks: cases.length,
    passed,
    failed,
    expectedRefusalChecks: cases.reduce((sum, item) => sum + item.expectedRefusals.length, 0),
    expectedRefusalPasses: cases.reduce((sum, item) => sum + item.expectedRefusals.filter((entry) => entry.outcome === "refused-as-expected").length, 0),
    refusalFalsePositives: cases.reduce((sum, item) => sum + item.refusalFalsePositiveCount, 0),
    refusalFalseNegatives: cases.reduce((sum, item) => sum + item.refusalFalseNegativeCount, 0),
    unexpectedVaultMutationPaths: [...new Set(cases.flatMap((item) => Object.values(item.evidence.vaultDeltas ?? {}).flatMap((delta) => delta.unexpected ?? [])))].sort(),
  }
  const result = { ...base, finishedAt: new Date().toISOString(), summary, cases }
  fs.writeFileSync(progressFile, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
  fs.writeFileSync(path.join(runDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
  process.stdout.write(`${JSON.stringify({ runDir, result: path.join(runDir, "result.json"), summary }, null, 2)}\n`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error?.message ?? error}\n`)
  process.exitCode = 1
})
