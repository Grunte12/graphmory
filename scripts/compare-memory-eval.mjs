#!/usr/bin/env node
import fs from 'node:fs'
const [file, candidate='bm25', baseline='baseline', out] = process.argv.slice(2)
if (!file) throw new Error('Usage: compare-memory-eval.mjs <report> [candidate] [baseline] [output]')
const report=JSON.parse(fs.readFileSync(file,'utf8'))
const get=arm=>{const rows=report.runs.filter(r=>r.arm===arm); const map=new Map(rows.map(r=>[r.id,r]));if(rows.length!==map.size||!rows.length)throw new Error('Duplicate or missing runs');return map}
const a=get(candidate), b=get(baseline)
if(a.size!==b.size||[...a.keys()].some(id=>!b.has(id)))throw new Error('Unpaired arms')
let seed=261026
const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296}
const metrics={}
for(const key of ['completeAt3','completeAt12','recallAt3','recallAt12']) {
 const groups=new Map();let wins=0,losses=0,ties=0,sum=0,n=0
 for(const [id,x] of a){const y=b.get(id);if(x[key]===null&&y[key]===null)continue
  if(x[key]===null||y[key]===null||!Number.isFinite(Number(x[key]))||!Number.isFinite(Number(y[key])))throw new Error('Missing paired metric')
  const d=Number(x[key])-Number(y[key]);sum+=d;n++;if(d>0)wins++;else if(d<0)losses++;else ties++
  const family=id.replace(/_abs$/u,'');if(!groups.has(family))groups.set(family,[]);groups.get(family).push(d)
 }
 const clusters=[...groups.values()],boot=[]
 if(!n)throw new Error('No answerable pairs')
 for(let i=0;i<10000;i++){let total=0,count=0;for(let j=0;j<clusters.length;j++){const group=clusters[Math.floor(random()*clusters.length)];total+=group.reduce((x,y)=>x+y,0);count+=group.length}boot.push(total/count)}
 boot.sort((x,y)=>x-y)
 metrics[key]={pairs:n,families:clusters.length,wins,losses,ties,delta:sum/n,interval95:[boot[249],boot[9749]]}
}
const result={candidate,baseline,split:report.split,dataset:report.dataset,sourceSha256:report.sourceSha256,
 method:'Paired family-cluster percentile bootstrap, 10000 resamples; conditional on this selected sample, not proof of universal superiority.',metrics}
if(out)fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result,null,2))
