import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const runner = new URL('../scripts/run-curator-paging-pilot.py', import.meta.url).pathname
function runFixture(mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-paging-harness-'))
  const vault = path.join(dir, 'vault'), bin = path.join(dir, 'bin')
  fs.mkdirSync(vault); fs.mkdirSync(bin)
  const markdown = '# Fixture\n## Fact\nThe fixture owner is Ada.'
  const sha256 = createHash('sha256').update(markdown).digest('hex')
  fs.writeFileSync(path.join(vault, 'note.md'), markdown)
  fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify([{ id: 'fixture:0', question: 'Who owns the fixture?', vault, sources: { 'note.md': sha256 } }]))
  const fake = `#!${process.execPath}\nconst fs=require('node:fs');process.stdin.resume();process.stdin.on('end',()=>{
    const schema=JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf('--output-schema')+1]));
    const counter=process.env.PAGING_TEST_COUNTER;const count=fs.existsSync(counter)?Number(fs.readFileSync(counter)):0;
    fs.writeFileSync(counter,String(count+1));
    const response=schema.properties.answer?{answer:'Ada owns the fixture (note.md)'}:
      count===0?{read_paths:[process.env.PAGING_TEST_MODE==='unseen'?'hidden-gold.md':'note.md'],next_page:process.env.PAGING_TEST_MODE==='exhausted-next',brief:''}:
      {read_paths:[],next_page:false,brief:'Ada owns the fixture (note.md)'};
    console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify(response)}}));
    console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,output_tokens:3}}));
  });\n`
  fs.writeFileSync(path.join(bin, 'codex'), fake, { mode: 0o700 })
  const child = spawnSync('python3', [runner, '--input', path.join(dir, 'input.json'), '--out', path.join(dir, 'run')], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, PAGING_TEST_MODE: mode, PAGING_TEST_COUNTER: path.join(dir, 'counter') },
  })
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'run', 'report.json')))
  assert.equal(fs.readFileSync(path.join(vault, 'note.md'), 'utf8'), markdown)
  fs.rmSync(dir, { recursive: true, force: true })
  return { child, report }
}
test('curator mediation delivers verified original through actual CLI and gives lead only final brief', () => {
  const { child, report } = runFixture('valid')
  assert.equal(child.status, 0, child.stderr)
  assert.equal(report.runComplete, true)
  assert.equal(report.modelCalls.length, 3)
  assert.deepEqual(report.sourceReads.map(row => row.path), ['note.md'])
  assert.equal(report.answer, 'Ada owns the fixture (note.md)')
  assert.equal(report.stopReason, 'curator-finalized')
})
test('curator mediation rejects unseen source requests and never reaches lead', () => {
  const { child, report } = runFixture('unseen')
  assert.notEqual(child.status, 0)
  assert.equal(report.runComplete, false)
  assert.equal(report.modelCalls.length, 1)
  assert.equal(report.sourceReads.length, 0)
  assert.equal(report.answer, null)
  assert.match(report.stopReason, /Invalid, unseen or repeated/)
})
test('requesting another page after exhaustion gets explicit feedback and can still finish', () => {
  const { child, report } = runFixture('exhausted-next')
  assert.equal(child.status, 0, child.stderr)
  assert.equal(report.runComplete, true)
  assert.equal(report.pages.length, 1)
  assert.equal(report.modelCalls.length, 3)
  assert.deepEqual(report.sourceReads.map(row => row.path), ['note.md'])
})
