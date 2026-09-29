#!/usr/bin/env python3
"""Execute a frozen native Curator session diagnostic without gold access."""
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
if m['protocol'] != 'native-curator-session-development-ab-v1' or out.exists():
    raise RuntimeError('Unknown protocol or existing output')
for name, expected in m['sourceHashes'].items():
    if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
        raise RuntimeError('Frozen runtime changed')
reader = prepared / 'reader-input.json'
if hashlib.sha256(reader.read_bytes()).hexdigest() != m['inputSha256']:
    raise RuntimeError('Reader input changed')
out.mkdir(parents=True, mode=0o700)
ledger = {'protocol': m['protocol'], 'manifestSha256': hashlib.sha256(manifest_bytes).hexdigest(),
          'batchRunnerSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
          'plannedTrials': m['plannedTrials'], 'attempts': [], 'stopped': None}
def save():
    (out / 'ledger.json').write_text(json.dumps(ledger, indent=2) + '\n')
save()
native = out / 'native-index'
build = subprocess.run(['python3', str(root / 'scripts/prepare-basic-memory-live-index.py'),
    '--input', str(reader), '--out', str(native)], text=True, capture_output=True)
(out / 'index.log').write_text(build.stdout + '\n' + build.stderr)
ledger['indexExitCode'] = build.returncode
save()
config = m['configuration']
for i, trial in enumerate(m['executionOrder']):
    target = out / (str(i) + '-' + trial['tool'] + ('-persistent' if trial['persistent'] else '-fresh'))
    if build.returncode:
        ledger['attempts'].append(dict(trial, index=i, complete=False, stopReason='native-index-preflight-failed', report=None))
        save()
        continue
    command = ['python3', str(root / 'scripts/run-curator-paging-pilot.py'), '--input', str(reader), '--out', str(target),
        '--model', config['curator'], '--lead-model', config['lead'], '--mode', config['mode'],
        '--max-rounds', str(config['maxRounds']), '--max-input-bytes', str(config['maxInputBytes']), '--structured-citations']
    if trial['tool'] == 'basic': command.extend(['--basic-config', str(native / 'basic-config.json')])
    if trial['persistent']: command.append('--persistent-curator')
    child = subprocess.run(command, text=True, capture_output=True)
    (out / (str(i) + '.log')).write_text(child.stdout + '\n' + child.stderr)
    file = target / 'report.json'
    report = json.loads(file.read_text()) if file.exists() else None
    threads = []
    if report:
        for n, call in enumerate(report['modelCalls']):
            if call['stage'] != 'curator': continue
            events = [json.loads(line) for line in (target / (str(n) + '-curator.jsonl')).read_text().splitlines() if line.startswith('{')]
            thread = next((e.get('thread_id') for e in events if e.get('type') == 'thread.started'), None)
            threads.append({'callIndex': n, 'threadSha256': hashlib.sha256(thread.encode()).hexdigest() if thread else None,
                            'reportedResumed': call['sessionResumed']})
    row = dict(trial, index=i, exitCode=child.returncode, complete=bool(report and report['runComplete']),
        report=str(file.relative_to(out)) if report else None,
        stopReason=report['stopReason'] if report else 'runner-failed-before-report', curatorThreads=threads)
    ledger['attempts'].append(row)
    save()
    print(json.dumps({key: row[key] for key in ['index', 'tool', 'persistent', 'complete', 'stopReason']}), flush=True)
    if report and any(call.get('failureKind') in ('usage-limit', 'unsupported-model') for call in report['modelCalls']):
        ledger['stopped'] = 'host unavailable; remaining trials unattempted, never successful'
        save()
        break
