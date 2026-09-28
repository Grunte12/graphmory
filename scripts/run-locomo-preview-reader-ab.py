#!/usr/bin/env python3
"""Execute frozen development A/B without loading answers; preserve every attempt."""
import argparse
import hashlib
import json
import pathlib
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--prepared', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args()
prepared = pathlib.Path(args.prepared).resolve()
out = pathlib.Path(args.out).resolve()
root = pathlib.Path(__file__).resolve().parents[1]
manifest = json.loads((prepared / 'manifest.json').read_text())
if manifest['protocol'] not in ('locomo-preview-reader-development-ab-v1', 'locomo-idempotent-targeted-development-v1'):
    raise RuntimeError('Unknown protocol')
if out.exists():
    raise RuntimeError('Preserve existing runs')
for name, expected in manifest['sourceHashes'].items():
    if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
        raise RuntimeError('Frozen runtime changed: ' + name)
if hashlib.sha256((prepared / 'reader-input.json').read_bytes()).hexdigest() != manifest['readerInputSha256']:
    raise RuntimeError('Reader input changed')
out.mkdir(parents=True, mode=0o700)
ledger = {'protocol': manifest['protocol'], 'manifestSha256': hashlib.sha256((prepared / 'manifest.json').read_bytes()).hexdigest(),
          'runnerSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
          'plannedTrials': len(manifest['executionOrder']), 'attempts': [], 'stopped': None}
config = manifest['configuration']
for index, trial in enumerate(manifest['executionOrder']):
    target = out / ('%02d-%s-%s' % (index, trial['id'].replace(':', '-'), trial['arm']))
    command = ['python3', str(root / 'scripts/run-curator-paging-pilot.py'), '--input', str(prepared / 'reader-input.json'),
               '--out', str(target), '--case-index', str(trial['caseIndex']), '--model', config['curator'],
               '--lead-model', config['lead'], '--mode', config['mode'], '--max-rounds', str(config['maxRounds']),
               '--max-input-bytes', str(config['maxInputBytes']), '--structured-citations']
    if trial['arm'] == 'coverage':
        command.append('--coverage-previews')
    result = subprocess.run(command, text=True, capture_output=True)
    (out / ('%02d-runner.log' % index)).write_text(result.stdout + '\n' + result.stderr)
    report_path = target / 'report.json'
    report = json.loads(report_path.read_text()) if report_path.exists() else None
    row = dict(trial, attemptIndex=index, exitCode=result.returncode,
               report=target.name + '/report.json' if report else None,
               complete=bool(report and report.get('runComplete')),
               stopReason=report.get('stopReason') if report else 'runner-failed-before-report')
    ledger['attempts'].append(row)
    # A host-wide limit cannot be fixed by blindly retrying other cases.
    if report and any(call.get('failureKind') in ('usage-limit', 'unsupported-model') for call in report['modelCalls']):
        ledger['stopped'] = 'host-unavailable; remaining trials unattempted, not successful'
    (out / 'ledger.json').write_text(json.dumps(ledger, indent=2) + '\n')
    print(json.dumps(row), flush=True)
    if ledger['stopped']:
        break
