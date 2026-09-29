// Experimental source selection. Partial excerpts never certify answer completeness.
import { createHash } from 'node:crypto'
import { tokenize } from '../../src/retrieval.mjs'

const stopwords = new Set('a an the is are was were be been being do does did how what which who when where why many much have has had to of for in on at with from and or about all information tell me'.split(' '))
const terms = text => new Set(tokenize(text).flatMap(term => term.length > 3 && term.endsWith('s') && !term.endsWith('ss') ? [term, term.slice(0, -1)] : [term]))

export function sourceSectionWindow(markdown, query, context = 1) {
  if (typeof markdown !== 'string' || typeof query !== 'string' || !Number.isInteger(context) || context < 0 || context > 2) throw new Error('Invalid source-window input')
  const lines = markdown.match(/[^\n]*\n|[^\n]+$/gu) ?? []
  const sections = []
  let start = 0, level = 0, fence = null
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].replace(/\r?\n$/u, '')
    const marker = text.match(/^ {0,3}(`{3,}|~{3,})/u)
    if (marker) {
      if (!fence) fence = { character: marker[1][0], length: marker[1].length }
      else if (marker[1][0] === fence.character && marker[1].length >= fence.length && /^ {0,3}(`{3,}|~{3,})\s*$/u.test(text)) fence = null
      continue
    }
    if (fence) continue
    const heading = text.match(/^ {0,3}(#{1,6})\s+/u)
    if (!heading) continue
    if (i > start) sections.push({ start, end: i, level })
    start = i; level = heading[1].length
  }
  if (lines.length > start) sections.push({ start, end: lines.length, level })
  const queryTerms = new Set([...terms(query)].filter(term => !stopwords.has(term)))
  const matched = sections.flatMap((section, i) => {
    // Heading-only matches would select every turn by the named speaker.
    const body = lines.slice(section.start + (section.level ? 1 : 0), section.end).join('')
    return [...terms(body)].some(term => queryTerms.has(term)) ? [i] : []
  })
  const selected = new Set()
  if (!queryTerms.size || !matched.length) sections.forEach((_, i) => selected.add(i))
  else {
    selected.add(0) // Keep document title/timestamp/frontmatter preamble intact.
    for (const i of matched) {
      for (let j = Math.max(0, i - context); j <= Math.min(sections.length - 1, i + context); j++) selected.add(j)
    }
    // Preserve full parent context, including negation/scope in parent bodies.
    for (const i of [...selected]) {
      let childLevel = sections[i].level
      for (let j = i - 1; j >= 0 && childLevel > 0; j--) {
        if (sections[j].level < childLevel) { selected.add(j); childLevel = sections[j].level }
      }
    }
  }
  const ranges = [...selected].sort((a, b) => a - b).map(i => ({
    startLine: sections[i].start + 1, endLine: sections[i].end,
    markdown: lines.slice(sections[i].start, sections[i].end).join(''),
  }))
  return { originalSha256: createHash('sha256').update(markdown).digest('hex'),
    originalBytes: Buffer.byteLength(markdown), selectedBytes: ranges.reduce((sum, r) => sum + Buffer.byteLength(r.markdown), 0),
    sectionCount: sections.length, omittedSections: sections.length - selected.size,
    sourceReadRequired: selected.size < sections.length, semanticCompleteness: 'not_assessed', ranges }
}
