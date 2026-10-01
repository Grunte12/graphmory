const VALID_UNTIL_KEYS = new Set(["valid_until", "valid-until", "validuntil"])
const VALID_UNTIL_STATE_CACHE = new WeakMap()

function validCalendarDate(year, month, day) {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= days[month - 1]
}

function utcDateStart(year, month, day) {
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  return date.getTime()
}

export function parseLifecycleDate(value) {
  if (typeof value !== "string") return { valid: false, reason: "not-a-string" }
  const text = value.trim()
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/u)
  if (dateOnly) {
    const year = Number(dateOnly[1])
    const month = Number(dateOnly[2])
    const day = Number(dateOnly[3])
    if (!validCalendarDate(year, month, day)) return { valid: false, reason: "invalid-date" }
    const startsAt = utcDateStart(year, month, day)
    return { valid: true, kind: "date", startsAt, expiresAt: startsAt + 86_400_000 }
  }

  const timestamp = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/iu)
  if (!timestamp) return { valid: false, reason: "ambiguous-or-unsupported-format" }
  const year = Number(timestamp[1])
  const month = Number(timestamp[2])
  const day = Number(timestamp[3])
  const hour = Number(timestamp[4])
  const minute = Number(timestamp[5])
  const second = Number(timestamp[6])
  const zone = timestamp[8].toUpperCase()
  if (!validCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) {
    return { valid: false, reason: "invalid-timestamp" }
  }
  if (zone !== "Z") {
    const offset = zone.slice(1).split(":").map(Number)
    if (offset[0] > 23 || offset[1] > 59 || zone === "-00:00") {
      return { valid: false, reason: "invalid-timezone" }
    }
  }
  const fraction = timestamp[7] ?? ""
  const millis = fraction.slice(0, 3).padEnd(3, "0")
  const canonical = timestamp[1] + "-" + timestamp[2] + "-" + timestamp[3]
    + "T" + timestamp[4] + ":" + timestamp[5] + ":" + timestamp[6]
  const expiresAt = Date.parse(canonical + "." + millis + zone)
  if (!Number.isFinite(expiresAt)) return { valid: false, reason: "invalid-timestamp" }
  const hasSubMillisecondPrecision = fraction.length > 3 && /[1-9]/u.test(fraction.slice(3))
  const expiryBoundary = expiresAt + (hasSubMillisecondPrecision ? 1 : 0)
  return { valid: true, kind: "timestamp", startsAt: expiryBoundary, expiresAt: expiryBoundary }
}

function frontmatterEntries(markdown) {
  if (typeof markdown !== "string") return null
  const firstLineEnd = markdown.search(/[\r\n]/u)
  const firstLine = firstLineEnd < 0 ? markdown : markdown.slice(0, firstLineEnd)
  if (firstLine.trim() !== "---") return null
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n")
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

function metadataValidUntilSnapshot(metadata) {
  if (!metadata || typeof metadata !== "object") return []
  const keys = Object.keys(metadata).filter((key) => VALID_UNTIL_KEYS.has(key.toLowerCase())).sort()
  const snapshot = []
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(metadata, key)
    if (descriptor && (descriptor.get || descriptor.set)) return null
    const value = metadata[key]
    const type = typeof value
    if (value !== null && type !== "undefined" && type !== "string" && type !== "number"
      && type !== "boolean" && type !== "bigint") return null
    snapshot.push([key, value])
  }
  return snapshot
}

function sameMetadataSnapshot(left, right) {
  return left.length === right.length && left.every((entry, index) =>
    entry[0] === right[index][0] && Object.is(entry[1], right[index][1]))
}

function decodeSimpleScalar(raw) {
  const value = String(raw).trim()
  if (value.startsWith('"') && value.endsWith('"')) {
    try { return JSON.parse(value) } catch { return null }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'")
  if (value === "[]") return []
  if (value === "null" || value === "~") return null
  return value
}

function invalidState(reason, value = undefined) {
  return { present: true, valid: false, reason, ...(value === undefined ? {} : { value }) }
}

export function validUntilState(document) {
  // Documents are reused across many retrieval queries. Cache only the parsed
  // lifecycle value, keyed by the exact Markdown bytes and (when needed) the
  // metadata expiry aliases; expiry is still evaluated against the current clock every time.
  // This avoids rescanning every line of every note on every query without
  // allowing a warmed cache to preserve authority past its expiry boundary.
  if (document && typeof document === "object" && typeof document.markdown === "string") {
    const cached = VALID_UNTIL_STATE_CACHE.get(document)
    if (cached?.markdown === document.markdown) {
      if (cached.usesFrontmatter) return cached.state
      const metadataSnapshot = metadataValidUntilSnapshot(document.metadata)
      if (metadataSnapshot && sameMetadataSnapshot(metadataSnapshot, cached.metadataSnapshot)) return cached.state
    }
    const entries = frontmatterEntries(document.markdown)
    const state = Object.freeze(computeValidUntilState(document, entries))
    const cacheEntry = { markdown: document.markdown, state, usesFrontmatter: entries !== null }
    if (entries === null) {
      const metadataSnapshot = metadataValidUntilSnapshot(document.metadata)
      if (!metadataSnapshot) return state
      cacheEntry.metadataSnapshot = metadataSnapshot
    }
    VALID_UNTIL_STATE_CACHE.set(document, cacheEntry)
    return state
  }
  return computeValidUntilState(document)
}

function computeValidUntilState(document, entries = frontmatterEntries(document?.markdown)) {
  if (entries !== null) {
    const matches = entries.filter((entry) => VALID_UNTIL_KEYS.has(entry.key))
    if (matches.length > 1) return invalidState("duplicate-valid-until")
    if (!matches.length) return { present: false, valid: true }
    const raw = matches[0]
    if (raw.listItems.length || !raw.raw.trim()) return invalidState("invalid-valid-until")
    const value = decodeSimpleScalar(raw.raw)
    if (typeof value !== "string") return invalidState("invalid-valid-until", value)
    const parsed = parseLifecycleDate(value)
    return parsed.valid
      ? { present: true, valid: true, value, expiresAt: parsed.expiresAt, kind: parsed.kind }
      : invalidState(parsed.reason, value)
  }

  const metadata = document?.metadata ?? {}
  const matchingKeys = Object.keys(metadata).filter((key) => VALID_UNTIL_KEYS.has(key.toLowerCase()))
  if (matchingKeys.length > 1) return invalidState("duplicate-valid-until")
  if (!matchingKeys.length) return { present: false, valid: true }
  const value = metadata[matchingKeys[0]]
  const parsed = parseLifecycleDate(value)
  return parsed.valid
    ? { present: true, valid: true, value, expiresAt: parsed.expiresAt, kind: parsed.kind }
    : invalidState(parsed.reason, typeof value === "string" ? value : undefined)
}

function clockMilliseconds(now) {
  const value = now === undefined ? new Date() : now
  const date = value instanceof Date ? value : new Date(value)
  return date.getTime()
}

export function isValidUntilExpired(state, now = new Date()) {
  if (!state?.present) return false
  if (!state.valid) return true
  const current = clockMilliseconds(now)
  return !Number.isFinite(current) || current >= state.expiresAt
}

export function isLifecycleDateDue(value, now = new Date()) {
  const parsed = parseLifecycleDate(value)
  if (!parsed.valid) return false
  const current = clockMilliseconds(now)
  return Number.isFinite(current) && current >= parsed.startsAt
}
