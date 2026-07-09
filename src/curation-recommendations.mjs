import { tokenize } from "./retrieval.mjs"

const STOPWORDS = new Set([
  "what", "which", "where", "when", "with", "from", "into", "that", "this", "should", "about",
  "agent", "memory", "note", "notes", "project", "durable", "stored", "policy", "workflow",
  "the", "and", "for", "are", "was", "were", "how", "why", "does", "did",
])

export function buildCurationRecommendations(report, queries, { method = "governed-bm25f-sections" } = {}) {
  const queryById = new Map(queries.map((item) => [item.id, item]))
  const runs = report.methods?.[method]?.runs
  if (!Array.isArray(runs)) throw new Error(`METHOD_NOT_FOUND: ${method}`)

  const recommendations = []
  for (const run of runs) {
    if (run.metrics?.hit === 1) continue
    const queryCase = queryById.get(run.id)
    if (!queryCase) continue
    const expected = expectedPaths(queryCase)
    const classification = classifyMiss(run, queryCase, report)
    const actions = buildActions({ queryCase, expected, run, report, classification })
    const patchCandidates = buildPatchCandidates({ queryCase, expected, run, classification })

    recommendations.push({
      id: run.id,
      category: queryCase.category ?? run.category ?? "unclassified",
      kind: classification.kind,
      severity: classification.severity,
      scope: queryCase.scope ?? "",
      query: queryCase.query,
      expected,
      retrieved: run.retrieved ?? [],
      estimatedRank: classification.estimatedRank,
      actions,
      patchCandidates,
    })
  }

  return {
    role: "curation-plan",
    canonical_memory: false,
    schema_version: "1.0",
    method,
    totalRuns: runs.length,
    misses: recommendations.length,
    byKind: countBy(recommendations, "kind"),
    bySeverity: countBy(recommendations, "severity"),
    recommendations,
  }
}

export function renderCurationRecommendations(result) {
  const lines = [`Curation recommendations: ${result.misses}/${result.totalRuns} miss cases for ${result.method}`]
  for (const item of result.recommendations) {
    lines.push("")
    lines.push(`- ${item.id} [${item.category}; ${item.kind}; ${item.severity}]`)
    lines.push(`  expected: ${item.expected.join(" | ")}`)
    lines.push(`  retrieved: ${item.retrieved.join(" | ") || "(none)"}`)
    for (const action of item.actions) lines.push(`  - ${action}`)
    for (const candidate of item.patchCandidates) {
      lines.push(`  candidate: ${candidate.type} -> ${candidate.target || "(eval case)"}`)
    }
  }
  return `${lines.join("\n")}\n`
}

function buildPatchCandidates({ queryCase, expected, run, classification }) {
  const candidates = []
  const common = {
    sourceCase: queryCase.id,
    evidence: {
      query: queryCase.query,
      expected,
      retrieved: run.retrieved ?? [],
      missKind: classification.kind,
    },
    requiresHumanReview: true,
    autoApplicable: false,
  }

  if (!queryCase.scope) {
    candidates.push({
      ...common,
      type: "scope-fix-candidate",
      target: queryCase.id,
      proposed: { scope: inferCommonScope(expected) },
    })
  }

  const aliases = aliasCandidates(queryCase.query, expected)
  for (const target of expected) {
    if (!aliases.length) break
    candidates.push({
      ...common,
      type: "alias-patch-candidate",
      target,
      proposed: { addAliases: aliases },
    })
  }

  const retrieved = run.retrieved ?? []
  if (classification.kind === "buried-gold" && retrieved.length > 0 && expected.length > 0) {
    candidates.push({
      ...common,
      type: "moc-link-candidate",
      target: retrieved[0],
      proposed: { linkTo: expected },
    })
  }

  if (!Array.isArray(queryCase.relevant_groups) && retrieved.length > 0) {
    candidates.push({
      ...common,
      type: "grouped-gold-review",
      target: queryCase.id,
      proposed: { alternatives: retrieved.filter((item) => !expected.includes(item)).slice(0, 3) },
    })
  }

  return candidates.filter((candidate) => {
    if (candidate.type === "scope-fix-candidate") return Boolean(candidate.proposed.scope)
    if (candidate.type === "grouped-gold-review") return candidate.proposed.alternatives.length > 0
    return true
  })
}

function inferCommonScope(paths) {
  if (!paths.length) return ""
  const split = paths.map((item) => String(item).replaceAll("\\", "/").split("/"))
  const common = []
  for (let index = 0; index < Math.min(...split.map((parts) => parts.length - 1)); index += 1) {
    const segment = split[0][index]
    if (!segment || !split.every((parts) => parts[index] === segment)) break
    common.push(segment)
  }
  return common.join("/")
}

function buildActions({ queryCase, expected, run, report, classification }) {
  const actions = []
  if (!queryCase.scope) actions.push("Add a scope to this eval case so agentic recall does not search the whole vault.")
  if (classification.estimatedRank && classification.estimatedRank > report.k) {
    actions.push(`Gold memory appears buried around rank ${classification.estimatedRank}; improve title, aliases, or MOC links before adding heavier retrieval.`)
  } else {
    actions.push("Gold memory did not appear near the bounded result set; inspect whether the canonical note uses different vocabulary or is missing links.")
  }
  const aliases = aliasCandidates(queryCase.query, expected)
  if (aliases.length) actions.push(`Consider aliases/frontmatter terms: ${aliases.join(", ")}`)
  if (!Array.isArray(queryCase.relevant_groups)) {
    actions.push("Human-review whether a MOC/summary note is an acceptable grouped-gold alternative; do not auto-promote retrieved paths.")
  }
  return actions
}

function expectedPaths(item) {
  if (Array.isArray(item.relevant_groups)) return item.relevant_groups.flat()
  return item.relevant ?? []
}

function aliasCandidates(query, expected) {
  const targetText = expected.join(" ").toLowerCase()
  return [...new Set(tokenize(query))]
    .filter((token) => token.length > 3)
    .filter((token) => !STOPWORDS.has(token))
    .filter((token) => !targetText.includes(token))
    .slice(0, 8)
}

function classifyMiss(run, queryCase, report) {
  const reciprocalRank = run.metrics?.reciprocalRank ?? 0
  const estimatedRank = reciprocalRank > 0 ? Math.round(1 / reciprocalRank) : null
  const retrieved = run.retrieved ?? []
  if (!queryCase.scope) return { kind: "missing-scope", severity: "high", estimatedRank }
  if (estimatedRank && estimatedRank > report.k) return { kind: "buried-gold", severity: estimatedRank <= report.k * 2 ? "medium" : "high", estimatedRank }
  if (retrieved.length === 0) return { kind: "no-candidates", severity: "high", estimatedRank }
  if (!Array.isArray(queryCase.relevant_groups)) return { kind: "gold-ambiguity-or-vocabulary", severity: "medium", estimatedRank }
  return { kind: "unresolved", severity: "medium", estimatedRank }
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const key = item[field] ?? "unknown"
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
}
