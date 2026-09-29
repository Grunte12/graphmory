#!/usr/bin/env node
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const args = process.argv.slice(2)
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function option(name) {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`${name} needs a value`)
  return args[index + 1]
}

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: node scripts/prepare-native-curator-smoke.mjs --out <new-directory>")
  console.log("Creates three synthetic Markdown vaults, patch inputs, baseline manifests, and scenario.json. Existing output paths are refused.")
  process.exit(0)
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" })
}

function writeFixtureFile(root, relative, content) {
  const target = path.join(root, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content, { flag: "wx" })
}

function filesUnder(root, directory = root) {
  const result = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error("Synthetic fixture unexpectedly contains a symlink")
    if (entry.isDirectory()) result.push(...filesUnder(root, absolute))
    else if (entry.isFile()) result.push(path.relative(root, absolute).split(path.sep).join("/"))
  }
  return result.sort()
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function manifestForFiles(vault, relativePaths) {
  return {
    algorithm: "sha256",
    files: relativePaths.map((relativePath) => {
      const bytes = fs.readFileSync(path.join(vault, relativePath))
      return { path: relativePath, bytes: bytes.length, sha256: sha256(bytes) }
    }),
  }
}

function fullVaultManifest(vault) {
  return manifestForFiles(vault, filesUnder(vault))
}

const obsidianSettings = `${JSON.stringify({ alwaysUpdateLinks: true }, null, 2)}\n`
const heliosIndex = `---\nstatus: active\ncanonical_memory: true\n---\n# Helios project index\n\nRelease work starts at [[Runbook]].\n`
const heliosRunbook = `---\nstatus: active\ncanonical_memory: true\n---\n# Production release runbook\n\nCurrent approval policy: [[Release Policy]]. The release owner may approve their own production release.\n`
const oldReleasePolicy = `---\nstatus: active\ncanonical_memory: true\n---\n# Release Policy\n\nA named release owner may approve their own production release.\n\nEvidence E1: [[90 Evidence/Approval Record#E1]]\n`
const approvedRecord = `---\nstatus: active\ncanonical_memory: false\n---\n# Release policy approval record\n\n## E1 — Previous rule (2026-08-01)\nThe named release owner may approve their own production release.\n\n## E2 — Approved update (2026-09-29)\nThe Helios product owner approved a rule requiring a named approver separate from the release owner. Record both people in the production runbook.\n`

const approvedPatch = {
  claim: "Production releases require a named approver separate from the release owner, recorded in the runbook.",
  why_it_matters: "Separating approval from ownership prevents self-approval and leaves an auditable release record.",
  scope: {
    applies: ["Helios production releases"],
    excludes: ["development deployments", "release-owner assignment"],
  },
  provenance: [{
    kind: "file",
    value: "90 Evidence/Approval Record.md#E2: Approved update dated 2026-09-29.",
  }],
  confidence: "high",
  suggested_type: "decision",
  lifecycle: {
    status: "active",
    revalidate_when: ["the production approval policy changes"],
    supersedes: ["01 Projects/Helios/Release Policy.md"],
  },
}

function releaseCaseFiles() {
  return {
    ".obsidian/app.json": obsidianSettings,
    "01 Projects/Helios/Index.md": heliosIndex,
    "01 Projects/Helios/Runbook.md": heliosRunbook,
    "01 Projects/Helios/Release Policy.md": oldReleasePolicy,
    "90 Evidence/Approval Record.md": approvedRecord,
  }
}

const conflictFiles = {
  ".obsidian/app.json": obsidianSettings,
  "01 Projects/Helios/Index.md": `---\nstatus: active\ncanonical_memory: true\n---\n# Helios project index\n\nRelease work starts at [[Runbook]].\n`,
  "01 Projects/Helios/Runbook.md": `---\nstatus: active\ncanonical_memory: true\n---\n# Production release runbook\n\nRetry behavior: [[Retry Policy]].\n`,
  "01 Projects/Helios/Retry Policy.md": `---\nstatus: tension\ncanonical_memory: true\n---\n# Retry Policy\n\nCurrent sources disagree on the production API timeout. The guide says 30 seconds: [[90 Evidence/Approved API Guide#A1]]. The checklist says 60 seconds: [[90 Evidence/Release Checklist#C1]]. Neither has been selected as authoritative.\n`,
  "90 Evidence/Approved API Guide.md": `---\nstatus: active\ncanonical_memory: false\n---\n# Approved API guide\n\n## A1 — Current timeout (2026-09-28)\nThe production API retry timeout is 30 seconds.\n`,
  "90 Evidence/Release Checklist.md": `---\nstatus: active\ncanonical_memory: false\n---\n# Release checklist\n\n## C1 — Current timeout (2026-09-29)\nThe production API retry timeout is 60 seconds.\n`,
}

const conflictPatch = {
  claim: "Current sources disagree on the production API retry timeout: one says 30 seconds and another says 60 seconds.",
  why_it_matters: "Choosing either value without an owner decision could make production retries inconsistent.",
  scope: {
    applies: ["Helios production API retries"],
    excludes: ["development environments"],
  },
  provenance: [
    { kind: "file", value: "90 Evidence/Approved API Guide.md#A1: Current approved API guide says 30 seconds." },
    { kind: "file", value: "90 Evidence/Release Checklist.md#C1: Current release checklist says 60 seconds." },
  ],
  confidence: "medium",
  suggested_type: "tension",
  lifecycle: {
    status: "tension",
    revalidate_when: ["the API owner resolves the timeout conflict"],
    supersedes: [],
  },
}

function caseDefinition(id, description, outcome, task, patch, fileMap, sourcePaths, extra = {}) {
  return { id, description, expectedOutcome: outcome, task, patch, fileMap, sourcePaths, ...extra }
}

const validCase = caseDefinition(
  "01-approved-supersession",
  "Follow Index → Runbook → current policy, apply one explicitly authorized approved update, then retry the identical patch.",
  "APPLIED on the first pass; the retry makes no duplicate note or semantic change.",
  `Use native named-agent dispatch to delegate this workflow to the installed graphmory_curator child. Start with a current-state recall of the Helios release approval rule, follow 01 Projects/Helios/Index.md → Runbook.md → Release Policy.md, and open the original E1/E2 evidence. Do not use --include-superseded for current-state recall. The synthetic user explicitly authorizes the E2 rule update and superseding only 01 Projects/Helios/Release Policy.md. Save patch.json outside the vault, run graphmory validate-patch --input <patch.json> --agent before any host edit, and stop if invalid. Apply the patch at 01 Projects/Helios/Independent Approval Policy.md, update Runbook.md to link it, and preserve the old policy note with status superseded and a replacement link. Preserve E1 and never edit the original evidence record. Then delegate the exact same patch once more: confirm no duplicate replacement or evidence is created, and leave the existing replacement and historical note semantically unchanged. Afterward, recall the current rule again without --include-superseded and report whether the old policy is hidden from current results. Return concise paths and audit findings.`,
  "patch.json",
  releaseCaseFiles(),
  ["90 Evidence/Approval Record.md"],
  {
    replacementPath: "01 Projects/Helios/Independent Approval Policy.md",
    explicitAuthorization: "The synthetic user explicitly authorizes the E2 rule update and superseding only the existing Release Policy note.",
    duplicateRetry: true,
    verifySupersededOmittedFromDefaultRecall: true,
  },
)

const missingProvenancePatch = JSON.parse(JSON.stringify(approvedPatch))
delete missingProvenancePatch.provenance

const invalidCase = caseDefinition(
  "02-missing-provenance",
  "The approved-update patch has the same fields except provenance is missing; schema preflight must block before edits.",
  "BLOCKED by validate-patch; vault remains byte-for-byte unchanged.",
  `Use native named-agent dispatch to the installed graphmory_curator child. Run graphmory validate-patch --input <patch.json> --agent before any host edit. Provenance is missing, so stop as BLOCKED and identify that missing field. Do not infer or add evidence, do not read or edit vault notes, and do not ask the host to write anything.`,
  missingProvenancePatch,
  releaseCaseFiles(),
  ["90 Evidence/Approval Record.md"],
)

const tensionCase = caseDefinition(
  "03-unresolved-current-conflict",
  "Two current source records disagree; the schema-valid tension patch describes the conflict but grants no authority to choose a value.",
  "TENSION with no vault edits. BLOCKED is acceptable only if the agent explains it cannot complete the requested read-only conflict report; do not treat either value as approved.",
  `Use native named-agent dispatch to the installed graphmory_curator child. Follow the Index → Runbook → Retry Policy links, open both linked original evidence records, and run graphmory validate-patch --input <patch.json> --agent. The patch is schema-valid, but the sources conflict and no authority resolves them. This task asks for a read-only report: return TENSION with both paths and the exact decision needed; do not choose either value or edit any vault file. If you interpret any requested action as requiring a write, stop BLOCKED and state what authorization is missing.`,
  "patch.json",
  conflictFiles,
  ["90 Evidence/Approved API Guide.md", "90 Evidence/Release Checklist.md"],
  { conflictDisposition: "TENSION is expected for the requested read-only report; BLOCKED is distinct from permission to choose or write." },
)

function createCase(outputRoot, definition) {
  const caseRoot = path.join(outputRoot, "cases", definition.id)
  const vault = path.join(caseRoot, "vault")
  fs.mkdirSync(vault, { recursive: true })
  for (const [relativePath, contents] of Object.entries(definition.fileMap)) {
    writeFixtureFile(vault, relativePath, contents)
  }

  const patch = definition.patch === "patch.json"
    ? definition.id === "03-unresolved-current-conflict" ? conflictPatch : approvedPatch
    : definition.patch
  writeJson(path.join(caseRoot, "patch.json"), patch)
  const sourceHashes = manifestForFiles(vault, definition.sourcePaths)
  writeJson(path.join(caseRoot, "source-hashes.json"), sourceHashes)
  const baseline = fullVaultManifest(vault)
  writeJson(path.join(caseRoot, "vault-baseline-manifest.json"), baseline)

  const { fileMap: _fileMap, patch: _patch, ...scenarioCase } = definition
  return {
    ...scenarioCase,
    vault: path.relative(outputRoot, vault).split(path.sep).join("/"),
    patch: path.relative(outputRoot, path.join(caseRoot, "patch.json")).split(path.sep).join("/"),
    sourceHashes: path.relative(outputRoot, path.join(caseRoot, "source-hashes.json")).split(path.sep).join("/"),
    vaultBaseline: path.relative(outputRoot, path.join(caseRoot, "vault-baseline-manifest.json")).split(path.sep).join("/"),
    sourcePaths: definition.sourcePaths,
    expectedImmutableSources: sourceHashes.files,
    baselineVaultFiles: baseline.files,
  }
}

try {
  const requestedOut = option("--out")
  if (!requestedOut) throw new Error("--out is required")
  const outputRoot = path.resolve(requestedOut)
  try {
    fs.lstatSync(outputRoot)
    throw new Error("--out must name a fresh directory; existing paths are never overwritten")
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }

  fs.mkdirSync(outputRoot, { recursive: true })
  try {
    const cases = [validCase, invalidCase, tensionCase].map((definition) => createCase(outputRoot, definition))
    const scenario = {
      schemaVersion: 1,
      fixture: "graphmory-native-curator-acceptance",
      date: "2026-09-29",
      syntheticOnly: true,
      purpose: "Exercise installed native Curator dispatch, multi-hop Markdown recall, schema preflight, source preservation, approved lifecycle update, duplicate retry, and conflict abstention.",
      execution: {
        leadSessions: 1,
        casesSequential: true,
        nativeNamedChildRequired: "graphmory_curator",
        curatorModel: "Choose and record a cheap model ID supported by the host account; do not change Graphmory model defaults.",
        installedPackage: "Record npm package name, version, tarball path, and integrity used by the host session.",
        noFallback: "If native child dispatch cannot be independently verified, stop the case. Do not count inline Lead execution, a generic role, or model self-report as child dispatch.",
        preflightOrder: "Capture ordered host tool/command events and prove validate-patch returned before the first vault Edit/Write in cases 1 and 2; case 3 also validates but is read-only.",
        traceEvidence: [
          "Record parent Lead session ID, native child ID, exact child role graphmory_curator, configured model and reasoning effort, and host trace source used to verify the binding.",
          "A child message saying it is graphmory_curator is not binding evidence; use host-generated run metadata or trace records.",
        ],
        immutableSources: "Hash every listed source before and after its case; all listed source hashes must remain identical.",
        failureVaults: "Cases 2 and 3 must match every entry in vault-baseline-manifest.json after the run.",
        warnings: "Report graph/lifecycle audit warnings separately from workflow completion. Unresolved critical/high findings block acceptance; medium findings do not become clean results by omission.",
        evaluationLimit: "This is one synthetic workflow acceptance, not a recall leaderboard or a general performance claim.",
      },
      cases,
    }
    writeJson(path.join(outputRoot, "scenario.json"), scenario)
    console.log(JSON.stringify({ created: true, output: outputRoot, scenario: path.join(outputRoot, "scenario.json"), cases: cases.map(({ id, vault, patch }) => ({ id, vault, patch })) }, null, 2))
  } catch (error) {
    fs.rmSync(outputRoot, { recursive: true, force: true })
    throw error
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
