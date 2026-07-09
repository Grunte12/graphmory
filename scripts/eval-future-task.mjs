#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const scenariosPath = path.resolve(option("--scenarios", "eval/future-task/scenarios.json"))
const candidatePath = path.resolve(option("--candidate", "eval/future-task/candidates"))
const jsonOutput = option("--json", "")
const allowFailures = args.includes("--allow-failures")

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

function loadCandidates(root) {
  const stat = fs.statSync(root)
  if (!stat.isDirectory()) return [readJson(root)]
  return fs
    .readdirSync(root)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => readJson(path.join(root, file)))
}

function includesAll(answer, terms) {
  const text = String(answer || "").toLowerCase()
  return terms.every((term) => text.includes(String(term).toLowerCase()))
}

function includesAny(answer, terms) {
  const text = String(answer || "").toLowerCase()
  return terms.some((term) => text.includes(String(term).toLowerCase()))
}

function scoreCandidate(candidate, scenarios) {
  const runs = scenarios.map((scenario) => {
    const answer = candidate.answers?.[scenario.id] || ""
    const hasRequired = includesAll(answer, scenario.required_terms || [])
    const hasForbidden = includesAny(answer, scenario.forbidden_terms || [])
    const score = hasRequired && !hasForbidden ? 1 : 0
    return {
      id: scenario.id,
      score,
      pass: score === 1,
      answer,
      required_terms: scenario.required_terms || [],
      forbidden_terms: scenario.forbidden_terms || [],
    }
  })
  const total = runs.length
  const passed = runs.filter((run) => run.pass).length
  const score = total ? Math.round((passed / total) * 100) : 0
  return { score, passed, total, runs }
}

const scenarios = readJson(scenariosPath)
const candidates = loadCandidates(candidatePath)
const reports = candidates.map((candidate) => {
  const result = scoreCandidate(candidate, scenarios)
  const min = candidate.expected_min_score ?? 0
  const max = candidate.expected_max_score ?? 100
  return {
    name: candidate.name || "candidate",
    score: result.score,
    passed: result.passed,
    total: result.total,
    expected_min_score: min,
    expected_max_score: max,
    pass: result.score >= min && result.score <= max,
    runs: result.runs,
  }
})

console.log(`Future-task eval: ${reports.filter((report) => report.pass).length}/${reports.length} candidates within expected ranges`)
console.log("")
console.log("| Candidate | Passed | Score | Expected | Result |")
console.log("|---|---:|---:|---:|---|")
for (const report of reports) {
  console.log(`| ${report.name} | ${report.passed}/${report.total} | ${report.score} | ${report.expected_min_score}-${report.expected_max_score} | ${report.pass ? "PASS" : "FAIL"} |`)
}

const failed = reports.filter((report) => !report.pass)
if (failed.length) {
  console.log("\nFailures:")
  for (const report of failed) {
    console.log(`- ${report.name}: score ${report.score}, expected ${report.expected_min_score}-${report.expected_max_score}`)
  }
}

if (jsonOutput) {
  const outputPath = path.resolve(jsonOutput)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify({ scenarios: scenariosPath, reports }, null, 2)}\n`)
  console.log(`\nJSON report: ${outputPath}`)
}

if (failed.length && !allowFailures) process.exit(1)
