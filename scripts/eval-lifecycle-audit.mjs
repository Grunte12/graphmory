#!/usr/bin/env node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { auditMemoryLifecycle } from "../src/memory-lifecycle-audit.mjs"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const jsonOutput = option("--json", "")
const now = new Date("2026-07-06T00:00:00.000Z")
const vault = fs.mkdtempSync(path.join(os.tmpdir(), "mph-lifecycle-eval-"))

function write(relativePath, body) {
  const file = path.join(vault, relativePath)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
}

write("00 Inbox/raw-capture.md", "---\nstatus: raw\n---\n# Raw Capture\n\nTemporary user clipping.\n")
write("01 Memory/active-current.md", "---\nstatus: active\n---\n# Current Deployment Rule\n\nAPPLIED: Use the stable endpoint only.\n")
write("01 Memory/expired.md", "---\nstatus: active\nvalid_until: 2026-01-01\n---\n# Expired Access Rule\n\nAPPLIED: This rule needs revalidation.\n")
write("01 Memory/revalidate.md", "---\nstatus: current\nrevalidate_when: 2026-07-01\n---\n# Due Vendor Policy\n\nAPPLIED: Vendor limit should be refreshed.\n")
write("01 Memory/superseded-no-replacement.md", "---\nstatus: superseded\n---\n# Old Runtime Advice\n\nThis note is no longer preferred.\n")
write("01 Memory/stale-language.md", "---\nstatus: active\n---\n# Mixed Status Note\n\nThe first paragraph is current. The old queue advice is stale and obsolete.\n")
write("01 Memory/tension-without-decision.md", "---\nstatus: tension\n---\n# Conflicting URL Policy\n\nTENSION\n\nTwo URLs may be correct in different contexts.\n")
write("Clippings/raw-outside-inbox.md", "---\nstatus: raw\n---\n# Raw Web Clip\n\nUntriaged raw capture.\n")

const before = snapshot(vault)
const report = auditMemoryLifecycle(vault, { includeRawPaths: true, now })
const after = snapshot(vault)

const expected = new Map([
  ["expired-valid-until", 1],
  ["revalidation-due", 1],
  ["obsolete-without-replacement", 1],
  ["active-note-has-stale-language", 1],
  ["tension-without-decision-path", 1],
  ["raw-memory-outside-inbox", 1],
])

const actualCounts = countBy(report.findings, "kind")
const checks = []
for (const [kind, minimum] of expected.entries()) {
  checks.push({ name: `detect ${kind}`, pass: (actualCounts[kind] ?? 0) >= minimum })
}
checks.push({ name: "does not mutate vault", pass: before === after })
checks.push({ name: "produces actionable recommendations", pass: report.actions.length >= 6 })
checks.push({ name: "high severity for expired memory", pass: report.findings.some((item) => item.kind === "expired-valid-until" && item.severity === "high") })
checks.push({ name: "no false raw finding for Inbox raw capture", pass: !report.findings.some((item) => item.kind === "raw-memory-outside-inbox" && item.file.startsWith("00 Inbox/")) })

console.log("Lifecycle audit eval")
console.log("")
console.log("| Check | Result |")
console.log("|---|---:|")
for (const check of checks) console.log(`| ${check.name} | ${check.pass ? "PASS" : "FAIL"} |`)
console.log("")
console.log(`Findings: ${report.findings.length}; actions: ${report.actions.length}`)

if (jsonOutput) {
  const target = path.resolve(jsonOutput)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify({ summary: report.summary, actualCounts, checks, actions: report.actions }, null, 2)}\n`)
  console.log(`JSON report: ${target}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length) {
  console.error(`Lifecycle audit eval failed: ${failed.length} check(s)`)
  process.exit(1)
}

function countBy(items, key) {
  const counts = {}
  for (const item of items) counts[item[key]] = (counts[item[key]] ?? 0) + 1
  return counts
}

function snapshot(root) {
  const entries = []
  for (const file of listFiles(root)) {
    entries.push(`${path.relative(root, file).replaceAll("\\", "/")}:${fs.readFileSync(file, "utf8")}`)
  }
  return entries.sort().join("\n---\n")
}

function listFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) return listFiles(full)
    return [full]
  })
}
