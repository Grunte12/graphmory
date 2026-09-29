#!/usr/bin/env python3
"""Run frozen matched native memory tools; never load gold labels."""
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
if m['protocol'] != 'locomo-matched-native-reader-development-v1' or out.exists():
    raise RuntimeError('Unknown protocol or existing output')
for name, expected in m['sourceHashes'].items():
    if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
        raise RuntimeError('Frozen runtime changed: ' + name)
for case in m['cases']:
    if hashlib.sha256((prepared / case['folder'] / 'reader-input.json').read_bytes()).hexdigest() != case['inputSha256']:
        raise RuntimeError('Reader input changed')
out.mkdir(parents=True, mode=0o700)
ledger = {'protocol': m['protocol'], 'manifestSha256': hashlib.sha256(manifest_bytes).hexdigest(),
          'batchRunnerSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
          'plannedTrials': m['plannedTrials'], 'indices': [], 'attempts': [], 'stopped': None}
def save():
    (out / 'ledger.json').write_text(json.dumps(ledger, indent=2) + '\n')
save()
config = m['configuration']
for index, case in enumerate(m['cases']):
    reader = prepared / case['folder'] / 'reader-input.json'
    native = out / ('index-' + str(index))
    built = subprocess.run(['python3', str(root / 'scripts/prepare-basic-memory-live-index.py'),
        '--input', str(reader), '--out', str(native)], capture_output=True, text=True)
    (out / ('index-' + str(index) + '.log')).write_text(built.stdout + '\n' + built.stderr)
    index_report = native / 'index-report.json'
    ledger['indices'].append({'id': case['id'], 'exitCode': built.returncode,
                             'report': str(index_report.relative_to(out)) if index_report.exists() else None})
    save()
    for arm in case['armOrder']:
        trial = {'id': case['id'], 'caseFolder': case['folder'], 'arm': arm, 'attemptIndex': len(ledger['attempts'])}
        if built.returncode:
            ledger['attempts'].append(dict(trial, exitCode=None, complete=False, report=None, stopReason='native-index-preflight-failed'))
            save()
            continue
        target = out / (str(index) + '-' + arm)
        command = ['python3', str(root / 'scripts/run-curator-paging-pilot.py'), '--input', str(reader),
            '--out', str(target), '--model', config['curator'], '--lead-model', config['lead'],
            '--mode', config['mode'], '--max-rounds', str(config['maxRounds']),
            '--max-input-bytes', str(config['maxInputBytes']), '--structured-citations']
        if arm == 'basic': command.extend(['--basic-config', str(native / 'basic-config.json')])
        child = subprocess.run(command, capture_output=True, text=True)
        (out / (str(index) + '-' + arm + '.log')).write_text(child.stdout + '\n' + child.stderr)
        report_path = target / 'report.json'
        report = json.loads(report_path.read_text()) if report_path.exists() else None
        row = dict(trial, exitCode=child.returncode, complete=bool(report and report['runComplete']),
                   report=str(report_path.relative_to(out)) if report else None,
                   stopReason=report['stopReason'] if report else 'runner-failed-before-report')
        ledger['attempts'].append(row)
        save()
        print(json.dumps(row), flush=True)
        if report and any(call.get('failureKind') in ('usage-limit', 'unsupported-model') for call in report['modelCalls']):
            ledger['stopped'] = 'host-unavailable; remaining planned trials unattempted, never successful'
            save()
            break
    if ledger['stopped']: break
