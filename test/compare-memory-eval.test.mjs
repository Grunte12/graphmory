import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import assert from 'node:assert/strict'
import test from 'node:test'
const run=report=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'graphmory-pairs-'))
 try{const input=path.join(dir,'report.json');fs.writeFileSync(input,JSON.stringify(report))
 return spawnSync(process.execPath,['scripts/compare-memory-eval.mjs',input],{encoding:'utf8'})
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
const row=(id,arm,score)=>({id,arm,completeAt3:score,completeAt12:score,recallAt3:score,recallAt12:score})
test('paired comparison counts wins/losses and preserves no-answer exclusion',()=>{
 const result=run({runs:[row('a','bm25',1),row('a','baseline',0),row('b','bm25',0),row('b','baseline',1),row('c_abs','bm25',null),row('c_abs','baseline',null)]})
 assert.equal(result.status,0,result.stderr)
 const value=JSON.parse(result.stdout).metrics.completeAt3
 assert.deepEqual({pairs:value.pairs,wins:value.wins,losses:value.losses,delta:value.delta},{pairs:2,wins:1,losses:1,delta:0})
 assert.ok(value.interval95[0]<=0&&value.interval95[1]>=0)
})
test('missing, duplicate or nonfinite paired outcomes cannot silently disappear',()=>{
 for(const runs of [[row('a','bm25',1),row('b','baseline',0)],
  [row('a','bm25',1),row('a','bm25',0),row('a','baseline',0)],
  [{...row('a','bm25',1),completeAt3:undefined},row('a','baseline',0)]])assert.notEqual(run({runs}).status,0)
})
