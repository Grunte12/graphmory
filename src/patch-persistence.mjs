import { validateMemoryPatch } from "./contracts.mjs"
import { parseMarkdown } from "./retrieval.mjs"
import { readSourceNotes } from "./source-read.mjs"

export function verifyPatchPersistence({ vault, patch, notePath }) {
  const schema = validateMemoryPatch(patch)
  if (!schema.valid) {
    return { valid: false, metadataOnly: true, checkedFields: [], errors: schema.errors }
  }

  let markdown
  try {
    markdown = readSourceNotes(vault, [notePath]).sources[0].markdown
  } catch {
    return {
      valid: false,
      metadataOnly: true,
      checkedFields: [],
      errors: ["note path is invalid or the note cannot be read safely"],
    }
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

  return { valid: errors.length === 0, metadataOnly: true, checkedFields, errors }
}
