#!/usr/bin/env python3
"""Replay request classification only; never reclassify original workflow outcomes."""
import argparse
import ast
import hashlib
import json
import pathlib

parser = argparse.ArgumentParser()
parser.add_argument('--runs', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args()
runs, out = pathlib.Path(args.runs).resolve(), pathlib.Path(args.out).resolve()
if out.exists():
    raise RuntimeError('Preserve previous audits')
runner = pathlib.Path(__file__).resolve().parent / 'run-curator-paging-pilot.py'
source = runner.read_bytes()
nodes = [n for n in ast.parse(source).body if isinstance(n, ast.FunctionDef) and n.name == 'classify_source_requests']
if len(nodes) != 1:
    raise RuntimeError('Expected request classifier')
namespace = {}
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(runner), 'exec'), namespace)
rows = []
for file in sorted(runs.glob('*/report.json')):
    report_bytes = file.read_bytes()
    report = json.loads(report_bytes)
    if report['stopReason'] != 'Invalid, unseen or repeated source request':
        continue
    traces = sorted(file.parent.glob('*-curator.jsonl'), key=lambda p: int(p.name.split('-')[0]))
    if not traces:
        raise RuntimeError('Missing stopped Curator trace')
    trace = traces[-1].read_bytes()
    events = [json.loads(line) for line in trace.splitlines() if line.startswith(b'{')]
    outputs = [event['item']['text'] for event in events if event.get('type') == 'item.completed'
               and event.get('item', {}).get('type') == 'agent_message']
    response = json.loads(outputs[-1])
    available = {name for page in report['pages'] for name in page['paths']}
    read = {row['path'] for row in report['sourceReads']}
    try:
        unique, unread, reused = namespace['classify_source_requests'](response['read_paths'], available, read)
        accepted = True
    except RuntimeError:
        unique, unread, reused, accepted = [], [], [], False
    rows.append({'id': report['id'], 'coveragePreviews': report['coveragePreviews'],
                 'originalStopReason': report['stopReason'], 'reportSha256': hashlib.sha256(report_bytes).hexdigest(),
                 'lastCuratorTraceSha256': hashlib.sha256(trace).hexdigest(), 'requested': response['read_paths'],
                 'newClassifierAccepted': accepted, 'unique': unique, 'new': unread, 'reused': reused,
                 'originalWorkflowComplete': report['runComplete']})
result = {'protocol': 'reader-repeat-classification-frozen-trace-v1',
          'classifierSourceSha256': hashlib.sha256(source).hexdigest(), 'rows': rows,
          'limitations': ['Only request classification is replayed, not any model generation or answer',
                          'Original workflows and official scores remain unchanged',
                          'No primary supported-complete or competitor acceptance evidence']}
out.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'audited': len(rows), 'acceptedForReuse': sum(row['newClassifierAccepted'] for row in rows)}))
