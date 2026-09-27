#!/usr/bin/env node
import fs from "node:fs"
import { prepareConversation, evidenceMetrics, digest } from "./lib/locomo.mjs"
import { parseMarkdown, governedRank } from "../src/retrieval.mjs"
import { fuseRankedLanes } from "../src/memory-recall.mjs"
const args = process.argv.slice(2)
const option = (name) => args[args.indexOf(name)+1]
for (const flag of ["--input","--out","--revision"]) if (!args.includes(flag)) throw new Error(`Missing ${flag}`)
const revision=option("--revision")
if(!/^[a-f0-9]{40}$/u.test(revision)) throw new Error("Dataset commit SHA required")
const bytes=fs.readFileSync(option("--input")), items=JSON.parse(bytes)
if(revision!=="3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376" || digest(bytes)!=="79fa87e90f04081343b8c8debecb80a9a6842b76a7aa537dc9fdf651ea698ff4") throw new Error("Pinned official dataset revision/hash mismatch; define a new experiment for other data")
if(!Array.isArray(items)||items.length!==10||new Set(items.map((i)=>i.sample_id)).size!==10) throw new Error("Expected official ten distinct conversations")
const ordered=[...items].sort((a,b)=>digest("graphmory-locomo-v1:"+a.sample_id).localeCompare(digest("graphmory-locomo-v1:"+b.sample_id)))
const development=ordered.slice(0,7), holdout=ordered.slice(7).map((i)=>i.sample_id)
const runs=[],excluded=[]
for(const item of development) {
  const prepared=prepareConversation(item)
  const documents=prepared.documents.map((doc)=>parseMarkdown(doc.path,doc.markdown))
  for(const question of prepared.questions) {
    if(question.category===5||question.unresolved.length||!question.evidence.length) {
      excluded.push({id:question.id,category:question.category,reason:question.category===5?"adversarial-answer-eval-needed":question.unresolved.length?"unresolved-gold-turn":"missing-evidence"})
      continue
    }
    const sparse=governedRank(documents,question.query,"bm25").results
    const focused=governedRank(documents,question.query,"bm25f-focused-sections").results
    for(const [arm, ranked] of [["bm25",sparse],["fusion",fuseRankedLanes([{method:"bm25",results:sparse},{method:"bm25f-focused-sections",results:focused}])]]) {
      const paths=ranked.map((doc)=>doc.id)
      runs.push({id:question.id,category:question.category,arm,evidenceNotes:question.evidence.length,goldTurns:question.goldTurns,captionInGoldSession:question.captionInGoldSession,
        at5:evidenceMetrics(paths,question.evidence,5),at10:evidenceMetrics(paths,question.evidence,10),at20:evidenceMetrics(paths,question.evidence,20),
        reachable:evidenceMetrics(paths,question.evidence,paths.length),rankedPaths:paths})
    }
  }
}
const summary={}
for(const arm of ["bm25","fusion"]) {
  const rows=runs.filter((r)=>r.arm===arm)
  const summarize=(group)=>Object.fromEntries(["at5","at10","at20","reachable"].map((key)=>[key,{meanRecall:group.reduce((s,r)=>s+r[key].recall,0)/group.length,complete:group.filter((r)=>r[key].complete).length,cases:group.length}]))
  summary[arm]={all:summarize(rows),categories:Object.fromEntries([1,2,3,4].map((category)=>[category,summarize(rows.filter((r)=>r.category===category))]))}
}
const report={dataset:"snap-research/locomo",revision,sourceSha256:digest(bytes),protocol:"session-retrieval-development-v1",development:development.map((i)=>i.sample_id),holdoutNotEvaluated:holdout,
  runtimeHashes:Object.fromEntries(["src/retrieval.mjs","src/memory-recall.mjs","scripts/lib/locomo.mjs","scripts/eval-locomo.mjs"].map((file)=>[file,digest(fs.readFileSync(file))])),
  adaptation:"One Markdown per session; verbatim turn text, speakers, dialog IDs, timestamp and supplied BLIP captions. No QA answers, generated observations or summaries in retrieval.",
  limitations:["Session-level evidence recall is not official QA F1 or answer accuracy.","Caption-marked sessions do not prove image availability or multimodal correctness.","Adversarial questions require reader evaluation; candidate counts cannot measure abstention.","Development results may guide optimization; three conversation holdouts remain unevaluated."],excluded,summary,runs}
fs.writeFileSync(option("--out"),JSON.stringify(report,null,2)+"\n")
console.log(JSON.stringify({development:report.development,holdout:report.holdoutNotEvaluated,excluded:excluded.length,summary},null,2))
