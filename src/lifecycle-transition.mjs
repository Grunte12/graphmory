// Mechanical application of an already approved supersession. No truth inference.
export function planPredecessorTransition(markdown, replacementPath, { resolveReplacement } = {}) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u)
  if (!match) throw new Error("LIFECYCLE_FRONTMATTER_REQUIRED: predecessor needs frontmatter")
  const newline = match[0].includes("\r\n") ? "\r\n" : "\n"
  const lines = match[1].split(/\r?\n/u)
  const statusKeys = ["status", "lifecycle"]
  const replacementKeys = ["superseded_by", "superseded-by", "replacement", "replaced_by", "replaced-by"]
  const entries = lines.flatMap((line, index) => {
    const entry = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u)
    return entry ? [{ key: entry[1].toLowerCase(), raw: entry[2].trim(), index }] : []
  })
  const statuses = entries.filter(entry => statusKeys.includes(entry.key))
  const replacements = entries.filter(entry => replacementKeys.includes(entry.key))
  if (statuses.length > 1 || replacements.length > 1) throw new Error("LIFECYCLE_AMBIGUOUS: duplicate lifecycle fields")
  const scalar = raw => {
    if (raw.startsWith('"')) { try { return JSON.parse(raw) } catch { return null } }
    if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replaceAll("''", "'")
    return raw
  }
  const resolvesToReplacement = raw => {
    const value = scalar(raw)
    if (value === replacementPath) return true
    if (!value || typeof resolveReplacement !== "function") return false
    const link = value.match(/^\[\[([\s\S]*)\]\]$/u)?.[1] ?? value
    const target = link.split("|", 1)[0].split("#", 1)[0].trim()
    if (!target) return false
    const resolution = resolveReplacement(target)
    if (!resolution?.resolved || typeof resolution.path !== "string") return false
    const normalizePath = value => value.replaceAll("\\", "/").replace(/^\/+/, "")
    return normalizePath(resolution.path) === normalizePath(replacementPath)
  }
  const status = statuses.length ? scalar(statuses[0].raw) : "active"
  if (!["active", "current", "superseded"].includes(status)) throw new Error("LIFECYCLE_CONFLICT: predecessor is not active/current/superseded")
  if (replacements.length && !resolvesToReplacement(replacements[0].raw)) {
    throw new Error("LIFECYCLE_CONFLICT: predecessor already has a different or ambiguous replacement")
  }
  // Block structured/commented values rather than guessing their YAML meaning.
  for (const entry of [...statuses, ...replacements]) {
    if (lines[entry.index + 1]?.match(/^\s+\S/u)) throw new Error("LIFECYCLE_AMBIGUOUS: structured lifecycle value")
  }
  const updates = new Map([
    ...(statuses.length ? [[statuses[0].index, "status: superseded"]] : []),
    ...(replacements.length ? [[replacements[0].index, `superseded_by: ${JSON.stringify(replacementPath)}`]] : []),
  ])
  const output = lines.map((line, index) => updates.get(index) ?? line)
  if (!statuses.length) output.push("status: superseded")
  if (!replacements.length) output.push(`superseded_by: ${JSON.stringify(replacementPath)}`)
  return `---${newline}${output.join(newline)}${newline}---${match[0].endsWith("\n") ? newline : ""}${markdown.slice(match[0].length)}`
}
