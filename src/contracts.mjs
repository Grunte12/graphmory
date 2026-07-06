const PATCH_TYPES = new Set([
  "decision",
  "root-cause",
  "workflow",
  "preference",
  "source-map",
  "tension",
])

const PROVENANCE_TYPES = new Set([
  "user-statement",
  "file",
  "command",
  "artifact",
  "url",
])

const MEMORY_STATUSES = new Set([
  "active",
  "superseded",
  "tension",
  "deprecated",
])

const DERIVED_ENTRY_TYPES = new Set([
  "artifact",
  "concept",
  "file",
  "note",
  "relation",
  "symbol",
])

const HOT_CONTEXT_CATEGORIES = new Set([
  "policy",
  "preference",
  "workflow",
  "routing",
  "gotcha",
  "stale-warning",
  "open-question",
])

const LEARNING_ACTIONS = new Set([
  "apply",
  "update",
  "deprecate",
  "tension",
  "reject",
])

const VERIFICATION_STATUSES = new Set([
  "verified",
  "partially-verified",
  "blocked",
])

const CURATION_CANDIDATE_TYPES = new Set([
  "alias-patch-candidate",
  "moc-link-candidate",
  "scope-fix-candidate",
  "grouped-gold-review",
])

function text(value, path, errors, min = 1) {
  if (typeof value !== "string" || value.trim().length < min) {
    errors.push(`${path} must be a string with at least ${min} characters`)
  }
}

function stringArray(value, path, errors, { min = 0, max = Infinity } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`)
    return
  }
  if (value.length < min) errors.push(`${path} must contain at least ${min} item(s)`)
  if (value.length > max) errors.push(`${path} must contain at most ${max} item(s)`)
  value.forEach((item, index) => text(item, `${path}[${index}]`, errors))
}

export function validateMemoryPatch(value) {
  const errors = []
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["patch must be an object"] }
  }

  text(value.claim, "claim", errors, 12)
  text(value.why_it_matters, "why_it_matters", errors, 12)

  if (!value.scope || typeof value.scope !== "object" || Array.isArray(value.scope)) {
    errors.push("scope must be an object")
  } else {
    stringArray(value.scope.applies, "scope.applies", errors, { min: 1 })
    stringArray(value.scope.excludes, "scope.excludes", errors)
  }

  if (!Array.isArray(value.provenance) || value.provenance.length === 0) {
    errors.push("provenance must contain at least one evidence item")
  } else {
    value.provenance.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`provenance[${index}] must be an object`)
        return
      }
      if (!PROVENANCE_TYPES.has(item.kind)) {
        errors.push(`provenance[${index}].kind is unsupported`)
      }
      text(item.value, `provenance[${index}].value`, errors, 2)
    })
  }

  if (!["high", "medium", "low"].includes(value.confidence)) {
    errors.push("confidence must be high, medium, or low")
  }
  if (!PATCH_TYPES.has(value.suggested_type)) {
    errors.push("suggested_type is unsupported")
  }

  validateLifecycle(value.lifecycle, "lifecycle", errors, { required: true })

  return { valid: errors.length === 0, errors }
}

export function validateBrainBrief(value) {
  const errors = []
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["brief must be an object"] }
  }

  if (!Array.isArray(value.relevant_memory)) {
    errors.push("relevant_memory must be an array")
  } else {
    if (value.relevant_memory.length < 1 || value.relevant_memory.length > 7) {
      errors.push("relevant_memory must contain 1-7 items")
    }
    value.relevant_memory.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`relevant_memory[${index}] must be an object`)
        return
      }
      text(item.summary, `relevant_memory[${index}].summary`, errors, 3)
      text(item.path, `relevant_memory[${index}].path`, errors, 3)
    })
  }

  stringArray(value.constraints, "constraints", errors)
  stringArray(value.watchouts, "watchouts", errors)
  stringArray(value.note_paths, "note_paths", errors, { min: 1 })
  stringArray(value.direct_read_paths, "direct_read_paths", errors, { max: 3 })

  return { valid: errors.length === 0, errors }
}

export function validateDerivedIndex(value) {
  const errors = []
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["derived index must be an object"] }
  }

  if (value.role !== "derived-index") errors.push("role must be derived-index")
  if (value.canonical_memory !== false) errors.push("canonical_memory must be false")
  text(value.generated_at, "generated_at", errors, 4)

  if (!value.generator || typeof value.generator !== "object" || Array.isArray(value.generator)) {
    errors.push("generator must be an object")
  } else {
    text(value.generator.name, "generator.name", errors, 2)
    if ("version" in value.generator && typeof value.generator.version !== "string") {
      errors.push("generator.version must be a string when present")
    }
  }

  if (!value.scope || typeof value.scope !== "object" || Array.isArray(value.scope)) {
    errors.push("scope must be an object")
  } else {
    stringArray(value.scope.includes, "scope.includes", errors, { min: 1 })
    if ("excludes" in value.scope) stringArray(value.scope.excludes, "scope.excludes", errors)
  }

  validateEvidenceArray(value.derived_from, "derived_from", errors)

  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    errors.push("entries must contain at least one item")
  } else {
    value.entries.forEach((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push(`entries[${index}] must be an object`)
        return
      }
      text(entry.id, `entries[${index}].id`, errors, 2)
      if (!DERIVED_ENTRY_TYPES.has(entry.kind)) {
        errors.push(`entries[${index}].kind is unsupported`)
      }
      text(entry.label, `entries[${index}].label`, errors, 2)
      if (!["high", "medium", "low"].includes(entry.confidence)) {
        errors.push(`entries[${index}].confidence must be high, medium, or low`)
      }
      validateEvidenceArray(entry.evidence_refs, `entries[${index}].evidence_refs`, errors)
      if (entry.canonical_memory === true) {
        errors.push(`entries[${index}].canonical_memory must not be true`)
      }
    })
  }

  return { valid: errors.length === 0, errors }
}

export function validateHotContextPack(value) {
  const errors = []
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["hot context pack must be an object"] }
  }

  if (value.role !== "hot-context-pack") errors.push("role must be hot-context-pack")
  if (value.canonical_memory !== false) errors.push("canonical_memory must be false")
  text(value.generated_at, "generated_at", errors, 4)
  validateEvidenceArray(value.derived_from, "derived_from", errors)

  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    errors.push("entries must contain at least one item")
  } else {
    if (value.entries.length > 24) errors.push("entries must contain at most 24 items")
    value.entries.forEach((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push(`entries[${index}] must be an object`)
        return
      }
      text(entry.id, `entries[${index}].id`, errors, 2)
      if (!HOT_CONTEXT_CATEGORIES.has(entry.category)) {
        errors.push(`entries[${index}].category is unsupported`)
      }
      if (!["high", "medium", "low"].includes(entry.priority)) {
        errors.push(`entries[${index}].priority must be high, medium, or low`)
      }
      if (!["high", "medium", "low"].includes(entry.confidence)) {
        errors.push(`entries[${index}].confidence must be high, medium, or low`)
      }
      text(entry.summary, `entries[${index}].summary`, errors, 12)
      stringArray(entry.source_paths, `entries[${index}].source_paths`, errors, { min: 1, max: 3 })
      validateLifecycle(entry.lifecycle, `entries[${index}].lifecycle`, errors, { required: true })
    })
  }

  return { valid: errors.length === 0, errors }
}

export function validateLearningPacket(value) {
  const errors = []
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["learning packet must be an object"] }
  }

  if (value.role !== "learning-packet") errors.push("role must be learning-packet")
  text(value.lesson, "lesson", errors, 16)
  text(value.trigger, "trigger", errors, 12)
  text(value.future_behavior_change, "future_behavior_change", errors, 16)
  if ("selectors" in value) validateLearningSelectors(value.selectors, "selectors", errors)

  if (!value.scope || typeof value.scope !== "object" || Array.isArray(value.scope)) {
    errors.push("scope must be an object")
  } else {
    stringArray(value.scope.applies, "scope.applies", errors, { min: 1 })
    stringArray(value.scope.excludes, "scope.excludes", errors)
  }

  validateEvidenceArray(value.evidence, "evidence", errors)

  if (!value.verification || typeof value.verification !== "object" || Array.isArray(value.verification)) {
    errors.push("verification must be an object")
  } else {
    if (!VERIFICATION_STATUSES.has(value.verification.status)) {
      errors.push("verification.status must be verified, partially-verified, or blocked")
    }
    text(value.verification.result, "verification.result", errors, 8)
    if ("evidence" in value.verification) {
      validateEvidenceArray(value.verification.evidence, "verification.evidence", errors)
    }
  }

  if (!value.loop_trace || typeof value.loop_trace !== "object" || Array.isArray(value.loop_trace)) {
    errors.push("loop_trace must be an object")
  } else {
    text(value.loop_trace.recall, "loop_trace.recall", errors, 8)
    text(value.loop_trace.action, "loop_trace.action", errors, 8)
    text(value.loop_trace.verification, "loop_trace.verification", errors, 8)
    text(value.loop_trace.learning, "loop_trace.learning", errors, 8)
  }

  if (!LEARNING_ACTIONS.has(value.memory_action)) {
    errors.push("memory_action must be apply, update, deprecate, tension, or reject")
  }
  if (!["high", "medium", "low"].includes(value.confidence)) {
    errors.push("confidence must be high, medium, or low")
  }
  validateLifecycle(value.lifecycle, "lifecycle", errors, { required: true })

  return { valid: errors.length === 0, errors }
}

export function validateCurationPlan(value) {
  const errors = []
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["curation plan must be an object"] }
  }
  if (value.role !== "curation-plan") errors.push("role must be curation-plan")
  if (value.canonical_memory !== false) errors.push("canonical_memory must be false")
  text(value.schema_version, "schema_version", errors, 1)
  text(value.method, "method", errors, 2)
  if (!Array.isArray(value.recommendations)) {
    errors.push("recommendations must be an array")
  } else {
    value.recommendations.forEach((recommendation, recIndex) => {
      if (!Array.isArray(recommendation.patchCandidates)) {
        errors.push(`recommendations[${recIndex}].patchCandidates must be an array`)
        return
      }
      recommendation.patchCandidates.forEach((candidate, index) => {
        const base = `recommendations[${recIndex}].patchCandidates[${index}]`
        if (!CURATION_CANDIDATE_TYPES.has(candidate?.type)) errors.push(`${base}.type is unsupported`)
        text(candidate?.target, `${base}.target`, errors, 2)
        if (candidate?.requiresHumanReview !== true) errors.push(`${base}.requiresHumanReview must be true`)
        if (candidate?.autoApplicable !== false) errors.push(`${base}.autoApplicable must be false`)
        if (!candidate?.evidence || typeof candidate.evidence !== "object") errors.push(`${base}.evidence must be an object`)
      })
    })
  }
  return { valid: errors.length === 0, errors }
}

function validateLearningSelectors(value, path, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} must be an object when present`)
    return
  }
  const allowed = new Set(["tags", "file_globs", "tool_names", "error_regex"])
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${path}.${key} is unsupported`)
  }
  if ("tags" in value) stringArray(value.tags, `${path}.tags`, errors)
  if ("file_globs" in value) stringArray(value.file_globs, `${path}.file_globs`, errors)
  if ("tool_names" in value) stringArray(value.tool_names, `${path}.tool_names`, errors)
  if ("error_regex" in value) stringArray(value.error_regex, `${path}.error_regex`, errors)
}

function validateLifecycle(value, path, errors, { required = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (required) errors.push(`${path} must be an object`)
    return
  }
  if (!MEMORY_STATUSES.has(value.status)) {
    errors.push(`${path}.status must be active, superseded, tension, or deprecated`)
  }
  if ("valid_until" in value && typeof value.valid_until !== "string") {
    errors.push(`${path}.valid_until must be a string when present`)
  }
  if ("revalidate_when" in value) {
    stringArray(value.revalidate_when, `${path}.revalidate_when`, errors)
  } else {
    errors.push(`${path}.revalidate_when must be an array`)
  }
  if ("supersedes" in value) stringArray(value.supersedes, `${path}.supersedes`, errors)
}

function validateEvidenceArray(value, path, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} must contain at least one evidence item`)
    return
  }
  value.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${path}[${index}] must be an object`)
      return
    }
    if (!PROVENANCE_TYPES.has(item.kind)) {
      errors.push(`${path}[${index}].kind is unsupported`)
    }
    text(item.value, `${path}[${index}].value`, errors, 2)
  })
}

export function detectContract(value) {
  if (value && typeof value === "object" && value.role === "learning-packet") return "learning-packet"
  if (value && typeof value === "object" && "claim" in value) return "memory-patch"
  if (value && typeof value === "object" && "relevant_memory" in value) return "brain-brief"
  if (value && typeof value === "object" && value.role === "derived-index") return "derived-index"
  if (value && typeof value === "object" && value.role === "hot-context-pack") return "hot-context-pack"
  if (value && typeof value === "object" && value.role === "curation-plan") return "curation-plan"
  return "unknown"
}
