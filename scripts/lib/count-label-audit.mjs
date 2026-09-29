// Structural checks for human/agent full-history count-label reviews.
export const AUDIT_PROTOCOL = 'locomo-count-label-audit-v1'

export function referenceCount(answer) {
  const text = String(answer).trim().toLowerCase().replace(/[.!]$/u, '')
  const digit = text.match(/^(\d+)(?:\s+(?:times?|visits?|events?))?$/u)
  if (digit) return Number.isSafeInteger(Number(digit[1])) ? Number(digit[1]) : null
  const words = { once: 1, twice: 2, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
  return words[text] ?? null
}

export function validateCountLabelReview(manifest, review) {
  if (manifest.protocol !== AUDIT_PROTOCOL || review.protocol !== AUDIT_PROTOCOL || review.caseId !== manifest.caseId)
    throw new Error('Audit protocol or case mismatch')
  if (!Number.isSafeInteger(manifest.referenceCount) || manifest.referenceCount < 0) throw new Error('Invalid reference count')
  const sessions = new Set(manifest.sessions.map(item => item.path))
  if (!sessions.size || sessions.size !== manifest.sessions.length) throw new Error('Invalid session inventory')
  const knownTurns = new Set(manifest.sessions.flatMap(item => item.turnIds))
  if (knownTurns.size !== manifest.sessions.reduce((sum, item) => sum + item.turnIds.length, 0)) throw new Error('Duplicate turn inventory')
  if (!Array.isArray(review.reviewedSessions) || new Set(review.reviewedSessions).size !== review.reviewedSessions.length ||
      review.reviewedSessions.some(item => !sessions.has(item))) throw new Error('Invalid reviewed session list')
  const reviewedTurns = new Set(manifest.sessions.filter(item => review.reviewedSessions.includes(item.path)).flatMap(item => item.turnIds))
  if (!Array.isArray(review.events) || !['valid', 'invalid', 'ambiguous', 'provisional'].includes(review.status) ||
      typeof review.rationale !== 'string' || !review.rationale.trim()) throw new Error('Incomplete audit verdict')
  const eventIds = new Set()
  for (const event of review.events) {
    if (typeof event.eventId !== 'string' || !event.eventId.trim() || eventIds.has(event.eventId)) throw new Error('Duplicate/empty event ID')
    eventIds.add(event.eventId)
    if (!['counted', 'candidate', 'excluded'].includes(event.classification) || !Array.isArray(event.turnIds) || !event.turnIds.length ||
        new Set(event.turnIds).size !== event.turnIds.length || event.turnIds.some(id => !knownTurns.has(id)) ||
        typeof event.rationale !== 'string' || !event.rationale.trim()) throw new Error('Invalid event evidence')
    if (event.turnIds.some(id => !reviewedTurns.has(id))) throw new Error('Event evidence belongs to an unreviewed session')
  }
  const count = review.events.filter(event => event.classification === 'counted').length
  const unresolved = review.events.filter(event => event.classification === 'candidate').length
  const completeHistory = review.reviewedSessions.length === sessions.size
  if (review.status === 'valid' && (!completeHistory || unresolved || count !== manifest.referenceCount))
    throw new Error('Valid label requires full-session review, resolved events and exact reference count')
  if (review.status === 'invalid' && count <= manifest.referenceCount)
    throw new Error('Invalid undercount needs more distinct counted events than reference')
  return { caseId: manifest.caseId, status: review.status, referenceCount: manifest.referenceCount,
    countedEvents: count, unresolvedEvents: unresolved, reviewedSessions: review.reviewedSessions.length,
    totalSessions: sessions.size, eligibleForStrictCountEval: review.status === 'valid' }
}
