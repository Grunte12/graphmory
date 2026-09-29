#!/usr/bin/env python3
"""Score frozen session trials and independently audit resumed thread identities."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

p = argparse.ArgumentParser()
for name in ['prepared', 'runs', 'scorer-source', 'out']: p.add_argument('--' + name, required=True)
a = p.parse_args()
prepared, runs, out = map(lambda value: pathlib.Path(value).resolve(), [a.prepared, a.runs, a.out])
if out.exists(): raise RuntimeError('Preserve prior score artifacts')
root = pathlib.Path(__file__).resolve().parents[1]
manifest_bytes = (prepared / 'manifest.json').read_bytes()
m = json.loads(manifest_bytes)
ledger = json.loads((runs / 'ledger.json').read_text())
if ledger['manifestSha256'] != hashlib.sha256(manifest_bytes).hexdigest(): raise RuntimeError('Manifest drift')
attempts = ledger['attempts']
if len(attempts) < m['plannedTrials'] and not ledger['stopped']: raise RuntimeError('Pending trials cannot be scored')
if len({row['index'] for row in attempts}) != len(attempts): raise RuntimeError('Duplicate attempt')
if [row['index'] for row in attempts] != list(range(len(attempts))) or len(attempts) > m['plannedTrials']:
    raise RuntimeError('Unknown or unordered attempt')
label_bytes = (prepared / 'labels.json').read_bytes()
if hashlib.sha256(label_bytes).hexdigest() != m['labelsSha256']: raise RuntimeError('Label drift')
gold = json.loads(label_bytes)[0]
rows = []
for index, trial in enumerate(m['executionOrder']):
    attempt = next((row for row in attempts if row['index'] == index), None)
    report = None
    if attempt:
        if any(attempt[key] != trial[key] for key in ['tool', 'persistent']): raise RuntimeError('Treatment drift')
        if attempt['report']:
            file = (runs / attempt['report']).resolve()
            if not file.is_relative_to(runs): raise RuntimeError('Unsafe report path')
            report = json.loads(file.read_text())
            if report['inputSha256'] != m['inputSha256'] or report['runnerSha256'] != m['sourceHashes']['scripts/run-curator-paging-pilot.py']:
                raise RuntimeError('Reader or runner drift')
            if report['persistentCurator'] != trial['persistent'] or report['compactFollowup']:
                raise RuntimeError('Session/rendering drift')
    calls = report['modelCalls'] if report else []
    reads = report['sourceReads'] if report else []
    threads = attempt.get('curatorThreads', []) if attempt else []
    hashes = [row['threadSha256'] for row in threads]
    identity_valid = bool(threads) and all(hashes) and (len(set(hashes)) == 1 if trial['persistent'] else len(set(hashes)) == len(hashes))
    if threads:
        identity_valid = identity_valid and all(row['reportedResumed'] == (trial['persistent'] and n > 0) for n, row in enumerate(threads))
    usage = {key: sum((call.get('usage') or {}).get(key, 0) for call in calls) for key in ['input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'output_tokens', 'reasoning_output_tokens']}
    rows.append(dict(trial, index=index, scheduledEntryRecorded=attempt is not None,
        attempted=bool(attempt and attempt.get('exitCode') is not None),
        complete=bool(report and report['runComplete'] and attempt.get('exitCode') == 0),
        stopReason=report['stopReason'] if report else attempt['stopReason'] if attempt else 'unattempted-host-stop',
        answer=report['answer'] if report else None, brief=report['brief'] if report else None,
        citations=report.get('citations') if report else None, citationIdentityValid=report.get('citationProvenanceValid') if report else None,
        curatorThreads=threads, threadIdentityValid=bool(identity_valid),
        modelCalls=calls, pages=report['pages'] if report else [], sourceReads=reads,
        observedUsage=usage, usageFullyObserved=bool(calls) and all(call.get('usage') is not None for call in calls),
        elapsedSeconds=report.get('elapsedSeconds') if report else None,
        goldNotesRead=len(set(row['path'] for row in reads).intersection(gold['goldPaths'])), goldNotes=len(gold['goldPaths'])))
out.mkdir(parents=True)
predictions = [{'id': m['id'] + ':' + str(row['index']), 'prediction': row['answer'] or ''} for row in rows]
labels = [{**gold, 'id': row['id']} for row in predictions]
pred_file, label_file, score_file = out / 'predictions.json', out / 'labels.json', out / 'raw-scores.json'
pred_file.write_text(json.dumps(predictions)); label_file.write_text(json.dumps(labels))
subprocess.run([sys.executable, str(root / 'scripts/eval-locomo-official-qa.py'), '--source', a.scorer_source,
    '--predictions', str(pred_file), '--labels', str(label_file), '--out', str(score_file)], check=True)
values = json.loads(score_file.read_text())['scores']
if [score['id'] for score in values] != [row['id'] for row in predictions]:
    raise RuntimeError('Missing, duplicate or reordered score identities')
for row, score in zip(rows, values):
    row['rawQaF1'] = score['rawQaF1']
    row['operationalAdjustedQaF1'] = row['rawQaF1'] if row['complete'] else 0.0
result = {'protocol': m['protocol'], 'manifestSha256': ledger['manifestSha256'],
    'summarizerSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
    'rows': rows, 'independentSemanticReview': 'not performed', 'limitations': m['limitations']}
(out / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps([{key: row[key] for key in ['tool', 'persistent', 'complete', 'threadIdentityValid', 'rawQaF1', 'elapsedSeconds']} for row in rows], indent=2))
