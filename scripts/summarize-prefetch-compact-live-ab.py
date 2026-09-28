#!/usr/bin/env python3
"""Validate four frozen live trials and score answers with pinned LoCoMo QA functions."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

p = argparse.ArgumentParser()
for name in ('prepared', 'runs', 'scorer-source', 'out'): p.add_argument('--' + name, required=True)
a = p.parse_args()
prepared, runs, out = [pathlib.Path(value).resolve() for value in (a.prepared, a.runs, a.out)]
if out.exists(): raise RuntimeError('Preserve prior summary')
root = pathlib.Path(__file__).resolve().parents[1]
manifest_bytes = (prepared/'manifest.json').read_bytes()
m = json.loads(manifest_bytes)
ledger = json.loads((runs/'ledger.json').read_text())
if m['protocol'] != 'prefetch-compact-live-development-ab-v1' or ledger['manifestSha256'] != hashlib.sha256(manifest_bytes).hexdigest():
    raise RuntimeError('Manifest/protocol drift')
if hashlib.sha256(pathlib.Path(a.scorer_source).read_bytes()).hexdigest() != m['scorerSourceSha256']:
    raise RuntimeError('Pinned scorer drift')
attempts = ledger['attempts']
if len(attempts) < m['plannedTrials'] and not ledger['stopped']: raise RuntimeError('Pending slots cannot be scored')
if len(attempts) > m['plannedTrials'] or [row['index'] for row in attempts] != list(range(len(attempts))):
    raise RuntimeError('Duplicate/unknown/reordered attempt')
labels = []
for case in m['cases']:
    folder = prepared/str(case['caseIndex'])
    if hashlib.sha256((folder/'reader-input.json').read_bytes()).hexdigest() != case['readerSha256'] or hashlib.sha256((folder/'labels.json').read_bytes()).hexdigest() != case['labelsSha256']:
        raise RuntimeError('Case input or labels changed')
    label = json.loads((folder/'labels.json').read_text())[0]
    if label['id'] != case['id']: raise RuntimeError('Label identity drift')
    labels.append(label)
rows, predictions, score_labels = [], [], []
for index, trial in enumerate(m['executionOrder']):
    case = m['cases'][trial['caseIndex']]
    if trial['id'] != case['id'] or trial['arm'] not in ('full', 'compact'): raise RuntimeError('Frozen trial invalid')
    attempt = attempts[index] if index < len(attempts) else None
    report = None
    if attempt:
        if any(attempt[key] != trial[key] for key in trial): raise RuntimeError('Treatment/order drift')
        if attempt['report']:
            file = (runs/attempt['report']).resolve()
            if not file.is_relative_to(runs): raise RuntimeError('Unsafe report path')
            report = json.loads(file.read_text())
            c = m['configuration']
            if report['id'] != trial['id'] or report['inputSha256'] != case['readerSha256'] or report['runnerSha256'] != m['sourceHashes']['scripts/run-curator-paging-pilot.py']:
                raise RuntimeError('Runner identity/runtime drift')
            if report['model'] != c['curator'] or report['leadModel'] != c['lead'] or report['prefetchWideOriginals'] is not True or report['compactPrefetch'] != (trial['arm']=='compact'):
                raise RuntimeError('Model/treatment drift')
            if any(report[key] != c[key] for key in ('mode','maxRounds','maxInputBytes','structuredCitations','persistentCurator')):
                raise RuntimeError('Runner config drift')
            if report['retrieval'] != 'graphmory-managed': raise RuntimeError('Wrong retrieval tool')
            if report['prefetch'] is None or report['prefetch']['status'] != 'ready': raise RuntimeError('Expected full original prefetch')
            if (report['prefetch'].get('presentation') == 'originals-only') != (trial['arm']=='compact'):
                raise RuntimeError('Presentation drift')
    calls = report['modelCalls'] if report else []
    reads = report['sourceReads'] if report else []
    if report:
        if {row['path'] for row in reads} != set(case['originalHashes']) or any(row.get('transport') != 'recall-prefetch' for row in reads):
            raise RuntimeError('Missing, duplicate or wrong original transport')
        for source in reads:
            if source['sha256'] != case['originalHashes'][source['path']]: raise RuntimeError('Original source drift')
    usage = {key:sum((call.get('usage') or {}).get(key,0) for call in calls) for key in ('input_tokens','cached_input_tokens','output_tokens','reasoning_output_tokens')}
    complete = bool(report and report['runComplete'] and attempt['exitCode']==0)
    rows.append({'id':trial['id'],'arm':trial['arm'],'index':index,'attempted':bool(attempt and attempt['attempted']),
        'complete':complete,'stopReason':report['stopReason'] if report else attempt['stopReason'] if attempt else 'unattempted-host-stop',
        'answer':report['answer'] if report else None,'brief':report['brief'] if report else None,
        'citations':report['citations'] if report else None,'citationIdentityValid':report['citationProvenanceValid'] if report else None,
        'originalReads':len(reads),'goldOriginalsRead':len(set(row['path'] for row in reads).intersection(labels[trial['caseIndex']]['goldPaths'])),
        'goldOriginals':len(labels[trial['caseIndex']]['goldPaths']), 'elapsedSeconds':report['elapsedSeconds'] if report else None,
        'modelCalls':len(calls),'observedUsage':usage,'usageFullyObserved':bool(calls) and all(call.get('usage') is not None for call in calls),
        'cliOutputBytes':sum(page['toolOutputBytes'] for page in report['pages']) if report else None})
    score_id = trial['id']+':'+str(index)
    predictions.append({'id':score_id,'prediction':(report['answer'] or '') if report else ''})
    score_labels.append({**labels[trial['caseIndex']],'id':score_id})
out.mkdir(parents=True)
(out/'predictions.json').write_text(json.dumps(predictions))
(out/'labels.json').write_text(json.dumps(score_labels))
subprocess.run([sys.executable,str(root/'scripts/eval-locomo-official-qa.py'),'--source',a.scorer_source,
    '--predictions',str(out/'predictions.json'),'--labels',str(out/'labels.json'),'--out',str(out/'raw-scores.json')],check=True)
scores = json.loads((out/'raw-scores.json').read_text())['scores']
if [score['id'] for score in scores] != [row['id'] for row in predictions]: raise RuntimeError('Score identity drift')
for row, score in zip(rows,scores):
    row['rawQaF1']=score['rawQaF1']
    row['operationalAdjustedQaF1']=row['rawQaF1'] if row['complete'] else 0.0
result={'protocol':m['protocol'],'manifestSha256':ledger['manifestSha256'],'rows':rows,
        'semanticReview':'pending source-blind assessment; official QA score is not evidence support',
        'limits':['Two exposed development histories','One generation per arm','Order/cache effects','No billing or p95 estimate']}
(out/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps([{'id':r['id'],'arm':r['arm'],'complete':r['complete'],'answer':r['answer'],
                   'rawQaF1':r['rawQaF1'],'seconds':r['elapsedSeconds']} for r in rows],indent=2))
