#!/usr/bin/env python3
"""Source-free records of all planned native Curator slots; no answer scoring."""
import argparse
import hashlib
import json
import pathlib

parser = argparse.ArgumentParser()
parser.add_argument('--manifest', required=True)
parser.add_argument('--runs', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args()
manifest_file = pathlib.Path(args.manifest)
manifest = json.loads(manifest_file.read_text())
runs = pathlib.Path(args.runs)
ledger = json.loads((runs / 'ledger.json').read_text())
if ledger['manifestSha256'] != hashlib.sha256(manifest_file.read_bytes()).hexdigest():
    raise RuntimeError('Manifest binding mismatch')
if [(r['id'], r['arm']) for r in ledger['attempts']] != [(r['id'], r['arm']) for r in manifest['order']]:
    raise RuntimeError('Attempt accounting mismatch')
out = pathlib.Path(args.out)
if out.exists():
    raise RuntimeError('Preserve prior summaries')
result = {'protocol': 'ranked-native-feasibility-summary-v1', 'manifestSha256': ledger['manifestSha256'],
          'planned': len(ledger['attempts']), 'attempted': 0, 'completed': 0, 'failed': 0,
          'unattempted': 0, 'stopped': ledger['stopped'], 'rows': [],
          'limitations': ['Two exposed development questions; no independent calibrated support labels',
                          'No official answer scoring or monetary cost estimate',
                          'One generation per arm; cache/order effects prohibit causal efficiency or tail claims']}
settings = manifest['configuration']
keep = ['id', 'question', 'retrieval', 'model', 'leadModel', 'maxRounds', 'maxInputBytes',
        'sourceIndex', 'rankedOriginals', 'rankedOriginalsDelivery', 'runnerSha256', 'inputSha256',
        'pages', 'sourceReads', 'sourceToolCalls', 'sourceRequests', 'sourceRequestErrors',
        'brief', 'answer', 'citations', 'citationProvenanceValid', 'runComplete', 'stopReason', 'elapsedSeconds']
usage_fields = ['input_tokens', 'cached_input_tokens', 'cache_write_input_tokens',
                'output_tokens', 'reasoning_output_tokens']
for attempt in ledger['attempts']:
    row = dict(attempt)
    status = row['status']
    if status not in ['complete', 'failed', 'unattempted']:
        raise RuntimeError('Pending or unknown slot status')
    result['completed' if status == 'complete' else status] += 1
    if status != 'unattempted':
        result['attempted'] += 1
        if row.get('report') is None:
            row['unavailableReport'] = True
            result['rows'].append(row)
            continue
        file = (runs / row['report']).resolve()
        if not file.is_relative_to(runs.resolve()):
            raise RuntimeError('Report outside run scope')
        raw = file.read_bytes()
        report = json.loads(raw)
        if (report['id'] != row['id'] or report['model'] != settings['curator']
            or report['leadModel'] != settings['lead']
            or report['maxRounds'] != settings['maxRounds']
            or report['maxInputBytes'] != settings['maxInputBytes']
            or report['sourceIndex'] is not True
            or report['rankedOriginals'] is not (row['arm'] == 'ranked')
            or report['runComplete'] is not (status == 'complete')
            or (row['arm'] == 'basic') != (report['retrieval'] == 'basic-memory-hybrid')):
            raise RuntimeError('Arm identity/configuration mismatch')
        row['reportSha256'] = hashlib.sha256(raw).hexdigest()
        row['record'] = {key: report[key] for key in keep if key in report}
        calls = [{key: value for key, value in call.items() if key != 'warnings'} for call in report['modelCalls']]
        row['record']['modelCalls'] = calls
        observed = [call['usage'] for call in calls if isinstance(call.get('usage'), dict)]
        row['unreportedUsageCalls'] = len(calls) - len(observed)
        row['usageObserved'] = {key: sum(u[key] for u in observed) if observed and all(key in u for u in observed) else None for key in usage_fields}
        gross, cached = row['usageObserved']['input_tokens'], row['usageObserved']['cached_input_tokens']
        row['noncachedInputObserved'] = gross - cached if gross is not None and cached is not None else None
        row['originalsRead'] = len(report['sourceReads'])
        row['sourceBytesRead'] = sum(source['bytes'] for source in report['sourceReads'])
        row['searchStdoutBytes'] = sum(page['toolOutputBytes'] for page in report['pages'])
        row['readStdoutBytes'] = sum(call['toolOutputBytes'] for call in report['sourceToolCalls'])
    result['rows'].append(row)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: result[key] for key in ['planned', 'attempted', 'completed', 'failed', 'unattempted', 'stopped']}))
