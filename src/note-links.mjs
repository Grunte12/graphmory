import path from "node:path"
import { NOTE_RELATIONS } from "./graph-navigation.mjs"
import { createNoteLinkResolver } from "./brain-sync.mjs"

// Link maintenance for the Curator. Relations live in frontmatter properties as quoted
// wikilinks, so Obsidian shows them as clickable links and the graph reads them. A repair
// rewrites only the target of a broken body link. Nothing else in the note changes.
const failure = (code, message) => Object.assign(new Error(`${code}: ${message}`), { publicCode: code })
const RECORD_START = "<!-- graphmory-patch-record:v1:start -->"
const RECORD_END = "<!-- graphmory-patch-record:v1:end -->"

const linkValue = (target) => JSON.stringify(`[[${target.replace(/\.md$/iu, "")}]]`)
const sameTarget = (left, right) => left.replace(/\.md$/iu, "") === right.replace(/\.md$/iu, "")
const referenceTarget = (value) => String(value).trim().replace(/^["']|["']$/gu, "").replace(/^\[\[|\]\]$/gu, "").split(/[|#]/u)[0].trim()

function splitFrontmatter(lines) {
  if (lines[0]?.trim() !== "---") return { front: null, body: lines }
  const close = lines.findIndex((line, index) => index > 0 && /^\s*(?:---|\.\.\.)\s*$/u.test(line))
  if (close < 0) throw failure("NEEDS_CURATION", "the note's frontmatter is unterminated")
  return { front: lines.slice(1, close), body: lines.slice(close + 1) }
}

// The key's own lines: `key: value`, `key: [a, b]` or `key:` followed by indented `- item` lines.
function findKey(front, key) {
  const start = front.findIndex((line) => new RegExp(`^${key}\\s*:`, "u").test(line))
  if (start < 0) return null
  let end = start + 1
  while (end < front.length && /^(?:\s+\S|\s*-\s)/u.test(front[end])) end++
  const inline = front[start].replace(new RegExp(`^${key}\\s*:\\s*`, "u"), "").trim()
  let values
  if (inline.startsWith("[")) {
    if (!inline.endsWith("]")) throw failure("NEEDS_CURATION", `the ${key} property is not a simple list`)
    values = inline.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean)
  } else if (inline) values = [inline]
  else values = front.slice(start + 1, end).map((line) => line.replace(/^\s*-\s*/u, "").trim()).filter(Boolean)
  if (front.slice(start + 1, end).some((line) => !/^\s*-\s/u.test(line))) throw failure("NEEDS_CURATION", `the ${key} property is not a simple list`)
  return { start, end, values }
}

function writeKey(front, key, values) {
  const found = findKey(front, key)
  const block = values.length ? [`${key}:`, ...values.map((value) => `  - ${value}`)] : []
  if (found) return [...front.slice(0, found.start), ...block, ...front.slice(found.end)]
  return [...front, ...block]
}

// Rewrites matching link targets outside code fences, inline code, comments and the record block.
function repairBody(body, from, to, notePath) {
  let fence = null, record = false, count = 0
  const wikiTarget = to.replace(/\.md$/iu, "")
  const relative = path.posix.relative(path.posix.dirname(notePath), to).split("/").map(encodeURIComponent).join("/")
  const lines = body.map((line) => {
    const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)
    if (fence) { if (marker && marker[1][0] === fence) fence = null; return line }
    if (marker) { fence = marker[1][0]; return line }
    if (line.trim() === RECORD_START) record = true
    if (record) { if (line.trim() === RECORD_END) record = false; return line }
    return line.split(/(`+[^`]*`+|<!--.*?-->)/u).map((part, index) => index % 2 ? part : part
      .replace(/\[\[([^\]|#]+)((?:#[^\]|]+)?(?:\|[^\]]+)?)\]\]/gu, (match, target, rest) => {
        if (!sameTarget(target.trim(), from)) return match
        count++; return `[[${wikiTarget}${rest}]]`
      })
      .replace(/(?<!!)(\[[^\]]+\]\()<?([^\s>)]+?)>?((?:#[^\s)]*)?\))/gu, (match, label, target, rest) => {
        let decoded
        try { decoded = decodeURIComponent(target) } catch { return match }
        if (!sameTarget(decoded, from)) return match
        count++; return `${label}${relative}${rest}`
      })).join("")
  })
  return { lines, count }
}

/**
 * Plans link edits for one note. `notes` is the whole vault inventory ({path, title, text}),
 * used to prove each new target exists and each repaired link is currently broken.
 */
export function editNoteLinks({ markdown, notePath, notes, add = [], remove = [], repair = [] }) {
  const paths = new Set(notes.map((note) => note.path))
  const resolve = createNoteLinkResolver(notes)
  const exists = (target) => {
    if (!paths.has(target)) throw failure("LINK_TARGET_NOT_FOUND", `no note at ${target}; use an exact vault-relative path`)
    if (target === notePath) throw failure("INVALID_LINK", "a note cannot link to itself")
  }
  const newline = markdown.includes("\r\n") ? "\r\n" : "\n"
  const split = splitFrontmatter(markdown.replace(/\r\n?/gu, "\n").split("\n"))
  let front = split.front ?? []
  let body = split.body
  const changes = []
  const resolved = (value) => {
    const target = referenceTarget(value)
    const result = resolve(target, notePath)
    return result.resolved ? result.path : target
  }
  for (const { target, relation } of add) {
    if (!NOTE_RELATIONS.includes(relation)) throw failure("INVALID_LINK", `relation must be one of ${NOTE_RELATIONS.join(", ")}`)
    exists(target)
    const values = findKey(front, relation)?.values ?? []
    if (values.some((value) => resolved(value) === target)) continue
    front = writeKey(front, relation, [...values, linkValue(target)])
    changes.push({ action: "added", relation, target })
  }
  for (const { target, relation } of remove) {
    if (!NOTE_RELATIONS.includes(relation)) throw failure("INVALID_LINK", `relation must be one of ${NOTE_RELATIONS.join(", ")}`)
    const values = findKey(front, relation)?.values ?? []
    const kept = values.filter((value) => resolved(value) !== target && referenceTarget(value) !== target)
    if (kept.length === values.length) continue
    front = writeKey(front, relation, kept)
    changes.push({ action: "removed", relation, target })
  }
  for (const { from, to } of repair) {
    exists(to)
    const current = resolve(from, notePath)
    if (current.resolved && paths.has(current.path)) throw failure("LINK_NOT_BROKEN", `[[${from}]] already resolves to ${current.path}; add or remove a relation instead`)
    let count = 0
    for (const relation of NOTE_RELATIONS) {
      const values = findKey(front, relation)?.values
      if (!values?.some((value) => sameTarget(referenceTarget(value), from))) continue
      front = writeKey(front, relation, values.map((value) => sameTarget(referenceTarget(value), from) ? linkValue(to) : value))
      count++
    }
    const repaired = repairBody(body, from, to, notePath)
    body = repaired.lines
    count += repaired.count
    if (!count) throw failure("LINK_NOT_FOUND", `the note has no link to ${from}`)
    changes.push({ action: "repaired", from, to, links: count })
  }
  if (!changes.length) return { markdown, changes }
  const lines = split.front || front.length ? ["---", ...front, "---", ...body] : body
  return { markdown: lines.join(newline), changes }
}
