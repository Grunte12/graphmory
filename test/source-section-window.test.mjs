import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceSectionWindow } from '../scripts/lib/source-section-window.mjs'

test('source window preserves exact line bytes, fenced headings, parent scope and neighboring negation', () => {
  const md = '# Project\r\nDate: 2026-01-01\r\n## Restricted scope\r\nThese are NOT approved.\r\n### Earlier\r\nUnrelated background.\r\n### Deployment\r\nDeploying engine Friday.\r\n```md\r\n## Fake code heading\r\n```\r\n### Correction\r\nDo not deploy Friday.\r\n### Another\r\nUnused.\r\n'
  const s = sourceSectionWindow(md, 'engine', 1)
  const output = s.ranges.map(r => r.markdown).join('')
  assert.ok(output.includes('These are NOT approved.'))
  assert.ok(output.includes('Do not deploy Friday.'))
  assert.ok(output.includes('## Fake code heading\r\n```'))
  assert.equal(s.sourceReadRequired, true)
  const lines = md.match(/[^\n]*\n|[^\n]+$/gu)
  for (const r of s.ranges) assert.equal(r.markdown, lines.slice(r.startLine - 1, r.endLine).join(''))
  assert.equal(s.semanticCompleteness, 'not_assessed')
})

test('no-match and stopword-only queries fall back to full originals; headings alone do not narrow sources', () => {
  const md = '# Speaker\nTimestamp: yesterday\n## Mira\nA painting was delivered.\n## Sam\nThe code is ready.\n'
  for (const query of ['semantic paraphrase absent', 'how many', 'Mira']) {
    const s = sourceSectionWindow(md, query, 0)
    assert.equal(s.ranges.map(r => r.markdown).join(''), md)
    assert.equal(s.sourceReadRequired, false)
    assert.equal(s.omittedSections, 0)
  }
  assert.throws(() => sourceSectionWindow(md, 'painting', 3))
})
