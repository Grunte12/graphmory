import test from "node:test"
import assert from "node:assert/strict"
import { prepareConversation, evidenceMetrics } from "../scripts/lib/locomo.mjs"
test("LoCoMo adapter preserves source text and separates labels from retrieval",()=>{
  const item={sample_id:"synthetic",conversation:{session_1_date_time:"1 May 2023",session_1:[
    {dia_id:"D1:1",speaker:"A",text:"Do NOT deploy Friday."},
    {dia_id:"D1:2",speaker:"B",text:"Owner is Mira.",blip_caption:"A red calendar"}],
    session_2_date_time:"2 May 2023",session_2:[{dia_id:"D2:1",speaker:"A",text:"Deadline is Sunday."}]},
    qa:[{question:"Owner and deadline?",answer:"SECRET_GOLD",category:1,evidence:["D1:1","D1:2","D2:1"]},
      {question:"Unknown?",answer:"SECRET_GOLD",category:4,evidence:["D9:9"]}]}
  const prepared=prepareConversation(item)
  assert.equal(prepared.documents.length,2)
  assert.match(prepared.documents[0].markdown,/Do NOT deploy Friday\./u)
  assert.match(prepared.documents[0].markdown,/Image caption: A red calendar/u)
  assert.ok(!JSON.stringify(prepared.documents).includes("SECRET_GOLD"))
  assert.ok(!JSON.stringify(prepared.documents).includes("Owner and deadline?"))
  assert.deepEqual(prepared.questions[0].evidence,["session_1.md","session_2.md"])
  assert.deepEqual(prepared.questions[1].unresolved,["D9:9"])
  assert.deepEqual(evidenceMetrics(["session_1.md"],prepared.questions[0].evidence,5),{recall:.5,complete:false})
  assert.equal(evidenceMetrics([],[],10),null)
  item.conversation.session_2[0].dia_id="D1:1"
  assert.throws(()=>prepareConversation(item),/Duplicate turn/u)
})
