import { createHash } from 'node:crypto'
export const hash = (value) => createHash('sha256').update(value).digest('hex')
export function benchmarkDate(value) {
  if (typeof value !== 'string') throw new Error('Missing timestamp')
  const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})(?: \([A-Za-z]+\))? (\d{2}):(\d{2})$/u)
  if (!match) throw new Error('Invalid benchmark timestamp')
  const [, y, m, d, h, min] = match
  const iso = `${y}-${m}-${d}T${h}:${min}:00.000Z`
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== iso) throw new Error('Invalid calendar timestamp')
  return date.getTime()
}
export function validateCase(item, { strictTime = false } = {}) {
  if (!item || typeof item.question_id !== 'string' || !item.question_id || typeof item.question_type !== 'string'
    || typeof item.question !== 'string' || !item.question.trim() || item.answer === undefined) throw new Error('Invalid question contract')
  const ids = item.haystack_session_ids, dates = item.haystack_dates, sessions = item.haystack_sessions
  if (!Array.isArray(ids) || !ids.length || !Array.isArray(dates) || !Array.isArray(sessions)
    || ids.length !== dates.length || ids.length !== sessions.length
    || ids.some(id => typeof id !== 'string' || !id)) throw new Error('Invalid session alignment')
  const cutoff = benchmarkDate(item.question_date)
  dates.forEach(date => { if (benchmarkDate(date) > cutoff && strictTime) throw new Error('Future history at query time') })
  for (const session of sessions) {
    if (!Array.isArray(session) || !session.length) throw new Error('Invalid session')
    for (const turn of session) if (!turn || typeof turn.role !== 'string' || typeof turn.content !== 'string') throw new Error('Invalid turn')
  }
  if (!Array.isArray(item.answer_session_ids) || new Set(item.answer_session_ids).size !== item.answer_session_ids.length
    || item.answer_session_ids.some(id => !ids.includes(id))) throw new Error('Missing or duplicate evidence session')
  if (!item.question_id.endsWith('_abs') && !item.answer_session_ids.length) throw new Error('Answerable case requires evidence')
}
export function selectCases(items, perCategory = 2, seed = 'graphmory-lme-pilot-v1') {
  if (!Array.isArray(items) || !items.length || !Number.isInteger(perCategory) || perCategory < 1) throw new Error('Invalid selection')
  const seen = new Set(), buckets = new Map()
  for (const item of items) {
    validateCase(item)
    if (seen.has(item.question_id)) throw new Error('Duplicate question ID')
    seen.add(item.question_id)
    const category = item.question_id.endsWith('_abs') ? 'abstention' : item.question_type
    if (!buckets.has(category)) buckets.set(category, [])
    buckets.get(category).push(item)
  }
  return [...buckets].sort(([a], [b]) => a.localeCompare(b)).flatMap(([, cases]) => cases
    .sort((a, b) => hash(seed + a.question_id).localeCompare(hash(seed + b.question_id))).slice(0, perCategory))
}
export function prepareCase(item) {
  validateCase(item)
  // Only timestamps, roles and verbatim text are visible; no answer-bearing labels or generated graph edges.
  const ordered = item.haystack_session_ids.map((id, index) => ({ id, index, date: item.haystack_dates[index] }))
    .sort((a, b) => benchmarkDate(a.date) - benchmarkDate(b.date) || a.index - b.index)
  const documents = ordered.map(({ id, index, date }, order) => ({
    path: `sessions/${String(order + 1).padStart(4, '0')}-${hash(id).slice(0, 12)}.md`,
    markdown: `# Conversation ${order + 1}\n\nDate: ${date}\n\n` + item.haystack_sessions[index]
      .map(turn => `## ${turn.role}\n\n${turn.content}`).join('\n\n') + '\n',
    // Allowlisted JSON for future chronological ingestion; excludes has_answer and arbitrary metadata.
    session: { date, turns: item.haystack_sessions[index].map(({ role, content }) => ({ role, content })) },
    sourceId: id,
  }))
  const evidence = item.answer_session_ids.map(id => documents.filter(doc => doc.sourceId === id).map(doc => doc.path))
  return { documents: documents.map(({ sourceId, ...doc }) => doc),
    query: { text: item.question, date: item.question_date },
    labels: { id: item.question_id, category: item.question_id.endsWith('_abs') ? 'abstention' : item.question_type,
      answer: item.answer, evidence, duplicateSessionIds: item.haystack_session_ids.length - new Set(item.haystack_session_ids).size, abstention: item.question_id.endsWith('_abs') } }
}
