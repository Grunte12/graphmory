import fs from "node:fs"
import path from "node:path"
import { validateMemoryPatch } from "./contracts.mjs"
import { parseMarkdown } from "./retrieval.mjs"
import { readSourceNotes } from "./source-read.mjs"
import { renderPatchRecord } from "./patch-record.mjs"
import { isValidUntilExpired, parseLifecycleDate } from "./lifecycle-date.mjs"

const RECORD_START = "<!-- graphmory-patch-record:v1:start -->"
const RECORD_END = "<!-- graphmory-patch-record:v1:end -->"
const REPLACEMENT_KEYS = new Set(["superseded_by", "superseded-by", "replacement", "replaced_by", "replaced-by"])
const VALID_UNTIL_KEYS = new Set(["valid_until", "valid-until", "validuntil"])

function result(valid, metadataOnly, checkedFields, errors) {
  return { valid, metadataOnly, checkedFields, errors }
}

function fullResult(valid, checkedFields, errors) {
  return {
    valid,
    metadataOnly: false,
    persistenceOnly: true,
    semanticSupportVerified: false,
    checkedFields,
    errors,
  }
}

function legacyVerifyPatchPersistence({ vault, patch, notePath }) {
  const schema = validateMemoryPatch(patch)
  if (!schema.valid) return result(false, true, [], schema.errors)

  let markdown
  try {
    markdown = readSourceNotes(vault, [notePath]).sources[0].markdown
  } catch {
    return result(false, true, [], ["note path is invalid or the note cannot be read safely"])
  }

  const metadata = parseMarkdown(notePath, markdown).metadata
  const checkedFields = ["lifecycle.status"]
  const errors = []

  if (metadata.status !== patch.lifecycle.status) {
    errors.push("lifecycle.status is missing or differs in note metadata")
  }

  const expectedTriggers = patch.lifecycle.revalidate_when
  const actualTriggers = metadata.revalidate_when
  expectedTriggers.forEach((trigger, index) => {
    checkedFields.push(`lifecycle.revalidate_when[${index}]`)
    if (!Array.isArray(actualTriggers) || !actualTriggers.some((actual) =>
      typeof actual === "string" && actual.trim() === trigger.trim())) {
      errors.push(`lifecycle.revalidate_when[${index}] is missing from the note YAML list`)
    }
  })

  if (Object.hasOwn(patch.lifecycle, "valid_until")) {
    checkedFields.push("lifecycle.valid_until")
    if (metadata.valid_until !== patch.lifecycle.valid_until) {
      errors.push("lifecycle.valid_until is missing or differs in note metadata")
    }
  }

  return result(errors.length === 0, true, checkedFields, errors)
}

export function verifyPatchPersistence(args) {
  if (args?.full !== true) return legacyVerifyPatchPersistence(args ?? {})
  return fullVerifyPatchPersistence({ ...args, checkPredecessors: true })
}

// Preflight for checkpointed mechanical metadata writes. This cannot issue a receipt.
export function verifyCanonicalPatchRecord(args) {
  return fullVerifyPatchPersistence({ ...args, checkPredecessors: false })
}

function fullVerifyPatchPersistence({ vault, patch, notePath, now = new Date(), checkPredecessors = true }) {
  const schema = validateMemoryPatch(patch)
  if (!schema.valid) return fullResult(false, [], schema.errors)
  let rendered
  try {
    rendered = renderPatchRecord(patch)
  } catch {
    return fullResult(false, [], ["patch contains unsupported fields for the canonical record"])
  }

  const errors = []
  let markdown
  try {
    markdown = readExactNote(vault, notePath)
  } catch {
    return fullResult(false, [], ["note path is invalid or the note cannot be read safely"])
  }

  const checkedFields = [
    "record.format", "patch_digest", "claim", "why_it_matters", "scope.applies", "scope.excludes",
    "provenance", "confidence", "suggested_type", "lifecycle.status", "lifecycle.valid_until",
    "lifecycle.revalidate_when", "lifecycle.supersedes", "frontmatter.type", "frontmatter.confidence",
    "frontmatter.status", "frontmatter.patch_digest", "frontmatter.graphmory_record_format",
    "frontmatter.revalidate_when", "frontmatter.valid_until", "frontmatter.supersedes",
  ]

  const expectedRecord = parseRecordMarkdown(rendered)
  const actualRecord = parseRecordMarkdown(markdown)
  if (expectedRecord.errors.length) {
    errors.push("canonical record could not be generated")
  } else if (actualRecord.errors.length) {
    errors.push(...actualRecord.errors)
  } else {
    compareRecordFields(expectedRecord.fields, actualRecord.fields, errors)
  }

  const expectedMetadata = frontmatterMetadata(rendered)
  const actualMetadata = frontmatterMetadata(markdown)
  compareOperationalFrontmatter(markdown, expectedMetadata, actualMetadata, errors)

  const lifecycle = patch.lifecycle
  if (Object.hasOwn(lifecycle, "valid_until")) {
    const parsedDate = parseLifecycleDate(lifecycle.valid_until)
    if (!parsedDate.valid) {
      errors.push("lifecycle.valid_until is invalid or lacks an explicit timezone")
    } else if (lifecycle.status === "active" && isValidUntilExpired({
      present: true,
      valid: true,
      expiresAt: parsedDate.expiresAt,
    }, now)) {
      errors.push("lifecycle.valid_until has expired for active authority")
    }
  }

  if (checkPredecessors) verifyPredecessors(vault, notePath, lifecycle.supersedes ?? [], errors)
  return fullResult(errors.length === 0, checkedFields, [...new Set(errors)])
}

function readExactNote(vault, relativePath) {
  const source = readSourceNotes(vault, [relativePath]).sources[0]
  if (source.path !== relativePath) throw new Error("noncanonical path")
  const rootReal = fs.realpathSync(vault)
  const noteReal = fs.realpathSync(path.resolve(vault, relativePath))
  const actualPath = path.relative(rootReal, noteReal).split(path.sep).join("/")
  if (actualPath !== relativePath) throw new Error("path is not an exact vault path")
  return source.markdown
}

function parseRecordMarkdown(markdown) {
  const located = locateRecordBlocks(markdown)
  if (located.errors.length) return { fields: new Map(), errors: located.errors }
  if (located.blocks.length !== 1) return { fields: new Map(), errors: ["owned patch record is missing or ambiguous"] }

  const fields = new Map()
  let malformed = false
  let duplicate = false
  for (const line of located.blocks[0]) {
    if (!line.trim()) continue
    const row = line.match(/^([A-Za-z0-9_.\[\]-]+):[ \t]*(.*?)\s*$/u)
    if (!row) {
      malformed = true
      continue
    }
    if (fields.has(row[1])) {
      duplicate = true
      continue
    }
    try {
      fields.set(row[1], JSON.parse(row[2]))
    } catch {
      malformed = true
    }
  }
  const errors = []
  if (duplicate) errors.push("owned patch record contains duplicate fields")
  if (malformed) errors.push("owned patch record contains malformed fields")
  return { fields, errors }
}

function locateRecordBlocks(markdown) {
  const lines = String(markdown).replace(/\r\n?/gu, "\n").split("\n")
  const blocks = []
  const errors = []
  let active = null
  let fence = null

  for (const line of lines) {
    if (fence) {
      const closing = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/u)
      if (closing && closing[1][0] === fence.char && closing[1].length >= fence.length) fence = null
      continue
    }
    if (/^(?: {4,}|\t)/u.test(line)) continue
    if (/^ {0,3}>/u.test(line)) continue

    const opening = line.match(/^ {0,3}(`{3,}|~{3,})/u)
    if (opening) {
      fence = { char: opening[1][0], length: opening[1].length }
      continue
    }

    const trimmed = line.trim()
    if (trimmed === RECORD_START) {
      if (active) errors.push("owned patch record markers are nested or duplicated")
      else active = []
      continue
    }
    if (trimmed === RECORD_END) {
      if (!active) errors.push("owned patch record has an unmatched end marker")
      else {
        blocks.push(active)
        active = null
      }
      continue
    }
    if (active) active.push(line)
  }
  if (active) errors.push("owned patch record is unterminated")
  return { blocks, errors }
}

function compareRecordFields(expected, actual, errors) {
  for (const [key, expectedValue] of expected) {
    if (!actual.has(key)) {
      errors.push(recordPath(key) + " is missing from the owned patch record")
      continue
    }
    if (!sameField(expectedValue, actual.get(key))) {
      errors.push(recordPath(key) + " differs in the owned patch record")
    }
  }
  for (const key of actual.keys()) {
    if (!expected.has(key)) errors.push("owned patch record contains unsupported fields")
  }
}

function recordPath(key) {
  if (key === "record_format") return "record.format"
  if (key === "scope.applies.count") return "scope.applies"
  if (key === "scope.excludes.count") return "scope.excludes"
  if (key === "provenance.count") return "provenance"
  if (key === "lifecycle.revalidate_when.count") return "lifecycle.revalidate_when"
  if (key === "lifecycle.supersedes.count" || key === "lifecycle.supersedes.present") return "lifecycle.supersedes"
  if (key === "lifecycle.valid_until.present") return "lifecycle.valid_until"
  return key
}

function normalized(value) {
  if (typeof value === "string") return value.replace(/\r\n?/gu, "\n").replace(/\s+/gu, " ").trim()
  if (Array.isArray(value)) return value.map(normalized)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalized(value[key])]))
  }
  return value
}

function sameField(left, right) {
  return JSON.stringify(normalized(left)) === JSON.stringify(normalized(right))
}

function frontmatterProperties(markdown) {
  const lines = String(markdown).replace(/\r\n?/gu, "\n").split("\n")
  if (lines[0]?.trim() !== "---") return null
  const entries = []
  let active = null
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (/^\s*(?:---|\.\.\.)\s*$/u.test(line)) return entries
    const property = line.match(/^([A-Za-z0-9_-]+):(?:[ \t]*(.*))?$/u)
    if (property) {
      active = { key: property[1].toLowerCase(), raw: property[2] ?? "", listItems: [] }
      entries.push(active)
      continue
    }
    const item = line.match(/^\s+-\s*(.*?)\s*$/u)
    if (item && active) active.listItems.push(item[1])
    else if (line.trim()) active = null
  }
  return entries
}

function frontmatterMetadata(markdown) {
  const entries = frontmatterProperties(markdown)
  const metadata = {}
  if (!entries) return metadata
  for (const entry of entries) {
    const raw = entry.raw.trim()
    let value
    if (entry.listItems.length || !raw) {
      value = entry.listItems.map(decodeFrontmatterScalar)
    } else if (raw === "[]") {
      value = []
    } else if (raw.startsWith("[") && raw.endsWith("]")) {
      try {
        const parsed = JSON.parse(raw)
        value = Array.isArray(parsed) ? parsed : raw
      } catch {
        value = raw.slice(1, -1).split(",").map(decodeFrontmatterScalar).filter(Boolean)
      }
    } else {
      value = decodeFrontmatterScalar(raw)
    }
    metadata[entry.key] = value
  }
  return metadata
}

function decodeFrontmatterScalar(raw) {
  const value = String(raw).trim()
  if (value.startsWith('"') && value.endsWith('"')) {
    try { return JSON.parse(value) } catch { return value }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'")
  return value
}

function compareOperationalFrontmatter(markdown, expected, actual, errors) {
  const entries = frontmatterProperties(markdown)
  if (!entries) {
    errors.push("frontmatter is missing")
    return
  }
  const required = ["type", "confidence", "status", "patch_digest", "graphmory_record_format", "revalidate_when", "supersedes"]
  for (const key of required) {
    const occurrences = entries.filter((entry) => entry.key === key).length
    if (occurrences > 1) errors.push("frontmatter." + key + " is duplicated")
    const expectedPresent = Object.hasOwn(expected, key)
    const actualPresent = Object.hasOwn(actual, key)
    if (expectedPresent !== actualPresent) {
      errors.push("frontmatter." + key + (expectedPresent ? " is missing" : " is unexpected"))
    } else if (expectedPresent && !sameField(expected[key], actual[key])) {
      errors.push("frontmatter." + key + " differs from the patch")
    }
  }

  for (const [canonical, aliases] of [
    ["status", ["status", "lifecycle"]],
    ["revalidate_when", ["revalidate_when", "revalidate-when", "revalidate"]],
  ]) {
    const matching = entries.filter((entry) => aliases.includes(entry.key))
    if (matching.length > 1) errors.push("frontmatter." + canonical + " is duplicated or ambiguous")
    else if (matching.length === 1 && matching[0].key !== canonical) {
      errors.push("frontmatter." + canonical + " must use the canonical key")
    }
  }

  const dateEntries = entries.filter((entry) => VALID_UNTIL_KEYS.has(entry.key))
  if (dateEntries.length > 1) errors.push("frontmatter.valid_until is duplicated or ambiguous")
  const expectedDatePresent = Object.hasOwn(expected, "valid_until")
  const actualDateKey = dateEntries[0]?.key
  const actualDatePresent = actualDateKey !== undefined
  if (expectedDatePresent !== actualDatePresent) {
    errors.push("frontmatter.valid_until presence differs from the patch")
  } else if (expectedDatePresent && actualDateKey !== "valid_until") {
    errors.push("frontmatter.valid_until must use the canonical key")
  } else if (expectedDatePresent && !sameField(expected.valid_until, actual.valid_until)) {
    errors.push("frontmatter.valid_until differs from the patch")
  }

}

function verifyPredecessors(vault, notePath, predecessors, errors) {
  if (!Array.isArray(predecessors)) return
  const seen = new Set()
  predecessors.forEach((value, index) => {
    const field = "lifecycle.supersedes[" + index + "]"
    if (typeof value !== "string" || !value.trim()) {
      errors.push(field + " must name an exact predecessor path")
      return
    }
    if (seen.has(value)) {
      errors.push(field + " duplicates another predecessor path")
      return
    }
    seen.add(value)
    if (value !== value.trim() || value !== value.replaceAll("\\", "/") || value.startsWith("./")) {
      errors.push(field + " must be a canonical relative path")
      return
    }
    if (value === notePath) {
      errors.push(field + " cannot reference the receiving note")
      return
    }

    let markdown
    try {
      markdown = readExactNote(vault, value)
    } catch {
      errors.push(field + " predecessor path is missing, ambiguous, or unsafe")
      return
    }
    const entries = frontmatterProperties(markdown)
    if (!entries) {
      errors.push(field + " predecessor lacks lifecycle frontmatter")
      return
    }
    const statusEntries = entries.filter((entry) => entry.key === "status")
    const metadata = frontmatterMetadata(markdown)
    const lifecycleEntries = entries.filter((entry) => entry.key === "lifecycle")
    if (statusEntries.length !== 1 || lifecycleEntries.length > 0 || metadata.status !== "superseded") {
      errors.push(field + " predecessor must have status superseded")
    }
    const replacementEntries = entries.filter((entry) => REPLACEMENT_KEYS.has(entry.key))
    if (replacementEntries.length !== 1) {
      errors.push(field + " predecessor must have one unambiguous replacement link")
      return
    }
    const replacement = metadata[replacementEntries[0].key]
    const targets = Array.isArray(replacement) ? replacement : [replacement]
    if (targets.length !== 1 || typeof targets[0] !== "string" || !sameField(targets[0], notePath)) {
      errors.push(field + " predecessor replacement link must point to the receiving note")
    }
  })
}
