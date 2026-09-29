#!/usr/bin/env python3
"""Account for all planned native reader trials and preserve pinned raw QA scores."""
import argparse
import hashlib
import json
import pathlib
import statistics
import subprocess
import sys

p = argparse.ArgumentParser()
for name in ['prepared', 'runs', 'scorer-source', 'out']: p.add_argument('--' + name, required=True)
a = p.parse_args()
prepared, runs, out = map(lambda name: pathlib.Path(name).resolve(), [a.prepared, a.runs, a.out])
if out.exists(): raise RuntimeError('Preserve prior summary')
root = pathlib.Path(__file__).resolve().parents[1]
manifest_bytes = (prepared / 'manifest.json').read_bytes()
m = json.loads(manifest_bytes)
ledger = json.loads((runs / 'ledger.json').read_text())
if ledger['manifestSha256'] != hashlib.sha256(manifest_bytes).hexdigest(): raise RuntimeError('Manifest drift')
expected = [(case['id'], arm) for case in m['cases'] for arm in case['armOrder']]
attempts = ledger['attempts']
if len(attempts) < len(expected) and not ledger['stopped']: raise RuntimeError('Pending batch cannot be scored')
if len({(row['id'], row['arm']) for row in attempts}) != len(attempts): raise RuntimeError('Duplicate attempts')
if [(row['id'], row['arm']) for row in attempts] != expected[:len(attempts)]: raise RuntimeError('Unknown or reordered attempt')
labels = []
for case in m['cases']:
    label_bytes = (prepared / case['folder'] / 'labels.json').read_bytes()
    if hashlib.sha256(label_bytes).hexdigest() != case['labelsSha256']: raise RuntimeError('Label drift')
    labels.extend(json.loads(label_bytes))
gold = {label['id']: label for label in labels}
if len(gold) != len(m['cases']): raise RuntimeError('Label ID mismatch')
out.mkdir(parents=True)
rows = []
for qid, arm in expected:
    attempt = next((row for row in attempts if row['id'] == qid and row['arm'] == arm), None)
    report = None
    if attempt and attempt['report']:
        file = (runs / attempt['report']).resolve()
        if not file.is_relative_to(runs): raise RuntimeError('Report escapes run root')
        report = json.loads(file.read_text())
        case = next(row for row in m['cases'] if row['id'] == qid)
        if report['id'] != qid or report['inputSha256'] != case['inputSha256'] or report['runnerSha256'] != m['sourceHashes']['scripts/run-curator-paging-pilot.py']:
            raise RuntimeError('Input or runner drift')
        if report['retrieval'] != ('basic-memory-hybrid' if arm == 'basic' else 'graphmory-managed'):
            raise RuntimeError('Comparator treatment drift')
        if report['model'] != m['configuration']['curator'] or report['leadModel'] != m['configuration']['lead']:
            raise RuntimeError('Model drift')
    calls = report['modelCalls'] if report else []
    reads = report['sourceReads'] if report else []
    paths = {row['path'] for row in reads}
    usage = {key: sum((call.get('usage') or {}).get(key, 0) for call in calls) for key in ['input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'output_tokens', 'reasoning_output_tokens']}
    complete = bool(report and report['runComplete'] and attempt['exitCode'] == 0)
    rows.append({'id': qid, 'arm': arm, 'category': gold[qid]['category'], 'attempted': attempt is not None,
        'complete': complete, 'stopReason': report['stopReason'] if report else attempt['stopReason'] if attempt else 'unattempted-host-stop',
        'answer': report['answer'] if report else None, 'brief': report['brief'] if report else None,
        'citations': report.get('citations') if report else None, 'citationIdentityValid': report.get('citationProvenanceValid') if report else None,
        'sourceReads': reads, 'pages': report['pages'] if report else [],
        'modelCalls': calls, 'observedUsage': usage, 'usageFullyObserved': bool(calls) and all(call.get('usage') is not None for call in calls),
        'elapsedSeconds': report.get('elapsedSeconds') if report else None,
        'goldNotesRead': len(paths.intersection(gold[qid]['goldPaths'])), 'goldNotes': len(gold[qid]['goldPaths']),
        'toolOutputBytes': sum(page.get('toolOutputBytes', 0) for page in report['pages']) + sum(call.get('toolOutputBytes', 0) for call in report.get('sourceToolCalls', [])) if report else None})
for arm in ['basic', 'graphmory']:
    selected = [row for row in rows if row['arm'] == arm]
    predictions = [{'id': row['id'], 'prediction': row['answer'] or ''} for row in selected]
    pred = out / (arm + '-predictions.json'); pred.write_text(json.dumps(predictions))
    label = out / (arm + '-labels.json'); label.write_text(json.dumps(labels))
    scores = out / (arm + '-scores.json')
    subprocess.run([sys.executable, str(root / 'scripts/eval-locomo-official-qa.py'), '--source', a.scorer_source,
        '--predictions', str(pred), '--labels', str(label), '--out', str(scores)], check=True)
    score_map = {row['id']: row['rawQaF1'] for row in json.loads(scores.read_text())['scores']}
    for row in selected:
        row['rawQaF1'] = score_map[row['id']]
        row['operationalAdjustedQaF1'] = row['rawQaF1'] if row['complete'] else 0.0
indices = []
for item in ledger['indices']:
    if item['report']:
        file = (runs / item['report']).resolve()
        if not file.is_relative_to(runs): raise RuntimeError('Unsafe index report path')
        index = json.loads(file.read_text())
        if index['builderSha256'] != m['sourceHashes']['scripts/prepare-basic-memory-live-index.py']:
            raise RuntimeError('Index builder drift')
        indices.append(index)
summary = {}
for arm in ['basic', 'graphmory']:
    selected = [row for row in rows if row['arm'] == arm]
    finished = [row for row in selected if row['complete']]
    summary[arm] = {'planned': len(selected), 'complete': len(finished),
        'meanRawQaF1AllPlanned': statistics.mean(row['rawQaF1'] for row in selected),
        'meanOperationalAdjustedQaF1AllPlanned': statistics.mean(row['operationalAdjustedQaF1'] for row in selected),
        'medianCompletedSeconds': statistics.median(row['elapsedSeconds'] for row in finished) if finished else None,
        'observedGrossInput': sum(row['observedUsage']['input_tokens'] for row in selected),
        'observedCachedInput': sum(row['observedUsage']['cached_input_tokens'] for row in selected),
        'usageFullyObserved': all(row['usageFullyObserved'] for row in selected)}
result = {'protocol': m['protocol'], 'manifestSha256': ledger['manifestSha256'],
    'summarizerSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
    'batchRunnerSha256': ledger['batchRunnerSha256'], 'scorerSha256': m['scorerSha256'],
    'summary': summary, 'rows': rows, 'indices': indices, 'independentSemanticReview': 'not performed',
    'limitations': m['limitations'] + ['Gold note reads and citation identity do not establish semantic entailment',
        'Usage without host counters is unknown; observed totals are lower bounds if usageFullyObserved=false',
        'Abstention phrase scoring is preserved separately from semantic correctness']}
(out / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(summary, indent=2))
