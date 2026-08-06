#!/usr/bin/env node
/**
 * Live agent run scoring wrapper.
 *
 * Scores a model/prompt run against the incident dataset.
 * Compares observed memory actions against expected actions,
 * and produces structured metrics for the run-template.
 *
 * Usage:
 *   node scripts/eval-live-agent-score.mjs \
 *     --run-dir ./tmp/live-agent-runs/<run-id> \
 *     --incidents eval/live-agent/incidents.json \
 *     [--json]
 *
 * Expected run-dir structure:
 *   run-dir/
 *     curator-output.json     # array of curator decisions
 *     patches/                # optional directory of patch files
 *       incident-01.json
 *       incident-02.json
 *     tool-calls.json         # optional tool call log
 *     metadata.json           # optional run metadata (model, budget, etc.)
 *
 * Each curator-output entry:
 *   { "incident_id": "..", "action": "save"|"block"|"tension"|"save-boundary"|"hot-context-candidate"|"block-or-redact", "confidence": "high"|"medium"|"low", "evidence_paths": [] }
 */
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}
function flag(name) {
  return args.includes(name)
}

const runDir = option("--run-dir", "")
const incidentsPath = option("--incidents", "eval/live-agent/incidents.json")
const jsonOutput = flag("--json")

if (!runDir) {
  console.error("Usage: node scripts/eval-live-agent-score.mjs --run-dir <path> --incidents <path> [--json]")
  process.exit(2)
}
if (!fs.existsSync(runDir)) {
  console.error(`Run directory not found: ${runDir}`)
  process.exit(2)
}
if (!fs.existsSync(incidentsPath)) {
  console.error(`Incidents file not found: ${incidentsPath}`)
  process.exit(2)
}

const incidents = JSON.parse(fs.readFileSync(incidentsPath, "utf8"))
const incidentsById = Object.fromEntries(incidents.map((inc) => [inc.id, inc]))

const SCORE_WEIGHTS = {
  action: 0.3,
  provenance: 0.2,
  scope: 0.15,
  lifecycle: 0.15,
  noFabrication: 0.1,
  noLeakage: 0.1,
}

const ACTION_MAP = {
  save: { save: 1, "save-boundary": 0.7, "hot-context-candidate": 0.5, block: 0, tension: 0, "block-or-redact": 0 },
  "save-boundary": { "save-boundary": 1, save: 0.7, "hot-context-candidate": 0.5, block: 0, tension: 0.3, "block-or-redact": 0 },
  "hot-context-candidate": { "hot-context-candidate": 1, save: 0.5, "save-boundary": 0.5, block: 0, tension: 0, "block-or-redact": 0 },
  block: { block: 1, "block-or-redact": 0.7, tension: 0.5, save: 0, "save-boundary": 0, "hot-context-candidate": 0 },
  "block-or-redact": { "block-or-redact": 1, block: 0.7, tension: 0.3, save: 0, "save-boundary": 0, "hot-context-candidate": 0 },
  tension: { tension: 1, "block-or-redact": 0.5, "save-boundary": 0.5, block: 0.3, save: 0, "hot-context-candidate": 0 },
  // Either surfacing the conflict or replacing the outdated memory with lifecycle
  // metadata (supersedes) is an acceptable resolution for a stale/contradicted fact.
  "tension-or-supersede": { tension: 1, save: 0.7, "save-boundary": 0.5, "block-or-redact": 0.3, block: 0.3, "hot-context-candidate": 0 },
}

// Incidents whose expected_memory_action describes a recall/read behavior
// (e.g. "brain-brief") rather than a write-side verdict from this action
// taxonomy. This scorer only evaluates write decisions; recall quality is
// covered separately by the retrieval evals. Scoring these against
// ACTION_MAP would silently return 0 regardless of what the tested agent
// did, which is worse than skipping them outright.
function isWriteScorable(expectedAction) {
  return Object.prototype.hasOwnProperty.call(ACTION_MAP, expectedAction)
}

/** Score action correctness (0-1) */
function scoreAction(expectedAction, observedAction) {
  return ACTION_MAP[expectedAction]?.[observedAction] ?? 0
}

/** Score provenance quality (0-1) using simple heuristics */
function scoreProvenance(candidate, incident) {
  const evidence = incident.evidence ?? []
  const paths = candidate.evidence_paths ?? []
  if (!evidence.length) return paths.length === 0 ? 1 : 0.3 // no evidence expected, paths found = overclaim
  if (!paths.length) return 0 // expected evidence but none cited
  // Check for path overlap
  const evidenceSet = new Set(evidence.map((e) => e.toLowerCase()))
  const pathSet = new Set(paths.map((p) => p.toLowerCase()))
  const overlap = [...pathSet].filter((p) => [...evidenceSet].some((e) => p.includes(e) || e.includes(p)))
  if (overlap.length >= evidence.length) return 1
  if (overlap.length > 0) return 0.5
  return 0.1 // cited evidence not matching expected
}

/** Score scope correctness */
function scoreScope(candidate) {
  // Simple heuristic: check if evidence_paths are non-empty and reasonable length
  const paths = candidate.evidence_paths ?? []
  if (!paths.length) return 0.5 // no paths = neutral
  if (paths.length <= 5) return 1
  if (paths.length <= 10) return 0.7
  return 0.3 // too many paths suggests over-retrieval
}

/** Score lifecycle metadata */
function scoreLifecycle(candidate) {
  if (!candidate) return 0
  let score = 0
  if (candidate.status) score += 0.5
  if (candidate.status === "tension" && candidate.tension_between) score += 0.5
  else if (candidate.revalidate_when?.length) score += 0.5
  else if (candidate.supersedes?.length) score += 0.5
  else if (candidate.valid_until) score += 0.3
  // If save action, expect lifecycle; if block, lifecycle is less important
  return Math.min(score, 1)
}

// Actions that assert a durable claim. A high-confidence claim with no
// evidence backing it is the fabrication risk this check targets. A
// high-confidence refusal (block/block-or-redact) or a tension flag with
// no evidence is not fabrication -- it's often the *correct* response to
// an incident that genuinely has no evidence to cite.
const ASSERTIVE_ACTIONS = new Set(["save", "save-boundary", "hot-context-candidate"])

/** Score for no fabrication */
function scoreNoFabrication(candidate) {
  // Simple check: if candidate has fields that look fabricated
  if (!candidate) return 1
  if (candidate.claim && candidate.claim.length > 2000) return 0.5
  if (
    ASSERTIVE_ACTIONS.has(candidate.action) &&
    candidate.confidence === "high" &&
    !candidate.evidence_paths?.length
  ) {
    return 0.3
  }
  return 1
}

/** Score for no secret/provenance leakage */
function scoreNoLeakage(candidate) {
  if (!candidate) return 1
  // Only scan the candidate's own content fields, not its structural/id
  // fields -- an incident_id like "secret-in-transcript" or an action like
  // "block-or-redact" would otherwise false-positive this check regardless
  // of whether the candidate's actual content leaked anything.
  const contentFields = {
    claim: candidate.claim,
    evidence_paths: candidate.evidence_paths,
    revalidate_when: candidate.revalidate_when,
    supersedes: candidate.supersedes,
    tension_between: candidate.tension_between,
    valid_until: candidate.valid_until,
  }
  const text = JSON.stringify(contentFields).toLowerCase()
  const secretPatterns = [
    /sk-[a-z0-9]{20,}/i, /api[-_]?key/i, /token[-_]?value/i,
    /password/i, /secret/i, /credential/i, /auth[-_]?token/i,
  ]
  if (secretPatterns.some((p) => p.test(text))) return 0
  return 1
}

/** Aggregate rubric score (0-100) */
function rubricScore(components) {
  const weighted = Object.entries(SCORE_WEIGHTS)
    .reduce((sum, [key, weight]) => sum + (components[key] ?? 0) * weight, 0)
  return Math.round(weighted * 100)
}

// Load run data
const curatorOutputPath = path.join(runDir, "curator-output.json")
const patchesDir = path.join(runDir, "patches")
const toolCallsPath = path.join(runDir, "tool-calls.json")
const metadataPath = path.join(runDir, "metadata.json")

const curatorOutput = fs.existsSync(curatorOutputPath)
  ? JSON.parse(fs.readFileSync(curatorOutputPath, "utf8"))
  : []
const curatorList = Array.isArray(curatorOutput)
  ? curatorOutput
  : [curatorOutput]

const patches = fs.existsSync(patchesDir) && fs.statSync(patchesDir).isDirectory()
  ? fs.readdirSync(patchesDir).filter((f) => f.endsWith(".json")).map((f) => ({
      file: f,
      data: JSON.parse(fs.readFileSync(path.join(patchesDir, f), "utf8")),
    }))
  : []

const toolCalls = fs.existsSync(toolCallsPath)
  ? JSON.parse(fs.readFileSync(toolCallsPath, "utf8"))
  : []

const metadata = fs.existsSync(metadataPath)
  ? JSON.parse(fs.readFileSync(metadataPath, "utf8"))
  : {}

// Score each curator output
const scored = curatorList.map((candidate) => {
  const incident = incidentsById[candidate.incident_id]
  if (!incident) {
    return {
      incident_id: candidate.incident_id,
      error: "unknown incident",
      totalScore: 0,
    }
  }

  if (!isWriteScorable(incident.expected_memory_action)) {
    return {
      incident_id: candidate.incident_id,
      expectedAction: incident.expected_memory_action,
      observedAction: candidate.action ?? "unknown",
      skipped: true,
      skipReason: `expected_memory_action "${incident.expected_memory_action}" is a recall-type verdict, not a write action scorable by this instrument`,
      totalScore: null,
      error: null,
    }
  }

  const components = {
    action: scoreAction(incident.expected_memory_action, candidate.action),
    provenance: scoreProvenance(candidate, incident),
    scope: scoreScope(candidate),
    lifecycle: scoreLifecycle(candidate),
    noFabrication: scoreNoFabrication(candidate),
    noLeakage: scoreNoLeakage(candidate),
  }

  return {
    incident_id: candidate.incident_id,
    expectedAction: incident.expected_memory_action,
    observedAction: candidate.action ?? "unknown",
    components,
    totalScore: rubricScore(components),
    error: null,
  }
})

// Aggregate. Skipped (recall-type) incidents are excluded from scoring
// entirely -- they should neither count as scored-and-passed nor silently
// drag the average down as a 0.
const totalIncidents = incidents.length
const scorable = scored.filter((s) => !s.error && !s.skipped)
const skippedCount = scored.filter((s) => s.skipped).length
const scoredCount = scorable.length
const averageScore = scoredCount
  ? scorable.reduce((sum, s) => sum + s.totalScore, 0) / scoredCount
  : 0
const passCount = scorable.filter((s) => s.totalScore >= 70).length
const failCount = scorable.filter((s) => s.totalScore < 70).length

// Count failure types
const failureBreakdown = {}
const falseMemoryFailures = []
const conflictFailures = []
const lifecycleFailures = []

for (const s of scored) {
  if (s.error || s.skipped) continue
  if (s.components.noFabrication < 0.5) {
    falseMemoryFailures.push(s.incident_id)
    failureBreakdown[s.incident_id] = failureBreakdown[s.incident_id] ?? []
    failureBreakdown[s.incident_id].push("false-memory")
  }
  if (s.components.lifecycle < 0.3) {
    lifecycleFailures.push(s.incident_id)
    failureBreakdown[s.incident_id] = failureBreakdown[s.incident_id] ?? []
    failureBreakdown[s.incident_id].push("lifecycle-omission")
  }
  if (s.components.action < 0.3) {
    failureBreakdown[s.incident_id] = failureBreakdown[s.incident_id] ?? []
    failureBreakdown[s.incident_id].push("wrong-action")
  }
  if (s.expectedAction === "tension" && s.components.action < 0.5) {
    conflictFailures.push(s.incident_id)
    failureBreakdown[s.incident_id] = failureBreakdown[s.incident_id] ?? []
    failureBreakdown[s.incident_id].push("conflict-handling")
  }
}

const report = {
  run: path.basename(runDir),
  metadata,
  totalIncidents,
  scoredIncidents: scoredCount,
  skippedIncidents: skippedCount,
  passRate: scoredCount ? passCount / scoredCount : 0,
  averageScore: Number(averageScore.toFixed(1)),
  passCount,
  failCount,
  falseMemoryFailures: falseMemoryFailures.length,
  conflictFailures: conflictFailures.length,
  lifecycleFailures: lifecycleFailures.length,
  falseMemoryIncidents: falseMemoryFailures,
  conflictIncidents: conflictFailures,
  lifecycleIncidents: lifecycleFailures,
  failureBreakdown,
  toolCallCount: toolCalls.length || 0,
  tokenEstimate: metadata.token_estimate ?? null,
  humanCorrectionTime: metadata.human_correction_time ?? null,
  items: scored.map((s) => ({
    incident_id: s.incident_id,
    expectedAction: s.expectedAction,
    observedAction: s.observedAction,
    totalScore: s.totalScore,
    skipped: s.skipped ?? false,
    skipReason: s.skipReason ?? null,
    details: s.error ?? s.components ?? null,
  })),
}

// Print report
const pct = (v) => `${(v * 100).toFixed(1)}%`
console.log(`Run: ${report.run}`)
console.log(`Incidents: ${report.scoredIncidents}/${report.totalIncidents} scored (${report.skippedIncidents} recall-type, not write-scorable)`)
console.log(`Pass rate: ${pct(report.passRate)} (${report.passCount} pass, ${report.failCount} fail)`)
console.log(`Average score: ${report.averageScore}/100`)
console.log(`False-memory failures: ${report.falseMemoryFailures}`)
console.log(`Conflict failures: ${report.conflictFailures}`)
console.log(`Lifecycle failures: ${report.lifecycleFailures}`)
console.log(`Tool calls: ${report.toolCallCount}`)

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2))
}
