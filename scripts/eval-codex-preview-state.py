#!/usr/bin/env python3
"""Controlled Codex curator pilot; source reads are mediated by this runner."""
import argparse, json, pathlib, subprocess, time
parser = argparse.ArgumentParser()
parser.add_argument('--workspace', required=True)
parser.add_argument('--start-index', type=int, default=0, choices=range(8))
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parents[1]
w = pathlib.Path(args.workspace).resolve()
if w.exists(): raise RuntimeError('Use a new workspace; preserve prior trials')
(w / 'vault').mkdir(parents=True)
notes = {
 'recovery.md': '# Orion recovery\nOrion recovery requirements. ' + 'Operational context. ' * 150 + 'The required procedure is to restore encrypted backup.',
 'owner.md': '# Orion owners\nOrion owner is Mira.',
 'deadline.md': '# Orion deadlines\nOrion deadline is October 12.',
 'unresolved-a.md': '# Vega storage\nVega storage uses SQLite. Decision recorded March 2025. No resolution recorded.',
 'unresolved-b.md': '# Vega storage\nVega storage uses PostgreSQL. Decision recorded March 2025. No resolution recorded.',
 'approval.md': '# Orion deployment\nOrion deployment needs approval. The approver has not been recorded.',
 'old.md': '# Nova storage\nNova storage used SQLite in January 2025.',
 'new.md': '# Nova storage\nNova storage uses PostgreSQL from March 2025, explicitly replacing the January SQLite decision.',
 'policy.md': '# Orion restrictions\nOrion deployment must NOT run on Friday. Approval is required.',
}

wrapper = f"""import {{ managedRecall }} from '{root}/src/decision-recall.mjs';
import {{ DEFAULT_RUNTIME_CONFIG }} from '{root}/src/runtime-config.mjs';
console.log(JSON.stringify(await managedRecall('./vault',process.argv[2],DEFAULT_RUNTIME_CONFIG,process.argv[4]==='small-page'?{{k:2,evidencePreview:true,offset:Number(process.argv[3]??0)}}:{{adaptiveBundle:true,matchedPreviews:true,offset:Number(process.argv[3]??0)}})));
"""
(w / 'retrieve.mjs').write_text(wrapper)
questions = [('paraphrase', 'Compare all Cedar owners and deadlines'), ('later-page', 'What is the Rowan recovery key?'), ('long', 'List all Orion recovery requirements'), ('split', 'Compare all Orion owners and deadlines'), ('conflict', 'Compare all Vega storage decisions and identify the resolved choice'), ('unknown', 'Who approved Orion deployment?'), ('temporal', 'Which Nova storage choice is current?'), ('negation', 'List all Orion deployment restrictions')]
schema = {'type':'object', 'properties':{'read_paths':{'type':'array','items':{'type':'string'}},'next_offset':{'type':['integer','null']},'answer':{'type':'string'}}, 'required':['read_paths','next_offset','answer'], 'additionalProperties':False}
(w / 'schema.json').write_text(json.dumps(schema))
instruction = """Act as a memory curator. Do not use tools or shell. This runner supplies retrieval and reads requested source notes. Return JSON with read_paths, next_offset, answer. Request original paths needed for a supported complete answer. To fetch the next page, set next_offset to the latest retrieval nextOffset. If evidence is sufficient, leave read_paths empty and next_offset null, and answer with exact source paths. sourceReadRequired means inspect original; truncated means preview is incomplete. previewOmitted means no preview selected, not irrelevant. Never infer missing facts. A preview does not guarantee complete evidence. When requesting sources or another page, leave answer empty until supplied. All evidence in this experiment is reachable using source reads and pagination."""
gold = {
 'paraphrase': (['Anika', 'November 9'], ['responsibility.md','schedule.md']),
 'later-page': (['sapphire'], ['z-final.md']),
 'long': (['encrypted backup'], ['recovery.md']),
 'split': (['Mira','October 12'], ['owner.md','deadline.md']),
 'conflict': (['SQLite','PostgreSQL'], ['unresolved-a.md','unresolved-b.md']),
 'unknown': ([], ['approval.md']),
 'temporal': (['PostgreSQL'], ['new.md']),
 'negation': (['Friday','approval'], ['policy.md']),
}

def call(prompt, trace):
 p = subprocess.run(['codex','exec','--ignore-user-config','--ephemeral','--skip-git-repo-check','-C',str(w),'-s','read-only','-m','gpt-5.6-luna','-c','model_reasoning_effort="low"','--output-schema',str(w/'schema.json'),'--json','-'],input=prompt,capture_output=True,text=True,timeout=120)
 (w / (trace+'.jsonl')).write_text(p.stdout)
 (w / (trace+'.stderr')).write_text(p.stderr)
 events = [json.loads(line) for line in p.stdout.splitlines() if line.startswith('{')]
 texts = [e['item']['text'] for e in events if e.get('type')=='item.completed' and e.get('item',{}).get('type')=='agent_message']
 usage = next((e.get('usage') for e in events if e.get('type')=='turn.completed'), None)
 if p.returncode or not usage or not texts: raise RuntimeError('Incomplete trial; preserve traces')
 value = json.loads(texts[-1])
 if set(value)!=set(schema['required']) or not isinstance(value['read_paths'],list) or not isinstance(value['answer'],str): raise RuntimeError('Invalid response')
 return value, usage

rows = []
stop = None
for repeat in range(2):
 for i, (qid, question) in enumerate(questions):
  if repeat==0 and i<args.start_index: continue
  fixture = notes if qid not in ['paraphrase','later-page'] else (
   {'responsibility.md':'# Cedar responsibility\nCedar is maintained by Anika.', 'schedule.md':'# Cedar schedule\nCedar handoff is due November 9.'} if qid=='paraphrase' else
   {**{f'context-{j}.md':f'# Rowan recovery key context unique{j}\nRowan recovery key notes: no access value recorded in this note.' for j in range(24)}, 'z-final.md':'# Rowan recovery appendix\nRowan recovery secret is sapphire.'})
  for file in (w/'vault').iterdir(): file.unlink()
  for name,text in fixture.items(): (w/'vault'/name).write_text(text)
  def retrieve(offset, arm):
   evidence=json.loads(subprocess.check_output(['node',str(w/'retrieve.mjs'),question,str(offset),*(['small-page'] if qid=='later-page' else [])],cwd=w,text=True))
   if arm=='old':
    for result in evidence['results']:
     if result.pop('previewOmitted',False): result['sourceReadRequired']=True
   return evidence
  initial = retrieve(0,'new')
  if qid=='later-page':
   if any(x['path']=='z-final.md' for x in initial['results']) or not initial['hasMore']: raise RuntimeError('Later-page fixture not adversarial')
  for arm in (['old','new'] if (i+repeat)%2==0 else ['new','old']):
   evidence=retrieve(0,arm)
   prompt=instruction+'\nQuestion: '+question+'\nRetrieval: '+json.dumps(evidence)
   start=time.monotonic(); usages=[]; paths=[]; offsets=[0]; answer=''
   for turn in range(6):
    value,usage=call(prompt,f'{qid}-{arm}-{repeat}-{turn}')
    usages.append(usage)
    requested=value['read_paths']; next_offset=value['next_offset']
    if any(not isinstance(name,str) or name not in fixture for name in requested): raise RuntimeError('Invalid source request')
    if not requested and next_offset is None:
     answer=value['answer']; break
    if value['answer']: raise RuntimeError('Answer while evidence request pending')
    paths.extend(requested)
    prompt+='\nCurator request: '+json.dumps(value)
    if requested: prompt+='\nOriginal sources: '+json.dumps({name:(w/'vault'/name).read_text() for name in requested})
    if next_offset is not None:
     if not evidence['hasMore'] or next_offset!=evidence['nextOffset']: raise RuntimeError('Invalid continuation')
     offsets.append(next_offset); evidence=retrieve(next_offset,arm)
     prompt+='\nRetrieval: '+json.dumps(evidence)
   if not answer.strip(): raise RuntimeError('Missing final answer or six-round protocol exhausted')
   if any((w/'vault'/name).read_text()!=text for name,text in fixture.items()): raise RuntimeError('Vault changed')
   needles,sources=gold[qid]
   screen=all(n.lower() in answer.lower() for n in needles+sources)
   rows.append({'id':qid,'arm':arm,'repeat':repeat,'elapsedSeconds':round(time.monotonic()-start,2),'usage':{key:sum(u.get(key,0) for u in usages) for key in usages[0]},'answer':answer,'readPaths':list(dict.fromkeys(paths)),'offsets':offsets,'modelCalls':len(usages),'vaultUnchanged':True,'literalGoldScreen':screen})
   (w/'results.json').write_text(json.dumps({'rows':rows,'stop':stop},indent=2)+'\n')
   print(qid,arm,repeat,len(usages),round(time.monotonic()-start,1),screen,flush=True)
  old,new=next(x for x in rows if x['id']==qid and x['repeat']==repeat and x['arm']=='old'),next(x for x in rows if x['id']==qid and x['repeat']==repeat and x['arm']=='new')
  if old['literalGoldScreen'] and not new['literalGoldScreen']:
   stop='Treatment lost gold fact/source found by control: '+qid
   (w/'results.json').write_text(json.dumps({'rows':rows,'stop':stop},indent=2)+'\n')
   print(stop,flush=True); break
 if stop: break
