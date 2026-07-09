#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { validateMemoryPatch } from "../src/contracts.mjs"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const candidatePath = path.resolve(option("--candidate", "eval/patch-quality/candidates"))
const jsonOutput = option("--json", "")
const allowFailures = args.includes("--allow-failures")

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

function loadCandidates(candidateRoot) {
  const stat = fs.statSync(candidateRoot)
  if (!stat.isDirectory()) return [normalizeCandidate(readJson(candidateRoot), path.basename(candidateRoot, ".json"))]
  return fs
    .readdirSync(candidateRoot)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => normalizeCandidate(readJson(path.join(candidateRoot, file)), path.basename(file, ".json")))
}

function normalizeCandidate(value, fallbackName) {
  if ("patch" in value) return { name: value.name || fallbackName, ...value }
  return { name: fallbackName, patch: value, expected_min_score: 80 }
}

const vagueTerms = /\b(always|everything|stuff|things|probably|maybe|latest run|today|somehow)\b/i
const noiseTerms = /\b(completed successfully|routine summary|daily log|chat transcript|raw log)\b/i
const secretTerms = /\b(api[_ -]?key|password|secret|token|credential)\b/i

function scorePatch(patch) {
  const validation = validateMemoryPatch(patch)
  const checks = []
  const add = (name, points, pass, detail = "") => {
    checks.push({ name, points, pass, earned: pass ? points : 0, detail })
  }

  add("valid contract", 25, validation.valid, validation.errors.join("; "))
  add("bounded claim", 10, typeof patch.claim === "string" && patch.claim.length >= 24 && !vagueTerms.test(patch.claim))
  add("why it matters", 10, typeof patch.why_it_matters === "string" && patch.why_it_matters.length >= 32 && !vagueTerms.test(patch.why_it_matters))
  add("scoped applies/excludes", 10, (patch.scope?.applies || []).length >= 1 && Array.isArray(patch.scope?.excludes))
  add("evidence provenance", 15, Array.isArray(patch.provenance) && patch.provenance.length >= 1)
  add("lifecycle status", 10, ["active", "superseded", "tension", "deprecated"].includes(patch.lifecycle?.status))
  add("revalidation trigger", 10, Array.isArray(patch.lifecycle?.revalidate_when) && patch.lifecycle.revalidate_when.length >= 1)
  add("not diary/vague/noise", 5, !noiseTerms.test(`${patch.claim || ""}\n${patch.why_it_matters || ""}`) && !vagueTerms.test(`${patch.claim || ""}\n${patch.why_it_matters || ""}`))
  add("no raw secret terms", 5, !secretTerms.test(`${patch.claim || ""}\n${patch.why_it_matters || ""}\n${JSON.stringify(patch.provenance || [])}`))

  const score = checks.reduce((sum, check) => sum + check.earned, 0)
  return { score, validation, checks }
}

const candidates = loadCandidates(candidatePath)
const runs = candidates.map((candidate) => {
  const result = scorePatch(candidate.patch)
  const min = candidate.expected_min_score ?? 0
  const max = candidate.expected_max_score ?? 100
  return {
    name: candidate.name,
    score: result.score,
    expected_min_score: min,
    expected_max_score: max,
    pass: result.score >= min && result.score <= max,
    checks: result.checks,
    validation_errors: result.validation.errors,
  }
})

console.log(`Patch quality eval: ${runs.filter((run) => run.pass).length}/${runs.length} candidates within expected ranges`)
console.log("")
console.log("| Candidate | Score | Expected | Result |")
console.log("|---|---:|---:|---|")
for (const run of runs) {
  console.log(`| ${run.name} | ${run.score} | ${run.expected_min_score}-${run.expected_max_score} | ${run.pass ? "PASS" : "FAIL"} |`)
}

const failed = runs.filter((run) => !run.pass)
if (failed.length) {
  console.log("\nFailures:")
  for (const run of failed) {
    console.log(`- ${run.name}: score ${run.score}, expected ${run.expected_min_score}-${run.expected_max_score}`)
  }
}

if (jsonOutput) {
  const outputPath = path.resolve(jsonOutput)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify({ candidate: candidatePath, runs }, null, 2)}\n`)
  console.log(`\nJSON report: ${outputPath}`)
}

if (failed.length && !allowFailures) process.exit(1)
