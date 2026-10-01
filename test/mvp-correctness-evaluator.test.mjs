import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  buildUpdateChildPrompt,
  captureUpdateResult,
  compareFrozenSnapshot,
  compareStateTreeAtRoot,
  linkTo,
  scanSession,
  snapshotTree,
} from "../scripts/eval-mvp-correctness-repair.mjs"

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const NATIVE = path.resolve(REPO, "..", "graphmory-mvp-repair-20261001", "native")
const SCRIPT = path.join(REPO, "scripts", "eval-mvp-correctness-repair.mjs")
const SOURCE = "90 Evidence/HelioForge Change Record.md"
const NEW_TARGET = "01 Projects/HelioForge/Recovery Window Policy.md"

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function sha(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }) }
function privateRun(runId) { return path.join(NATIVE, "private", runId) }
function runDirectory(runId) { return path.join(NATIVE, "runs", runId) }

test("source anchors normalize .md before the fragment and require the expected anchor", () => {
  const current = "Approved replacement history: [[90 Evidence/HelioForge Change Record.md#D2]]."
  const previous = "Authority history: [[HelioForge Change Record#D1]]."
  assert.equal(linkTo(current, `${SOURCE}#D2`), true)
  assert.equal(linkTo(previous, `${SOURCE}#D1`), true)
  assert.equal(linkTo(current, `${SOURCE}#D1`), false)
})

test("native02 and native03 raw traces retain path case and resolve omitted page offset 0", { skip: !fs.existsSync(privateRun("repair-native-02")) || !fs.existsSync(privateRun("repair-native-03")) }, () => {
  for (const runId of ["repair-native-02", "repair-native-03"]) {
    const privateRoot = privateRun(runId)
    const evidence = readJson(path.join(privateRoot, "evidence", "native-evidence.json"))
    const session = evidence.sessions.update
    const expectedState = path.join(privateRoot, "state", "primary")
    const project = path.join(runDirectory(runId), "project")
    const scan = scanSession(session, expectedState, project)
    assert.equal(scan.rootPass, true, `${runId} state-root comparison`)
    if (scan.stateAssignments.length) assert.ok(scan.stateAssignments.every((value) => value === expectedState))
    assert.ok(scan.recallManagedOffsets.includes("0"), `${runId} implicit/default offset`)
    assert.ok(scan.recallManagedOffsets.includes("2"), `${runId} offset 2`)
    assert.ok(scan.recallManagedOffsets.includes("4"), `${runId} offset 4`)
  }
})

test("native02 anchor repair does not erase its missing-receipt failure", { skip: !fs.existsSync(privateRun("repair-native-02")) }, () => {
  const privateRoot = privateRun("repair-native-02")
  const runRoot = runDirectory("repair-native-02")
  const oracle = readJson(path.join(privateRoot, "oracle.json"))
  const originalScoreBytes = fs.readFileSync(path.join(privateRoot, "evidence", "update-score.json"))
  const originalCaptureBytes = fs.readFileSync(path.join(privateRoot, "evidence", "update-capture.json"))
  const capture = captureUpdateResult({
    selectedVault: path.join(runRoot, "vault", "helioforge"),
    baseline: oracle.baseline.files,
    selectedStateRoot: path.join(privateRoot, "state", "primary"),
    expectedSourceSha256: oracle.source.sha256,
    selectedRunId: "repair-native-02-regression-read-only",
    capturedAt: "fixed-test-time",
  })
  assert.equal(capture.semanticPass, true)
  assert.equal(capture.fileIntegrityPass, true)
  assert.equal(capture.receiptPass, false)
  assert.ok(capture.receiptCheck.errors.includes("matching successful receipt is absent"))
  assert.equal(readJson(path.join(privateRoot, "evidence", "update-score.json")).workflowPass, false)
  assert.deepEqual(fs.readFileSync(path.join(privateRoot, "evidence", "update-score.json")), originalScoreBytes)
  assert.deepEqual(fs.readFileSync(path.join(privateRoot, "evidence", "update-capture.json")), originalCaptureBytes)
})

test("native03 missing approved target produces and persists a complete FAIL capture and score", { skip: !fs.existsSync(privateRun("repair-native-03")) }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-eval-missing-target-"))
  try {
    const nativeRoot = path.join(tempRoot, "native")
    const privateRoot = path.join(nativeRoot, "private", "repair-native-03")
    const runRoot = path.join(nativeRoot, "runs", "repair-native-03")
    fs.mkdirSync(path.dirname(privateRoot), { recursive: true })
    fs.mkdirSync(path.dirname(runRoot), { recursive: true })
    fs.cpSync(privateRun("repair-native-03"), privateRoot, { recursive: true })
    fs.cpSync(runDirectory("repair-native-03"), runRoot, { recursive: true })

    const freezePath = path.join(privateRoot, "candidate-freeze.json")
    const freeze = readJson(freezePath)
    freeze.candidate.packageRoot = path.join(privateRun("repair-native-03"), "archive-check", "candidate", "package")
    writeJson(freezePath, freeze)
    const freezeRecordPath = path.join(privateRoot, "freeze-record.json")
    const freezeRecord = readJson(freezeRecordPath)
    freezeRecord.candidateFreezeSha256 = sha(fs.readFileSync(freezePath))
    writeJson(freezeRecordPath, freezeRecord)

    const runnerBytes = fs.readFileSync(SCRIPT)
    const runnerSha256 = sha(runnerBytes)
    const runnerArchive = `evidence/scorer-revision-runner-${runnerSha256}.mjs`
    fs.writeFileSync(path.join(privateRoot, runnerArchive), runnerBytes, { mode: 0o600 })
    const revision = {
      status: "SCORER-ONLY LINKED REVISION BEFORE SCORE",
      baseCandidateFreezeSha256: sha(fs.readFileSync(freezePath)),
      previousRunnerSha256: freeze.runnerSha256,
      revisedRunnerSha256: runnerSha256,
      semanticOracleChanged: false,
      candidateIdentityChanged: false,
      fixtureOrPromptChanged: false,
      runnerArchive,
      runnerArchiveSha256: runnerSha256,
    }
    writeJson(path.join(privateRoot, "scorer-revision.json"), revision)

    const capture = spawnSync(process.execPath, [SCRIPT, "capture-update", "--run-id", "repair-native-03", "--root", nativeRoot], {
      cwd: REPO, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
    })
    assert.equal(capture.status, 0, capture.stderr)
    const capturePath = path.join(privateRoot, "evidence", "update-capture.json")
    const savedCapture = readJson(capturePath)
    assert.equal(savedCapture.fileIntegrityPass, false)
    assert.equal(savedCapture.receiptPass, false)
    assert.deepEqual(savedCapture.missingRequiredTargets, [NEW_TARGET])
    assert.ok(savedCapture.contentCheck.errors.some((error) => error.includes(`required target is missing: ${NEW_TARGET}`)))

    const evidencePath = path.join(privateRoot, "evidence", "native-evidence.json")
    const score = spawnSync(process.execPath, [SCRIPT, "score-update", "--run-id", "repair-native-03", "--root", nativeRoot,
      "--evidence", evidencePath], { cwd: REPO, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 })
    assert.equal(score.status, 0, score.stderr)
    const savedScore = readJson(path.join(privateRoot, "evidence", "update-score.json"))
    assert.equal(savedScore.workflowPass, false)
    assert.deepEqual(savedScore.missingRequiredTargets, [NEW_TARGET])
    assert.equal(savedScore.receiptPass, false)
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})

test("pending state-tree comparison covers files, directories, lock data, and missing roots", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-state-tree-"))
  const stateRoot = path.join(tempRoot, "state")
  const operation = path.join(stateRoot, "vaults", "fixture", "operations", "operation-1")
  fs.mkdirSync(path.join(operation, "preimages"), { recursive: true })
  fs.writeFileSync(path.join(operation, "manifest.json"), "pending")
  fs.writeFileSync(path.join(operation, "preimages", "target.bin"), "original bytes")
  fs.writeFileSync(path.join(stateRoot, "lock-state.json"), "locked")
  try {
    const before = snapshotTree(stateRoot)
    assert.ok(before["vaults/"])
    assert.ok(before["vaults/fixture/operations/operation-1/preimages/target.bin"])
    assert.equal(compareFrozenSnapshot(before, snapshotTree(stateRoot)).pass, true)
    fs.writeFileSync(path.join(stateRoot, "lock-state.json"), "changed")
    const changed = compareFrozenSnapshot(before, snapshotTree(stateRoot))
    assert.equal(changed.pass, false)
    assert.ok(changed.changed.includes("lock-state.json"))

    fs.rmSync(stateRoot, { recursive: true })
    const missingRoot = compareStateTreeAtRoot(before, stateRoot)
    assert.equal(missingRoot.pass, false)
    assert.deepEqual(missingRoot.changed, ["<state tree unavailable>"])
    assert.match(missingRoot.error, /ENOENT/u)
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})

test("legacy native04 PASS is preserved but cannot stand in for the new state-tree gate", { skip: !fs.existsSync(privateRun("repair-native-04")) }, () => {
  const privateRoot = privateRun("repair-native-04")
  const seedPath = path.join(privateRoot, "pending-seed.json")
  const scorePath = path.join(privateRoot, "evidence", "pending-score.json")
  const seedBytes = fs.readFileSync(seedPath)
  const scoreBytes = fs.readFileSync(scorePath)
  const seed = JSON.parse(seedBytes.toString("utf8"))
  const priorScore = JSON.parse(scoreBytes.toString("utf8"))
  const stateRoot = path.join(privateRoot, "state", "pending")
  const traceEvidence = readJson(path.join(privateRoot, "evidence", "native-traces.json"))
  const session = traceEvidence.sessions.pendingRefusal
  const scan = scanSession(session, stateRoot, path.join(runDirectory("repair-native-04"), "project"))
  assert.equal(priorScore.workflowPass, true)
  assert.equal(scan.tracePass, true)
  assert.equal(scan.rootPass, true)
  assert.equal(seed.preSessionStateSnapshot, undefined)
  const newGate = compareStateTreeAtRoot(seed.preSessionStateSnapshot, stateRoot)
  assert.equal(newGate.pass, false)
  assert.deepEqual(newGate.changed, ["<missing pre-session snapshot>"])
  assert.deepEqual(fs.readFileSync(seedPath), seedBytes)
  assert.deepEqual(fs.readFileSync(scorePath), scoreBytes)
})

test("new update prompt narrowly authorizes the exact absent target and binds its absence before writes", () => {
  const targetsText = JSON.stringify([
    "00 Projects/HelioForge/Index.md",
    "01 Projects/HelioForge/Migration Runbook.md",
    "01 Projects/HelioForge/Batch Policy.md",
    NEW_TARGET,
  ])
  const prompt = buildUpdateChildPrompt({ c: "node graphmory", shared: "Constants are fixed.", targetsText, sourceText: JSON.stringify([SOURCE]) })
  assert.match(prompt, /explicitly authorizes creating exactly this new target/u)
  assert.ok(prompt.includes(NEW_TARGET))
  assert.match(prompt, /skip reading a nonexistent original body/u)
  assert.match(prompt, /existed:false and sha256:null before the first write/u)
  assert.match(prompt, /No other new path is authorized/u)
  assert.ok(prompt.includes(targetsText))
})
