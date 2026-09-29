#!/usr/bin/env python3
"""Controlled Codex curator pilot; source reads are mediated by this runner."""
import argparse, copy, json, pathlib, subprocess, time
parser = argparse.ArgumentParser()
parser.add_argument('--workspace', required=True)
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
for name, text in notes.items(): (w / 'vault' / name).write_text(text)
wrapper = f"""import {{ managedRecall }} from '{root}/src/decision-recall.mjs';
import {{ DEFAULT_RUNTIME_CONFIG }} from '{root}/src/runtime-config.mjs';
console.log(JSON.stringify(await managedRecall('./vault',process.argv[2],DEFAULT_RUNTIME_CONFIG,{{adaptiveBundle:true,matchedPreviews:true}})));
"""
(w / 'retrieve.mjs').write_text(wrapper)
questions = [('long', 'List all Orion recovery requirements'), ('split', 'Compare all Orion owners and deadlines'), ('conflict', 'Compare all Vega storage decisions and identify the resolved choice'), ('unknown', 'Who approved Orion deployment?'), ('temporal', 'Which Nova storage choice is current?'), ('negation', 'List all Orion deployment restrictions')]
schema = {'type':'object', 'properties':{'read_paths':{'type':'array','items':{'type':'string'}},'answer':{'type':'string'}}, 'required':['read_paths','answer'], 'additionalProperties':False}
(w / 'schema.json').write_text(json.dumps(schema))
instruction = '''Act as a memory curator. Do not use tools or shell. This runner provides retrieval and reads requested source notes for you. Return JSON with read_paths and answer. Request all original note paths needed for a supported complete answer. If evidence is sufficient, leave read_paths empty and answer with exact source paths. sourceReadRequired means inspect original; truncated means preview is incomplete. Never infer missing facts. A preview does not guarantee complete evidence. You have one source-read batch, so request every needed path together. If requesting sources, leave answer empty until they are supplied.'''

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
for i, (qid, question) in enumerate(questions):
 retrieval = json.loads(subprocess.check_output(['node',str(w/'retrieve.mjs'),question],cwd=w,text=True))
 for arm in (['control','flags'] if i % 2 == 0 else ['flags','control']):
  evidence = copy.deepcopy(retrieval)
  if arm=='control':
   for result in evidence['results']:
    result.pop('sourceReadRequired',None)
    for preview in result.get('evidencePreview',[]): preview.pop('truncated',None)
  prompt = instruction+'\nQuestion: '+question+'\nRetrieval: '+json.dumps(evidence)
  start = time.monotonic()
  first, usage = call(prompt,qid+'-'+arm+'-triage')
  paths = first['read_paths']
  if any(not isinstance(name,str) or name not in notes for name in paths): raise RuntimeError('Invalid source request')
  paths = list(dict.fromkeys(paths))
  usages = [usage]
  answer = first['answer']
  if paths:
   final, usage = call(prompt+'\nYour source request: '+json.dumps(paths)+'\nOriginal sources: '+json.dumps({name:(w/'vault'/name).read_text() for name in paths})+'\nNow answer from provided evidence. No more reads; read_paths must be empty.',qid+'-'+arm+'-answer')
   if final['read_paths']: raise RuntimeError('Additional reads requested; protocol failure')
   answer = final['answer']; usages.append(usage)
  if not answer.strip(): raise RuntimeError('Missing answer')
  if any((w/'vault'/name).read_text()!=text for name,text in notes.items()): raise RuntimeError('Vault changed')
  rows.append({'id':qid,'arm':arm,'elapsedSeconds':round(time.monotonic()-start,2),'usage':{key:sum(u.get(key,0) for u in usages) for key in usages[0]},'answer':answer,'readPaths':paths,'modelCalls':len(usages),'vaultUnchanged':True})
  (w/'results.json').write_text(json.dumps(rows,indent=2)+'\n')
  print(qid,arm,len(usages),round(time.monotonic()-start,1),flush=True)
