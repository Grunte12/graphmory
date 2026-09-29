#!/usr/bin/env python3
"""Score all frozen three-arm slots and audit native index/source identities."""
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
if out.exists(): raise RuntimeError('Preserve earlier summary')
root = pathlib.Path(__file__).resolve().parents[1]
manifest_bytes = (prepared / 'manifest.json').read_bytes()
m = json.loads(manifest_bytes)
ledger = json.loads((runs / 'ledger.json').read_text())
if m['protocol'] != 'prefetch-three-arm-development-v1' or ledger['manifestSha256'] != hashlib.sha256(manifest_bytes).hexdigest():
    raise RuntimeError('Protocol or manifest drift')
if len(m['executionOrder']) != m['plannedTrials'] or len(ledger['indexBuilds']) != len(m['cases']):
    raise RuntimeError('Frozen plan/index accounting drift')
if [row['caseIndex'] for row in ledger['indexBuilds']] != list(range(len(m['cases']))):
    raise RuntimeError('Index order drift')
attempts = ledger['attempts']
if len(attempts) < m['plannedTrials'] and not ledger['stopped']: raise RuntimeError('Pending slots cannot be scored')
if len({row['index'] for row in attempts}) != len(attempts): raise RuntimeError('Duplicate attempt')
if [row['index'] for row in attempts] != list(range(len(attempts))) or len(attempts) > m['plannedTrials']:
    raise RuntimeError('Unknown or unordered slot')
labels, index_builds = [], []
for case, build in zip(m['cases'], ledger['indexBuilds']):
    folder = prepared / str(case['caseIndex'])
    if hashlib.sha256((folder / 'reader-input.json').read_bytes()).hexdigest() != case['readerSha256']:
        raise RuntimeError('Reader input drift')
    data = (folder / 'labels.json').read_bytes()
    if hashlib.sha256(data).hexdigest() != case['labelsSha256']: raise RuntimeError('Label drift')
    label = json.loads(data)[0]
    if label['id'] != case['id']: raise RuntimeError('Label identity drift')
    labels.append(label)
    report = None
    if build['report']:
        file = (runs / build['report']).resolve()
        if not file.is_relative_to(runs): raise RuntimeError('Unsafe index report path')
        report = json.loads(file.read_text())
        if report['id'] != case['id'] or report['inputSha256'] != case['readerSha256'] or report['builderSha256'] != m['sourceHashes']['scripts/prepare-basic-memory-live-index.py']:
            raise RuntimeError('Native index identity/runtime drift')
        if report['version'] != '0.23.2' or report['indexed'] != case['noteCount'] or report['embeddingErrors'] != 0 or report['embedded'] < 1:
            raise RuntimeError('Native hybrid index incomplete')
        if report['originalSourceHashes'] != case['originalHashes']:
            raise RuntimeError('Native index source drift')
    if (build['exitCode'] == 0) != bool(report): raise RuntimeError('Index completion drift')
    index_builds.append({'caseIndex': case['caseIndex'], 'id': case['id'], 'exitCode': build['exitCode'],
                         'stopReason': build['stopReason'], 'report': report})

rows, predictions, score_labels = [], [], []
for index, trial in enumerate(m['executionOrder']):
    attempt = attempts[index] if index < len(attempts) else None
    case = m['cases'][trial['caseIndex']]
    if trial['id'] != case['id'] or trial['tool'] not in ('basic', 'graph', 'prefetch'):
        raise RuntimeError('Invalid treatment identity')
    report = None
    if attempt:
        if any(attempt[key] != trial[key] for key in trial): raise RuntimeError('Treatment/order drift')
        if attempt['report']:
            file = (runs / attempt['report']).resolve()
            if not file.is_relative_to(runs): raise RuntimeError('Unsafe report path')
            report = json.loads(file.read_text())
            c = m['configuration']
            if report['id'] != trial['id'] or report['inputSha256'] != case['readerSha256'] or report['runnerSha256'] != m['sourceHashes']['scripts/run-curator-paging-pilot.py']:
                raise RuntimeError('Runner identity/runtime drift')
            if any(report[key] != c[key] for key in ['mode','maxRounds','maxInputBytes','persistentCurator','compactFollowup','structuredCitations']):
                raise RuntimeError('Runner config drift')
            if report['model'] != c['curator'] or report['leadModel'] != c['lead'] or report['prefetchWideOriginals'] != (trial['tool'] == 'prefetch') or report['evidenceState']:
                raise RuntimeError('Model/treatment drift')
            if report['retrieval'] != ('basic-memory-hybrid' if trial['tool'] == 'basic' else 'graphmory-managed'):
                raise RuntimeError('Wrong native retrieval tool')
    calls, reads = (report['modelCalls'], report['sourceReads']) if report else ([], [])
    if len({row['path'] for row in reads}) != len(reads): raise RuntimeError('Duplicate original read')
    for source in reads:
        expected = case['originalHashes'].get(source['path'])
        if not expected or source.get('originalSha256', source['sha256']) != expected:
            raise RuntimeError('Unknown or mutated original source')
    if report and (report.get('prefetch') or {}).get('status') == 'ready':
        if trial['tool'] != 'prefetch' or {row['path'] for row in reads} != set(case['originalHashes']) or any(row.get('transport') != 'recall-prefetch' for row in reads):
            raise RuntimeError('Prefetch delivery incomplete')
    complete = bool(report and report['runComplete'] and attempt['exitCode'] == 0)
    usage = {key: sum((call.get('usage') or {}).get(key, 0) for call in calls) for key in ['input_tokens','cached_input_tokens','output_tokens','reasoning_output_tokens']}
    row = dict(trial, index=index, attempted=bool(attempt and attempt['attempted']), complete=complete,
        stopReason=report['stopReason'] if report else attempt['stopReason'] if attempt else 'unattempted-host-stop',
        answer=report['answer'] if report else None, brief=report['brief'] if report else None,
        citations=report.get('citations') if report else None, citationIdentityValid=report.get('citationProvenanceValid') if report else None,
        prefetch=report.get('prefetch') if report else None, pages=report['pages'] if report else [], sourceReads=reads,
        modelCalls=calls, observedUsage=usage, usageFullyObserved=bool(calls) and all(call.get('usage') is not None for call in calls),
        elapsedSeconds=report.get('elapsedSeconds') if report else None,
        goldNotesRead=len({source['path'] for source in reads}.intersection(labels[trial['caseIndex']]['goldPaths'])),
        goldNotes=len(labels[trial['caseIndex']]['goldPaths']))
    rows.append(row)
    score_id = trial['id'] + ':' + str(index)
    predictions.append({'id': score_id, 'prediction': row['answer'] or ''})
    score_labels.append({**labels[trial['caseIndex']], 'id': score_id})

out.mkdir(parents=True)
prediction_file, label_file, score_file = out/'predictions.json', out/'labels.json', out/'raw-scores.json'
prediction_file.write_text(json.dumps(predictions)); label_file.write_text(json.dumps(score_labels))
subprocess.run([sys.executable, str(root/'scripts/eval-locomo-official-qa.py'), '--source', a.scorer_source,
    '--predictions', str(prediction_file), '--labels', str(label_file), '--out', str(score_file)], check=True)
scores = json.loads(score_file.read_text())['scores']
if [score['id'] for score in scores] != [row['id'] for row in predictions]: raise RuntimeError('Score identity/order drift')
for row, score in zip(rows, scores):
    row['rawQaF1'] = score['rawQaF1']
    row['operationalAdjustedQaF1'] = row['rawQaF1'] if row['complete'] else 0.0
result = {'protocol': m['protocol'], 'manifestSha256': ledger['manifestSha256'],
          'summarizerSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
          'indexBuilds': index_builds, 'rows': rows, 'independentSemanticReview': 'not performed',
          'limitations': m['limitations']}
(out/'summary.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps([{'id': row['id'], 'tool': row['tool'], 'complete': row['complete'],
                   'answer': row['answer'], 'seconds': row['elapsedSeconds'], 'rawQaF1': row['rawQaF1']}
                  for row in rows], indent=2))
