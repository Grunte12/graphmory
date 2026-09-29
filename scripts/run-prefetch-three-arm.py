#!/usr/bin/env python3
"""Execute frozen Basic/Graph/Graph-prefetch live arms without answer labels."""
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
if m['protocol'] != 'prefetch-three-arm-development-v1' or out.exists():
    raise RuntimeError('Unknown protocol or existing output')
for name, expected in m['sourceHashes'].items():
    if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
        raise RuntimeError('Frozen source drift: ' + name)
for case in m['cases']:
    reader = prepared / str(case['caseIndex']) / 'reader-input.json'
    if hashlib.sha256(reader.read_bytes()).hexdigest() != case['readerSha256']:
        raise RuntimeError('Frozen reader input changed')
out.mkdir(parents=True, mode=0o700)
ledger = {'protocol': m['protocol'], 'manifestSha256': hashlib.sha256(manifest_bytes).hexdigest(),
          'indexBuilds': [], 'attempts': [], 'stopped': None}
def save():
    (out / 'ledger.json').write_text(json.dumps(ledger, indent=2) + '\n')
save()
for case in m['cases']:
    index = case['caseIndex']
    destination = out / ('index-' + str(index))
    child = subprocess.run(['python3', str(root / 'scripts/prepare-basic-memory-live-index.py'),
        '--input', str(prepared / str(index) / 'reader-input.json'), '--out', str(destination)],
        capture_output=True, text=True)
    (out / ('index-' + str(index) + '.log')).write_text(child.stdout + '\n' + child.stderr)
    report_file = destination / 'index-report.json'
    report = json.loads(report_file.read_text()) if report_file.exists() else None
    row = {'caseIndex': index, 'id': case['id'], 'exitCode': child.returncode,
           'report': str(report_file.relative_to(out)) if report else None,
           'stopReason': None if child.returncode == 0 and report else 'native-index-preflight-failed'}
    ledger['indexBuilds'].append(row)
    save()
    print(json.dumps({'indexCase': index, 'exitCode': child.returncode, 'stopReason': row['stopReason']}), flush=True)

c = m['configuration']
for index, trial in enumerate(m['executionOrder']):
    native = ledger['indexBuilds'][trial['caseIndex']]
    if native['exitCode']:
        row = dict(trial, index=index, attempted=False, exitCode=None, report=None,
                   stopReason='native-index-preflight-failed')
        ledger['attempts'].append(row); save()
        print(json.dumps({'trial': index, 'tool': trial['tool'], 'stopReason': row['stopReason']}), flush=True)
        continue
    target = out / ('trial-' + str(index))
    command = ['python3', str(root / 'scripts/run-curator-paging-pilot.py'),
               '--input', str(prepared / str(trial['caseIndex']) / 'reader-input.json'),
               '--out', str(target), '--model', c['curator'], '--lead-model', c['lead'],
               '--mode', c['mode'], '--max-rounds', str(c['maxRounds']),
               '--max-input-bytes', str(c['maxInputBytes']), '--structured-citations']
    if trial['tool'] == 'basic':
        command += ['--basic-config', str(out / ('index-' + str(trial['caseIndex'])) / 'basic-config.json')]
    elif trial['tool'] == 'prefetch':
        command += ['--prefetch-wide-originals']
    elif trial['tool'] != 'graph':
        raise RuntimeError('Unknown treatment')
    child = subprocess.run(command, capture_output=True, text=True)
    (out / ('trial-' + str(index) + '.log')).write_text(child.stdout + '\n' + child.stderr)
    report_file = target / 'report.json'
    report = json.loads(report_file.read_text()) if report_file.exists() else None
    row = dict(trial, index=index, attempted=True, exitCode=child.returncode,
               report=str(report_file.relative_to(out)) if report else None,
               stopReason=report['stopReason'] if report else 'runner-failed-before-report')
    ledger['attempts'].append(row); save()
    print(json.dumps({'trial': index, 'id': trial['id'], 'tool': trial['tool'],
                      'exitCode': child.returncode, 'stopReason': row['stopReason']}), flush=True)
    if report and any(call.get('failureKind') in ('usage-limit', 'unsupported-model') for call in report['modelCalls']):
        ledger['stopped'] = 'host unavailable; remaining slots unattempted'
        save()
        break
