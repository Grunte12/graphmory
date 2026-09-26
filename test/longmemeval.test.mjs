import assert from 'node:assert/strict'
import test from 'node:test'
import { benchmarkDate, prepareCase, selectCases, validateCase } from '../scripts/lib/longmemeval.mjs'
const fixture = () => ({question_id:'q1',question_type:'multi-session',question:'Where?',question_date:'2024/02/03 (Sat) 12:00',answer:'SECRET_LABEL',
  haystack_session_ids:['later','earlier'],haystack_dates:['2024/02/02 (Fri) 12:00','2024/02/01 (Thu) 12:00'],
  haystack_sessions:[[{role:'user',content:'Latest fact',has_answer:true,answer:'SECRET_LABEL'}],[{role:'assistant',content:'Earlier fact'}]],answer_session_ids:['later']})
test('chronology, source content and evaluator labels are separated',()=>{
 const r=prepareCase(fixture())
 assert.equal(r.documents[0].session.turns[0].content,'Earlier fact')
 assert.equal(r.documents[1].session.turns[0].content,'Latest fact')
 assert.ok(!JSON.stringify(r.documents).includes('SECRET_LABEL'))
 assert.ok(!JSON.stringify(r.documents).includes('has_answer'))
 assert.deepEqual(r.labels.evidence,[[r.documents[1].path]])
 assert.equal(r.labels.answer,'SECRET_LABEL')
})
test('malformed dates, future history, mismatched arrays and missing gold fail',()=>{
 assert.throws(()=>benchmarkDate('2024/02/31 (Sat) 12:00'),/calendar/)
 for (const mutate of [x=>x.haystack_dates[0]='2025/02/01 (Sat) 12:00',x=>x.haystack_dates.pop(),x=>x.answer_session_ids=['missing']]) {
  const x=fixture();mutate(x);assert.throws(()=>validateCase(x, {strictTime:true}))
 }
})
test('duplicate session IDs preserve occurrences and group evidence alternatives',()=>{
 const x=fixture();x.haystack_session_ids=['same','same'];x.answer_session_ids=['same']
 const r=prepareCase(x)
 assert.equal(r.documents.length,2)
 assert.equal(r.labels.evidence[0].length,2)
 assert.equal(r.labels.duplicateSessionIds,1)
})
test('selection is independent of input order and abstention is stratified',()=>{
 const inputs=Array.from({length:8},(_,i)=>({...fixture(),question_id:`q${i}${i>5?'_abs':''}`}))
 assert.deepEqual(selectCases(inputs).map(x=>x.question_id),selectCases([...inputs].reverse()).map(x=>x.question_id))
 assert.equal(selectCases(inputs).filter(x=>x.question_id.endsWith('_abs')).length,2)
 assert.throws(()=>selectCases([inputs[0],inputs[0]]),/Duplicate question/)
})

test('upstream exporter verifies source identity and removes gold labels', async()=>{
 const {hash}=await import('../scripts/lib/longmemeval.mjs')
 const {exportGenerationEntries}=await import('../scripts/lib/longmemeval-export.mjs')
 const item=fixture(),bytes=Buffer.from(JSON.stringify([item])),prepared=prepareCase(item)
 const report={sourceSha256:hash(bytes),runs:[{id:item.question_id,arm:'bm25',selectedSessionPaths:[prepared.documents[1].path]}]}
 const rows=exportGenerationEntries([item],report,'bm25',bytes)
 assert.equal(rows[0].retrieval_results.ranked_items[0].corpus_id,prepared.documents[1].path)
 assert.equal(rows[0].answer,'')
 assert.ok(!JSON.stringify(rows).includes('SECRET_LABEL'))
 assert.ok(!JSON.stringify(rows).includes('has_answer'))
 assert.throws(()=>exportGenerationEntries([item],report,'bm25',Buffer.from('other')),/hash/)
 report.runs[0].selectedSessionPaths=['invented.md']
 assert.throws(()=>exportGenerationEntries([item],report,'bm25',bytes),/Invalid retrieval/)
})
