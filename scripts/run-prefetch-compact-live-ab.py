#!/usr/bin/env python3
"""Execute frozen fresh Curator/Lead full-vs-compact trials, preserving failures."""
import argparse
import hashlib
import json
import os
import pathlib
import subprocess

p = argparse.ArgumentParser()
for name in ('prepared', 'out'): p.add_argument('--' + name, required=True)
a = p.parse_args()
prepared, out = pathlib.Path(a.prepared).resolve(), pathlib.Path(a.out).resolve()
root = pathlib.Path(__file__).resolve().parents[1]
manifest_bytes = (prepared/'manifest.json').read_bytes()
m = json.loads(manifest_bytes)
if m['protocol'] != 'prefetch-compact-live-development-ab-v1' or out.exists():
    raise RuntimeError('Unknown protocol or existing output')
for name, expected in m['sourceHashes'].items():
    if hashlib.sha256((root/name).read_bytes()).hexdigest() != expected:
        raise RuntimeError('Frozen source drift: ' + name)
config = prepared/'runtime-config.json'
if hashlib.sha256(config.read_bytes()).hexdigest() != m['configSha256']:
    raise RuntimeError('Frozen config drift')
for case in m['cases']:
    folder = prepared/str(case['caseIndex'])
    if hashlib.sha256((folder/'reader-input.json').read_bytes()).hexdigest() != case['readerSha256']:
        raise RuntimeError('Reader input drift')
    if hashlib.sha256((folder/'labels.json').read_bytes()).hexdigest() != case['labelsSha256']:
        raise RuntimeError('Label drift')
    vault = folder/'vault'
    if {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in vault.glob('*.md')} != case['originalHashes']:
        raise RuntimeError('Source drift')
out.mkdir(parents=True, mode=0o700)
ledger = {'protocol': m['protocol'], 'manifestSha256': hashlib.sha256(manifest_bytes).hexdigest(),
          'attempts': [], 'stopped': None}
def save(): (out/'ledger.json').write_text(json.dumps(ledger, indent=2) + '\n')
save()
env = dict(os.environ, GRAPHMORY_CONFIG_PATH=str(config))
for index, trial in enumerate(m['executionOrder']):
    c = m['configuration']
    target = out/('trial-' + str(index))
    command = ['python3', str(root/'scripts/run-curator-paging-pilot.py'), '--input',
               str(prepared/str(trial['caseIndex'])/'reader-input.json'), '--out', str(target),
               '--model', c['curator'], '--lead-model', c['lead'], '--mode', c['mode'],
               '--max-rounds', str(c['maxRounds']), '--max-input-bytes', str(c['maxInputBytes']),
               '--structured-citations', '--prefetch-wide-originals']
    if trial['arm'] == 'compact': command.append('--compact-prefetch')
    elif trial['arm'] != 'full': raise RuntimeError('Unknown frozen arm')
    child = subprocess.run(command, capture_output=True, text=True, env=env)
    (out/('trial-' + str(index) + '.log')).write_text(child.stdout + '\n' + child.stderr)
    report_file = target/'report.json'
    report = json.loads(report_file.read_text()) if report_file.exists() else None
    row = dict(trial, index=index, attempted=True, exitCode=child.returncode,
               report=str(report_file.relative_to(out)) if report else None,
               stopReason=report['stopReason'] if report else 'runner-failed-before-report')
    ledger['attempts'].append(row); save()
    print(json.dumps({'trial': index, 'id': trial['id'], 'arm': trial['arm'],
                      'exitCode': child.returncode, 'stopReason': row['stopReason']}), flush=True)
    if report and any(call.get('failureKind') in ('usage-limit', 'unsupported-model') for call in report['modelCalls']):
        ledger['stopped'] = 'host unavailable; remaining slots unattempted'
        save(); break
