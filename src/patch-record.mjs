import { createHash } from "node:crypto"
import { validateMemoryPatch } from "./contracts.mjs"

export const PATCH_RECORD_FORMAT = "graphmory-patch-record/v1"

const START_MARKER = "<!-- graphmory-patch-record:v1:start -->"
const END_MARKER = "<!-- graphmory-patch-record:v1:end -->"
const MARKDOWN_SENSITIVE = /[&<>*_`~\[\]]/gu

function sortObjectKeys(value) {
  if (Array.isArray(value)) return value.map(sortObjectKeys)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObjectKeys(value[key])]))
  }
  return value
}

export function patchDigest(patch) {
  const serialized = JSON.stringify(sortObjectKeys(patch))
  return "sha256:" + createHash("sha256").update(serialized).digest("hex")
}

function validateForRender(patch) {
  if (!validateMemoryPatch(patch).valid || !hasOnlyKeys(patch, [
    "claim", "why_it_matters", "scope", "provenance", "confidence", "suggested_type", "lifecycle",
  ]) || !hasOnlyKeys(patch?.scope, ["applies", "excludes"])
    || !hasOnlyKeys(patch?.lifecycle, ["status", "valid_until", "revalidate_when", "supersedes"])
    || !patch?.provenance?.every((item) => hasOnlyKeys(item, ["kind", "value"]))) {
    throw new TypeError("patch must satisfy the Memory Patch contract")
  }
}

function hasOnlyKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).every((key) => keys.includes(key))
}

function yamlStringList(key, values) {
  if (!values.length) return key + ": []\n"
  return key + ":\n" + values.map((value) => "  - " + JSON.stringify(value) + "\n").join("")
}

function markdownSafeJson(value) {
  return JSON.stringify(value).replace(MARKDOWN_SENSITIVE, (character) =>
    "\\u" + character.codePointAt(0).toString(16).padStart(4, "0"))
}

function recordRows(patch) {
  const lifecycle = patch.lifecycle
  const validUntilPresent = Object.hasOwn(lifecycle, "valid_until")
  const supersedesPresent = Object.hasOwn(lifecycle, "supersedes")
  const supersedes = supersedesPresent ? lifecycle.supersedes : []
  const rows = [
    ["record_format", PATCH_RECORD_FORMAT],
    ["patch_digest", patchDigest(patch)],
    ["claim", patch.claim],
    ["why_it_matters", patch.why_it_matters],
    ["scope.applies.count", patch.scope.applies.length],
  ]
  patch.scope.applies.forEach((value, index) => rows.push(["scope.applies[" + index + "]", value]))
  rows.push(["scope.excludes.count", patch.scope.excludes.length])
  patch.scope.excludes.forEach((value, index) => rows.push(["scope.excludes[" + index + "]", value]))
  rows.push(["provenance.count", patch.provenance.length])
  patch.provenance.forEach((item, index) => {
    rows.push(["provenance[" + index + "].kind", item.kind])
    rows.push(["provenance[" + index + "].value", item.value])
  })
  rows.push(
    ["confidence", patch.confidence],
    ["suggested_type", patch.suggested_type],
    ["lifecycle.status", lifecycle.status],
    ["lifecycle.valid_until.present", validUntilPresent],
    ["lifecycle.valid_until", validUntilPresent ? lifecycle.valid_until : null],
    ["lifecycle.revalidate_when.count", lifecycle.revalidate_when.length],
  )
  lifecycle.revalidate_when.forEach((value, index) => rows.push(["lifecycle.revalidate_when[" + index + "]", value]))
  rows.push(
    ["lifecycle.supersedes.present", supersedesPresent],
    ["lifecycle.supersedes.count", supersedes.length],
  )
  supersedes.forEach((value, index) => rows.push(["lifecycle.supersedes[" + index + "]", value]))
  return rows
}

export function renderPatchRecord(patch) {
  validateForRender(patch)
  const lifecycle = patch.lifecycle
  const validUntilPresent = Object.hasOwn(lifecycle, "valid_until")
  const supersedes = lifecycle.supersedes ?? []
  const digest = patchDigest(patch)
  let frontmatter = "---\n"
  frontmatter += "type: " + patch.suggested_type + "\n"
  frontmatter += "confidence: " + patch.confidence + "\n"
  frontmatter += "status: " + lifecycle.status + "\n"
  frontmatter += "patch_digest: " + digest + "\n"
  frontmatter += "graphmory_record_format: " + PATCH_RECORD_FORMAT + "\n"
  frontmatter += yamlStringList("revalidate_when", lifecycle.revalidate_when)
  if (validUntilPresent) frontmatter += "valid_until: " + JSON.stringify(lifecycle.valid_until) + "\n"
  frontmatter += yamlStringList("supersedes", supersedes)
  frontmatter += "---\n"

  const rows = recordRows(patch).map(([key, value]) => key + ": " + markdownSafeJson(value) + "\n").join("")
  return frontmatter + "\n# " + renderHeading(patch.claim) + "\n\n" + START_MARKER + "\n" + rows + END_MARKER + "\n"
}

// Frontmatter keys the record owns; aliases go too so the merged note has one canonical key each.
const OWNED_KEYS = new Set(["type", "confidence", "status", "lifecycle", "patch_digest", "graphmory_record_format",
  "revalidate_when", "revalidate-when", "revalidate", "valid_until", "valid-until", "validuntil", "supersedes"])

// Places the canonical record into an existing note: owned frontmatter keys and the one record block
// are replaced, everything else the owner wrote stays. A new note gets the full projection.
export function placePatchRecord(existing, patch) {
  const rendered = renderPatchRecord(patch)
  if (existing === null || existing === undefined) return rendered
  const newline = existing.includes("\r\n") ? "\r\n" : "\n"
  const lines = existing.replace(/\r\n?/gu, "\n").split("\n")
  const renderedLines = rendered.split("\n")
  const ownedFrontmatter = renderedLines.slice(1, renderedLines.indexOf("---", 1))
  const recordLines = renderedLines.slice(renderedLines.indexOf(START_MARKER), renderedLines.indexOf(END_MARKER) + 1)

  let kept = []
  let body = lines
  if (lines[0]?.trim() === "---") {
    const close = lines.findIndex((line, index) => index > 0 && /^\s*(?:---|\.\.\.)\s*$/u.test(line))
    if (close < 0) throw new Error("NEEDS_CURATION: existing frontmatter is unterminated")
    let dropping = false
    for (const line of lines.slice(1, close)) {
      const key = /^([A-Za-z0-9_-]+):/u.exec(line)?.[1]?.toLowerCase()
      if (key) dropping = OWNED_KEYS.has(key)
      else if (!/^(?:\s+\S|\s*-\s)/u.test(line)) dropping = false
      if (!dropping) kept.push(line)
    }
    body = lines.slice(close + 1)
  }

  let fence = null
  const starts = [], ends = []
  let heading = -1
  body.forEach((line, index) => {
    const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)
    if (fence) { if (marker && marker[1][0] === fence) fence = null; return }
    if (marker) { fence = marker[1][0]; return }
    if (line.trim() === START_MARKER) starts.push(index)
    if (line.trim() === END_MARKER) ends.push(index)
    if (heading < 0 && /^# \S/u.test(line)) heading = index
  })
  if (starts.length > 1 || ends.length > 1 || starts.length !== ends.length || (starts.length && ends[0] < starts[0])) {
    throw new Error("NEEDS_CURATION: existing note has an ambiguous patch record")
  }
  if (starts.length) body = [...body.slice(0, starts[0]), ...recordLines, ...body.slice(ends[0] + 1)]
  else if (heading >= 0) body = [...body.slice(0, heading + 1), "", ...recordLines, ...body.slice(heading + 1)]
  else body = ["", ...recordLines, ...body]
  return ["---", ...ownedFrontmatter, ...kept, "---", ...body].join(newline)
}

function renderHeading(claim) {
  let title = String(claim).replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim()
  for (const character of ["\\", "`", "*", "_", "[", "]", "<", ">"])
    title = title.replaceAll(character, "\\" + character)
  title = Array.from(title).slice(0, 120).join("").replace(/\\+$/u, "")
  return title || "Memory Patch"
}
