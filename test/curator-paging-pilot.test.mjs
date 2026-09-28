import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const runner = process.env.READER_PILOT_RUNNER || new URL('../scripts/run-curator-paging-pilot.py', import.meta.url).pathname
function runFixture(mode, extraArgs = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-paging-harness-'))
  const vault = path.join(dir, 'vault'), bin = path.join(dir, 'bin')
  fs.mkdirSync(vault); fs.mkdirSync(bin)
  const markdown = '# Fixture\n## Fact\nThe fixture owner is Ada.'
  const sha256 = createHash('sha256').update(markdown).digest('hex')
  fs.writeFileSync(path.join(vault, 'note.md'), markdown)
  const sourceHashes = { 'note.md': sha256 }
  if (mode === 'mixed-repeat') {
    const second = '# Fixture details\nThe fixture launched in March.'
    fs.writeFileSync(path.join(vault, 'details.md'), second)
    sourceHashes['details.md'] = createHash('sha256').update(second).digest('hex')
  }
  if (mode === 'future-page') {
    for (let i = 0; i < 20; i++) {
      const name = 'next-' + String(i).padStart(2, '0') + '.md'
      const nextMarkdown = markdown.replace('# Fixture\n', '# Fixture nextitem' + String(i).padStart(2, '0') + '\n')
      fs.writeFileSync(path.join(vault, name), nextMarkdown)
      sourceHashes[name] = createHash('sha256').update(nextMarkdown).digest('hex')
    }
  }
  fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify([{ id: 'fixture:0', question: 'Who owns the fixture?', vault, sources: sourceHashes }]))
  const fake = `#!${process.execPath}\nconst fs=require('node:fs');let prompt='';process.stdin.on('data',chunk=>prompt+=chunk);process.stdin.resume();process.stdin.on('end',()=>{
    const schema=JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf('--output-schema')+1]));
    const counter=process.env.PAGING_TEST_COUNTER;const count=fs.existsSync(counter)?Number(fs.readFileSync(counter)):0;
    fs.writeFileSync(counter,String(count+1));
    const resumed=process.argv.includes('resume');
    if(process.env.PAGING_TEST_MODE==='persistent' && count===1 && !resumed)process.exit(9);
    console.log(JSON.stringify({type:'thread.started',thread_id:process.env.PAGING_TEST_MODE==='changed-session'&&count===1?'wrong-session':'fixture-session'}));
    let response=schema.properties.answer?{answer:'Ada owns the fixture (note.md)'}:
      count===0?{read_paths:[process.env.PAGING_TEST_MODE==='unsafe'?'../outside.md':'note.md'],next_page:process.env.PAGING_TEST_MODE==='exhausted-next',brief:''}:
      {read_paths:[],next_page:false,brief:'Ada owns the fixture (note.md)'};
    const repeatModes=['repeat','mixed-repeat','batch-duplicate','repeat-forever','compact-repeat','repeat-unseen','repeat-next'];
    if(!schema.properties.answer && repeatModes.includes(process.env.PAGING_TEST_MODE)) {
      if(count===0 && process.env.PAGING_TEST_MODE==='batch-duplicate')response.read_paths=['note.md','note.md'];
      if(count===1 || (count>0 && process.env.PAGING_TEST_MODE==='repeat-forever'))response={read_paths:process.env.PAGING_TEST_MODE==='mixed-repeat'?['note.md','details.md']:['note.md'],next_page:false,brief:''};
      if(count===1 && process.env.PAGING_TEST_MODE==='repeat-unseen')response.read_paths=['note.md','hidden-gold.md'];
      if(count===1 && process.env.PAGING_TEST_MODE==='repeat-next')response.next_page=true;
      if(count===2 && ['repeat','mixed-repeat','compact-repeat','repeat-next'].includes(process.env.PAGING_TEST_MODE)) {
        if(!prompt.includes('Requested originals already supplied') || !prompt.includes('Ada'))process.exit(8);
        if(process.env.PAGING_TEST_MODE==='repeat-next' && !prompt.includes('No more pages'))process.exit(8);
      }
    }
    const mode=process.env.PAGING_TEST_MODE;
    if(!schema.properties.answer && ['recover-unseen','unseen-forever'].includes(mode)) {
      if(count===0 || mode==='unseen-forever')response={read_paths:['hidden-gold.md'],next_page:true,brief:''};
      else if(count===1) {
        if(!prompt.includes('UNSEEN_SOURCE_PATH') || !prompt.includes('no originals or next page were read') || !prompt.includes('No more pages'))process.exit(8);
        response={read_paths:['note.md'],next_page:false,brief:''};
      }
    }
    if(!schema.properties.answer && mode==='repeat-unseen' && count===2 && !prompt.includes('UNSEEN_SOURCE_PATH'))process.exit(8);
    if(!schema.properties.answer && mode==='future-page') {
      if(count===0)response={read_paths:['next-10.md'],next_page:true,brief:''};
      else if(count===1) {
        if(!prompt.includes('UNSEEN_SOURCE_PATH') || !prompt.includes('Request next_page=true'))process.exit(8);
        response={read_paths:[],next_page:true,brief:''};
      } else if(count===2) {
        if(!prompt.includes('"offset": 10'))process.exit(8);
        response={read_paths:['next-10.md'],next_page:false,brief:''};
      } else response={read_paths:[],next_page:false,brief:'Ada owns the fixture (next-10.md)'};
    }
    const citeBrief={extensionless:'Ada owns the fixture [[note]].',prefix:'Ada owns the fixture (note.md.bak)',suffix:'Ada owns the fixture (other-note.md)',differentExtension:'Ada owns the fixture (note.pdf)',punctuation:'Ada owns the fixture: note.md.'};
    if(response.brief && citeBrief[process.env.PAGING_TEST_MODE])response.brief=citeBrief[process.env.PAGING_TEST_MODE];
    if(schema.properties.citations)response.citations=[process.env.PAGING_TEST_MODE==='bad-citation'?'unread.md':'note.md'];
    if(schema.properties.answer && mode==='future-page') {response.answer='Ada owns the fixture (next-10.md)';if(schema.properties.citations)response.citations=['next-10.md'];}
    console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify(response)}}));
    console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:10,output_tokens:3}}));
  });\n`
  fs.writeFileSync(path.join(bin, 'codex'), fake, { mode: 0o700 })
  if (mode === 'basic') {
    const native = path.join(dir, 'native'), notes = path.join(native, 'notes')
    fs.mkdirSync(notes, { recursive: true })
    fs.writeFileSync(path.join(notes, 'note.md'), '# Fixture\n## Fact\nThe fixture owner is Ada.\n')
    const bm = path.join(bin, 'bm')
    fs.writeFileSync(bm, `#!${process.execPath}\nconst args=process.argv.slice(2);if(args[0]==='--version')process.stdout.write('Basic Memory version: 0.23.2\\n');else if(args[0]==='tool'&&args[1]==='search-notes')process.stdout.write(JSON.stringify({results:[{file_path:'note.md',content:'The fixture owner is Ada.',matched_chunk:'Ada owns the fixture'}],has_more:false,current_page:1,page_size:10,total:1,total_is_exact:true}));else if(args[0]==='tool'&&args[1]==='read-note')process.stdout.write(JSON.stringify({file_path:'note.md',content:'# Fixture\\n## Fact\\nThe fixture owner is Ada.\\n'}));else process.exit(9);`, { mode: 0o700 })
    fs.writeFileSync(path.join(dir, 'basic.json'), JSON.stringify({ exe: bm, state: path.join(native, 'state'), home: path.join(native, 'home'), notes, project: 'pilot' }))
  }
  const child = spawnSync('python3', [runner, '--input', path.join(dir, 'input.json'), '--out', path.join(dir, 'run'), '--model', 'gpt-5.6-luna', '--lead-model', 'gpt-5.6-sol', ...extraArgs, ...(mode === 'basic' ? ['--basic-config', path.join(dir, 'basic.json')] : []), ...(['persistent', 'changed-session', 'compact-repeat'].includes(mode) ? ['--persistent-curator', '--compact-followup'] : []), ...(['citation', 'bad-citation'].includes(mode) ? ['--structured-citations'] : [])], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, PAGING_TEST_MODE: mode, PAGING_TEST_COUNTER: path.join(dir, 'counter') },
  })
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'run', 'report.json')))
  assert.equal(fs.readFileSync(path.join(vault, 'note.md'), 'utf8'), markdown)
  if (process.env.READER_FIXTURE_REPORT_DIR) {
    fs.mkdirSync(process.env.READER_FIXTURE_REPORT_DIR, { recursive: true })
    fs.writeFileSync(path.join(process.env.READER_FIXTURE_REPORT_DIR, mode + '.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
  }
  fs.rmSync(dir, { recursive: true, force: true })
  return { child, report }
}
test('curator mediation delivers verified original through actual CLI and gives lead only final brief', () => {
  const { child, report } = runFixture('valid')
  assert.equal(child.status, 0, child.stderr)
  assert.equal(report.runComplete, true)
  assert.equal(report.modelCalls.length, 3)
  assert.deepEqual(report.modelCalls.map(row => row.model), ['gpt-5.6-luna', 'gpt-5.6-luna', 'gpt-5.6-sol'])
  assert.deepEqual(report.sourceReads.map(row => row.path), ['note.md'])
  assert.equal(report.answer, 'Ada owns the fixture (note.md)')
  assert.equal(report.stopReason, 'curator-finalized')
})
test('isolated Basic Memory hybrid adapter preserves native content, mapped paths and indexed-source hashes', () => {
  const { child, report } = runFixture('basic')
  assert.equal(child.status, 0, child.stderr)
  assert.equal(report.runComplete, true)
  assert.equal(report.retrieval, 'basic-memory-hybrid')
  assert.deepEqual(report.pages[0].paths, ['note.md'])
  assert.equal(report.pages[0].toolOutputBytes > 0, true)
  assert.deepEqual(report.sourceReads.map(row => row.path), ['note.md'])
  assert.equal(report.sourceReads[0].indexedSha256, report.indexedSourceHashes['note.md'])
})
test('curator mediation rejects unsafe source paths and never reaches lead', () => {
  const { child, report } = runFixture('unsafe')
  assert.notEqual(child.status, 0)
  assert.equal(report.runComplete, false)
  assert.equal(report.modelCalls.length, 1)
  assert.equal(report.sourceReads.length, 0)
  assert.equal(report.answer, null)
  assert.match(report.stopReason, /Invalid.*unsafe/)
})
test('requesting another page after exhaustion gets explicit feedback and can still finish', () => {
  const { child, report } = runFixture('exhausted-next')
  assert.equal(child.status, 0, child.stderr)
  assert.equal(report.runComplete, true)
  assert.equal(report.pages.length, 1)
  assert.equal(report.modelCalls.length, 3)
  assert.deepEqual(report.sourceReads.map(row => row.path), ['note.md'])
})
test('persistent curator resumes its explicit session while lead stays fresh', () => {
  const { child, report } = runFixture('persistent')
  assert.equal(child.status, 0, child.stderr)
  assert.equal(report.runComplete, true)
  assert.deepEqual(report.modelCalls.map(row => row.sessionResumed), [false, true, false])
  assert.equal(report.persistentCurator, true)
  assert.equal(report.compactFollowup, true)
})
test('changed resumed session is counted as a failed call and never reaches lead', () => {
  const { child, report } = runFixture('changed-session')
  assert.notEqual(child.status, 0)
  assert.equal(report.runComplete, false)
  assert.equal(report.modelCalls.length, 2)
  assert.equal(report.modelCalls[1].failed, true)
  assert.equal(report.modelCalls[1].sessionIdentityFailed, true)
  assert.equal(report.answer, null)
})
test('structured citations accept verified brief source and reject unread provenance', () => {
  const valid = runFixture('citation')
  assert.equal(valid.child.status, 0, valid.child.stderr)
  assert.deepEqual(valid.report.citations, ['note.md'])
  assert.equal(valid.report.citationProvenanceValid, true)
  const invalid = runFixture('bad-citation')
  assert.notEqual(invalid.child.status, 0)
  assert.equal(invalid.report.runComplete, false)
  assert.match(invalid.report.stopReason, /citation provenance/)
})
test('coverage-preview option is passed through actual CLI and recorded', () => {
  const { child, report } = runFixture('valid', ['--coverage-previews', '--mode', 'auto'])
  assert.equal(child.status, 0, child.stderr)
  assert.equal(report.coveragePreviews, true)
  assert.equal(report.runComplete, true)
})

test('citation identity accepts Markdown extension omission and punctuation but rejects path substrings', () => {
  for (const mode of ['extensionless', 'punctuation']) {
    const valid = runFixture(mode, ['--structured-citations'])
    assert.equal(valid.child.status, 0, valid.child.stderr)
    assert.equal(valid.report.citationProvenanceValid, true)
  }
  for (const mode of ['prefix', 'suffix', 'differentExtension']) {
    const invalid = runFixture(mode, ['--structured-citations'])
    assert.notEqual(invalid.child.status, 0, mode)
    assert.match(invalid.report.stopReason, /citation provenance/)
  }
})

test('repeated originals are reused with feedback while mixed new originals are read once', () => {
  for (const mode of ['repeat', 'mixed-repeat', 'compact-repeat', 'repeat-next']) {
    const { child, report } = runFixture(mode)
    assert.equal(child.status, 0, child.stderr)
    assert.equal(report.runComplete, true)
    assert.equal(report.modelCalls.length, 4)
    assert.deepEqual(report.sourceRequests[1].reused, ['note.md'])
    assert.deepEqual(report.sourceRequests[1].new, mode === 'mixed-repeat' ? ['details.md'] : [])
    assert.deepEqual(report.sourceReads.map(row => row.path), mode === 'mixed-repeat' ? ['note.md', 'details.md'] : ['note.md'])
  }
})
test('duplicate paths within a request are read once and endless repeats hit the declared round budget', () => {
  const batch = runFixture('batch-duplicate')
  assert.equal(batch.child.status, 0, batch.child.stderr)
  assert.equal(batch.report.sourceReads.length, 1)
  assert.deepEqual(batch.report.sourceRequests[0].requested, ['note.md', 'note.md'])
  const endless = runFixture('repeat-forever', ['--max-rounds', '3'])
  assert.notEqual(endless.child.status, 0)
  assert.equal(endless.report.stopReason, 'round-budget')
  assert.equal(endless.report.modelCalls.length, 3)
  assert.equal(endless.report.sourceReads.length, 1)
  assert.equal(endless.report.answer, null)
})

test('unseen paths return explicit feedback and can recover without unauthorized reads', () => {
  const recovered = runFixture('recover-unseen')
  assert.equal(recovered.child.status, 0, recovered.child.stderr)
  assert.equal(recovered.report.runComplete, true)
  assert.equal(recovered.report.modelCalls.length, 4)
  assert.equal(recovered.report.pages.length, 1)
  assert.deepEqual(recovered.report.sourceReads.map(row => row.path), ['note.md'])
  assert.deepEqual(recovered.report.sourceRequestErrors[0].unseen, ['hidden-gold.md'])
  const mixed = runFixture('repeat-unseen')
  assert.equal(mixed.child.status, 0, mixed.child.stderr)
  assert.equal(mixed.report.sourceReads.length, 1)
  assert.equal(mixed.report.sourceRequests.length, 1)
  assert.deepEqual(mixed.report.sourceRequestErrors[0].rejectedRequest, ['note.md', 'hidden-gold.md'])
  const endless = runFixture('unseen-forever', ['--max-rounds', '3'])
  assert.notEqual(endless.child.status, 0)
  assert.equal(endless.report.stopReason, 'round-budget')
  assert.equal(endless.report.sourceRequestErrors.length, 3)
  assert.equal(endless.report.sourceReads.length, 0)
  assert.equal(endless.report.answer, null)
})

test('future-page request recovers by observing the real next page before reading its original', () => {
  const { child, report } = runFixture('future-page', ['--mode', 'auto', '--max-rounds', '5', '--structured-citations'])
  assert.equal(child.status, 0, child.stderr + JSON.stringify({ pages: report.pages, errors: report.sourceRequestErrors }))
  assert.equal(report.runComplete, true)
  assert.deepEqual(report.pages.map(page => page.offset), [0, 10])
  assert.equal(report.sourceRequestErrors.length, 1)
  assert.equal(report.sourceRequestErrors[0].nextPageRequested, true)
  assert.deepEqual(report.sourceReads.map(source => source.path), ['next-10.md'])
  assert.deepEqual(report.citations, ['next-10.md'])
  assert.equal(report.modelCalls.length, 5)
})
