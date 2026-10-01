import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const pythonExecutable = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
const readNormalizedText = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')

test('BEIR rendering preserves IDs/labels and refuses archive drift or output overwrite', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-beir-'))
  try {
    const archive = path.join(dir, 'fixture.zip')
    const build = spawnSync(pythonExecutable, ['-c', `import zipfile,json,sys
with zipfile.ZipFile(sys.argv[1],'w') as z:
 z.writestr('fixture/corpus.jsonl',json.dumps({'_id':'doc-1','title':'Deployment','text':'Ada reverses the release.'})+'\\n')
 z.writestr('fixture/queries.jsonl',json.dumps({'_id':'q-1','text':'Who reverses the release?'})+'\\n')
 z.writestr('fixture/qrels/test.tsv','query-id\\tcorpus-id\\tscore\\nq-1\\tdoc-1\\t2\\n')
`, archive], { encoding: 'utf8' })
    assert.equal(build.status, 0, build.stderr)
    const hash = createHash('sha256').update(fs.readFileSync(archive)).digest('hex')
    const out = path.join(dir, 'prepared')
    const args = ['scripts/prepare-beir-markdown.py', '--zip', archive, '--expected-sha256', hash,
      '--dataset', 'fixture', '--split', 'test', '--out', out]
    const render = spawnSync(pythonExecutable, args, { encoding: 'utf8' })
    assert.equal(render.status, 0, render.stderr)
    const cases = JSON.parse(fs.readFileSync(path.join(out, 'queries.json')))
    assert.deepEqual(cases[0].relevant, ['docs/doc-1.md'])
    assert.equal(cases[0].id, 'q-1')
    assert.equal(readNormalizedText(path.join(out, 'vault/docs/doc-1.md')), '# Deployment\n\nAda reverses the release.\n')
    assert.notEqual(spawnSync(pythonExecutable, args).status, 0)
    const driftOut = path.join(dir, 'drift')
    const driftArgs = [...args]
    driftArgs[driftArgs.indexOf('--expected-sha256') + 1] = '0'.repeat(64)
    driftArgs[driftArgs.indexOf('--out') + 1] = driftOut
    assert.notEqual(spawnSync(pythonExecutable, driftArgs).status, 0)
    assert.equal(fs.existsSync(driftOut), false)
    const runs = path.join(dir, 'runs')
    const exported = spawnSync(process.execPath, ['scripts/export-beir-lexical-runs.mjs', '--prepared', out, '--out', runs], { encoding: 'utf8' })
    assert.equal(exported.status, 0, exported.stderr)
    for (const arm of ['bm25', 'managedLexical']) {
      const result = JSON.parse(fs.readFileSync(path.join(runs, arm + '.json')))
      assert.deepEqual(Object.keys(result), ['q-1'])
      assert.deepEqual(Object.keys(result['q-1']), ['doc-1'])
    }
    const semanticOut = path.join(dir, 'semantic-missing')
    const semantic = spawnSync(process.execPath, ['scripts/export-beir-existing-semantic.mjs',
      '--prepared', out, '--out', semanticOut, '--model-cache', path.join(dir, 'cache')], {
      encoding: 'utf8', env: { ...process.env, MPH_TEST_SEMANTIC_MOCK_MISSING: '1' },
    })
    assert.notEqual(semantic.status, 0)
    const ledger = JSON.parse(fs.readFileSync(path.join(semanticOut, 'manifest.json')))
    assert.equal(ledger.complete, false)
    assert.deepEqual(ledger.planned, ['q-1'])
    assert.deepEqual(ledger.attempted, [])
    assert.match(ledger.stopReason, /OPTIONAL_DEPENDENCY_MISSING/)
    const timingOut = path.join(dir, 'cache-miss.json')
    const timing = spawnSync(process.execPath, ['scripts/benchmark-semantic-cache.mjs',
      '--prepared', out, '--model-cache', path.join(dir, 'empty-cache'),
      '--out', timingOut, '--mode', 'cache', '--count', '2'], { encoding: 'utf8' })
    assert.notEqual(timing.status, 0)
    const timingLedger = JSON.parse(fs.readFileSync(timingOut))
    assert.equal(timingLedger.complete, false)
    assert.equal(timingLedger.plannedCalls, 2)
    assert.deepEqual(timingLedger.rows, [])
    assert.match(timingLedger.stopReason, /Unexpected embedding/)
    fs.appendFileSync(path.join(out, 'vault/docs/doc-1.md'), 'Mutation')
    const corrupt = spawnSync(process.execPath, ['scripts/export-beir-lexical-runs.mjs', '--prepared', out, '--out', path.join(dir, 'corrupt')], { encoding: 'utf8' })
    assert.notEqual(corrupt.status, 0)
    assert.match(corrupt.stderr, /Source drift/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
