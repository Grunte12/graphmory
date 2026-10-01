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

function renderHeading(claim) {
  let title = String(claim).replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim()
  for (const character of ["\\", "`", "*", "_", "[", "]", "<", ">"])
    title = title.replaceAll(character, "\\" + character)
  title = Array.from(title).slice(0, 120).join("").replace(/\\+$/u, "")
  return title || "Memory Patch"
}
