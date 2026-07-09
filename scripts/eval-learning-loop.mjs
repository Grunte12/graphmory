#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { validateLearningPacket } from "../src/contracts.mjs"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const candidatePath = path.resolve(option("--candidate", "eval/learning-loop/candidates"))
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
  if ("packet" in value) return { name: value.name || fallbackName, ...value }
  return { name: fallbackName, packet: value, expected_min_score: 80, expected_max_score: 100 }
}

const vagueTerms = /\b(always|everything|stuff|things|probably|maybe|today|somehow|be careful)\b/i
const noiseTerms = /\b(completed successfully|routine summary|daily log|chat transcript|raw log)\b/i
const secretTerms = /\b(api[_ -]?key|password|secret|token|credential)\b/i

function hasEvidence(value) {
  return Array.isArray(value) && value.length > 0
}

function hasText(value, min = 1) {
  return typeof value === "string" && value.trim().length >= min
}

function payloadMetrics(packet) {
  const serialized = JSON.stringify(packet, null, 2)
  return {
    chars: serialized.length,
    bytes: Buffer.byteLength(serialized, "utf8"),
    estimated_tokens: Math.ceil(serialized.length / 4),
    evidence_items: Array.isArray(packet.evidence) ? packet.evidence.length : 0,
    selector_items: packet.selectors && typeof packet.selectors === "object"
      ? Object.values(packet.selectors).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0)
      : 0,
  }
}

function scorePacket(packet) {
  const validation = validateLearningPacket(packet)
  const checks = []
  const add = (name, points, pass, detail = "") => {
    checks.push({ name, points, pass, earned: pass ? points : 0, detail })
  }

  add("valid learning packet", 25, validation.valid, validation.errors.join("; "))
  add("future behavior change", 15, hasText(packet.future_behavior_change, 32) && !vagueTerms.test(packet.future_behavior_change || ""))
  add("verified before learning", 15, packet.verification?.status === "verified" && hasText(packet.verification?.result, 16))
  add("evidence bundle", 10, hasEvidence(packet.evidence) && (hasEvidence(packet.verification?.evidence) || packet.verification?.status === "verified"))
  add("loop trace", 10, ["recall", "action", "verification", "learning"].every((key) => hasText(packet.loop_trace?.[key], 12)))
  add("bounded scope", 10, Array.isArray(packet.scope?.applies) && packet.scope.applies.length > 0 && Array.isArray(packet.scope?.excludes))
  add("lifecycle gate", 5, Array.isArray(packet.lifecycle?.revalidate_when) && packet.lifecycle.revalidate_when.length > 0)
  add("structured selectors", 5, packet.selectors && typeof packet.selectors === "object" && payloadMetrics(packet).selector_items > 0)
  add("not diary/noise", 3, !noiseTerms.test(`${packet.lesson || ""}\n${packet.trigger || ""}`) && !vagueTerms.test(packet.lesson || ""))
  add("no raw secret terms", 2, !secretTerms.test(JSON.stringify(packet)))

  return {
    score: checks.reduce((sum, check) => sum + check.earned, 0),
    validation,
    checks,
  }
}

const candidates = loadCandidates(candidatePath)
const runs = candidates.map((candidate) => {
  const result = scorePacket(candidate.packet)
  const min = candidate.expected_min_score ?? 0
  const max = candidate.expected_max_score ?? 100
  const maxTokens = candidate.expected_max_estimated_tokens ?? Infinity
  const metrics = payloadMetrics(candidate.packet)
  const scorePass = result.score >= min && result.score <= max
  const tokenPass = metrics.estimated_tokens <= maxTokens
  return {
    name: candidate.name,
    score: result.score,
    metrics,
    expected_min_score: min,
    expected_max_score: max,
    expected_max_estimated_tokens: maxTokens === Infinity ? null : maxTokens,
    pass: scorePass && tokenPass,
    score_pass: scorePass,
    token_pass: tokenPass,
    checks: result.checks,
    validation_errors: result.validation.errors,
  }
})

console.log(`Learning loop eval: ${runs.filter((run) => run.pass).length}/${runs.length} candidates within expected ranges`)
console.log("")
console.log("| Candidate | Score | Expected | Max tokens | Result |")
console.log("|---|---:|---:|---:|---|")
for (const run of runs) {
  console.log(`| ${run.name} | ${run.score} | ${run.expected_min_score}-${run.expected_max_score} | ${run.expected_max_estimated_tokens ?? "n/a"} | ${run.pass ? "PASS" : "FAIL"} |`)
}

console.log("")
console.log("| Candidate | Bytes | Chars | Est. tokens | Evidence | Selectors |")
console.log("|---|---:|---:|---:|---:|---:|")
for (const run of runs) {
  console.log(`| ${run.name} | ${run.metrics.bytes} | ${run.metrics.chars} | ${run.metrics.estimated_tokens} | ${run.metrics.evidence_items} | ${run.metrics.selector_items} |`)
}

if (runs.length >= 2) {
  const baseline = runs[0]
  const latest = runs[runs.length - 1]
  const tokenDelta = latest.metrics.estimated_tokens - baseline.metrics.estimated_tokens
  const scoreDelta = latest.score - baseline.score
  const efficiency = scoreDelta > 0 ? (tokenDelta / scoreDelta).toFixed(2) : "n/a"
  console.log("")
  console.log(`Baseline delta (${baseline.name} -> ${latest.name}): score ${scoreDelta >= 0 ? "+" : ""}${scoreDelta}, est. tokens ${tokenDelta >= 0 ? "+" : ""}${tokenDelta}, tokens per score point ${efficiency}`)
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
