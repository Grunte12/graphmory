#!/usr/bin/env python3
"""Preserve all declared coverage arms and unchanged pinned QA scores."""
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
if out.exists(): raise RuntimeError('Preserve previous summary')
root = pathlib.Path(__file__).resolve().parents[1]
manifest_bytes = (prepared / 'manifest.json').read_bytes()
m = json.loads(manifest_bytes)
ledger = json.loads((runs / 'ledger.json').read_text())
if ledger['manifestSha256'] != hashlib.sha256(manifest_bytes).hexdigest(): raise RuntimeError('Manifest drift')
attempts = ledger['attempts']
if len(attempts) < len(m['executionOrder']) and not ledger['stopped']: raise RuntimeError('Pending trials cannot be scored')
if len({row['index'] for row in attempts}) != len(attempts): raise RuntimeError('Duplicate attempt')
if [row['index'] for row in attempts] != list(range(len(attempts))) or len(attempts) > len(m['executionOrder']):
    raise RuntimeError('Unknown or unordered attempt')
gold_bytes = (prepared / 'labels.json').read_bytes()
if hashlib.sha256(gold_bytes).hexdigest() != m['labelsSha256']: raise RuntimeError('Label drift')
gold = json.loads(gold_bytes)
if [row['id'] for row in gold] != m['selectedIds']: raise RuntimeError('Label identity/order drift')
rows, predictions, labels, label_bindings = [], [], [], []
for index, trial in enumerate(m['executionOrder']):
    attempt = attempts[index] if index < len(attempts) else None
    report = None
    if attempt:
        if any(attempt[key] != trial[key] for key in trial): raise RuntimeError('Treatment drift')
        if attempt['report']:
            file = (runs / attempt['report']).resolve()
            if not file.is_relative_to(runs): raise RuntimeError('Unsafe report path')
            report = json.loads(file.read_text())
            if report['id'] != trial['id'] or report['evidenceState'] != trial['evidenceState']:
                raise RuntimeError('Report identity/treatment drift')
            if report['inputSha256'] != m['readerInputSha256'] or report['runnerSha256'] != m['sourceHashes']['scripts/run-curator-paging-pilot.py']:
                raise RuntimeError('Frozen input/runtime drift')
            c = m['configuration']
            if any(report[key] != c[key] for key in ['mode','maxRounds','maxInputBytes','persistentCurator','compactFollowup','structuredCitations']) or report['model'] != c['curator'] or report['leadModel'] != c['lead']:
                raise RuntimeError('Configuration drift')
    label = gold[trial['caseIndex']]
    if label['id'] != trial['id']: raise RuntimeError('Case index drift')
    calls, reads = (report['modelCalls'], report['sourceReads']) if report else ([], [])
    complete = bool(report and report['runComplete'] and attempt['exitCode'] == 0)
    if attempt and attempt['complete'] != complete: raise RuntimeError('Completion accounting drift')
    if len({row['path'] for row in reads}) != len(reads) or any(m['originals'][trial['id']].get(row['path']) != row['sha256'] for row in reads):
        raise RuntimeError('Duplicate, unknown or mutated source read')
    usage = {key: sum((call.get('usage') or {}).get(key, 0) for call in calls) for key in ['input_tokens','cached_input_tokens','output_tokens','reasoning_output_tokens']}
    row = dict(trial, index=index, attempted=attempt is not None, complete=complete,
        stopReason=report['stopReason'] if report else 'unattempted-host-stop' if not attempt else attempt['stopReason'],
        answer=report['answer'] if report else None, brief=report['brief'] if report else None,
        citations=report.get('citations') if report else None, citationIdentityValid=report.get('citationProvenanceValid') if report else None,
        pages=report['pages'] if report else [], sourceReads=reads, modelCalls=calls,
        evidenceStateSnapshots=report['evidenceStateSnapshots'] if report else [],
        goldNotesRead=len({r['path'] for r in reads}.intersection(label['goldPaths'])), goldNotes=len(label['goldPaths']),
        observedUsage=usage, usageFullyObserved=bool(calls) and all(call.get('usage') is not None for call in calls),
        elapsedSeconds=report.get('elapsedSeconds') if report else None)
    rows.append(row)
    predictions.append({'id': trial['id'] + ':' + str(index), 'prediction': row['answer'] or ''})
    scorer_label = {**label, 'id': predictions[-1]['id']}
    # LoCoMo's adversarial rows omit answer. The unchanged upstream function
    # accesses this key but scores category 5 only from prediction phrases.
    # Bind an unused empty string, retain frozen source labels and record it.
    if 'answer' not in scorer_label and scorer_label['category'] == 5:
        scorer_label['answer'] = ''
        label_bindings.append({'id': scorer_label['id'], 'binding': 'unused missing category-5 answer -> empty string'})
    if 'answer' not in scorer_label: raise RuntimeError('Missing answerable reference')
    labels.append(scorer_label)
out.mkdir(parents=True)
pred_file, label_file, score_file = out/'predictions.json', out/'labels.json', out/'raw-scores.json'
pred_file.write_text(json.dumps(predictions)); label_file.write_text(json.dumps(labels))
subprocess.run([sys.executable, str(root/'scripts/eval-locomo-official-qa.py'), '--source', a.scorer_source,
    '--predictions', str(pred_file), '--labels', str(label_file), '--out', str(score_file)], check=True)
values = json.loads(score_file.read_text())['scores']
if [score['id'] for score in values] != [row['id'] for row in predictions]: raise RuntimeError('Score identity/order drift')
for row, score in zip(rows, values):
    row['rawQaF1'] = score['rawQaF1']
    row['operationalAdjustedQaF1'] = row['rawQaF1'] if row['complete'] else 0.0
result = {'protocol': m['protocol'], 'manifestSha256': ledger['manifestSha256'],
    'summarizerSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
    'rows': rows, 'scorerLabelBindings': label_bindings,
    'independentSemanticReview': 'not performed', 'limitations': m['limitations']}
(out/'summary.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps([{k:r[k] for k in ['id','evidenceState','complete','answer','goldNotesRead','elapsedSeconds','rawQaF1']} for r in rows], indent=2))
