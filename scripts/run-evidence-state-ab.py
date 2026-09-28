#!/usr/bin/env python3
"""Run all frozen mechanical-coverage trials; never load answer labels."""
import argparse
import hashlib
import json
import pathlib
import subprocess

p = argparse.ArgumentParser()
p.add_argument('--prepared', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
prepared, out = pathlib.Path(a.prepared).resolve(), pathlib.Path(a.out).resolve()
root = pathlib.Path(__file__).resolve().parents[1]
manifest_bytes = (prepared / 'manifest.json').read_bytes()
m = json.loads(manifest_bytes)
if m['protocol'] != 'curator-mechanical-evidence-state-development-ab-v1' or out.exists():
    raise RuntimeError('Unknown protocol or existing output')
for name, expected in m['sourceHashes'].items():
    if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
        raise RuntimeError('Frozen source drift')
reader = prepared / 'reader-input.json'
if hashlib.sha256(reader.read_bytes()).hexdigest() != m['readerInputSha256']:
    raise RuntimeError('Input drift')
out.mkdir(parents=True, mode=0o700)
ledger = {'manifestSha256': hashlib.sha256(manifest_bytes).hexdigest(), 'attempts': [], 'stopped': None}
def save():
    (out / 'ledger.json').write_text(json.dumps(ledger, indent=2) + '\n')
save()
c = m['configuration']
for index, trial in enumerate(m['executionOrder']):
    target = out / str(index)
    command = ['python3', str(root / 'scripts/run-curator-paging-pilot.py'), '--input', str(reader), '--out', str(target),
        '--case-index', str(trial['caseIndex']), '--model', c['curator'], '--lead-model', c['lead'], '--mode', c['mode'],
        '--max-rounds', str(c['maxRounds']), '--max-input-bytes', str(c['maxInputBytes']), '--structured-citations']
    if trial['evidenceState']: command.append('--evidence-state')
    child = subprocess.run(command, capture_output=True, text=True)
    (out / (str(index) + '.log')).write_text(child.stdout + '\n' + child.stderr)
    file = target / 'report.json'
    report = json.loads(file.read_text()) if file.exists() else None
    row = dict(trial, index=index, exitCode=child.returncode, report=str(file.relative_to(out)) if report else None,
        complete=bool(report and report['runComplete'] and child.returncode == 0),
        stopReason=report['stopReason'] if report else 'runner-failed-before-report')
    ledger['attempts'].append(row)
    save()
    print(json.dumps(row), flush=True)
    if report and any(call.get('failureKind') in ('usage-limit', 'unsupported-model') for call in report['modelCalls']):
        ledger['stopped'] = 'host unavailable; remaining trials unattempted'
        save()
        break
