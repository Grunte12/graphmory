import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const runner = new URL('../scripts/run-reader-pilot.py', import.meta.url).pathname
function trial(mode, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-reader-test-'))
  const bin = path.join(dir, 'bin'); fs.mkdirSync(bin)
  const fake = `#!${process.execPath}\nprocess.stdin.resume();process.stdin.on('end',()=>{
    const emit=x=>console.log(JSON.stringify(x));
    emit({type:'item.completed',item:{type:'error',message:'advisory warning'}});
    if(process.env.PILOT_TEST_MODE==='tool') emit({type:'item.completed',item:{type:'command_execution',command:'cat labels.json'}});
    emit({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({answer:'Supported fixture answer (note.md)'})}});
    emit({type:'turn.completed',usage:{input_tokens:10,output_tokens:5}});
  });\n`
  fs.writeFileSync(path.join(bin, 'codex'), fake, { mode: 0o700 })
  const markdown = '# Note\nA fixture fact.'
  const note = { path: 'note.md', markdown, sha256: createHash('sha256').update(markdown).digest('hex') }
  fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify([{ id: 'fixture:0', question: 'What fact?', oracle: [note], predicted: [note], ...extra }]))
  const run = spawnSync('python3', [runner, '--input', path.join(dir, 'input.json'), '--out', path.join(dir, 'run')], {
    encoding: 'utf8', timeout: 10000, env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, PILOT_TEST_MODE: mode },
  })
  const file = path.join(dir, 'run', 'report.json')
  const report = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : null
  fs.rmSync(dir, { recursive: true, force: true })
  return { run, report }
}
test('reader pilot accepts advisory warnings and accounts for all four mediated stages', () => {
  const { run, report } = trial('warning')
  assert.equal(run.status, 0, run.stderr)
  assert.equal(report.runComplete, true)
  assert.equal(report.expectedTrials.length, 4)
  assert.equal(report.rows.length, 4)
  assert.ok(report.rows.every(row => row.warnings.length === 1 && row.error === null))
})
test('reader pilot rejects tool use, retains failed row, and never runs remaining stages', () => {
  const { run, report } = trial('tool')
  assert.notEqual(run.status, 0)
  assert.equal(report.runComplete, false)
  assert.equal(report.expectedTrials.length, 4)
  assert.equal(report.rows.length, 1)
  assert.equal(report.rows[0].answer, null)
})
test('reader pilot rejects labels in reader input before calling the host', () => {
  const { run, report } = trial('warning', { answer: 'LEAKED GOLD' })
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /unexpected fields/)
  assert.equal(report, null)
})
