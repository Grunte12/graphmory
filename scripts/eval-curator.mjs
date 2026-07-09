#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { validateBrainBrief } from "../src/contracts.mjs"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const scenariosPath = path.resolve(option("--scenarios", "eval/curator/scenarios.json"))
const candidatePath = path.resolve(option("--candidate", "eval/curator/candidate.memory-patch.json"))
const jsonOutput = option("--json", "")
const allowFailures = args.includes("--allow-failures")

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

function normalizePath(value) {
  return String(value || "").replaceAll("\\", "/").toLowerCase()
}

function pathMatches(actual, expected) {
  const haystack = normalizePath(actual)
  const needle = normalizePath(expected)
  return haystack === needle || haystack.endsWith(`/${needle}`) || haystack.endsWith(needle)
}

function includesTerm(value, term) {
  return String(value || "").toLowerCase().includes(String(term || "").toLowerCase())
}

function collectBriefPaths(output) {
  return [
    ...(output.note_paths || []),
    ...(output.direct_read_paths || []),
    ...((output.relevant_memory || []).map((item) => item.path)),
  ]
}

function hasProvenance(output, expected) {
  const provenance = output.retained_provenance || output.provenance || []
  return provenance.some((item) => {
    if (expected.kind && item.kind !== expected.kind) return false
    if (expected.value_contains && !includesTerm(item.value, expected.value_contains)) return false
    return true
  })
}

function checkScenario(scenario, candidate) {
  const failures = []
  const output = candidate?.output || {}
  const expected = scenario.expected || {}

  if (!candidate) {
    return { pass: false, failures: ["missing candidate output"] }
  }

  if (scenario.mode === "recall") {
    const validation = validateBrainBrief(output)
    if (!validation.valid) failures.push(...validation.errors)

    const paths = collectBriefPaths(output)
    for (const required of expected.required_note_paths || []) {
      if (!paths.some((actual) => pathMatches(actual, required))) {
        failures.push(`missing required note path: ${required}`)
      }
    }
    for (const forbidden of expected.forbidden_note_paths || []) {
      if (paths.some((actual) => pathMatches(actual, forbidden))) {
        failures.push(`included forbidden note path: ${forbidden}`)
      }
    }
    if ((output.direct_read_paths || []).length > (expected.max_direct_read_paths ?? 3)) {
      failures.push(`too many direct_read_paths: ${output.direct_read_paths.length}`)
    }
  } else if (scenario.mode === "consolidation") {
    if (output.status !== expected.status) {
      failures.push(`expected status ${expected.status}, got ${output.status || "missing"}`)
    }

    const changedPaths = output.changed_paths || []
    if (expected.must_not_write && changedPaths.length) {
      failures.push("changed_paths must be empty when write is forbidden")
    }
    for (const required of expected.required_changed_paths || []) {
      if (!changedPaths.some((actual) => pathMatches(actual, required))) {
        failures.push(`missing required changed path: ${required}`)
      }
    }
    for (const required of expected.required_tension_paths || []) {
      if (!((output.tension_paths || []).some((actual) => pathMatches(actual, required)))) {
        failures.push(`missing required tension path: ${required}`)
      }
    }
    for (const provenance of expected.required_provenance || []) {
      if (!hasProvenance(output, provenance)) {
        failures.push(`missing provenance ${JSON.stringify(provenance)}`)
      }
    }
    for (const term of expected.claim_terms || []) {
      if (!includesTerm(output.stored_claim, term)) failures.push(`stored_claim missing term: ${term}`)
    }
    const combinedText = `${output.stored_claim || ""}\n${output.reason || ""}`
    for (const term of expected.reason_terms || []) {
      if (!includesTerm(combinedText, term)) failures.push(`reason/stored_claim missing term: ${term}`)
    }
    for (const term of expected.forbidden_terms || []) {
      if (includesTerm(combinedText, term)) failures.push(`output includes forbidden term: ${term}`)
    }
  } else {
    failures.push(`unknown scenario mode: ${scenario.mode}`)
  }

  return { pass: failures.length === 0, failures }
}

const scenarios = readJson(scenariosPath)
const categories = [...new Set(scenarios.map((scenario) => scenario.category))]
const summarize = (items) => ({
  scenarios: items.length,
  passed: items.filter((item) => item.pass).length,
  passRate: items.filter((item) => item.pass).length / Math.max(items.length, 1),
})

function loadCandidates(candidateRoot) {
  const stat = fs.statSync(candidateRoot)
  if (!stat.isDirectory()) return [readJson(candidateRoot)]
  return fs
    .readdirSync(candidateRoot)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const candidate = readJson(path.join(candidateRoot, file))
      return {
        ...candidate,
        name: candidate.name || path.basename(file, ".json"),
      }
    })
}

function evaluateCandidate(candidate) {
  const outputs = new Map(candidate.outputs.map((item) => [item.id, item]))
  const runs = scenarios.map((scenario) => {
    const result = checkScenario(scenario, outputs.get(scenario.id))
    return {
      id: scenario.id,
      category: scenario.category,
      mode: scenario.mode,
      pass: result.pass,
      failures: result.failures,
    }
  })
  return {
    name: candidate.name || candidate.description || path.basename(candidatePath, ".json"),
    summary: summarize(runs),
    categories: Object.fromEntries(categories.map((category) => [category, summarize(runs.filter((run) => run.category === category))])),
    runs,
  }
}

const candidates = loadCandidates(candidatePath)
const candidateReports = candidates.map(evaluateCandidate)

const report = {
  scenarios: scenariosPath,
  candidate: candidatePath,
  candidates: Object.fromEntries(candidateReports.map((item) => [item.name, item])),
}

const percent = (value) => `${(value * 100).toFixed(1)}%`
if (candidateReports.length === 1) {
  const single = candidateReports[0]
  console.log(`Curator eval: ${single.summary.passed}/${single.summary.scenarios} scenarios passed (${percent(single.summary.passRate)})`)
  console.log("")
  console.log("| Category | Passed | Pass rate |")
  console.log("|---|---:|---:|")
  for (const [category, summary] of Object.entries(single.categories)) {
    console.log(`| ${category} | ${summary.passed}/${summary.scenarios} | ${percent(summary.passRate)} |`)
  }
} else {
  console.log(`Curator comparison: ${candidateReports.length} candidates, ${scenarios.length} scenarios`)
  console.log("")
  console.log("| Candidate | Passed | Pass rate |")
  console.log("|---|---:|---:|")
  for (const item of candidateReports) {
    console.log(`| ${item.name} | ${item.summary.passed}/${item.summary.scenarios} | ${percent(item.summary.passRate)} |`)
  }
}

const failed = candidateReports.flatMap((candidate) =>
  candidate.runs
    .filter((run) => !run.pass)
    .map((run) => ({ candidate: candidate.name, ...run })),
)
if (failed.length && candidateReports.length === 1) {
  console.log("\nFailures:")
  for (const run of failed) console.log(`- ${run.id}: ${run.failures.join("; ")}`)
}

if (jsonOutput) {
  const outputPath = path.resolve(jsonOutput)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`\nJSON report: ${outputPath}`)
}

if (failed.length && !allowFailures) process.exit(1)
