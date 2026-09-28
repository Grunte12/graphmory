import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('mechanical coverage preserves older-page gaps, deduplicates reads and refuses unseen originals', () => {
  const child = spawnSync('python3', ['-c', `
from scripts.curator_evidence_state import evidence_state
page = {'results': [{'path': 'b.md', 'sourceReadRequired': True}, {'path': 'c.md', 'previewOmitted': True}], 'hasMore': True}
s = evidence_state(['a.md','b.md','c.md','b.md'], ['b.md','b.md'], page)
assert s == {'candidatesObserved':3, 'originalsDelivered':1, 'observedWithoutOriginal':2, 'earlierPageWithoutOriginal':1, 'currentPartialPreviewWithoutOriginal':1, 'moreCandidatesAvailable':True, 'semanticCompleteness':'not_assessed'}
page['hasMore'] = False
assert evidence_state(['a.md','b.md','c.md'], ['a.md','b.md','c.md'], page)['semanticCompleteness'] == 'not_assessed'
for read, current in [(['unseen.md'], page), ([], {'results':[{'path':'unseen.md'}], 'hasMore':False})]:
    try: evidence_state(['a.md','b.md','c.md'], read, current)
    except RuntimeError: pass
    else: raise AssertionError('unobserved evidence was accepted')
print('coverage boundary checks passed')
`], { encoding: 'utf8' })
  assert.equal(child.status, 0, child.stderr)
})
